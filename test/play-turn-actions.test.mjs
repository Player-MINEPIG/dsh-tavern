import test from 'node:test'
import assert from 'node:assert/strict'
import { turnActionCapabilities } from '../packages/client/src/play/turn-actions.js'

test('human-triggered replies expose the complete RP action set', () => {
  assert.deepEqual(turnActionCapabilities({ triggerKind: 'user' }), {
    copy: true,
    variants: true,
    generateReply: true,
    fork: true,
    editDisplay: true,
    hide: true,
  })
})

test('context-triggered parent output cannot be retried or swiped as a human prompt', () => {
  assert.deepEqual(turnActionCapabilities({ triggerKind: 'context' }), {
    copy: true,
    variants: false,
    generateReply: false,
    fork: true,
    editDisplay: true,
    hide: true,
  })
})
