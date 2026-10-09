import test from 'node:test'
import assert from 'node:assert/strict'
import {newQuickJSAsyncWASMModuleFromVariant} from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-asyncify'
import {createAsyncJobDrain} from '../packages/client/src/play/quickjs-async-jobs.js'

test('real Asyncify job survives WASM growth while suspended and a subsequent getter',async()=>{
 const quickjs=await newQuickJSAsyncWASMModuleFromVariant(variant)
 const runtime=quickjs.newRuntime(),vm=runtime.newContext(),module=runtime.module
 runtime.setMemoryLimit(64*1024*1024)
 let allocation=0,calls=0,outputAllocated=0,outputReleased=0,valueReleased=0,inFlight=false
 const makeOutput=runtime.memory.newMutablePointerArray.bind(runtime.memory)
 const getMemory=vm.getMemory.bind(vm),cwrap=module.cwrap.bind(module)
 runtime.memory.newMutablePointerArray=(...args)=>{
  const output=makeOutput(...args),dispose=output.dispose.bind(output);let released=false
  outputAllocated++
  output.dispose=()=>{assert.equal(inFlight,false);assert.equal(released,false);released=true;outputReleased++;dispose()}
  return output
 }
 vm.getMemory=(...args)=>{
  const memory=getMemory(...args)
  return {heapValueHandle(pointer){
   const handle=memory.heapValueHandle(pointer),dispose=handle.dispose.bind(handle);let released=false
   handle.dispose=()=>{assert.equal(released,false);released=true;valueReleased++;dispose()}
   return handle
  }}
 }
 module.cwrap=(...args)=>{
  const execute=cwrap(...args)
  return async(...values)=>{inFlight=true;try{return await execute(...values)}finally{inFlight=false}}
 }
 const run=async code=>{
  const result=await vm.evalCodeAsync(code)
  if(result.error){try{throw Error(vm.dump(result.error).message)}finally{result.error.dispose()}}
  try{return vm.typeof(result.value)==='number'?vm.getNumber(result.value):undefined}finally{result.value.dispose()}
 }
 try{
  const getter=vm.newAsyncifiedFunction('measure',async()=>{
   calls++
   await Promise.resolve()
   if(calls===1){
    assert.equal(inFlight,true)
    assert.equal(outputAllocated,1);assert.equal(outputReleased,0)
    const old=module.HEAP32.buffer,bytes=old.byteLength
    assert.ok(bytes>0&&bytes<=32*1024*1024,'bounded initial WASM heap')
    // Real Emscripten malloc grows WebAssembly.Memory and refreshes HEAP views.
    // No VM re-entry or artificial buffer replacement is used here.
    allocation=module._malloc(bytes+65536)
    assert.ok(allocation>0)
    assert.ok(module.HEAP32.byteLength>bytes)
    assert.equal(old.byteLength,0,'the allocation-time heap was detached by WASM growth')
    assert.equal(outputReleased,0)
   }
   return vm.newNumber(90)
  })
  vm.setProp(vm.global,'measure',getter);getter.dispose()
  await run('globalThis.box={get scrollHeight(){return measure()}};Promise.resolve().then(()=>{globalThis.height=box.scrollHeight});undefined')
  assert.equal(await createAsyncJobDrain(runtime,{version:'0.31.0'})(),1)
  assert.equal(runtime.hasPendingJob(),false)
  assert.equal(await run('height'),90)
  assert.deepEqual({outputAllocated,outputReleased,valueReleased},{outputAllocated:1,outputReleased:1,valueReleased:1})
  assert.equal(await run('box.scrollHeight'),90)
  assert.equal(calls,2)
 }finally{
  runtime.memory.newMutablePointerArray=makeOutput;vm.getMemory=getMemory;module.cwrap=cwrap
  if(allocation)module._free(allocation)
  vm.dispose();runtime.dispose()
 }
})
