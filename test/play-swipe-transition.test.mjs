import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consumeSwipeTransition,
  queueSwipeTransition,
} from '../packages/client/src/play/swipe-transition.js'

test('swipe transition intent is directional, one-shot and validates input', () => {
  queueSwipeTransition('', 'next')
  queueSwipeTransition('invalid-direction', 'sideways')
  assert.equal(consumeSwipeTransition(''), null)
  assert.equal(consumeSwipeTransition('invalid-direction'), null)

  queueSwipeTransition('session-next', 'next')
  queueSwipeTransition('session-previous', 'previous')
  assert.equal(consumeSwipeTransition('session-next'), 'next')
  assert.equal(consumeSwipeTransition('session-next'), null)
  assert.equal(consumeSwipeTransition('session-previous'), 'previous')
})
