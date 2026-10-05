import { hash, fail } from './policy.js'
import { WorldBookMemorySource } from './world-books.js'
import { PromptTemplateService, TEMPLATE_SOURCE } from '../prompt-template/service.js'
import { boundScope, boundSnapshot } from './bound-metadata.js'
export const MEMORY_SOURCE_SERVICE = 'tavernMemorySources'
export function createMemorySources(options) {
  const worldBooks = new WorldBookMemorySource(options)
  const templates = new PromptTemplateService({ ...options, worldBooks })
  let disposed = false
  return { protocolVersion: 1, adapters: [worldBooks, templates], worldBooks, templates,
    async listBound({ scope, signal } = {}) {
      scope = boundScope(scope); signal?.throwIfAborted()
      if (disposed || !options.getSession || !options.getSelection) fail('SOURCE_BOUND_UNAVAILABLE', 'Current session binding metadata is unavailable')
      const session = options.getSession(scope.sessionId), selection = hash(options.getSelection(scope.sessionId))
      if (!session) fail('SOURCE_BOUND_UNAVAILABLE', 'Session is not loaded')
      const sessionIdentity = hash([session.header?.id, session.header?.version, session.header?.createdAt])
      const mvu = options.getMvu?.(), snapshots = [worldBooks.listBound({ scope, signal }), templates.listBound({ scope, signal })]
      if (mvu) {
        if (typeof mvu.listBound !== 'function') fail('SOURCE_BOUND_UNSUPPORTED', 'MVU source does not expose bound metadata')
        snapshots.push(await mvu.listBound({ scope, signal }))
      }
      const items = snapshots.flatMap(snapshot => snapshot.items), revision = hash([selection, ...snapshots.map(s => s.revision)])
      const checkCurrent = () => {
        try { return !disposed && !signal?.aborted && options.getSession(scope.sessionId) === session && hash([session.header?.id, session.header?.version, session.header?.createdAt]) === sessionIdentity
          && items.every(row => row.binding.kind !== 'state-instance' || row.binding.instanceCreatedAt === session.header?.createdAt) && hash(options.getSelection(scope.sessionId)) === selection
          && options.getMvu?.() === mvu && snapshots.every(snapshot => snapshot.checkCurrent() === true) } catch { return false }
      }
      signal?.throwIfAborted()
      if (!checkCurrent()) fail('SOURCE_BOUND_CHANGED', 'Current bindings changed during lookup')
      return boundSnapshot(items, revision, checkCurrent)
    },
    dispose() { disposed = true; worldBooks.dispose(); templates.dispose() },
    validateAssembly(assembly) {
      for (const snapshot of assembly?.snapshots ?? []) if (snapshot.source?.sourceId === 'worldbook' && worldBooks.policy.mode(`world-book:${snapshot.source.resourceId}`) === 'managed') {
        fail('MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED', 'Managed world books require request lifetime; retained native snapshots cannot bypass current policy')
      }
    },
    observeRequest(request, session) {
      if (!session?.id || (request.sessionId && request.sessionId !== session.id)) return
      const event = session?.snapshotEvents?.().findLast(e => e.type === 'request/assembly')
      if (!Number.isSafeInteger(event?.seq) || event.data.metadata?.owner !== 'pmp-dsh-tavern' || hash(event.data.messages) !== hash(request.messages)) return
      const assembly = event.data.metadata.assembly
      if (!assembly || assembly.preview) return
      const flatten = nodes => nodes.flatMap(n => [n, ...flatten(n.children ?? [])])
      const nodes = flatten(assembly.nodes ?? [])
      for (const fact of assembly.diagnostics ?? []) {
        if (fact.code === 'WORLD_BOOK_POLICY_SKIPPED') {
          // Only current source-authored diagnostics carry enough identity and
          // revision evidence for a receipt. Older incomplete diagnostics remain
          // readable in Trace, but are never replayed into the manager journal.
          if (fact.adapterId === worldBooks.id && fact.sourceId === 'worldbook' && typeof fact.resourceId === 'string'
            && fact.resourceId.startsWith('world-book:') && typeof fact.revision === 'string' && typeof fact.reason === 'string') {
            const requestId = `${session.id}:${event.seq}`
            worldBooks.policy.emit({ id: fact.resourceId, eventId: `${requestId}:worldbook-policy:${fact.resourceId}`, requestId,
              phase: 'skipped', reason: fact.reason, code: fact.code, sessionId: session.id, turn: event.data.turn, turnKind: 'unknown',
              revision: fact.revision, managementMode: fact.managementMode, configRevision: fact.configRevision ?? null,
              detail: `World-book request contribution skipped by source policy: ${fact.reason}` })
          }
          continue
        }
        if (!['TAVERN_MEMORY_RESOURCE_VERSION', 'TAVERN_MEMORY_DEPENDENCY_VERSION'].includes(fact.code)) continue
        const source = [worldBooks, templates].find(a => a.id === fact.adapterId)
        if (!source || !nodes.some(n => n.source?.sourceId === fact.sourceId && n.source?.resourceId === (fact.consumerId ?? fact.blockResourceId ?? fact.resourceId) && (n.id?.endsWith(`:${fact.blockId}`) || n.name === fact.blockId))) continue
        source.policy.emit({ id: fact.resourceId, eventId: `${session.id}:${event.seq}:${fact.blockId}`, requestId: `${session.id}:${event.seq}`, phase: 'applied', sessionId: session.id,
          turn: event.data.turn, turnKind: 'unknown', ...(fact.consumerId ? {consumerId:fact.consumerId} : {}), revision: fact.revision, configRevision: fact.configRevision, detail: 'Observed in durable DSH request; provider delivery not established' })
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
