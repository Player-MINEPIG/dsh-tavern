import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consumeSwipeTransition,
  queueSwipeTransition,
} from '../packages/client/src/play/swipe-transition.js'

test('swipe transition intent is directional, one-shot and validates input', () => {
  queueSwipeTransition('', 'next', 'qa-1')
  queueSwipeTransition('invalid-direction', 'sideways', 'qa-1')
  queueSwipeTransition('invalid-node', 'next', '')
  assert.equal(consumeSwipeTransition(''), null)
  assert.equal(consumeSwipeTransition('invalid-direction'), null)
  assert.equal(consumeSwipeTransition('invalid-node'), null)

  queueSwipeTransition('session-next', 'next', 'qa-2')
  queueSwipeTransition('session-previous', 'previous', 'qa-3')
  assert.deepEqual(consumeSwipeTransition('session-next'), { direction: 'next', nodeId: 'qa-2' })
  assert.equal(consumeSwipeTransition('session-next'), null)
  assert.deepEqual(consumeSwipeTransition('session-previous'), { direction: 'previous', nodeId: 'qa-3' })
})
