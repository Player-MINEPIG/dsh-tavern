import { CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'
import { resourceApi } from './resource-api.js'

const memoryKey = `${PLUGIN_ID}:last-focused-personality:v1`
const connectionKey = options => JSON.stringify([options?.workspaceId ?? null, options?.agentPreset ?? null])

export function createPersonalityInheritance({ sessions, navigation, readSelection, applyDefault, storage, active = () => true, changed = () => {}, report = () => {} }) {
  let alive = true, focused = null, mainIds = new Set(), epoch = 0, scope = null
  let focusedRead = null, explicitFocus = false, initialFocus = true
  const pending = new Map()
  const originalCreate = sessions.create, originalOpen = navigation.openWorkspace, originalOpenSession = navigation.openSession
  const stored = () => {
    try { return storage?.getItem(memoryKey) ?? null } catch { return null }
  }
  const previous = () => {
    try {
      const value = JSON.parse(stored() ?? 'null')
      if (typeof value?.sessionId !== 'string') return null
      if (Object.hasOwn(value, 'personalityId')) return value.personalityId === null || typeof value.personalityId === 'string' ? value : null
      // Pre-card snapshots stored only the session coordinate.
      return { sessionId: value.sessionId }
    } catch { return null }
  }
  let remembered = previous()
  let protectRestore = remembered !== null
  const remember = (sessionId, personalityId, baseline) => {
    if (!alive || stored() !== baseline) return
    remembered = { sessionId, personalityId }
    try { storage?.setItem(memoryKey, JSON.stringify(remembered)) } catch {}
  }
  const refresh = () => {
    const sessionId = focused
    if (!sessionId || protectRestore || !active()) return
    const request = ++epoch
    const baseline = stored()
    const read = Promise.resolve().then(() => readSelection(sessionId)).then(value => {
      const personalityId = typeof value?.personalityId === 'string' ? value.personalityId : null
      // A focus closing while this read is in flight still owns its captured
      // selection. A newer focus or another window's write supersedes it.
      if (request === epoch) remember(sessionId, personalityId, baseline)
      return personalityId
    })
    focusedRead = { sessionId, request, baseline, promise: read }
    void read.catch(report)
  }
  const sync = () => {
    const snapshot = sessions.list.getSnapshot()
    if (snapshot.phase === 'pending') return
    const ids = Object.values(snapshot.byId ?? {}).filter(row => row.retainedBy?.mainView > 0).map(row => row.id)
    const added = ids.filter(id => !mainIds.has(id))
    mainIds = new Set(ids)
    const next = added.at(-1) ?? (mainIds.has(focused) ? focused : ids.at(-1) ?? null)
    if (next !== focused) {
      // Startup restoreBlank can create a mainView without a user choosing it.
      // A saved card remains the welcome-page source until public navigation.
      if (next && !initialFocus && !protectRestore) explicitFocus = true
      focused = next
      if (focused && explicitFocus) protectRestore = false
      if (focused) { initialFocus = false; refresh() }
    }
  }
  const source = () => {
    if (focused && !protectRestore && active()) return Promise.resolve(readSelection(focused)).then(value => value.personalityId)
    if (!focused && focusedRead?.request === epoch && !protectRestore && stored() === focusedRead.baseline) return focusedRead.promise
    const value = previous() ?? remembered
    if (!value) return Promise.resolve(null)
    if (Object.hasOwn(value, 'personalityId')) return Promise.resolve(value.personalityId)
    return Promise.resolve(readSelection(value.sessionId)).then(selection => selection.personalityId)
  }
  function openSession(...args) {
    if (alive && active()) { explicitFocus = true; protectRestore = false }
    const result = originalOpenSession.apply(this, args)
    sync(); refresh()
    return result
  }
  const prepare = async record => {
    const id = await record.created
    while (alive && record.source) {
      const selection = record.source
      const personalityId = await selection
      if (selection !== record.source) continue
      if (!alive) return id
      await applyDefault(id, personalityId)
      changed()
      if (selection !== record.source) continue
      break
    }
    return id
  }
  function create(options = {}) {
    if (!alive) return originalCreate.call(this, options)
    const record = { source: scope, created: originalCreate.call(this, options) }
    const key = connectionKey(options)
    pending.set(key, record)
    const result = prepare(record)
    void result.finally(() => { if (pending.get(key) === record) pending.delete(key) }).catch(() => {})
    return result
  }
  function open(workspaceId, beforeOpen, options) {
    if (!alive) return originalOpen.call(this, workspaceId, beforeOpen, options)
    const selection = source()
    void selection.catch(() => {})
    // Native navigation starts synchronously, preserving its cancellation order.
    // Only a create reached from this public operation receives the default.
    const before = scope
    if (active()) { explicitFocus = true; protectRestore = false }
    scope = selection
    let result
    try { result = originalOpen.call(this, workspaceId, beforeOpen, options) }
    finally { scope = before }
    const shared = pending.get(connectionKey({ workspaceId, ...options }))
    if (shared) shared.source = selection
    return result
  }
  sessions.create = create
  navigation.openWorkspace = open
  if (typeof originalOpenSession === 'function') navigation.openSession = openSession
  const unsubscribe = sessions.list.subscribe(sync)
  sync()
  return {
    refresh,
    async connect(workspaceId, options) {
      const selection = source()
      void selection.catch(() => {})
      const id = await navigation.connectWorkspace(workspaceId, options)
      if (alive) { await applyDefault(id, await selection); changed() }
      return id
    },
    dispose() {
      alive = false; ++epoch; unsubscribe()
      if (sessions.create === create) sessions.create = originalCreate
      if (navigation.openWorkspace === open) navigation.openWorkspace = originalOpen
      if (navigation.openSession === openSession) navigation.openSession = originalOpenSession
    },
  }
}

export function installPersonalityInheritance(ctx) {
  let storage
  try { storage = window.localStorage } catch {}
  const controller = createPersonalityInheritance({
    sessions: ctx.sessions, navigation: ctx.uiWorkspace, storage,
    active: () => document.visibilityState !== 'hidden' && (typeof document.hasFocus !== 'function' || document.hasFocus()),
    readSelection: id => resourceApi(`/personality-selection?sessionId=${encodeURIComponent(id)}`),
    applyDefault: (sessionId, personalityId) => resourceApi('/personality-selection', {
      method: 'POST', body: JSON.stringify({ sessionId, personalityId, defaultIfUnbound: true }),
    }),
    changed: () => window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT)),
    report: error => console.warn('Tavern personality focus could not be read:', error),
  })
  const refresh = () => controller.refresh()
  window.addEventListener('focus', refresh)
  window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
  ctx.effect(() => () => {
    window.removeEventListener('focus', refresh)
    window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
    controller.dispose()
  }, 'Tavern: native personality defaults')
  return controller
}
