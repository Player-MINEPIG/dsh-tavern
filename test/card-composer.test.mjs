import test from 'node:test'
import assert from 'node:assert/strict'
import {createCardComposerBridge,createComposerAdapter,cardComposerIdentity} from '../packages/client/src/play/card-composer.js'
import {DEPENDENCY_LIMITS} from '../packages/client/src/play/rendering-limits.js'
import {settleCardActionWait} from '../packages/client/src/play/card-action-wait-budget.js'

function fixture() {
  let active=true, state={draft:'old draft',draftRev:1,phase:'plain',attachmentIds:[],occurrences:[]},sent=[],closed=0
  const storage=new Map(),actions={captureInsertion:()=>({draftRev:state.draftRev}),insertText(text,span){if(span.draftRev!==state.draftRev||state.phase!=='plain')return false;state={...state,draft:text,draftRev:state.draftRev+1};return true}}
  const adapter=createComposerAdapter({inputActions:actions,getState:()=>state,isCurrent:()=>active,send:async(text,{signal})=>{signal?.throwIfAborted();sent.push(text)}})
  const build=()=>createCardComposerBridge({identity:'a'.repeat(64),adapter,storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},onClose:()=>closed++})
  return {adapter,build,get state(){return state},get sent(){return sent},get closed(){return closed},setActive:value=>active=value,edit:text=>state={...state,draft:text,draftRev:state.draftRev+1},busy:()=>state={...state,phase:'submitting'},attach:()=>state={...state,attachmentIds:['attachment']}}
}
const click=(operation,value,taskId='click')=>({operation,value,taskId,cause:'user-interaction',signal:new AbortController().signal})
test('fill is a revision-guarded draft edit, saved mode persists per card, and accepted send alone can close',async()=>{
 const f=fixture(),bridge=f.build()
 await bridge.request(click('saveMode',false));await bridge.request(click('fill','Option A'))
 assert.equal(f.state.draft,'Option A');assert.equal(f.sent.length,0)
 await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option A'})),/Direct send/)
 assert.equal(f.build().initial.directSend,false)
 await bridge.request(click('saveMode',true));await bridge.request(click('send',{mode:'direct',text:'Option A'}));assert.deepEqual(f.sent,['Option A']);assert.equal(f.state.draft,'')
 await bridge.request(click('close'));assert.equal(f.closed,1)
 await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option A'},'new')),/already/)
})
test('script causes, cross-event sends, changed draft, unaccepted close, and expired scopes fail before transport',async()=>{
 const f=fixture(),bridge=f.build()
 await assert.rejects(bridge.request({...click('fill','No'),cause:'script'}),/trusted/)
 await assert.rejects(bridge.request(click('close')),/accepted/)
 await bridge.request(click('fill','Option B'))
 await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option B'},'other')),/this click/)
 f.edit('typed later');await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option B'})),/changed/)
 f.setActive(false);await assert.rejects(bridge.request(click('fill','No')),/expired/)
 assert.deepEqual(f.sent,[]);assert.equal(f.closed,0)
})
test('concurrent/repeated sends are single-flight; teardown and newer edits cannot be cleared by late acceptance',async()=>{
 const f=fixture();let done
 f.adapter.send=()=>new Promise(resolve=>done=resolve)
 const bridge=f.build();await bridge.request(click('fill','Option C'))
 const pending=bridge.request(click('send',{mode:'direct',text:'Option C'}))
 await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option C'})),/already/)
 f.edit('preserve my newer draft');done();await pending;assert.equal(f.state.draft,'preserve my newer draft')
 const next=f.build();await next.request(click('fill','Option D'));const late=next.request(click('send',{mode:'direct',text:'Option D'}));next.dispose();done();await assert.rejects(late,/expired/);assert.equal(f.state.draft,'Option D')
})
test('errors are returned, rejected send cannot close, and composer admission protects chips and attachments',async()=>{
 const f=fixture();f.adapter.send=async()=>{throw Error('synthetic transport rejected')}
 const bridge=f.build();await bridge.request(click('fill','Option E'))
 await assert.rejects(bridge.request(click('send',{mode:'direct',text:'Option E'})),/transport rejected/)
 await assert.rejects(bridge.request(click('close')),/accepted/);assert.equal(f.state.draft,'Option E')
 f.attach();await assert.rejects(bridge.request(click('fill','No')),/structured/)
 const busy=fixture();busy.busy();await assert.rejects(busy.build().request(click('fill','No')),/busy/)
})
test('card mode identity is source/scope bound and persistence never stores proposal text',async()=>{
 const a=await cardComposerIdentity('session-a','source'),b=await cardComposerIdentity('session-b','source'),c=await cardComposerIdentity('session-a','different')
 assert.equal(a.length,64);assert.notEqual(a,b);assert.notEqual(a,c)
})

test('a pending opening lease ends on close, failure, task completion or disposal',async()=>{
 const f=fixture();let released=0
 f.adapter.finishRequest=()=>released++
 const bridge=f.build();await bridge.request(click('fill','Option F'));await bridge.request(click('send',{mode:'direct',text:'Option F'}))
 assert.equal(released,0);await bridge.request(click('close'));assert.equal(released,1)
 bridge.finishRequest();assert.equal(released,2);bridge.dispose();assert.equal(released,3)
 const failed=f.build();f.adapter.send=async()=>{throw Error('rejected')};await failed.request(click('fill','Option G'))
 await assert.rejects(failed.request(click('send',{mode:'direct',text:'Option G'})),/rejected/);assert.equal(released,4)
})

test('worker receiver requires actual click metadata, monotonic requests, idle generations, and tears down pending actions',async()=>{
 const {readFileSync}=await import('node:fs')
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace(/^import.*\n/gm,'').replace('export function','function')
 let worker,serial=0,calls=[],resolvePending,aborted=false;const posts=[],timers=new Map()
 class Worker {constructor(){worker=this}postMessage(data){posts.push(data)}terminate(){}}
 const create=new Function('DEPENDENCY_LIMITS','TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')(DEPENDENCY_LIMITS,'',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=>String(++serial)},(fn,ms)=>{const id={fn,ms};timers.set(id,id);return id},id=>timers.delete(id))
 const runtime=create({},{onError:()=>{},onAction:input=>{calls.push(input);if(input.operation==='fill')return{status:'filled'};return new Promise(resolve=>{resolvePending=resolve;input.signal.addEventListener('abort',()=>aborted=true)})}})
 const nonce=posts[0].nonce,message=(kind,value,otherNonce=nonce)=>worker.onmessage({data:{nonce:otherNonce,kind,value}}),tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
 runtime.dispatch({type:'click'},{trusted:false});let taskId=posts.at(-1).taskId
 message('action',{requestId:1,taskId,operation:'fill',value:'Fake'});await tick();assert.equal(calls.length,0);assert.match(posts.at(-1).value.error,/trusted/)
 runtime.dispatch({type:'input'},{trusted:true});taskId=posts.at(-1).taskId
 message('action',{requestId:2,taskId,operation:'fill',value:'Wrong event'});await tick();assert.equal(calls.length,0)
 runtime.dispatch({type:'click'},{trusted:true});taskId=posts.at(-1).taskId
 message('action',{requestId:3,taskId,operation:'fill',value:'Cross nonce'},'other');await tick();assert.equal(calls.length,0)
 message('action',{requestId:3,taskId,operation:'fill',value:'Real'});await tick();assert.equal(calls.length,1);assert.equal(calls[0].cause,'user-interaction')
 message('action',{requestId:4,taskId,operation:'fill',value:'Repeat'});await tick();assert.equal(calls.length,1)
 message('idle',{taskId});message('action',{requestId:5,taskId,operation:'send',value:{mode:'direct',text:'Real'}});await tick();assert.equal(calls.length,1)
 runtime.dispatch({type:'click'},{trusted:true});taskId=posts.at(-1).taskId
 message('action',{requestId:6,taskId,operation:'fill',value:'Next'});await tick();message('action',{requestId:7,taskId,operation:'send',value:{mode:'direct',text:'Next'}});await tick();assert.equal(calls.length,3)
 runtime.dispose();assert.equal(aborted,true);const count=posts.length;resolvePending({status:'accepted'});await tick();assert.equal(posts.length,count);assert.equal(timers.size,0)
})

test('composer waiting credits only its live interpreter entry once and remains bounded',()=>{
 const make=()=>({started:100,execution:{waitMs:0,creditedWaitMs:0},deadline:220,settled:false})
 const wait=make(),facts={current:wait.execution,live:true,now:12100,deadline:220}
 assert.equal(settleCardActionWait(wait,facts),10220)
 assert.deepEqual(wait.execution,{waitMs:12000,creditedWaitMs:10000})
 assert.equal(settleCardActionWait(wait,{...facts,deadline:10220}),10220)
 for(const alter of [{live:false},{current:{}},{deadline:221}]){
  const stale=make(),value={current:stale.execution,live:true,now:300,deadline:220,...alter}
  assert.equal(settleCardActionWait(stale,value),value.deadline)
  assert.equal(stale.execution.creditedWaitMs,0)
 }
})
