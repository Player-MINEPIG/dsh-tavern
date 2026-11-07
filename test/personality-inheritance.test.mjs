import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { createPersonalityApiHandler } from '../packages/personality/src/server.js'
import { API_V1 } from '../packages/identity.js'
import { createPersonalityInheritance } from '../packages/client/src/personality-inheritance.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'personality-inherit-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const store = new PersonalityStore(directory), card = store.create({ name: 'One' }), other = store.create({ name: 'Two' })
  store.select('A', { characterCardId: card.id })
  store.select('B', { characterCardId: other.id })
  let snapshot = { byId: {} }, navigationEpoch = 0, active = true
  const listeners = new Set(), connections = new Map(), writes = [], storageMap = new Map()
  const focus = id => {
    snapshot = { byId: id ? { [id]: { id, retainedBy: { mainView: 1 } } } : {} }
    for (const listener of listeners) listener()
  }
  const sessions = {
    list: { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } },
    create: async options => options.sessionId ?? `blank-${options.workspaceId}`,
  }
  const navigation = {
    openSession(id) { focus(id) },
    connectWorkspace(workspaceId, options) {
      const key = `${workspaceId}:${options?.agentPreset ?? ''}`
      if (connections.has(key)) return connections.get(key)
      const promise = sessions.create({ workspaceId, ...options }).finally(() => connections.delete(key))
      connections.set(key, promise)
      return promise
    },
    async openWorkspace(workspaceId, beforeOpen, options) {
      const epoch = ++navigationEpoch
      const id = await this.connectWorkspace(workspaceId, options)
      if (epoch !== navigationEpoch) return
      beforeOpen?.(id)
      focus(id)
    },
  }
  focus('A')
  const controller = createPersonalityInheritance({ sessions, navigation,
    storage: { getItem: key => storageMap.get(key), setItem: (key, value) => storageMap.set(key, value) },
    active: () => active,
    readSelection: async id => ({ personalityId: store.selection(id)?.characterCardId ?? null }),
    applyDefault: async (id, personalityId) => { writes.push({ id, personalityId }); return store.selectDefault(id, personalityId) },
  })
  t.after(() => controller.dispose())
  return { store, card, other, sessions, navigation, controller, focus, writes, storageMap, setActive: value => { active = value } }
}

test('new native workspace navigation persists only the focused card binding before opening', async t => {
  const f = fixture(t)
  let observed
  await f.navigation.openWorkspace('different-workspace', id => { observed = f.store.selection(id) })
  assert.equal(observed.characterCardId, f.card.id)
  assert.equal(f.store.selection('blank-different-workspace').characterCardId, f.card.id)
  f.focus('B')
  await f.navigation.openWorkspace('second')
  assert.equal(f.store.selection('blank-second').characterCardId, f.other.id)
  f.focus('no-card')
  await f.navigation.openWorkspace('third')
  assert.equal(f.store.selection('blank-third'), null)
})

test('late defaults preserve explicit selection, explicit disable and persisted decisions', async t => {
  const f = fixture(t)
  f.store.select('blank-explicit', { characterCardId: f.other.id })
  await f.navigation.openWorkspace('explicit')
  assert.equal(f.store.selection('blank-explicit').characterCardId, f.other.id)
  f.store.select('blank-off', null)
  f.focus('A')
  await f.navigation.openWorkspace('off')
  assert.equal(f.store.selection('blank-off'), null)
  const restored = new PersonalityStore(f.store.storageDir.replace(/\/personality$/, ''))
  assert.equal(restored.selectDefault('blank-off', f.card.id), false)
  assert.equal(restored.selectDefault('blank-explicit', f.card.id), false)
})

test('restoration, existing focus navigation and background session creation do not inherit', async t => {
  const f = fixture(t)
  await f.sessions.create({ workspaceId: 'restore' })
  await f.navigation.connectWorkspace('rp-draft')
  f.focus('existing')
  await tick()
  assert.equal(f.store.selection('existing'), null)
  assert.deepEqual(f.writes, [])
})

test('native navigation can share an in-flight connection first requested outside native navigation', async t => {
  const f = fixture(t), result = deferred()
  f.controller.dispose()
  f.sessions.create = () => result.promise
  const controller = createPersonalityInheritance({ sessions: f.sessions, navigation: f.navigation,
    readSelection: async () => ({ personalityId: f.card.id }),
    applyDefault: (id, card) => f.store.selectDefault(id, card),
  })
  t.after(() => controller.dispose())
  const outside = f.navigation.connectWorkspace('shared')
  const native = f.navigation.openWorkspace('shared', id => assert.equal(f.store.selection(id)?.characterCardId, f.card.id))
  result.resolve('shared-id')
  await Promise.all([outside, native])
  assert.equal(f.store.selection('shared-id').characterCardId, f.card.id)
})

test('source reads do not reorder native navigation or expose a new session before its default', async t => {
  const f = fixture(t), slow = deferred()
  f.controller.dispose()
  const opens = []
  const controller = createPersonalityInheritance({ sessions: f.sessions, navigation: f.navigation,
    readSelection: id => id === 'A' ? slow.promise : Promise.resolve({ personalityId: f.other.id }),
    applyDefault: (id, card) => f.store.selectDefault(id, card),
  })
  t.after(() => controller.dispose())
  const old = f.navigation.openWorkspace('old', id => opens.push(id))
  f.focus('B')
  const newer = f.navigation.openWorkspace('new', id => opens.push(id))
  await newer
  assert.deepEqual(opens, ['blank-new'])
  slow.resolve({ personalityId: f.card.id })
  await old
  assert.deepEqual(opens, ['blank-new'])
})

test('no-focus new navigation remembers the last active focused selection, including disabled and deleted cards', async t => {
  const f = fixture(t)
  await tick()
  f.focus(null)
  await f.navigation.openWorkspace('remembered')
  assert.equal(f.store.selection('blank-remembered').characterCardId, f.card.id)
  f.focus('B'); await tick()
  f.setActive(false); f.focus('A'); await tick()
  f.focus(null); f.setActive(true)
  await f.navigation.openWorkspace('inactive-does-not-overwrite')
  assert.equal(f.store.selection('blank-inactive-does-not-overwrite').characterCardId, f.other.id)
  f.store.delete(f.other.id)
  f.focus(null)
  await f.navigation.openWorkspace('deleted')
  assert.equal(f.store.selection('blank-deleted'), null)
  f.store.select('A', null); f.focus('A'); await tick(); f.focus(null)
  await f.navigation.openWorkspace('off-memory')
  assert.equal(f.store.selection('blank-off-memory'), null)
})

test('disposal preserves subsequent adapters and disables an already pending inheritance', async t => {
  const f = fixture(t), oldCreate = f.sessions.create, slow = deferred()
  f.controller.dispose()
  const nativeCreate = f.sessions.create
  f.sessions.create = () => slow.promise
  const controller = createPersonalityInheritance({ sessions: f.sessions, navigation: f.navigation,
    readSelection: async () => ({ personalityId: f.card.id }),
    applyDefault: (id, card) => f.store.selectDefault(id, card),
  })
  const action = f.navigation.openWorkspace('unloaded')
  const wrapped = f.sessions.create
  const later = (...args) => wrapped(...args)
  f.sessions.create = later
  controller.dispose()
  assert.equal(f.sessions.create, later)
  slow.resolve('unloaded')
  await action
  assert.equal(f.store.selection('unloaded'), null)
  assert.notEqual(oldCreate, nativeCreate)
})

test('a failed default blocks opening, and retry keeps a later explicit choice', async t => {
  const f = fixture(t)
  f.controller.dispose()
  let available = false, opened = false
  const controller = createPersonalityInheritance({ sessions: f.sessions, navigation: f.navigation,
    readSelection: async () => ({ personalityId: f.card.id }),
    applyDefault(id, card) {
      if (!available) throw new Error('network unavailable')
      return f.store.selectDefault(id, card)
    },
  })
  t.after(() => controller.dispose())
  await assert.rejects(f.navigation.openWorkspace('retry', () => { opened = true }), /network unavailable/)
  assert.equal(opened, false)
  f.store.select('blank-retry', null)
  available = true
  await f.navigation.openWorkspace('retry', () => { opened = true })
  assert.equal(opened, true)
  assert.equal(f.store.selection('blank-retry'), null)
})

test('selection API applies defaults atomically without overriding explicit disable or missing-card deletion', async t => {
  const f = fixture(t), api = createPersonalityApiHandler(f.store)
  const request = async body => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))])
    Object.assign(req, { method: 'POST', url: `${API_V1}/personality-selection` })
    let status, result
    await api(req, { setHeader() {}, end(value) { status = this.statusCode; result = JSON.parse(value) } })
    return { status, result }
  }
  assert.equal((await request({ sessionId: 'target', personalityId: f.card.id, defaultIfUnbound: true })).result.applied, true)
  await request({ sessionId: 'target', personalityId: null })
  const retry = await request({ sessionId: 'target', personalityId: f.card.id, defaultIfUnbound: true })
  assert.equal(retry.result.applied, false)
  assert.equal(retry.result.personalityId, null)
  f.store.delete(f.other.id)
  const missing = await request({ sessionId: 'new', personalityId: f.other.id, defaultIfUnbound: true })
  assert.equal(missing.status, 200)
  assert.equal(missing.result.personalityId, null)
  assert.equal((await request({ sessionId: 'invalid', personalityId: f.card.id, defaultIfUnbound: 'yes' })).status, 400)
})

test('a reused native blank refreshes its inherited default, including no card, but explicit changes win', async t => {
  const f = fixture(t)
  await f.navigation.openWorkspace('reused')
  assert.equal(f.store.selection('blank-reused').characterCardId, f.card.id)
  f.focus('B')
  await f.navigation.openWorkspace('reused')
  assert.equal(f.store.selection('blank-reused').characterCardId, f.other.id)
  f.focus('unbound')
  await f.navigation.openWorkspace('reused')
  assert.equal(f.store.selection('blank-reused'), null)
  const restored = new PersonalityStore(f.store.storageDir.replace(/\/personality$/, ''))
  assert.equal(restored.selectDefault('blank-reused', f.card.id), true)
  restored.select('blank-reused', null)
  assert.equal(restored.selectDefault('blank-reused', f.other.id), false)
})

function restart(f, t, readSelection = async id => ({ personalityId: f.store.selection(id)?.characterCardId ?? null })) {
  f.controller.dispose()
  const controller = createPersonalityInheritance({ sessions: f.sessions, navigation: f.navigation,
    storage: { getItem: key => f.storageMap.get(key), setItem: (key, value) => f.storageMap.set(key, value) },
    readSelection, applyDefault: (id, card) => f.store.selectDefault(id, card) })
  t.after(() => controller.dispose())
  f.controller = controller
  return controller
}

test('welcome inheritance uses the captured personality after the source is deleted or rebound elsewhere', async t => {
  const f = fixture(t)
  await tick(); f.focus(null)
  const reads = []
  restart(f, t, async id => { reads.push(id); throw new Error('source session removed') })
  f.store.select('A', { characterCardId: f.other.id })
  await f.navigation.openWorkspace('cold-snapshot')
  assert.equal(f.store.selection('blank-cold-snapshot').characterCardId, f.card.id)
  assert.ok(!reads.includes('A'), 'trusted stored personality does not requery the old session')
})

test('automatic blank restoration cannot replace the welcome source; explicit focus still reads live selection', async t => {
  const f = fixture(t)
  await tick(); f.controller.dispose(); f.focus('B')
  const reads = []
  restart(f, t, async id => { reads.push(id); return { personalityId: f.store.selection(id)?.characterCardId ?? null } })
  await tick()
  assert.deepEqual(reads, [], 'initial mainView restoration is not a human focus')
  await f.navigation.openWorkspace('after-restore')
  assert.equal(f.store.selection('blank-after-restore').characterCardId, f.card.id)
  f.navigation.openSession('B')
  await tick()
  f.store.select('B', null)
  await f.navigation.openWorkspace('live-disabled')
  assert.equal(f.store.selection('blank-live-disabled'), null, 'foreground source is current, not cached')
})

test('an explicit disabled exit snapshot stays disabled and legacy session-only snapshots remain readable', async t => {
  const f = fixture(t)
  f.store.select('A', null); f.controller.refresh(); await tick(); f.focus(null)
  restart(f, t, async () => { throw new Error('a stored null must not be read again') })
  await f.navigation.openWorkspace('cold-disabled')
  assert.equal(f.store.selection('blank-cold-disabled'), null)
  f.controller.dispose()
  f.focus(null)
  const key = [...f.storageMap.keys()][0]
  f.storageMap.set(key, JSON.stringify({ sessionId: 'B' }))
  restart(f, t)
  await f.navigation.openWorkspace('legacy-memory')
  assert.equal(f.store.selection('blank-legacy-memory').characterCardId, f.other.id)
})

test('a closing focus retains its in-flight card read but cannot overwrite a newer window snapshot', async t => {
  const f = fixture(t)
  await tick(); f.controller.dispose(); f.focus(null)
  const slow = deferred(), key = [...f.storageMap.keys()][0]
  const controller = restart(f, t, id => id === 'B' ? slow.promise : Promise.resolve({ personalityId: f.card.id }))
  f.navigation.openSession('B')
  await tick(); f.focus(null)
  const create = f.navigation.openWorkspace('closing-focus')
  slow.resolve({ personalityId: f.other.id })
  await create
  assert.equal(f.store.selection('blank-closing-focus').characterCardId, f.other.id)
  controller.dispose(); f.focus(null)
  const later = deferred()
  restart(f, t, () => later.promise)
  f.navigation.openSession('A'); await tick(); f.focus(null)
  f.storageMap.set(key, JSON.stringify({ sessionId: 'another-window', personalityId: null }))
  later.resolve({ personalityId: f.card.id }); await tick()
  assert.deepEqual(JSON.parse(f.storageMap.get(key)), { sessionId: 'another-window', personalityId: null })
  await f.navigation.openWorkspace('newer-window-off')
  assert.equal(f.store.selection('blank-newer-window-off'), null)
})
