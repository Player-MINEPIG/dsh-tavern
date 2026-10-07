import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMvuGreetingInitialization } from '../packages/mvu-adapter/src/greeting-initialization.js'
import { compileMvuSchema, normalizeVariables } from '../packages/mvu-adapter/src/index.js'
const initial = () => normalizeVariables({ stat_data: { hp: 100, records: {} }, mvu_schema: compileMvuSchema('const Schema=z.strictObject({hp:z.number(),records:z.record(z.string(),z.number())});') })
test('opening envelopes apply once without reading unrelated display scripts', () => {
 const before=initial(),text='<script>_.get(data,"hp");</script><UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":80},{"op":"add","path":"/records/start","value":1}]</JSONPatch></UpdateVariable>'
 const changed=applyMvuGreetingInitialization(before,text)
 assert.deepEqual(changed.stat_data,{hp:80,records:{start:1}});assert.deepEqual(before.stat_data,{hp:100,records:{}})
 assert.deepEqual(applyMvuGreetingInitialization(before,'No variable updates'),before)
 assert.equal(applyMvuGreetingInitialization(before,'<UpdateVariable>```json\n[{"op":"replace","path":"/hp","value":70}]\n```</UpdateVariable>').stat_data.hp,70)
})
test('invalid opening updates fail atomically rather than silently omitting a field', () => {
 const before=initial()
 for(const text of ['<UpdateVariable>_.set("hp",80);_.set("unknown",1);</UpdateVariable>','<JSONPatch>[{"op":"replace","path":"/hp","value":"bad"}]</JSONPatch>','<UpdateVariable>_.set("hp",80);','</JSONPatch>']) assert.throws(()=>applyMvuGreetingInitialization(before,text),{code:'MVU_INITIALIZATION_INVALID'})
 assert.equal(before.stat_data.hp,100)
})
