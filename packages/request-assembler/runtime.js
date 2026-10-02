import { assembleRequest } from './assemble.js'
import { normalizePreset } from './model.js'
import { createHash } from 'node:crypto'

export class RequestAssembler {
  constructor({ ctx, store, resources }) { this.ctx = ctx; this.store = store; this.resources = resources }
  available() { return this.ctx.get('agentLoop')?.requestAssemblyVersion === 1 }
  requireAvailable() {
    if (!this.available()) throw Object.assign(new Error('This layout requires DSH request assembly protocol 1. Install the prepared core before applying it.'), { status: 409, code: 'REQUEST_ASSEMBLY_CORE_REQUIRED' })
  }
  selected(id) { return this.store.selection(id) }
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
    const assembly = assembleRequest({ preset, assets, nativeMessages: base.messages, inputIds, previous, snapshots: previous?.snapshots ?? [], maxBytes: this.resources.maxProfileBytes })
    const { messages, ...metadata } = assembly
    return { messages, metadata: { owner: 'pmp-dsh-tavern', assembly: metadata } }
  }
  preview({ preset, agent, sessionId }) {
    const snapshot = this.resources.compile({ agent, sessionId, resolveOnly: true })
    const nativeMessages = agent?.session?.deriveMessages?.() ?? []
    const assembly = assembleRequest({ preset, assets: { ...snapshot.assemblyInput, diagnostics: snapshot.diagnostics }, nativeMessages, preview: true, maxBytes: this.resources.maxProfileBytes })
    return { ...assembly, capability: this.available(), scope: 'current-resources-and-durable-history', pendingInputsIncluded: false }
  }
}
