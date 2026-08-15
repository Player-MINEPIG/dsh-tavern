import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sameOrderedIds,
  userPanelDirty,
  userResourceDirty,
} from '../packages/user/src/client-state.js'

test('user panel reports resource and ordered relationship edits without mutating saved values', () => {
  const saved = { id: 'reader', name: 'Reader', description: 'Saved.' }
  assert.equal(userResourceDirty(structuredClone(saved), saved), false)
  assert.equal(userResourceDirty({ ...saved, description: 'Draft.' }, saved), true)
  assert.equal(sameOrderedIds(['a', 'b'], ['a', 'b']), true)
  assert.equal(sameOrderedIds(['b', 'a'], ['a', 'b']), false)
  assert.equal(userPanelDirty(saved, saved, ['a'], ['a']), false)
  assert.equal(userPanelDirty(saved, saved, ['a', 'b'], ['a']), true)
})
