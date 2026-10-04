import { assembleRequestAsync } from './assemble.js'
import { createDefaultRegistry } from './builtin-sources.js'
import { normalizePreset } from './model.js'
import { createHash } from 'node:crypto'
import { projectSystemSnapshots } from './system-snapshots.js'

export class RequestAssembler {
  constructor({ ctx, store, resources, registry = createDefaultRegistry() }) { this.ctx = ctx; this.store = store; this.resources = resources; this.registry = registry }
  sources() { return this.registry.list() }
  available() { return this.ctx.get('agentLoop')?.requestAssemblyVersion === 1 }
  requireAvailable() {
    if (!this.available()) throw Object.assign(new Error('This layout requires DSH request assembly protocol 1. Install the prepared core before applying it.'), { status: 409, code: 'REQUEST_ASSEMBLY_CORE_REQUIRED' })
  }
  selected(id) {
    if (!this.available() && this.store.hasSelection && !this.store.hasSelection(id)) return null
    return this.store.selection(id)
  }
  startsSeries(agent) {
    const selected = this.selected(agent.id)
    const last = agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly')?.data.metadata
    const revision = selected ? createHash('sha256').update(JSON.stringify(normalizePreset(selected))).digest('hex') : null
    return revision !== (last?.owner === 'pmp-dsh-tavern' ? last.assembly.preset.revision : null)
  }
  async execute(payload, next) {
    const base = await next(), preset = this.selected(payload.agent.id)
    if (!preset) return base
    this.requireAvailable()
    const snapshot = this.resources.assembledFor(payload.agent)
    if (!snapshot?.assemblyInput) throw new Error('Resource snapshot missing at request assembly')
    const events = payload.agent.session.snapshotEvents()
    const start = events.findLast(e => e.type === 'step/start')?.seq ?? -1
    const inputIds = events.filter(e => e.seq > start && e.type === 'user/message').map(e => e.data.id)
    const lastMetadata = events.findLast(e => e.type === 'request/assembly')?.data.metadata
    const previous = lastMetadata?.owner === 'pmp-dsh-tavern' ? lastMetadata.assembly : null
    const assets = { ...snapshot.assemblyInput, diagnostics: snapshot.diagnostics, officialSections: snapshot.officialAssembly?.sections ?? [] }
    const logical = await assembleRequestAsync({ registry: this.registry, sessionId: payload.agent.id, turn: payload.turn, step: payload.step, signal: payload.signal, preset, assets, nativeMessages: base.messages, inputIds, previous, snapshots: previous?.snapshots ?? [], maxBytes: this.resources.maxProfileBytes })
    // Complete snapshots repeat active instructions; their physical ceiling is independent of logical admission.
    const assembly = projectSystemSnapshots(logical, base.messages, undefined, { systemPromptUpdate: payload.agent.session.requestContext?.()?.systemPromptUpdate })
    if (!assembly.messages.length) throw Object.assign(new Error('提示词装配结果为空：请启用或填写至少一条内容。The assembled request is empty; enable or fill at least one item.'), { code: 'ASSEMBLY_EMPTY' })
    const { messages, ...metadata } = assembly
    return { messages, metadata: { owner: 'pmp-dsh-tavern', assembly: metadata, upstream: base.metadata ?? null } }
  }
  async preview({ preset, agent, sessionId, signal }) {
    const snapshot = this.resources.compile({ agent, sessionId, resolveOnly: true })
    // Historical system messages may still contain the old loader's assets.
    // Preview current core assembly independently, without committing any event.
    let nativeMessages = (agent?.session?.deriveMessages?.() ?? []).filter(m => m.role !== 'system')
    const diagnostics = [...(snapshot.diagnostics ?? [])]
    let officialSections = []
    const systemPrompt = this.ctx.get('systemPrompt')
    if (systemPrompt?.assemble) {
      const current = await systemPrompt.assemble({ agent, scope: agent, tavernAssemblyPreview: true })
      officialSections = current.sections
      const text = current.sections.map(section => section.interpolate === false ? section.text : section.text.replace(/\{\{([^{}]*)\}\}/g, (_, key) => {
        if (!/^[a-z][a-z0-9_]*$/.test(key) || typeof current.variables?.[key] !== 'string') throw new Error('Unresolved native preview variable')
        return current.variables[key]
      })).filter(Boolean).join('\n\n')
      if (text) nativeMessages.unshift({ id: 'preview-native-system', role: 'system', content: [{ type: 'text', text }], source: { kind: 'system-prompt' } })
    } else diagnostics.push({ code: 'NATIVE_SYSTEM_PREVIEW_UNAVAILABLE' })
    const logical = await assembleRequestAsync({ registry: this.registry, sessionId: sessionId ?? agent?.id ?? '', signal, preset, assets: { ...snapshot.assemblyInput, diagnostics, officialSections }, nativeMessages, preview: true, maxBytes: this.resources.maxProfileBytes })
    const assembly = projectSystemSnapshots(logical, nativeMessages, undefined, { preview: true })
    return { ...assembly, capability: this.available(), scope: 'current-resources-and-durable-history', pendingInputsIncluded: false }
  }
}
