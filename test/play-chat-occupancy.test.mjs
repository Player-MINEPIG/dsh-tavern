import test from 'node:test'
import assert from 'node:assert/strict'
import { CLIENT_UI_SETTINGS_EVENT } from '../packages/identity.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'
import {
  PLAY_DEFAULT_VIEW_ADAPTER_ID,
  PLAY_SLOT_PRIORITY,
  PLAY_VIEW_ID,
  PLAY_VIEW_ORDER,
  findConversationStore,
  installPlaySlotOccupancy,
} from '../packages/client/src/play/occupancy.js'

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

test('locale refresh updates the view roster without repeating the default-view choice', async () => {
  const previousWindow = globalThis.window
  const previousSettings = getClientUiSettings()
  globalThis.window = new EventTarget()
  const registrations = [], cleanups = []
  const playthrough = { id: 'pt', path: 'pt/timeline.json', ext: { pmpDshTavern: { rootSessionId: 's' } } }
  const ctx = {
    sessions: { list: { getSnapshot: () => ({ current: 's', byId: { s: { id: 's', cwd: '/rp' } } }) } },
    slots: {
      entries: () => [{ store: {} }],
      inject(_name, callback) { cleanups.push(callback()) },
      register(options) {
        const entry = { options, active: true, label: options.label?.() }
        registrations.push(entry)
        return () => { entry.active = false }
      },
    },
  }
  try {
    setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
    const occupancy = installPlaySlotOccupancy(ctx, {
      getWorkspace: async () => ({ selected: true, rootPath: '/rp' }),
      getCatalog: async () => ({ playthroughs: [playthrough] }),
      getTimeline: async () => ({ nodes: [] }),
    })
    occupancy.setMode('play')
    await nextTurn()
    const original = registrations.find(e => e.options.id === PLAY_VIEW_ID)
    registrations.find(e => e.options.id === PLAY_DEFAULT_VIEW_ADAPTER_ID).options.inject().complete()
    setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
    window.dispatchEvent(new Event(CLIENT_UI_SETTINGS_EVENT))
    assert.equal(original.active, false)
    const views = registrations.filter(e => e.options.id === PLAY_VIEW_ID)
    assert.equal(views.length, 2)
    assert.equal(views[1].label, 'RP View')
    assert.equal(registrations.filter(e => e.options.id === PLAY_DEFAULT_VIEW_ADAPTER_ID).length, 1)
    window.dispatchEvent(new Event(CLIENT_UI_SETTINGS_EVENT))
    assert.equal(registrations.filter(e => e.options.id === PLAY_VIEW_ID).length, 2)
    for (const cleanup of cleanups) cleanup()
    setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
    window.dispatchEvent(new Event(CLIENT_UI_SETTINGS_EVENT))
    assert.equal(registrations.filter(e => e.options.id === PLAY_VIEW_ID).length, 2)
  } finally {
    for (const cleanup of cleanups) cleanup()
    globalThis.window = previousWindow
    setClientUiSettings(previousSettings, { announce: false })
  }
})

test('Mowan adds the default RP view only while the current session belongs to a playthrough', async () => {
  let snapshot = {
    current: 'root',
    byId: {
      root: { id: 'root', cwd: '/rp' },
      swipe: { id: 'swipe', cwd: '/rp' },
      ordinary: { id: 'ordinary', cwd: '/rp' },
      outside: { id: 'outside', cwd: '/other' },
    },
  }
  let notifySessions = () => {}
  const registrations = []
  const declarationCleanups = []
  const nativeChatStore = { create() {} }
  const playthrough = {
    id: 'pt-a',
    path: 'characters/a/playthroughs/pt-a/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'root' } },
  }
  const client = {
    async getWorkspace() { return { selected: true, rootPath: '/rp' } },
    async getCatalog() { return { playthroughs: [playthrough] } },
    async getTimeline() {
      return {
        nodes: [{
          id: 'qa-1', kind: 'qa', adoptedVariantId: 'swipe-v',
          variants: [{ id: 'swipe-v', sessionId: 'swipe', startEventId: 1, endEventId: 3 }],
        }],
      }
    },
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
      entries(name) {
        return name === 'conversation.session'
          ? [{ options: {}, store: nativeChatStore }]
          : []
      },
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
  const firstAdapter = registrations.find(item => item.options.id === PLAY_DEFAULT_VIEW_ADAPTER_ID)
  assert.ok(firstAdapter)
  assert.equal(firstAdapter.active, true)
  assert.equal(firstAdapter.options.name, 'conversation.input.dock')
  assert.equal(firstAdapter.options.priority, PLAY_SLOT_PRIORITY)
  assert.equal(firstAdapter.options.store, nativeChatStore)
  assert.equal(firstAdapter.options.inject().targetViewId, PLAY_VIEW_ID)
  assert.equal(registrations.some(item => item.options.name === 'conversation.view' && item.options.id === 'chat'), false)

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
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 1)

  firstAdapter.options.inject().complete()
  assert.equal(firstAdapter.active, false)
  notifySessions()
  await nextTurn()
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 1)

  snapshot = { ...snapshot, current: 'swipe' }
  notifySessions()
  assert.equal(firstChat.active, true)
  await nextTurn()
  assert.equal(firstChat.active, true)
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 1)

  snapshot = { ...snapshot, current: 'ordinary' }
  notifySessions()
  assert.equal(firstChat.active, true)
  await nextTurn()
  assert.equal(firstChat.active, false)

  snapshot = { ...snapshot, current: 'outside' }
  notifySessions()
  await nextTurn()
  assert.equal(registrations.filter(item => item.options.name === 'conversation.view').length, 1)

  snapshot = { ...snapshot, current: 'root' }
  notifySessions()
  await nextTurn()
  const chats = registrations.filter(item => item.options.name === 'conversation.view')
  assert.equal(chats.length, 2)
  assert.equal(chats[1].options.id, PLAY_VIEW_ID)
  assert.equal(chats[1].active, true)

  occupancy.setMode('native')
  assert.equal(chats[1].active, false)
  for (const cleanup of declarationCleanups) cleanup()
})

test('default view adapter reuses the Conversation shell store, not the Chat target store', () => {
  const nativeChatStore = { create() {} }
  assert.equal(findConversationStore({
    entries(name) {
      assert.equal(name, 'conversation.session')
      return [
        { options: {} },
        { options: {}, store: nativeChatStore },
      ]
    },
  }), nativeChatStore)
  assert.equal(findConversationStore({ entries() { return [] } }), undefined)
  assert.equal(findConversationStore({}), undefined)
})

test('sidebar navigation keeps the selected playthrough when fork histories share a session', async () => {
  let snapshot = {
    current: null,
    byId: { shared: { id: 'shared', cwd: '/rp' } },
  }
  const registrations = []
  const first = { id: 'first', path: 'first/timeline.json' }
  const selected = { id: 'selected', path: 'selected/timeline.json' }
  const client = {
    async getWorkspace() { return { selected: true, rootPath: '/rp' } },
    async getCatalog() { return { playthroughs: [first, selected] } },
    async getTimeline(playthrough) {
      return {
        nodes: [{
          id: `${playthrough.id}-qa`, kind: 'qa', adoptedVariantId: `${playthrough.id}-v`,
          variants: [{ id: `${playthrough.id}-v`, sessionId: 'shared', startEventId: 1, endEventId: 2 }],
        }],
      }
    },
  }
  const ctx = {
    sessions: {
      open(sessionId) { snapshot = { ...snapshot, current: sessionId } },
      list: {
        getSnapshot() { return snapshot },
        subscribe() { return () => {} },
      },
    },
    slots: {
      entries() { return [] },
      inject(_name, callback) { callback() },
      register(options) {
        registrations.push(options)
        return () => {}
      },
    },
    effect(body) { return body() },
  }

  const occupancy = installPlaySlotOccupancy(ctx, client)
  occupancy.setMode('play')
  const sidebar = registrations.find(item => item.name === 'sidebar.workspaces')
  sidebar.inject().openSession('shared', selected)
  await nextTurn()
  const chat = registrations.find(item => item.name === 'conversation.view')
  assert.equal(chat.inject().playthrough.id, 'selected')
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
