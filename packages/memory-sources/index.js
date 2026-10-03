import { hash, fail } from './policy.js'
import { WorldBookMemorySource } from './world-books.js'
import { PromptTemplateService, TEMPLATE_SOURCE } from '../prompt-template/service.js'
export const MEMORY_SOURCE_SERVICE = 'tavernMemorySources'
export function createMemorySources(options) {
  const worldBooks = new WorldBookMemorySource(options)
  const templates = new PromptTemplateService({ ...options, worldBooks })
  return { protocolVersion: 1, adapters: [worldBooks, templates], worldBooks, templates,
    dispose() { worldBooks.dispose(); templates.dispose() },
    validateAssembly(assembly) {
      for (const snapshot of assembly?.snapshots ?? []) if (snapshot.source?.sourceId === 'worldbook' && worldBooks.policy.mode(`world-book:${snapshot.source.resourceId}`) === 'managed') {
        fail('MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED', 'Managed world books require request lifetime; retained native snapshots cannot bypass current policy')
      }
    },
    observeRequest(request, session) {
      const event = session?.snapshotEvents?.().findLast(e => e.type === 'request/assembly')
      if (!event || event.data.metadata?.owner !== 'pmp-dsh-tavern' || hash(event.data.messages) !== hash(request.messages)) return
      const assembly = event.data.metadata.assembly
      if (assembly.preview) return
      const flatten = nodes => nodes.flatMap(n => [n, ...flatten(n.children ?? [])])
      const nodes = flatten(assembly.nodes ?? [])
      for (const fact of assembly.diagnostics ?? []) {
        if (fact.code !== 'TAVERN_MEMORY_RESOURCE_VERSION') continue
        const source = [worldBooks, templates].find(a => a.id === fact.adapterId)
        if (!source || !nodes.some(n => n.source?.sourceId === fact.sourceId && n.source?.resourceId === (fact.blockResourceId ?? fact.resourceId) && (n.id?.endsWith(`:${fact.blockId}`) || n.name === fact.blockId))) continue
        source.policy.emit({ id: fact.resourceId, eventId: `${session.id}:${event.seq}:${fact.blockId}`, requestId: `${session.id}:${event.seq}`, phase: 'applied', sessionId: session.id,
          turn: event.data.turn, turnKind: 'unknown', revision: fact.revision, configRevision: fact.configRevision, detail: 'Observed in durable DSH request; provider delivery not established' })
      }
    } }
}
export function installMemorySources(ctx, service, registry) {
  ctx.provide(MEMORY_SOURCE_SERVICE, service)
  ctx.effect(() => registry.register({ id: TEMPLATE_SOURCE, pluginId: 'pmp-dsh-tavern', name: '提示词模板 / Prompt Template (read-only subset)', stability: 'evaluation', lifetimes: ['request'],
    resolve: context => service.templates.resolve(context), validateResolved: service.templates.validateResolved }))
  ctx.on('llm/stream', async function* (request, next) { service.observeRequest(request, ctx.get('sessions')?.get(request.sessionId)); yield* next() })
  ctx.effect(() => () => service.dispose())
}
