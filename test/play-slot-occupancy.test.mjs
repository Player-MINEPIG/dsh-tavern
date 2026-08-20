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
        assert.ok(['sidebar.workspaces', 'conversation.input.dock', 'conversation.view'].includes(name))
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

  const occupancy = installPlaySlotOccupancy(ctx, { mode: 'live' })
  assert.equal(registrations.length, 0)

  occupancy.setMode('play')
  assert.equal(registrations.length, 2)
  const sidebar = registrations.find(item => item.options.name === 'sidebar.workspaces')
  const notice = registrations.find(item => item.options.name === 'conversation.input.dock')
  assert.equal(sidebar.options.priority, PLAY_SLOT_PRIORITY)
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
