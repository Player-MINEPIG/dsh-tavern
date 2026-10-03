import test from 'node:test'
import assert from 'node:assert/strict'
import { createMvuCardBinding } from '../packages/client/src/play/mvu-bridge.js'

const scope = { sessionId: 's', variantId: 'v', endEventId: 2 }
const snapshot = revision => ({ version: 1, scope, revision, status: 'available', variables: { stat_data: { hp: 100 - revision }, schema: { type: 'object' } } })

test('binding validates scope, detaches data, polls committed changes and disposes', async t => {
  let revision = 1
  const binding = await createMvuCardBinding({ client: { getMvuSnapshot: async () => snapshot(revision) }, scope, pollMs: 250 })
  t.after(() => binding.dispose())
  const first = binding.getSnapshot(); first.variables.stat_data.hp = 0
  assert.equal(binding.getSnapshot().variables.stat_data.hp, 99)
  const changed = new Promise(resolve => binding.subscribe(resolve))
  revision = 2
  assert.equal((await changed).revision, 2)
  binding.dispose()
  assert.throws(() => binding.getSnapshot(), /disposed/)
  await assert.rejects(createMvuCardBinding({ client: { getMvuSnapshot: async () => ({ ...snapshot(1), scope: { ...scope, sessionId: 'other' } }) }, scope }), /scope mismatch/)
})
test('abort during initial snapshot stops transport and exposes no binding', async () => {
  const controller = new AbortController()
  let stopped = false
  const promise = createMvuCardBinding({ scope, signal: controller.signal, client: { getMvuSnapshot: (_scope, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { stopped = true; reject(signal.reason) }, { once: true })) } })
  controller.abort()
  await assert.rejects(promise)
  assert.equal(stopped, true)
})

test('a failed poll issued before a committed write cannot erase the newer snapshot', async () => {
  const scope = { sessionId: 's', nodeId: 'n' }, snap = revision => ({ version: 1, status: 'available', scope, revision, currentRevision: revision, variables: { stat_data: { hp: revision }, schema: {} } })
  let calls = 0, rejectPoll, entered
  const ready = new Promise(resolve => { entered = resolve })
  const binding = await createMvuCardBinding({ scope, pollMs: 250, writeGrant: { grantId: 'g', sourceIdentity: {} }, client: {
    getMvuSnapshot: () => ++calls === 1 ? snap(1) : (entered(), new Promise((_, reject) => { rejectPoll = reject })),
    postMvuOperation: async path => path === 'card-binding' ? { capability: 'private', snapshot: snap(1) } : path === 'card-write' ? snap(2) : { ok: true },
  } })
  const notifications = []; binding.subscribe(value => notifications.push(value))
  await ready
  await binding.write({ operation: 'patch', value: [], expectedRevision: 1, operationId: 'write', cause: 'script' })
  rejectPoll(new Error('old transport failure'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(binding.getSnapshot().status, 'available'); assert.equal(binding.getSnapshot().revision, 2)
  assert.deepEqual(notifications.map(value => value.revision), [2])
  binding.dispose()
})
test('an exact POST receipt remains separate when polling advances the current snapshot',async t=>{
 const scope={sessionId:'authored',mode:'initial'},snap=revision=>({version:1,status:'available',resourceId:'mvu:authored',scope,revision,currentRevision:revision,variables:{stat_data:{value:revision},schema:{type:'object'}}})
 let resolvePost,resolvePoll;const postPending=new Promise(resolve=>{resolvePost=resolve}),pollReady=new Promise(resolve=>{resolvePoll=resolve});let reads=0
 const binding=await createMvuCardBinding({scope,pollMs:250,writeGrant:{grantId:'authored',sourceIdentity:{}},client:{getMvuSnapshot:()=>{if(++reads===1)return snap(1);resolvePoll();return snap(3)},postMvuOperation:async path=>path==='card-binding'?{capability:'private',snapshot:snap(1)}:path==='card-write'?postPending:{ok:true}}})
 t.after(()=>binding.dispose());const notifications=[];binding.subscribe(value=>notifications.push(value.revision))
 const operation=binding.writeOperation({operation:'replace',value:{stat_data:{value:2}},expectedRevision:1,operationId:'exact-op',cause:'user-interaction'})
 await pollReady;await new Promise(resolve=>setImmediate(resolve));assert.equal(binding.getSnapshot().revision,3);resolvePost(snap(2))
 const receipt=await operation;assert.equal(receipt.operationId,'exact-op');assert.equal(receipt.result.revision,2);assert.ok(Object.isFrozen(receipt.result.variables.stat_data));assert.equal(binding.getSnapshot().revision,3);assert.deepEqual(notifications,[3,3])
})
test('a validated known POST outcome is retained when cancellation arrives after save',async t=>{
 const scope={sessionId:'authored'},snap=revision=>({version:1,status:'available',resourceId:'mvu:authored',scope,revision,currentRevision:revision,variables:{stat_data:{value:revision},schema:{type:'object'}}}),controller=new AbortController()
 const binding=await createMvuCardBinding({scope,writeGrant:{grantId:'authored',sourceIdentity:{}},client:{getMvuSnapshot:()=>snap(1),postMvuOperation:async path=>{if(path==='card-binding')return {capability:'private',snapshot:snap(1)};if(path==='card-write'){controller.abort();return snap(2)}return {ok:true}}}})
 t.after(()=>binding.dispose());await assert.rejects(binding.writeOperation({operation:'replace',value:{stat_data:{value:2}},expectedRevision:1,operationId:'saved-op',signal:controller.signal}),error=>error.name==='AbortError'&&error.operationReceipt.operationId==='saved-op'&&error.operationReceipt.result.revision===2)
})
