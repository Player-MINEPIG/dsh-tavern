import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {sourceSha256} from '../packages/client/src/play/source-sha256.js'
import {openingSourceIdentity,createIdentityOpeningBridge,createOpeningSourceCache} from '../packages/client/src/play/identity-opening-bridge.js'
import {IDENTITY_OPENING_RUNTIME} from '../packages/client/src/play/identity-opening-runtime.js'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
import {OPENING_SOURCES} from '../packages/opening-worldbook/manifest.js'

test('opening identity binds trusted session, character and original greeting before display expansion',()=>{
 const binding=openingSourceIdentity({sessionId:'session-fixture',greeting:{characterId:'character-fixture',index:0,text:'display expansion',options:[{index:0,text:'raw greeting'}]}})
 assert.equal(binding.greetingSha256,sourceSha256('raw greeting'))
 assert.equal(binding.sessionId,'session-fixture');assert.equal(binding.greetingIndex,0);assert.ok(Object.isFrozen(binding))
 assert.equal(openingSourceIdentity({sessionId:'session-fixture',greeting:{characterId:'character-fixture',index:0,text:'display expansion',options:[]}}),null)
 assert.throws(()=>createIdentityOpeningBridge({sourceIdentity:binding,identitySource:'source drift'}),/binding is unavailable/)
})
test('VM opening promises accept only their own reply and do not expose write authorization',async()=>{
 const calls=[],context=vm.createContext({__call:(op,args)=>calls.push({op,args})})
 vm.runInContext(IDENTITY_OPENING_RUNTIME,context)
 const first=vm.runInContext('__identityOpening("police_done")',context)
 await assert.rejects(vm.runInContext('__identityOpening("pool")',context),/pending/)
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{op:'identityOpening',args:[1,'police_done']}])
 vm.runInContext('__identityOpeningResult(999,{value:{ok:true}})',context)
 vm.runInContext('__identityOpeningResult(1,{value:{ok:true,receiptId:"receipt-fixture"}})',context)
 assert.equal((await first).receiptId,'receipt-fixture')
 assert.equal(vm.runInContext('typeof fetch+":"+typeof __identityOpeningCommit',context),'undefined:undefined')
 const second=vm.runInContext('__identityOpening("hospital_done")',context)
 vm.runInContext('__identityOpeningResult(2,{error:"source expired"})',context)
 await assert.rejects(second,/source expired/)
})
test('inert cache charges cold data before selection, rejects drift and cannot exceed shared code budget',async()=>{
 const descriptor=OPENING_SOURCES[0],budget=createRenderingCacheBudget(),stored='changed',events=[]
 const cache=createOpeningSourceCache({budget,store:{async get(){events.push(budget.snapshot().total);return stored},async remove(){events.push('removed')}},download:async()=>{throw Error('not requested')}})
 await cache.ready
 assert.equal(events[0],descriptor.byteLength);assert.deepEqual(events,[descriptor.byteLength,'removed']);assert.equal(budget.snapshot().total,0)
 await assert.rejects(cache.get(),/source changed/)
 const small=createRenderingCacheBudget(descriptor.byteLength-1)
 const denied=createOpeningSourceCache({budget:small,store:{get(){throw Error('must not read')}},download(){throw Error('must not download')}})
 await denied.ready;await assert.rejects(denied.get(),/shared byte budget/);assert.equal(small.snapshot().total,0)
})
test('parent opening callbacks require a fresh trusted click and discard replies after disposal',async()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 let worker,called=0,done,serial=0;const posts=[],timers=new Map()
 class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){}}
 const create=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=>String(++serial)},(fn,ms)=>{const key={fn,ms};timers.set(key,key);return key},key=>timers.delete(key))
 const runtime=create({identityOpening:true},{onOpening(){called++;return new Promise(resolve=>done=resolve)},onError(){}}),nonce=posts[0].nonce
 runtime.dispatch({type:'click',target:1},{trusted:false});const untrusted=posts.at(-1).taskId
 worker.onmessage({data:{nonce,kind:'identityOpening',value:{requestId:1,openingId:'default',taskId:untrusted}}})
 for(let i=0;i<5;i++)await Promise.resolve()
 assert.equal(called,0);assert.match(posts.at(-1).value.error,/user click/)
 runtime.dispatch({type:'click',target:1},{trusted:true});const trusted=posts.at(-1).taskId
 worker.onmessage({data:{nonce:'other',kind:'identityOpening',value:{requestId:2,openingId:'pool',taskId:trusted}}})
 worker.onmessage({data:{nonce,kind:'identityOpening',value:{requestId:2,openingId:'pool',taskId:trusted}}})
 await Promise.resolve();assert.equal(called,1);runtime.dispose();done({ok:true})
 for(let i=0;i<5;i++)await Promise.resolve()
 assert.equal(posts.filter(value=>value.kind==='identityOpeningResult').length,1);assert.equal(timers.size,0)
})
