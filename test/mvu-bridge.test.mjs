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

test('temporary read failure retains verified display, denies writes and recovers at the same revision',async t=>{
 let mode='ready',calls=0,writes=0
 const binding=await createMvuCardBinding({scope,pollMs:250,writeGrant:{grantId:'g',sourceIdentity:{}},client:{
  getMvuSnapshot:async()=>{calls++;if(mode==='failed')throw Object.assign(Error('temporarily busy'),{status:503});return snapshot(4)},
  postMvuOperation:async(path,body)=>path==='card-binding'?{capability:body.bindingId,snapshot:snapshot(4)}:path==='card-write'?(writes++,snapshot(5)):{ok:true},
 }})
 t.after(()=>binding.dispose())
 const waitFor=predicate=>new Promise(resolve=>{const stop=binding.subscribe(value=>{if(predicate(value)){stop();resolve(value)}})})
 const failed=waitFor(value=>value.readState==='failed');mode='failed';await failed
 assert.equal(binding.getSnapshot().variables.stat_data.hp,96);assert.equal(binding.getSnapshot().status,'available');assert.equal(binding.getSnapshot().writable,false)
 await assert.rejects(binding.write({operation:'patch',value:[]}),error=>error.code==='MVU_READ_FAILED');assert.equal(writes,0)
 const notices=[];const stop=binding.subscribe(value=>notices.push(value))
 await new Promise(resolve=>setTimeout(resolve,300));assert.equal(notices.length,0,'identical failed polls must not flood the VM')
 const recovered=waitFor(value=>!value.readState);mode='ready';await recovered
 assert.equal(binding.getSnapshot().revision,4);assert.equal(binding.getSnapshot().writable,true);assert.ok(calls>=3);stop()
})

test('access rejection and malformed replies invalidate the display instead of retaining stale variables',async t=>{
 for(const failure of ['access','source','malformed']){
  let fail=false
  const binding=await createMvuCardBinding({scope,pollMs:250,client:{getMvuSnapshot:async()=>{if(!fail)return snapshot(4);if(failure==='access')throw Object.assign(Error('scope revoked'),{status:403,code:'MVU_SCOPE'});if(failure==='source')throw Object.assign(Error('source is unavailable'),{status:503,code:'MVU_HISTORY_UNAVAILABLE'});return {...snapshot(4),scope:{sessionId:'foreign'}}}}})
  t.after(()=>binding.dispose())
  const changed=new Promise(resolve=>binding.subscribe(resolve));fail=true
  const value=await changed;assert.equal(value.status,'unavailable');assert.deepEqual(value.variables,{})
  binding.dispose()
 }
})

test('a failed poll issued before a committed write cannot erase the newer snapshot', async () => {
  const scope = { sessionId: 's', nodeId: 'n' }, snap = revision => ({ version: 1, status: 'available', scope, revision, currentRevision: revision, variables: { stat_data: { hp: revision }, schema: {} } })
  let calls = 0, rejectPoll, entered
  const ready = new Promise(resolve => { entered = resolve })
  const binding = await createMvuCardBinding({ scope, pollMs: 250, writeGrant: { grantId: 'g', sourceIdentity: {} }, client: {
    getMvuSnapshot: () => ++calls === 1 ? snap(1) : (entered(), new Promise((_, reject) => { rejectPoll = reject })),
    postMvuOperation: async (path,body) => path === 'card-binding' ? { capability: body.bindingId, snapshot: snap(1) } : path === 'card-write' ? snap(2) : { ok: true },
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
 const binding=await createMvuCardBinding({scope,pollMs:250,writeGrant:{grantId:'authored',sourceIdentity:{}},client:{getMvuSnapshot:()=>{if(++reads===1)return snap(1);resolvePoll();return snap(3)},postMvuOperation:async(path,body)=>path==='card-binding'?{capability:body.bindingId,snapshot:snap(1)}:path==='card-write'?postPending:{ok:true}}})
 t.after(()=>binding.dispose());const notifications=[];binding.subscribe(value=>notifications.push(value.revision))
 const operation=binding.writeOperation({operation:'replace',value:{stat_data:{value:2}},expectedRevision:1,operationId:'exact-op',cause:'user-interaction'})
 await pollReady;await new Promise(resolve=>setImmediate(resolve));assert.equal(binding.getSnapshot().revision,3);resolvePost(snap(2))
 const receipt=await operation;assert.equal(receipt.operationId,'exact-op');assert.equal(receipt.result.revision,2);assert.ok(Object.isFrozen(receipt.result.variables.stat_data));assert.equal(binding.getSnapshot().revision,3);assert.deepEqual(notifications,[3,3])
})
test('a validated known POST outcome is retained when cancellation arrives after save',async t=>{
 const scope={sessionId:'authored'},snap=revision=>({version:1,status:'available',resourceId:'mvu:authored',scope,revision,currentRevision:revision,variables:{stat_data:{value:revision},schema:{type:'object'}}}),controller=new AbortController()
 const binding=await createMvuCardBinding({scope,writeGrant:{grantId:'authored',sourceIdentity:{}},client:{getMvuSnapshot:()=>snap(1),postMvuOperation:async(path,body)=>{if(path==='card-binding')return {capability:body.bindingId,snapshot:snap(1)};if(path==='card-write'){controller.abort();return snap(2)}return {ok:true}}}})
 t.after(()=>binding.dispose());await assert.rejects(binding.writeOperation({operation:'replace',value:{stat_data:{value:2}},expectedRevision:1,operationId:'saved-op',signal:controller.signal}),error=>error.name==='AbortError'&&error.operationReceipt.operationId==='saved-op'&&error.operationReceipt.result.revision===2)
})

test('lost capability responses revoke the native known ID without consuming slots',async()=>{
 const live=new Set(),revoked=[]
 for(let i=0;i<520;i++)await assert.rejects(createMvuCardBinding({scope,writeGrant:{grantId:'authored',sourceIdentity:{}},client:{getMvuSnapshot:()=>snapshot(1),postMvuOperation:async(path,body)=>{
  if(path==='card-binding'){live.add(body.bindingId);throw Error('Response lost after allocation')}
  if(path==='card-binding/revoke'){revoked.push(body.capability);live.delete(body.capability);return {ok:true}}
 }}}),/Response lost/)
 assert.equal(live.size,0);assert.equal(new Set(revoked).size,520)
})
