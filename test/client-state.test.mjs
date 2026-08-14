import test from 'node:test'
import assert from 'node:assert/strict'
import { reorder, shouldUseFloatingPanel } from '../packages/preset/src/client-state.js'

test('direct prompt reordering moves one item without mutating the draft array', () => {
  const prompts = [{ name: 'first' }, { name: 'second' }, { name: 'third' }]
  const moved = reorder(prompts, 1, 0)

  assert.deepEqual(moved.map((prompt) => prompt.name), ['second', 'first', 'third'])
  assert.deepEqual(prompts.map((prompt) => prompt.name), ['first', 'second', 'third'])
  assert.equal(reorder(prompts, -1, 0), prompts)
})

test('floating preset entry is exclusive to missing or blank sessions', () => {
  assert.equal(shouldUseFloatingPanel({ current: undefined, byId: {} }), true)
  assert.equal(shouldUseFloatingPanel({ current: 'blank', byId: { blank: { blank: true } } }), true)
  assert.equal(shouldUseFloatingPanel({ current: 'active', byId: { active: { blank: false } } }), false)
})
