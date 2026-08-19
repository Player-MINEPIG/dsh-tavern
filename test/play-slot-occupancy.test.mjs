import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAY_SLOT_PRIORITY,
  installPlaySlotOccupancy,
} from '../packages/client/src/play/occupancy.js'

test('Mowan shadows only sidebar.workspaces and Lingzhu disposes the shadow', () => {
  const registrations = []
  let declarationCleanup = null
  const nativeStart = () => {}
  const ctx = {
    sessions: { open() {} },
    workspaces: { startSession: nativeStart },
    slots: {
      inject(name, callback) {
        assert.equal(name, 'sidebar.workspaces')
        declarationCleanup = callback()
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
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, 'sidebar.workspaces')
  assert.equal(registrations[0].options.priority, PLAY_SLOT_PRIORITY)
  assert.equal(registrations[0].active, true)
  assert.equal(ctx.workspaces.startSession, nativeStart)

  occupancy.setMode('play')
  assert.equal(registrations.length, 1)
  occupancy.setMode('native')
  assert.equal(registrations[0].active, false)
  assert.equal(registrations[0].disposals, 1)

  occupancy.setMode('play')
  assert.equal(registrations.length, 2)
  assert.equal(registrations[1].active, true)
  declarationCleanup()
  assert.equal(registrations[1].active, false)
})
