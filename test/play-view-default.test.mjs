import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultViewTarget } from '../packages/client/src/play/view-default.js'

test('default RP view adapter acts only before the user has selected a view', () => {
  assert.equal(defaultViewTarget(null, 'rp'), 'rp')
  assert.equal(defaultViewTarget(undefined, 'rp'), 'rp')
  assert.equal(defaultViewTarget('chat', 'rp'), null)
  assert.equal(defaultViewTarget('rp', 'rp'), null)
  assert.equal(defaultViewTarget('trajectory', 'rp'), null)
})
