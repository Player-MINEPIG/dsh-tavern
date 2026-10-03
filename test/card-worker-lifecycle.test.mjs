import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vmModule from 'node:vm'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'

test('worker construction and initial transfer failures synchronously release all resources',()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 for(const constructorFails of [true,false]) {
  let created=0,revoked=0,terminated=0;const timers=new Map()
  class Worker {constructor(){if(constructorFails)throw Error('construction failed')}postMessage(){throw Error('clone failed')}terminate(){terminated++}}
  const api=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL(){created++;return 'blob:fixture'},revokeObjectURL(){revoked++}},class {},{randomUUID:()=> 'fixture'},(fn)=>{const key={};timers.set(key,fn);return key},id=>timers.delete(id))
  for(let i=0;i<9;i++)assert.throws(()=>api({},{onError(){}}),constructorFails?/construction failed/:/clone failed/)
  assert.equal(created,9);assert.equal(revoked,9);assert.equal(terminated,constructorFails?0:9);assert.equal(timers.size,0)
 }
})

test('interval callback rearming retains its interval marker',()=>{
 const scheduled=[],sandbox=vmModule.createContext({__TavernDOM:{Element:class{},parseHTML:()=>({window:{},document:{createElement(){}}})},__host:raw=>{const data=JSON.parse(raw);if(data.op==='timer')scheduled.push(data.args);return JSON.stringify({value:null})}})
 vmModule.runInContext(VIRTUAL_DOM_BOOTSTRAP,sandbox)
 vmModule.runInContext('globalThis.count=0;setInterval(()=>count++,20)',sandbox)
 for(let i=0;i<4;i++){const [id,,interval]=scheduled.shift();assert.equal(interval,true);vmModule.runInContext(`__tick(${id},true)`,sandbox)}
 assert.equal(sandbox.count,4);assert.equal(scheduled.length,1)
})

test('duplicate guest timer IDs cannot orphan native timers at disposal',async()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker.js',import.meta.url),'utf8').replace(/^import.*\n/gm,'')
 let host,id=0;const pending=new Map(),events=[]
 const vm={dispose(){},setProp(){},newFunction(name,fn){host=fn;return{dispose(){}}},newAsyncifiedFunction(){return{dispose(){}}},typeof:handle=>handle.code==='__view()'?'string':'undefined',getString:x=>typeof x==='string'?x:'{}',newString:x=>x,evalCodeAsync:code=>({value:{code,dispose(){}}}),dump:handle=>handle.code==='__view()'?'{}':null}
 const runtime={setMemoryLimit(){},setMaxStackSize(){},setInterruptHandler(){},setModuleLoader(){},newContext:()=>vm,executePendingJobs:()=>({}),hasPendingJob:()=>false,computeMemoryUsage:()=>({dispose(){}}),dispose(){}}
 const context=vmModule.createContext({createAsyncJobDrain:()=>async()=>0,TAVERN_QUICKJS_VERSION:'0.31.0',newQuickJSAsyncWASMModuleFromVariant:async()=>({newRuntime:()=>runtime}),variant:{},VIRTUAL_DOM_BOOTSTRAP:'',TAVERN_VIRTUAL_DOM_SOURCE:'',performance:{now:()=>0},self:{postMessage:x=>events.push(x),close(){}},setTimeout:fn=>{pending.set(++id,fn);return id},clearTimeout:id=>pending.delete(id),URL,TextEncoder})
 vmModule.runInContext(source,context);context.self.onmessage({data:{kind:'init',nonce:'fixture',html:'',runs:[]}})
 for(let i=0;i<50;i++)await Promise.resolve()
 assert.ok(events.some(x=>x.kind==='ready'))
 assert.equal(JSON.parse(host(JSON.stringify({op:'timer',args:[1,100,false]}))).error,undefined)
 for(let i=0;i<4;i++)assert.match(JSON.parse(host(JSON.stringify({op:'timer',args:[1,100,false]}))).error,/timer limit/)
 assert.equal(pending.size,1);context.self.onmessage({data:{kind:'dispose',nonce:'fixture'}});assert.equal(pending.size,0)
})

test('layout replies stay within their nonce/generation and disposal prevents deferred measurement',async()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 let worker,called=0,terminated=0;const timers=new Map(),posts=[],errors=[]
 class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){terminated++}}
 const create=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=> 'nonce'},(fn,ms)=>{const key={};timers.set(key,{fn,ms});return key},key=>timers.delete(key))
 const runtime=create({},{onMeasure(){called++;return{}},onError:error=>errors.push(error.message)})
 const value={requestId:1,id:1,view:{html:'',styles:''}}
 worker.onmessage({data:{nonce:'other',kind:'measure',value}})
 await Promise.resolve();assert.equal(called,0)
 worker.onmessage({data:{nonce:'nonce',kind:'measure',value}});runtime.dispose()
 await Promise.resolve();await Promise.resolve();assert.equal(called,0);assert.equal(terminated,1);assert.equal(posts.length,1);assert.equal(timers.size,0)
})
test('layout timeout aborts its Host callback and releases the Worker without a late reply',async()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 let worker,signal,resolve,terminated=0;const timers=[],posts=[],errors=[]
 class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){terminated++}}
 const create=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=> 'nonce'},(fn,ms)=>{const value={fn,ms};timers.push(value);return value},()=>{})
 const runtime=create({},{onMeasure:(_,options)=>{signal=options.signal;return new Promise(done=>{resolve=done})},onError:error=>errors.push(error.message)})
 worker.onmessage({data:{nonce:'nonce',kind:'measure',value:{requestId:1,id:1,view:{html:'',styles:''}}}})
 await Promise.resolve();timers.find(item=>item.ms===1000).fn();assert.equal(signal.aborted,true);assert.equal(terminated,1)
 resolve({});await Promise.resolve();await Promise.resolve();assert.equal(posts.length,1);assert.match(errors[0],/layout deadline/);runtime.dispose()
})
