import { registerTavernMvuSource } from 'dsh-prompt-assembler/adapters/tavern'
import { symbols } from '@deepseek-ai/cordis'
import { timelineHead } from '../../play/src/timeline-tree.js'
import { MvuService } from './service.js'
import { snapshotMvuSession } from './history.js'
import { fail } from './value.js'
import { createHash, randomUUID } from 'node:crypto'

export const MVU_SERVICE = 'tavernMvu'
export const MVU_SOURCE = 'tavern.mvu/state'

/** Install with public Cordis/DSH seams. No Helper runtime or manager dependency. */
export function installMvu(ctx, { storageDir, resources = [], sources, memberships, refresh, isActive, getSelection, getSelectionToken, getPreviewSession, isPreviewRead, resolveCommandHook, onError = () => {} } = {}) {
  const sessionEpochs = new Map()
  const promptSessionEpochs = new Map()
  let hostQueue = Promise.resolve()
  // DSH permission presets pin these exact configuration facts before publishing a new session.
  // No prefix/category match: messages, turns, inbox activity and unknown events close this window.
  const initialMetadata = new Set(['permission/preset', 'sandbox/mode', 'approval/policy'])
  // SessionController.selectModel records log-only intent, not a model request.
  // Validate the complete public payload so unknown fields cannot hide activity.
  const modelSelectionMetadata = data => data !== null && typeof data === 'object' && !Array.isArray(data)
    && Object.hasOwn(data, 'provider') && typeof data.provider === 'string' && data.provider.length > 0
    && Object.hasOwn(data, 'model') && typeof data.model === 'string' && data.model.length > 0
    && Object.keys(data).every(key => ['provider', 'model', 'reasoningEffort'].includes(key))
    && (!Object.hasOwn(data, 'reasoningEffort') || (typeof data.reasoningEffort === 'string' && data.reasoningEffort.length > 0))
  // SessionController.rename is log-only. Automatic titles and message references
  // are activity, so accept only the complete explicit-user rename payload.
  const userTitleMetadata = data => data !== null && typeof data === 'object' && !Array.isArray(data)
    && Object.keys(data).length === 3 && ['title', 'messageSeqs', 'source'].every(key => Object.hasOwn(data, key))
    && typeof data.title === 'string' && data.title.trim().length > 0
    && Array.isArray(data.messageSeqs) && data.messageSeqs.length === 0
    && data.source !== null && typeof data.source === 'object' && !Array.isArray(data.source)
    && Object.keys(data.source).length === 1 && Object.hasOwn(data.source, 'kind') && data.source.kind === 'user'
  // Official Session restore appends this empty marker; inherited seed markers are not empty history.
  const emptyHistory = events => Array.isArray(events) && events.every(event => initialMetadata.has(event.type)
    || (event.type === 'model/selection' && modelSelectionMetadata(event.data))
    || (event.type === 'session/title' && userTitleMetadata(event.data))
    || (event.type === 'session/end-seed' && event.data !== null && typeof event.data === 'object'
      && !Array.isArray(event.data) && Object.keys(event.data).length === 0))
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const viewEpoch = randomUUID()
  const selectedView = scope => ({ greetingIndex: getSelection(scope.sessionId)?.character?.greetingIndex ?? 0,
    selectionToken: digest([viewEpoch, scope.sessionId, getSelectionToken(scope.sessionId)]) })
  const requireSelectedView = scope => {
    if (scope.greetingIndex !== undefined && (!Number.isSafeInteger(scope.greetingIndex) || scope.greetingIndex < 0)
      || scope.selectionToken !== undefined && (typeof scope.selectionToken !== 'string' || !/^[a-f0-9]{64}$/.test(scope.selectionToken))) fail('MVU_SCOPE', 'Invalid greeting selection identity')
    const view = selectedView(scope)
    if (scope.greetingIndex !== undefined && scope.greetingIndex !== view.greetingIndex
      || scope.selectionToken !== undefined && scope.selectionToken !== view.selectionToken) fail('MVU_READ_ONLY', 'Greeting selection changed')
    return view
  }
  const inspect = async id => { const session = ctx.get('sessions')?.get?.(id) ?? getPreviewSession?.(id); return session ? { header: session.header, events: session.snapshotEvents() } : ctx.get('sessionController')?.inspect?.(id) }
  const requestMetadata = event => (event.type === 'system/message' && event.data?.message?.role === 'system'
    && Number.isSafeInteger(event.data.turn) && Number.isSafeInteger(event.data.step))
    || (event.type === 'request/context' && typeof event.data?.provider === 'string' && typeof event.data?.model === 'string'
      && Object.keys(event.data).every(key => ['provider', 'model', 'contextWindow', 'systemPromptUpdate'].includes(key)))
  const preparationType = event => requestMetadata(event) || ['step/start', 'user/message', 'request/header'].includes(event.type)
  const captureSessionLease = async (sessionId, { allowRequestMetadata = false, readOnly = false } = {}) => {
    let sessions = ctx.get('sessions'), live = sessions?.get?.(sessionId)
    if (!live && readOnly) {
      const observed = getPreviewSession?.(sessionId)
      if (!observed?.snapshotEvents) return null
      const sessionsIdentity = sessions?.[symbols.original] ?? sessions
      const epoch = sessionEpochs.get(sessionId) ?? 0, header = digest(observed.header), events = digest(observed.snapshotEvents())
      return () => ctx.get(MVU_SERVICE) === service && (ctx.get('sessions')?.[symbols.original] ?? ctx.get('sessions')) === sessionsIdentity
        && getPreviewSession?.(sessionId) === observed && !ctx.get('sessions')?.get?.(sessionId)
        && (sessionEpochs.get(sessionId) ?? 0) === epoch && digest(observed.header) === header && digest(observed.snapshotEvents()) === events
    }
    if (!live) {
      await ctx.get('sessionController')?.resolveAgent?.(sessionId)
      sessions = ctx.get('sessions'); live = sessions?.get?.(sessionId)
    }
    if (!live?.snapshotEvents) return null
    // Public resume can publish fresh discovery/ingest work after the caller's entry barrier.
    await hostQueue
    const sessionsIdentity = sessions[symbols.original] ?? sessions
    const epochs = allowRequestMetadata ? promptSessionEpochs : sessionEpochs
    const epoch = epochs.get(sessionId) ?? 0, header = digest(live.header), prefix = live.snapshotEvents(), prefixLength = prefix.length, events = digest(prefix)
    const turn = prefix.findLast(event => event.type === 'turn/start')?.data.turn
    const loggedUsers = new Set(prefix.filter(event => event.type === 'user/message').map(event => event.data?.id))
    const claimedUsers = new Map(prefix.filter(event => event.type === 'agent/inbox/spliced').flatMap(event => event.data?.inserted ?? [])
      .filter(message => message?.role === 'user' && typeof message.id === 'string' && !loggedUsers.has(message.id)).map(message => [message.id, digest(message)]))
    const preparationCurrent = event => (requestMetadata(event) && (event.type !== 'system/message' || event.data.turn === turn))
      || (event.type === 'step/start' && event.data?.turn === turn && Number.isSafeInteger(event.data.step))
      || (event.type === 'user/message' && claimedUsers.get(event.data?.id) === digest(event.data))
      || (event.type === 'request/header' && event.data?.header && Object.keys(event.data).every(key => ['header', 'reason'].includes(key)))
    const historyCurrent = () => {
      const current = live.snapshotEvents()
      return allowRequestMetadata ? current.length >= prefixLength && digest(current.slice(0, prefixLength)) === events && current.slice(prefixLength).every(preparationCurrent) : digest(current) === events
    }
    return () => ctx.get(MVU_SERVICE) === service && (ctx.get('sessions')?.[symbols.original] ?? ctx.get('sessions')) === sessionsIdentity && ctx.get('sessions')?.get?.(sessionId) === live
      && (epochs.get(sessionId) ?? 0) === epoch && digest(live.header) === header && historyCurrent()
  }
  const capturePromptScope = (scope, resource) => {
    if (!memberships || !getSelection || !getSelectionToken) return null
    const contextLease = memberships.captureContextLease?.()
    if (typeof contextLease !== 'function' || contextLease() !== true) return null
    const selection = getSelectionToken(scope.sessionId), selected = getSelection(scope.sessionId)?.characterCardId
    if (resource.characterId && selected !== resource.characterId) return null
    const catalog = memberships.readCatalog({ allowMissing: true })?.catalog
    const members = (catalog?.playthroughs ?? []).filter(play => play.ext?.pmpDshTavern?.rootSessionId === scope.sessionId
      || memberships.readTimeline(play).timeline.nodes.some(node => node.variants.some(variant => variant.sessionId === scope.sessionId)))
    // Fork timelines can retain the same ancestor session. A current read is
    // still session/instance-bound when every reference confirms its card.
    // Unqualified or cross-card memberships remain ambiguous.
    if ((members.length > 1 && !resource.characterId)
      || (resource.characterId && members.some(play => play.ext?.pmpDshTavern?.characterId !== resource.characterId))) return null
    // The context lease also covers other timelines, absent catalogs and workspace ABA.
    return () => ctx.get(MVU_SERVICE) === service && getSelectionToken(scope.sessionId) === selection
      && getSelection(scope.sessionId)?.characterCardId === selected && contextLease() === true
  }
  const service = new MvuService({ storageDir, resources, inspect, refresh, isActive, isPreviewRead, resolveCommandHook, capturePromptScope, captureSessionLease, captureCommandScope: session => {
    const epoch = sessionEpochs.get(session.id) ?? 0, live = ctx.get('sessions')?.get?.(session.id)
    const header = live && digest(live.header), events = live?.snapshotEvents && digest(live.snapshotEvents())
    return () => ctx.get(MVU_SERVICE) === service && (sessionEpochs.get(session.id) ?? 0) === epoch
      && ctx.get('sessions')?.get?.(session.id) === live && (!live || (digest(live.header) === header && digest(live.snapshotEvents()) === events))
  }, waitForHost: () => hostQueue, authorizeCardWrite: async request => {
    const authority = ctx.get('tavernRenderingAuthority')
    const grant = await authority?.resolve(request)
    return grant && ctx.get('tavernRenderingAuthority') === authority ? { ...grant, checkCurrent: () => ctx.get('tavernRenderingAuthority') === authority && authority.isCurrent?.(request) === true } : null
  }, async resolveScope(scope) {
    if (!scope || typeof scope.sessionId !== 'string') fail('MVU_SCOPE', 'Session scope required')
    if (scope.mode === 'greeting') {
      if (typeof scope.playthroughId !== 'string' || !scope.playthroughId || typeof scope.characterId !== 'string' || !scope.characterId || ['nodeId', 'variantId', 'endEventId', 'messageId'].some(key => key in scope)
        || !getSelection || !getSelectionToken) fail('MVU_SCOPE', 'Explicit greeting scope required')
      const member = () => {
        const item = memberships?.readCatalog({ allowMissing: true })?.catalog.playthroughs.find(p => p.id === scope.playthroughId)
        if (!item || item.ext?.pmpDshTavern?.characterId !== scope.characterId) fail('MVU_READ_ONLY', 'Greeting membership changed')
        if (item.ext?.pmpDshTavern?.rootSessionId === scope.sessionId) return digest(item)
        const timeline = memberships.readTimeline(item).timeline
        const member = timeline.nodes.some(node => node.variants.some(variant => variant.sessionId === scope.sessionId))
        if (!member) fail('MVU_READ_ONLY', 'Greeting session is not a saved playthrough member')
        return digest([item, timeline])
      }
      member()
      requireSelectedView(scope)
      if (getSelection(scope.sessionId)?.characterCardId !== scope.characterId) fail('MVU_READ_ONLY', 'Greeting character is not selected')
      // This is a current read view, not a historical message or a write capability.
      // Inspect without resuming an Agent just to display a greeting.
      const observed = await inspect(scope.sessionId), header = observed?.header ?? observed?.meta
      if (!header || header.id !== scope.sessionId || !Number.isSafeInteger(header.version)
        || (scope.sessionFormatVersion != null && scope.sessionFormatVersion !== header.version)) fail('MVU_READ_ONLY', 'Greeting session unavailable')
      const viewIdentity = requireSelectedView(scope)
      const key = member(), lease = memberships.captureLease?.(scope.playthroughId), selection = getSelectionToken(scope.sessionId)
      const checkCurrent = () => {
        try { return lease?.() === true && member() === key && digest(selectedView(scope)) === digest(viewIdentity) && getSelectionToken(scope.sessionId) === selection && getSelection(scope.sessionId)?.characterCardId === scope.characterId }
        catch { return false }
      }
      if (!checkCurrent()) fail('MVU_READ_ONLY', 'Greeting scope changed')
      return { mode: 'greeting', writableHead: false, checkCurrent, viewIdentity }
    }
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
      requireSelectedView(scope)
      membership() // Check access before loading; acquire the lease after the official resume lifecycle.
      let live = ctx.get('sessions')?.get?.(scope.sessionId)
      if (getSelection(scope.sessionId)?.characterCardId !== scope.characterId) fail('MVU_READ_ONLY', 'Initial character is not selected')
      if (!live) {
        await ctx.get('sessionController')?.resolveAgent?.(scope.sessionId)
        live = ctx.get('sessions')?.get?.(scope.sessionId)
      }
      if (!live?.snapshotEvents) fail('MVU_READ_ONLY', 'Initial binding requires a live controlled session')
      // Resume may normalize persisted RP selection. Bind only its completed, revalidated state.
      const memberKey = membership(), memberLease = memberships.captureLease?.(scope.playthroughId)
      if (typeof memberLease !== 'function' || memberLease() !== true) fail('MVU_READ_ONLY', 'Membership mutation lease required')
      const viewIdentity = requireSelectedView(scope)
      const selectionToken = getSelectionToken(scope.sessionId)
      if (getSelection(scope.sessionId)?.characterCardId !== scope.characterId) fail('MVU_READ_ONLY', 'Initial character is not selected')
      const epoch = sessionEpochs.get(scope.sessionId) ?? 0
      const inspected = { header: live.header, events: live.snapshotEvents() }, header = inspected.header
      if (!header || !Number.isSafeInteger(header.version) || header.parentSession || header.isSeeded === true || !emptyHistory(inspected.events)
        || (scope.sessionFormatVersion != null && scope.sessionFormatVersion !== header.version)) fail('MVU_READ_ONLY', 'Initial session must have empty durable history')
      const headerKey = digest(header)
      const checkCurrent = () => {
        try {
          const current = ctx.get('sessions')?.get?.(scope.sessionId)
          return (sessionEpochs.get(scope.sessionId) ?? 0) === epoch && current === live && emptyHistory(current.snapshotEvents()) && digest(current.header) === headerKey
            && memberLease() === true && digest(selectedView(scope)) === digest(viewIdentity) && getSelectionToken(scope.sessionId) === selectionToken && getSelection(scope.sessionId)?.characterCardId === scope.characterId && membership() === memberKey
        } catch { return false }
      }
      if (!checkCurrent()) fail('MVU_READ_ONLY', 'Initial scope changed during inspection')
      return { mode: 'initial', writableHead: true, checkCurrent, viewIdentity, initialSource: { sessionId: scope.sessionId, playthroughId: scope.playthroughId,
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
  const schedule = async (session, deferredSeed = false) => {
    if (!session?.snapshotEvents) return
    await refresh?.(session.id)
    const parent = session.header?.parentSession && ctx.get('sessions')?.get?.(session.header.parentSession)
    if (parent?.snapshotEvents) service.ingest(parent).catch(onError)
    try { await service.ingest(session) }
    catch (error) { if (!deferredSeed || !['MVU_SEED_PENDING', 'MVU_SEED_REQUIRED'].includes(error.code)) throw error }
  }
  // Publish event ordering before refresh can yield. A later turn's checkpoint
  // must wait for the previous turn's state commit, including source discovery.
  const publish = work => {
    hostQueue = work.catch(() => {})
    service.trackHostWork(work).catch(onError)
    return work.catch(onError)
  }
  const enqueue = task => publish(hostQueue.then(task))
  const freezeSession = session => {
    if (!session?.snapshotEvents) return session
    const snapshot = snapshotMvuSession(session)
    return { ...snapshot, snapshotEvents: () => snapshot.events }
  }
  for (const event of ['session/created', 'session/disposed']) ctx.on(event, session => {
    sessionEpochs.set(session.id, (sessionEpochs.get(session.id) ?? 0) + 1)
    promptSessionEpochs.set(session.id, (promptSessionEpochs.get(session.id) ?? 0) + 1)
  })
  ctx.on('session/event', (session, event) => {
    sessionEpochs.set(session.id, (sessionEpochs.get(session.id) ?? 0) + 1)
    if (!preparationType(event)) promptSessionEpochs.set(session.id, (promptSessionEpochs.get(session.id) ?? 0) + 1)
    if (event.type === 'turn/start') publish(service.checkpoint(session, event))
    if (event.type === 'turn/end') { const snapshot = freezeSession(session); enqueue(() => schedule(snapshot)) }
  })
  ctx.on('agent/created', ({ agent }) => { const snapshot = freezeSession(agent?.session); return enqueue(() => schedule(snapshot, true)) })
  ctx.on('agent/pre-step', async (payload, next) => {
    await hostQueue
    await refresh?.(payload.agent?.id)
    const session = payload.agent?.session, start = session?.snapshotEvents?.().findLast(e => e.type === 'turn/start')
    if (start) await service.checkpoint(session, start)
    await service.flush()
    return next()
  })
  ctx.on('llm/stream', async function* (options, next) {
    service.observeRequest(options, ctx.get('sessions')?.get?.(options.sessionId))
    yield* next()
  })
  ctx.effect(() => registerTavernMvuSource(sources, service))
  ctx.effect(() => () => service.dispose())
  return service
}
