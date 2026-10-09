import test from 'node:test'
import assert from 'node:assert/strict'
import {mvuBuiltin} from '../packages/client/src/play/mvu-builtins.js'

const schemaUrl='https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js'
const schemaHashes=[
  '78c40f52d81022d9d769a923a49e673b8babb562656051a7d0410b6b19f45184',
  'e540ab99589ad83de1495056a84693bda00af92f8848926bcb9a53b9263a0302',
]

test('reviewed schema byte revisions resolve to the same bounded backend adapter',()=>{
  for(const hash of schemaHashes){
    const descriptor=mvuBuiltin(schemaUrl,hash)
    assert.equal(descriptor?.kind,'backend-schema')
    assert.equal(descriptor.version,1)
  }
})

test('schema identities remain exact in both URL and digest',()=>{
  assert.equal(mvuBuiltin(schemaUrl,'0'.repeat(64)),null)
  for(const hash of schemaHashes){
    assert.equal(mvuBuiltin(schemaUrl+'?changed=1',hash),null)
    assert.equal(mvuBuiltin(schemaUrl.replace('StageDog','OtherOwner'),hash),null)
    assert.equal(mvuBuiltin(schemaUrl,hash.toUpperCase()),null)
  }
})
