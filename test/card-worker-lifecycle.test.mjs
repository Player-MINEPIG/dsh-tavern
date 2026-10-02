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
 const scheduled=[],sandbox=vmModule.createContext({__TavernDOM:{parseHTML:()=>({window:{},document:{}})},__host:raw=>{const data=JSON.parse(raw);if(data.op==='timer')scheduled.push(data.args);return JSON.stringify({value:null})}})
 vmModule.runInContext(VIRTUAL_DOM_BOOTSTRAP,sandbox)
 vmModule.runInContext('globalThis.count=0;setInterval(()=>count++,20)',sandbox)
 for(let i=0;i<4;i++){const [id,,interval]=scheduled.shift();assert.equal(interval,true);vmModule.runInContext(`__tick(${id},true)`,sandbox)}
 assert.equal(sandbox.count,4);assert.equal(scheduled.length,1)
})

test('duplicate guest timer IDs cannot orphan native timers at disposal',async()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker.js',import.meta.url),'utf8').replace(/^import.*\n/gm,'')
 let host,id=0;const pending=new Map(),events=[]
 const vm={dispose(){},setProp(){},newFunction(name,fn){host=fn;return{dispose(){}}},getString:x=>x,newString:x=>x,evalCode:code=>({value:{code,dispose(){}}}),dump:handle=>handle.code==='__view()'?'{}':null}
 const runtime={setMemoryLimit(){},setMaxStackSize(){},setInterruptHandler(){},setModuleLoader(){},newContext:()=>vm,executePendingJobs:()=>({}),hasPendingJob:()=>false,computeMemoryUsage:()=>({dispose(){}}),dispose(){}}
 const context=vmModule.createContext({newQuickJSWASMModuleFromVariant:async()=>({newRuntime:()=>runtime}),variant:{},VIRTUAL_DOM_BOOTSTRAP:'',TAVERN_VIRTUAL_DOM_SOURCE:'',performance:{now:()=>0},self:{postMessage:x=>events.push(x)},setTimeout:fn=>{pending.set(++id,fn);return id},clearTimeout:id=>pending.delete(id),URL})
 vmModule.runInContext(source,context);context.self.onmessage({data:{kind:'init',nonce:'fixture',html:'',runs:[]}})
 for(let i=0;i<5;i++)await Promise.resolve()
 assert.ok(events.some(x=>x.kind==='ready'))
 assert.equal(JSON.parse(host(JSON.stringify({op:'timer',args:[1,100,false]}))).error,undefined)
 for(let i=0;i<4;i++)assert.match(JSON.parse(host(JSON.stringify({op:'timer',args:[1,100,false]}))).error,/timer limit/)
 assert.equal(pending.size,1);context.self.onmessage({data:{kind:'dispose',nonce:'fixture'}});assert.equal(pending.size,0)
})
