import { timelineHead } from '../../play/src/timeline-tree.js'
import { MvuService } from './service.js'
import { fail } from './value.js'
import { createHash } from 'node:crypto'

export const MVU_SERVICE = 'tavernMvu'
export const MVU_SOURCE = 'tavern.mvu/state'

/** Install with public Cordis/DSH seams. No Helper runtime or manager dependency. */
export function installMvu(ctx, { storageDir, resources = [], sources, memberships, refresh, isActive, getSelection, getSelectionToken, onError = () => {} } = {}) {
  const sessionEpochs = new Map()
  // DSH creates this metadata before the first turn; every other event closes the initial window.
  const emptyHistory = events => Array.isArray(events) && events.every(event => event.type === 'sandbox/mode')
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const inspect = async id => { const live = ctx.get('sessions')?.get?.(id); return live ? { header: live.header, events: live.snapshotEvents() } : ctx.get('sessionController')?.inspect?.(id) }
  const service = new MvuService({ storageDir, resources, inspect, refresh, isActive, authorizeCardWrite: async request => {
    const authority = ctx.get('tavernRenderingAuthority')
    const grant = await authority?.resolve(request)
    return grant && ctx.get('tavernRenderingAuthority') === authority ? { ...grant, checkCurrent: () => ctx.get('tavernRenderingAuthority') === authority && authority.isCurrent?.(request) === true } : null
  }, async resolveScope(scope) {
    if (!scope || typeof scope.sessionId !== 'string') fail('MVU_SCOPE', 'Session scope required')
    if (scope.mode === 'initial') {
      if (typeof scope.playthroughId !== 'string' || !scope.playthroughId || typeof scope.characterId !== 'string' || !scope.characterId
        || ['nodeId', 'variantId', 'endEventId', 'messageId'].some(key => key in scope) || !getSelection || !getSelectionToken) fail('MVU_SCOPE', 'Explicit initial scope required')
      const membership = () => {
        const playthrough = memberships?.readCatalog({ allowMissing: true })?.catalog.playthroughs.find(p => p.id === scope.playthroughId)
        if (!playthrough || playthrough.ext?.pmpDshTavern?.rootSessionId !== scope.sessionId || playthrough.ext?.pmpDshTavern?.characterId !== scope.characterId) fail('MVU_READ_ONLY', 'Initial membership changed')
        const timeline = memberships.readTimeline(playthrough).timeline
        if (timeline.nodes.length || timelineHead(timeline)) fail('MVU_READ_ONLY', 'Initial timeline is not empty')
        return digest({ playthrough, timeline })
      }
      const memberKey = membership(), memberLease = memberships.captureLease?.(scope.playthroughId)
      if (typeof memberLease !== 'function' || memberLease() !== true) fail('MVU_READ_ONLY', 'Membership mutation lease required')
      const selectionToken = getSelectionToken(scope.sessionId)
      let live = ctx.get('sessions')?.get?.(scope.sessionId)
      if (getSelection(scope.sessionId)?.characterCardId !== scope.characterId) fail('MVU_READ_ONLY', 'Initial character is not selected')
      if (!live) {
        await ctx.get('sessionController')?.resolveAgent?.(scope.sessionId)
        live = ctx.get('sessions')?.get?.(scope.sessionId)
      }
      if (!live?.snapshotEvents) fail('MVU_READ_ONLY', 'Initial binding requires a live controlled session')
      const epoch = sessionEpochs.get(scope.sessionId) ?? 0
      const inspected = { header: live.header, events: live.snapshotEvents() }, header = inspected.header
      if (!header || !Number.isSafeInteger(header.version) || header.parentSession || !emptyHistory(inspected.events)
        || (scope.sessionFormatVersion != null && scope.sessionFormatVersion !== header.version)) fail('MVU_READ_ONLY', 'Initial session must have empty durable history')
      const headerKey = digest(header)
      const checkCurrent = () => {
        try {
          const current = ctx.get('sessions')?.get?.(scope.sessionId)
          return (sessionEpochs.get(scope.sessionId) ?? 0) === epoch && current === live && emptyHistory(current.snapshotEvents()) && digest(current.header) === headerKey
            && memberLease() === true && getSelectionToken(scope.sessionId) === selectionToken && getSelection(scope.sessionId)?.characterCardId === scope.characterId && membership() === memberKey
        } catch { return false }
      }
      if (!checkCurrent()) fail('MVU_READ_ONLY', 'Initial scope changed during inspection')
      return { mode: 'initial', writableHead: true, checkCurrent, initialSource: { sessionId: scope.sessionId, playthroughId: scope.playthroughId,
        characterId: scope.characterId, sessionFormatVersion: header.version, ...(header.createdAt === undefined ? {} : { sessionCreatedAt: header.createdAt }) } }
    }
    if (scope.mode !== undefined || scope.characterId !== undefined) fail('MVU_SCOPE', 'Unknown durable scope mode')
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
  ctx.on('session/event', (session, event) => { sessionEpochs.set(session.id, (sessionEpochs.get(session.id) ?? 0) + 1); if (event.type === 'turn/end') service.trackHostWork(schedule(session)).catch(onError) })
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
