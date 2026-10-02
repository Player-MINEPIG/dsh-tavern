// Compatibility seam for quickjs-emscripten-core and its Asyncify variant 0.31.0.
// This intentionally uses pinned internals: the public synchronous job wrapper
// releases ctxPtrOut before an Asyncify job resumes. Never fall back to it.
export function createAsyncJobDrain(runtime,{version,isCurrent=()=>true}={}) {
 const invalid=()=>{throw Error('Unsupported QuickJS async job ABI; layout capability disabled')}
 if(version!=='0.31.0'||typeof runtime?.module?.cwrap!=='function'||typeof runtime?.module?._QTS_ExecutePendingJob!=='function'||typeof runtime?.memory?.newMutablePointerArray!=='function'
  ||typeof runtime?.contextMap?.get!=='function'||typeof runtime?.ffi?.QTS_FreeValuePointerRuntime!=='function'
  ||!Number.isSafeInteger(runtime?.rt?.value)||runtime.rt.value<=0)invalid()
 const execute=runtime.module.cwrap('QTS_ExecutePendingJob','number',['number','number','number'],{async:true})
 if(typeof execute!=='function')invalid()
 let running=false
 return async function drainOne({signal}={}) {
  signal?.throwIfAborted();if(!isCurrent())throw Error('Card generation expired')
  if(running)throw Error('QuickJS asynchronous job re-entry rejected')
  running=true
  let output,raw,handle,transferred=false
  try{
   output=runtime.memory.newMutablePointerArray(1)
   const outputPointer=output.value.ptr
   if(!Number.isSafeInteger(outputPointer)||outputPointer<=0||outputPointer%4!==0)invalid()
   raw=await execute(runtime.rt.value,1,outputPointer)
   if(!Number.isSafeInteger(raw)||raw<0)invalid()
   // Memory may grow while C is suspended. The allocation's cached typedArray
   // then refers to a detached buffer; acquire the module's current view here.
   const heap=runtime.module.HEAP32
   if(!(heap instanceof Int32Array)||outputPointer>heap.byteLength-4)invalid()
   const contextPointer=heap[outputPointer/4]>>>0
   let executed=0
   if(contextPointer!==0){
    const context=runtime.contextMap.get(contextPointer)
    if(!context||typeof context.getMemory!=='function'||typeof context.typeof!=='function'||typeof context.getNumber!=='function')invalid()
    handle=context.getMemory(runtime.rt.value).heapValueHandle(raw);transferred=true
    if(context.typeof(handle)!=='number')throw Error('Card asynchronous job failed')
    executed=context.getNumber(handle)
    if(!Number.isSafeInteger(executed)||executed<0||executed>1)invalid()
   }
   signal?.throwIfAborted();if(!isCurrent())throw Error('Card generation expired')
   return executed
  }finally{
   // No context or output pointer is released until the awaited C call settles.
   try{if(handle)handle.dispose();else if(raw!==undefined&&!transferred&&Number.isSafeInteger(raw)&&raw>0)runtime.ffi.QTS_FreeValuePointerRuntime(runtime.rt.value,raw)}
   finally{try{output?.dispose()}finally{running=false}}
  }
 }
}
