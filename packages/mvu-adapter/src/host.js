import { timelineHead } from '../../play/src/timeline-tree.js'
import { MvuService } from './service.js'
import { fail } from './value.js'
import { createHash } from 'node:crypto'

export const MVU_SERVICE = 'tavernMvu'
export const MVU_SOURCE = 'tavern.mvu/state'

/** Install with public Cordis/DSH seams. No Helper runtime or manager dependency. */
export function installMvu(ctx, { storageDir, resources = [], sources, memberships, refresh, isActive, onError = () => {} } = {}) {
  const inspect = async id => { const live = ctx.get('sessions')?.get?.(id); return live ? { header: live.header, events: live.snapshotEvents() } : ctx.get('sessionController')?.inspect?.(id) }
  const service = new MvuService({ storageDir, resources, inspect, refresh, isActive, authorizeCardWrite: async request => {
    const authority = ctx.get('tavernRenderingAuthority')
    const grant = await authority?.resolve(request)
    return grant && ctx.get('tavernRenderingAuthority') === authority ? { ...grant, checkCurrent: () => ctx.get('tavernRenderingAuthority') === authority && authority.isCurrent?.(request) === true } : null
  }, async resolveScope(scope) {
    if (!scope || typeof scope.sessionId !== 'string') fail('MVU_SCOPE', 'Session scope required')
    if (!scope.playthroughId || !scope.nodeId || !scope.variantId || !Number.isSafeInteger(scope.endEventId)) fail('MVU_SCOPE', 'Durable message scope required')
    const playthrough = memberships?.readCatalog({ allowMissing: true })?.catalog.playthroughs.find(p => p.id === scope.playthroughId)
    if (!playthrough) fail('MVU_SCOPE', 'Unknown playthrough')
    const timeline = memberships.readTimeline(playthrough).timeline
    const node = timeline.nodes.find(n => n.id === scope.nodeId)
    const variant = node?.variants.find(v => v.id === scope.variantId)
    if (!variant || variant.sessionId !== scope.sessionId || variant.endEventId !== scope.endEventId
      || (scope.sessionFormatVersion != null && scope.sessionFormatVersion !== variant.ext?.pmpDshTavern?.sessionFormatVersion)) fail('MVU_SCOPE', 'Message scope no longer matches durable timeline')
    const live = ctx.get('sessions')?.get?.(scope.sessionId)
    const inspected = live ? { meta: live.header, events: live.snapshotEvents() } : await ctx.get('sessionController')?.inspect?.(scope.sessionId)
    if (!inspected || (scope.sessionFormatVersion != null && inspected.meta?.version !== scope.sessionFormatVersion)) fail('MVU_SCOPE', 'Durable session unavailable or changed')
    const event = inspected.events.find(e => e.seq === scope.endEventId)
    if (event?.type !== 'assistant/message' || event.data?.interrupted) fail('MVU_SCOPE', 'Snapshot does not point at a final assistant message')
    const text = (event.data.message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
    const head = timelineHead(timeline), lastReply = inspected.events.findLast(e => e.type === 'assistant/message'), lastEnd = inspected.events.findLast(e => e.type === 'turn/end'), lastStart = inspected.events.findLast(e => e.type === 'turn/start')
    const writableHead = head?.variantId === scope.variantId && head?.sessionId === scope.sessionId && lastReply?.seq === event.seq && lastEnd?.data?.reason?.kind === 'completed' && lastEnd.data.turn === event.data.turn && (!lastStart || lastStart.seq < lastEnd.seq)
    return { writableHead, messageId: event.data.message.id, fingerprint: createHash('sha256').update(JSON.stringify(text)).digest('hex') }
  } })
  ctx.provide(MVU_SERVICE, service)
  const schedule = async session => {
    if (!session?.snapshotEvents) return
    await refresh?.(session.id)
    const parent = session.header?.parentSession && ctx.get('sessions')?.get?.(session.header.parentSession)
    if (parent?.snapshotEvents) service.ingest(parent).catch(onError)
    await service.ingest(session)
  }
  ctx.on('session/event', (session, event) => { if (event.type === 'turn/end') service.trackHostWork(schedule(session)).catch(onError) })
  ctx.on('agent/created', ({ agent }) => service.trackHostWork(schedule(agent?.session)).catch(onError))
  ctx.on('agent/pre-step', async (payload, next) => { await refresh?.(payload.agent?.id); await service.flush(); return next() })
  ctx.on('llm/stream', async function* (options, next) {
    service.observeRequest(options, ctx.get('sessions')?.get?.(options.sessionId))
    yield* next()
  })
  ctx.effect(() => sources.register({ id: MVU_SOURCE, pluginId: 'pmp-dsh-tavern', name: 'MVU state', stability: 'conversation', roles: ['system'], lifetimes: ['request'], depth: true, resolve: context => service.resolveRequest(context) }))
  ctx.effect(() => () => service.dispose())
  return service
}
