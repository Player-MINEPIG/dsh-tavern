import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAY_SLOT_PRIORITY,
  installPlaySlotOccupancy,
} from '../packages/client/src/play/occupancy.js'

test('Mowan owns only the sidebar shadow and additive unbound notice while Lingzhu disposes both', () => {
  const registrations = []
  const declarationCleanups = []
  const nativeStart = () => {}
  const ctx = {
    sessions: { open() {} },
    workspaces: { startSession: nativeStart },
    slots: {
      inject(name, callback) {
        assert.ok(['sidebar.workspaces', 'conversation.input.dock', 'conversation.view','main.conversation'].includes(name))
        declarationCleanups.push(callback())
      },
      register(options, component) {
        const registration = { options, component, active: true, disposals: 0 }
        registrations.push(registration)
        return () => {
          if (!registration.active) return
          registration.active = false
          registration.disposals += 1
        }
      },
    },
    effect(body) {
      return body()
    },
  }

  const switchToNative = () => {}
  const occupancy = installPlaySlotOccupancy(ctx, { mode: 'live' }, { switchToNative })
  assert.equal(registrations.length, 0)

  occupancy.setMode('play')
  assert.equal(registrations.length, 2)
  const sidebar = registrations.find(item => item.options.name === 'sidebar.workspaces')
  const notice = registrations.find(item => item.options.name === 'conversation.input.dock')
  assert.equal(sidebar.options.priority, PLAY_SLOT_PRIORITY)
  assert.equal(sidebar.options.inject().switchToNative, switchToNative)
  assert.equal(notice.options.id, 'pmp-dsh-tavern-session-dock')
  assert.equal(notice.options.order, 90)
  assert.equal(registrations.every(item => item.active), true)
  assert.equal(ctx.workspaces.startSession, nativeStart)
  assert.equal(registrations.some(item => item.options.name === 'conversation.input.left'), false)

  occupancy.setMode('play')
  assert.equal(registrations.length, 2)
  occupancy.setMode('native')
  assert.equal(registrations.every(item => !item.active && item.disposals === 1), true)

  occupancy.setMode('play')
  assert.equal(registrations.length, 4)
  assert.equal(registrations.slice(2).every(item => item.active), true)
  for (const cleanup of declarationCleanups) cleanup()
  assert.equal(registrations.slice(2).every(item => !item.active), true)
})

test('opening a draft leaves the Plugins panel through public layout navigation without creating a Session', () => {
  let panel = 'plugins', sessionOpened = false
  const registrations = [], cleanups = []
  const ctx = {
    layout: { selectPanel(value) { panel = value } },
    sessions: { list: { getSnapshot: () => ({ phase: 'ready', byId: {} }) } },
    uiWorkspace: { openSession() { sessionOpened = true } },
    slots: {
      inject(_name, fn) { cleanups.push(fn()) },
      register(options) { const item = { options, active: true }; registrations.push(item); return () => { item.active = false } },
    },
  }
  try {
    const occupancy = installPlaySlotOccupancy(ctx, {})
    occupancy.setMode('play')
    occupancy.openPlaythrough(null, { id: 'draft-1', ext: { pmpDshTavern: { draftId: 'draft-1' } } })
    assert.equal(panel, null, 'the global Plugins panel must yield to the Conversation area')
    assert.equal(occupancy.getActiveDraftId(), 'draft-1')
    assert.equal(registrations.find(item => item.active && item.options.name === 'main.conversation').options.inject().draftId, 'draft-1')
    assert.equal(sessionOpened, false, 'plugin-owned draft IDs must never be passed to a native Session API')
  } finally { for (const cleanup of cleanups) cleanup?.() }
})
