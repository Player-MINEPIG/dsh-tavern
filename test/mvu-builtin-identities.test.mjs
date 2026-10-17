import test from 'node:test'
import assert from 'node:assert/strict'
import {MVU_ADAPTERS,mvuAdapter} from '../packages/client/src/play/mvu-builtins.js'

test('local MVU contracts identify exact aliases and versions without remote byte identities',()=>{
 for(const entry of MVU_ADAPTERS){
  assert.equal(mvuAdapter(entry.url,1),entry)
  assert.equal(Object.hasOwn(entry,'sha256'),false)
  assert.equal(mvuAdapter(entry.url,2),null)
  assert.equal(mvuAdapter(entry.url+'?changed=1'),null)
  assert.equal(mvuAdapter(entry.url.replace('/gh/','/npm/')),null)
 }
 assert.equal(mvuAdapter('https://example.com/bundle.js'),null)
})
