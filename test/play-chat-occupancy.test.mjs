import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAY_SLOT_PRIORITY,
  PLAY_VIEW_ID,
  PLAY_VIEW_ORDER,
  installPlaySlotOccupancy,
} from '../packages/client/src/play/occupancy.js'

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

test('Mowan adds the default RP view only while the current session belongs to a playthrough', async () => {
  let snapshot = {
    current: 'root',
    byId: {
      root: { id: 'root', cwd: '/rp' },
      ordinary: { id: 'ordinary', cwd: '/rp' },
      outside: { id: 'outside', cwd: '/other' },
    },
  }
  let notifySessions = () => {}
  const registrations = []
  const declarationCleanups = []
  const playthrough = {
    id: 'pt-a',
    path: 'characters/a/playthroughs/pt-a/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'root' } },
  }
  const client = {
    async getWorkspace() { return { selected: true, rootPath: '/rp' } },
    async getCatalog() { return { playthroughs: [playthrough] } },
    async getTimeline() { return { nodes: [] } },
  }
  const ctx = {
    sessions: {
      open() {},
      list: {
        getSnapshot() { return snapshot },
        subscribe(callback) {
          notifySessions = callback
          return () => { notifySessions = () => {} }
        },
      },
    },
    slots: {
      inject(_name, callback) { declarationCleanups.push(callback()) },
      register(options, component) {
        const registration = { options, component, active: true }
        registrations.push(registration)
        return () => { registration.active = false }
      },
    },
    effect(body) { return body() },
  }

  const occupancy = installPlaySlotOccupancy(ctx, client)
  occupancy.setMode('play')
  await nextTurn()

  const firstChat = registrations.find(item => item.options.name === 'conversation.view')
  assert.ok(firstChat)
  assert.equal(firstChat.active, true)
  assert.equal(firstChat.options.id, PLAY_VIEW_ID)
  assert.notEqual(firstChat.options.id, 'chat')
  assert.equal(firstChat.options.order, PLAY_VIEW_ORDER)
  assert.equal(firstChat.options.priority, PLAY_SLOT_PRIORITY)
  assert.equal(firstChat.options.inject().playthrough, playthrough)
  const firstAdapter = registrations.find(item => item.options.name === 'conversation.view' && item.options.id === 'chat')
  assert.ok(firstAdapter)
  assert.equal(firstAdapter.active, true)
  assert.equal(firstAdapter.options.priority, PLAY_SLOT_PRIORITY)
  assert.equal(firstAdapter.options.inject().targetViewId, PLAY_VIEW_ID)

  snapshot = {
    ...snapshot,
    byId: {
      ...snapshot.byId,
      root: { ...snapshot.byId.root, running: true, blank: false },
    },
  }
  notifySessions()
  await nextTurn()
  assert.equal(firstChat.active, true)
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 2)

  firstAdapter.options.inject().complete()
  assert.equal(firstAdapter.active, false)
  notifySessions()
  await nextTurn()
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 2)

  snapshot = { ...snapshot, current: 'ordinary' }
  notifySessions()
  assert.equal(firstChat.active, false)
  await nextTurn()
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 2)

  snapshot = { ...snapshot, current: 'outside' }
  notifySessions()
  await nextTurn()
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 2)

  snapshot = { ...snapshot, current: 'root' }
  notifySessions()
  await nextTurn()
  const chats = registrations.filter(item => item.options.name === 'conversation.view')
  assert.equal(chats.length, 3)
  assert.equal(chats[2].options.id, PLAY_VIEW_ID)
  assert.equal(chats[2].active, true)

  occupancy.setMode('native')
  assert.equal(chats[2].active, false)
  for (const cleanup of declarationCleanups) cleanup()
})

test('Chat classification failures preserve the official view', async () => {
  const registrations = []
  const ctx = {
    sessions: {
      open() {},
      list: {
        getSnapshot() { return { current: 'root', byId: { root: { id: 'root', cwd: '/rp' } } } },
        subscribe() { return () => {} },
      },
    },
    slots: {
      inject(_name, callback) { callback() },
      register(options) { registrations.push(options); return () => {} },
    },
    effect(body) { return body() },
  }
  const occupancy = installPlaySlotOccupancy(ctx, {
    async getWorkspace() { throw new Error('offline') },
  })
  occupancy.setMode('play')
  await nextTurn()
  assert.equal(registrations.some(item => item.name === 'conversation.view'), false)
})
