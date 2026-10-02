import test from 'node:test'
import assert from 'node:assert/strict'
import {createAsyncJobDrain} from '../packages/client/src/play/quickjs-async-jobs.js'
function fixture({kind='number',contextId=2,ptr=4}={}){
 let release,reject,live=true,outDisposed=0,valueDisposed=0,rawFreed=0,calls=0
 const heap=new Int32Array(16);heap[1]=contextId
 const runtime={rt:{value:1},module:{HEAP32:heap,_QTS_ExecutePendingJob(){},cwrap(name,result,args,options){assert.equal(name,'QTS_ExecutePendingJob');assert.deepEqual(options,{async:true});return async()=>{calls++;return new Promise((resolve,fail)=>{release=resolve;reject=fail})}}},memory:{newMutablePointerArray(){return{value:{ptr,typedArray:heap.subarray(1,2)},dispose(){assert.equal(live,true);live=false;outDisposed++}}}},contextMap:new Map([[2,{getMemory:()=>({heapValueHandle(){assert.equal(live,true);return{dispose(){valueDisposed++}}}}),typeof:()=>kind,getNumber:()=>1}]]),ffi:{QTS_FreeValuePointerRuntime(){rawFreed++}}}
 return{runtime,resolve:()=>release(4),reject:()=>reject(Error('C failure')),state:()=>({live,outDisposed,valueDisposed,rawFreed,calls})}
}
test('pinned async job drain holds output memory until C completes and releases handles once',async()=>{
 const f=fixture(),drain=createAsyncJobDrain(f.runtime,{version:'0.31.0'}),pending=drain()
 assert.deepEqual(f.state(),{live:true,outDisposed:0,valueDisposed:0,rawFreed:0,calls:1})
 await assert.rejects(drain(),/re-entry/);f.resolve();assert.equal(await pending,1)
 assert.deepEqual(f.state(),{live:false,outDisposed:1,valueDisposed:1,rawFreed:0,calls:1})
})
test('abort and expired generation cannot free a still-suspended output pointer',async()=>{
 for(const useAbort of [true,false]){
  const f=fixture(),controller=new AbortController();let current=true
  const pending=createAsyncJobDrain(f.runtime,{version:'0.31.0',isCurrent:()=>current})({signal:controller.signal})
  if(useAbort)controller.abort();else current=false
  assert.equal(f.state().outDisposed,0);f.resolve();await assert.rejects(pending)
  assert.equal(f.state().outDisposed,1);assert.equal(f.state().valueDisposed,1)
 }
})
test('job errors, missing contexts and rejected C calls release exactly the owned resources',async()=>{
 for(const options of [{kind:'object'},{contextId:9},{contextId:0},{reject:true}]){
  const f=fixture(options),pending=createAsyncJobDrain(f.runtime,{version:'0.31.0'})()
  options.reject?f.reject():f.resolve()
  if(options.contextId===0)assert.equal(await pending,0);else await assert.rejects(pending)
  const actual=f.state();assert.equal(actual.outDisposed,1);assert.equal(actual.valueDisposed,options.kind==='object'?1:0);assert.equal(actual.rawFreed,options.contextId!==undefined?1:0)
 }
})
test('unknown versions and symbols fail closed without invoking the unsafe sync wrapper',()=>{
 const f=fixture();assert.throws(()=>createAsyncJobDrain(f.runtime,{version:'0.32.0'}),/ABI/)
 assert.throws(()=>createAsyncJobDrain({...f.runtime,module:{}},{version:'0.31.0'}),/ABI/);assert.equal(f.state().calls,0)
})

test('resumption reads the current heap after the allocation view is detached',async()=>{
 const f=fixture(),old=f.runtime.module.HEAP32.buffer
 const pending=createAsyncJobDrain(f.runtime,{version:'0.31.0'})()
 f.runtime.module.HEAP32=new Int32Array(32);f.runtime.module.HEAP32[1]=2
 structuredClone(old,{transfer:[old]});assert.equal(old.byteLength,0)
 f.resolve();assert.equal(await pending,1)
 assert.deepEqual(f.state(),{live:false,outDisposed:1,valueDisposed:1,rawFreed:0,calls:1})
})
test('invalid output alignment and current heap bounds fail with exactly-once cleanup',async()=>{
 for(const ptr of [0,3,-4,1.5,Number.MAX_SAFE_INTEGER+1]){
  const f=fixture({ptr});await assert.rejects(createAsyncJobDrain(f.runtime,{version:'0.31.0'})(),/ABI/)
  assert.equal(f.state().calls,0);assert.equal(f.state().outDisposed,1)
 }
 for(const heap of [new Int32Array(1),new Uint8Array(64),null]){
  const f=fixture(),pending=createAsyncJobDrain(f.runtime,{version:'0.31.0'})()
  f.runtime.module.HEAP32=heap;f.resolve();await assert.rejects(pending,/ABI/)
  assert.equal(f.state().outDisposed,1);assert.equal(f.state().rawFreed,1)
 }
})
