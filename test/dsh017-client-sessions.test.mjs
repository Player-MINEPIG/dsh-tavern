import test from 'node:test'
import assert from 'node:assert/strict'
import { mainSessionId, mainSessionBlank, retainedSessions } from '../packages/client/src/session-selection.js'
import { installPlaySlotOccupancy, PLAY_VIEW_ID, PLAY_DEFAULT_VIEW_ADAPTER_ID } from '../packages/client/src/play/occupancy.js'
import { sessionViewTarget } from '../packages/client/src/play/view-default.js'

const settle = () => new Promise(resolve => setImmediate(resolve))
const row = (id, retainedBy, blank = false) => ({ id, cwd: '/rp', retainedBy, blank })
function fixture(initial, { getTimeline } = {}) {
  let snapshot = initial
  const listeners = new Set(), entries = [], cleanups = [], navigations = []
  const playthroughs = ['a', 'b'].map(id => ({ id: `pt-${id}`, path: `${id}/timeline.json`, ext: { pmpDshTavern: { rootSessionId: id } } }))
  const ctx = {
    uiWorkspace: { openSession: id => navigations.push(id) },
    sessions: { list: { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } } },
    slots: {
      entries: () => [{ store: {} }],
      inject(_name, callback) { cleanups.push(callback()) },
      register(options, component) {
        const entry = { options, component, active: true }
        entries.push(entry)
        return () => { entry.active = false }
      },
    },
  }
  const occupancy = installPlaySlotOccupancy(ctx, {
    getWorkspace: async () => ({ selected: true, rootPath: '/rp' }),
    getCatalog: async () => ({ playthroughs }),
    getTimeline: getTimeline ?? (async () => ({ nodes: [] })),
  })
  return {
    entries, navigations, occupancy,
    update(byId) { snapshot = { byId }; for (const listener of listeners) listener() },
    active(id) { return entries.find(entry => entry.active && entry.options.id === id) },
    dispose() { for (const cleanup of cleanups) cleanup(); assert.equal(listeners.size, 0) },
  }
}

test('main selection ignores other retained consumers and never reads removed current', () => {
  const byId = { b: row('b', { referenceCandidates: 1 }), a: row('a', { mainView: 1 }, true), c: row('c', {}) }
  const snapshot = new Proxy({ byId }, { get(target, key) { assert.notEqual(key, 'current'); return target[key] } })
  assert.equal(mainSessionId(snapshot), 'a')
  assert.equal(mainSessionBlank(snapshot), true)
  byId.a = row('a', { mainView: 1 })
  assert.equal(mainSessionBlank(snapshot), false)
  byId.a = row('a', {})
  assert.equal(mainSessionId(snapshot), null)
  assert.equal(mainSessionBlank(snapshot), true)
  assert.deepEqual(retainedSessions(snapshot).map(session => session.id), ['b'])
})

test('RP bindings, defaults and navigation are isolated across retained sessions', async () => {
  const f = fixture({ byId: { a: row('a', { mainView: 1 }), b: row('b', { referenceCandidates: 1 }), native: row('native', { other: 1 }) } })
  f.occupancy.setMode('play')
  await settle()
  const view = f.active(PLAY_VIEW_ID), adapter = f.active(PLAY_DEFAULT_VIEW_ADAPTER_ID)
  const a = view.options.inject('a'), b = view.options.inject('b'), native = view.options.inject('native')
  assert.equal(a.getBinding().playthrough.id, 'pt-a')
  assert.equal(b.getBinding().playthrough.id, 'pt-b')
  assert.equal(native.getBinding(), null)
  const defaultA = adapter.options.inject('a'), defaultB = adapter.options.inject('b')
  assert.equal(sessionViewTarget(null, 'rp', a.getBinding(), defaultA.shouldDefault), 'rp')
  defaultA.complete(a.getBinding())
  assert.equal(defaultA.shouldDefault(a.getBinding()), false)
  assert.equal(defaultB.shouldDefault(b.getBinding()), true)
  assert.equal(sessionViewTarget('chat', 'rp', b.getBinding(), defaultB.shouldDefault), null)
  assert.equal(sessionViewTarget('trajectory', 'rp', b.getBinding(), defaultB.shouldDefault), null)
  assert.equal(sessionViewTarget('rp', 'rp', undefined, defaultA.shouldDefault), null)
  assert.equal(sessionViewTarget('rp', 'rp', null, defaultA.shouldDefault), 'chat')
  assert.equal(sessionViewTarget(null, 'rp', null, defaultA.shouldDefault), null)
  b.openSession('b')
  assert.deepEqual(f.navigations, ['b'])
  let changes = 0
  const stop = b.subscribeBindings(() => { changes++ })
  f.update({ a: row('a', {}), b: row('b', { mainView: 1 }) })
  await settle()
  assert.equal(a.getBinding(), null)
  assert.equal(b.getBinding().playthrough.id, 'pt-b')
  assert.ok(changes > 0)
  assert.equal(view.active, true)
  f.occupancy.setMode('native')
  assert.equal(view.active, false)
  assert.equal(adapter.active, false)
  assert.equal(b.getBinding(), null)
  stop()
  f.dispose()
  assert.equal(f.entries.every(entry => !entry.active), true)
})

test('late classification cannot re-register an RP surface after release or disposal', async () => {
  let resolveTimeline
  const timeline = new Promise(resolve => { resolveTimeline = resolve })
  const f = fixture({ byId: { a: row('a', { mainView: 1 }) } }, { getTimeline: () => timeline })
  f.occupancy.setMode('play')
  await settle()
  f.update({ a: row('a', {}) })
  f.dispose()
  resolveTimeline({ nodes: [] })
  await settle()
  assert.equal(f.active(PLAY_VIEW_ID), undefined)
  assert.equal(f.entries.every(entry => !entry.active), true)
})

test('chat render cache cannot seed another retained session without an explicit swipe source', async () => {
  const { cachedChatSnapshot, rememberChatSnapshot } = await import('../packages/client/src/play/chat.js')
  const { queueSwipeTransition, consumeSwipeTransition, setSwipeTransitionSource } = await import('../packages/client/src/play/swipe-transition.js')
  const client = {}, playthrough = { path: 'shared/timeline.json' }
  const a = { sessionId: 'a', value: { turns: ['a'] } }, b = { sessionId: 'b', value: { turns: ['b'] } }
  rememberChatSnapshot(client, playthrough, a)
  assert.equal(cachedChatSnapshot(client, playthrough, 'b'), null)
  rememberChatSnapshot(client, playthrough, b)
  assert.equal(cachedChatSnapshot(client, playthrough, 'a'), a)
  assert.equal(cachedChatSnapshot(client, playthrough, 'b'), b)
  queueSwipeTransition('b', 'next', 'qa')
  setSwipeTransitionSource('b', 'a')
  assert.equal(cachedChatSnapshot(client, playthrough, 'b'), a)
  consumeSwipeTransition('b')
  assert.equal(cachedChatSnapshot(client, playthrough, 'b'), b)
})
