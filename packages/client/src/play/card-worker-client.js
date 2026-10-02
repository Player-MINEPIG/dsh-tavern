let active=0
function validateInput(data) {
 const runs=data.runs??[],modules=data.modules??{},html=data.html??''
 if(!Array.isArray(runs)||runs.length>128||!modules||typeof modules!=='object'||Array.isArray(modules)||Object.keys(modules).length>24)throw Error('Card input count exceeds limit')
 let size=0
 const count=(value,limit)=>{if(typeof value!=='string'||value.length>limit)throw Error('Card input exceeds limit');size+=new TextEncoder().encode(value).byteLength;if(size>24*1024*1024)throw Error('Card expanded input exceeds 24 MiB')}
 count(html,1024*1024)
 for(const run of runs){if(!run||typeof run!=='object')throw Error('Invalid card run');count(run.code,8*1024*1024);if(run.name!==undefined)count(run.name,2048)}
 for(const[name,code]of Object.entries(modules)){count(name,2048);count(code,8*1024*1024)}
 count(JSON.stringify({context:data.context??{},variables:data.variables??null}),256*1024)
 return {...data,runs,modules,html}
}
export function createVirtualCardRuntime(input,{onView,onProposal,onError,onAudit=()=>{},onWrite=async()=>{throw Error('Variable writes are disabled')}}) {
 const data=validateInput(input)
 if(typeof TAVERN_CARD_WORKER_SOURCE!=='string')throw Error('Card worker unavailable in this build')
 if(active>=4)throw Error('Four external card runtimes are active. Pause an older card, then retry this card.')
 const nonce=crypto.randomUUID(),url=URL.createObjectURL(new Blob([TAVERN_CARD_WORKER_SOURCE],{type:'text/javascript'}))
 let worker;try{worker=new Worker(url)}finally{URL.revokeObjectURL(url)}active++
 let disposed=false,startupTimer,busyTimer,lastWriteId=0
 const tasks=new Map(),pending=new Map()
 const stop=()=>{if(disposed)return;disposed=true;clearTimeout(startupTimer);clearTimeout(busyTimer);for(const item of pending.values()){clearTimeout(item.timer);item.controller.abort()}pending.clear();worker.terminate();tasks.clear();active--}
 const fail=(message,operationId)=>{if(disposed)return;stop();onError(Object.assign(Error(message),operationId?{operationId,outcome:'unknown'}:{}))}
 const replyWrite=(requestId,value,operationId)=>{if(disposed)return;try{if(JSON.stringify(value).length>128*1024)throw Error();worker.postMessage({kind:'writeResult',nonce,requestId,value})}catch{fail('Write result could not be delivered; inspect the operation receipt before retrying',operationId)}}
 worker.onerror=()=>fail('Card worker failed')
 worker.onmessage=event=>{
  const message=event.data
  if(disposed||message?.nonce!==nonce)return
  if(message.kind==='busy'){if(!busyTimer)busyTimer=setTimeout(()=>fail('Card worker exceeded its response deadline'),1500);return}
  if(message.kind==='ready'){clearTimeout(startupTimer);startupTimer=null;return}
  if(message.kind==='idle'){clearTimeout(busyTimer);busyTimer=null;return}
  if(message.kind==='error'){fail(String(message.value).slice(0,300));return}
  if(message.kind==='proposal'){if(typeof message.value==='string'&&message.value.length<=4000)onProposal(message.value);else fail('Invalid card proposal');return}
  if(message.kind==='write'){
   const value=message.value
   if(!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastWriteId||pending.size>=32||!['patch','replace'].includes(value.operation)||!Number.isSafeInteger(value.observedRevision)||value.observedRevision<0||JSON.stringify(value).length>128*1024){fail('Invalid or duplicate variable write request');return}
   lastWriteId=value.requestId
   const task=tasks.get(value.taskId);tasks.delete(value.taskId)
   const cause=task?.trusted===true&&performance.now()-task.at<1500?'user-interaction':value.cause==='interval'?'interval':'script'
   const operationId=crypto.randomUUID(),controller=new AbortController()
   const item={controller,operationId,timer:setTimeout(()=>{if(!pending.has(value.requestId))return;fail('Variable write outcome is unknown; inspect the operation receipt before retrying',operationId)},30000)}
   pending.set(value.requestId,item)
   Promise.resolve().then(()=>{if(disposed||!pending.has(value.requestId))return;return onWrite({operation:value.operation,value:value.value,options:value.options,cause,observedRevision:value.observedRevision,operationId,signal:controller.signal})}).then(snapshot=>{
    if(disposed||!pending.has(value.requestId))return
    pending.delete(value.requestId);clearTimeout(item.timer)
    replyWrite(value.requestId,{variables:snapshot.variables},operationId)
   },error=>{if(disposed||!pending.has(value.requestId))return;pending.delete(value.requestId);clearTimeout(item.timer);replyWrite(value.requestId,{error:{message:String(error.message).slice(0,300),code:error.code}},operationId)})
   return
  }
  if(message.kind==='audit'){onAudit(message.value);return}
  if(message.kind==='view'){
   if(typeof message.value!=='string'||message.value.length>1024*1024){fail('Card output exceeds 1 MiB');return}
   try{const view=JSON.parse(message.value);if(typeof view.html!=='string'||typeof view.styles!=='string')throw Error();onView(view)}catch{fail('Invalid card view')}
  }
 }
 startupTimer=setTimeout(()=>fail('Card worker exceeded its startup deadline'),15000)
 try{worker.postMessage({...data,kind:'init',nonce})}catch(error){stop();throw error}
 let events=0,epoch=performance.now()
 const send=(kind,value,metadata={})=>{if(disposed)return;const now=performance.now();if(now-epoch>1000){epoch=now;events=0}if(++events>128){fail('Card input rate limit exceeded');return}try{worker.postMessage({kind,nonce,value,...metadata})}catch{fail('Card input could not be transferred')}}
 return {dispose:stop,dispatch:(value,{trusted=false}={})=>{for(const[id,task]of tasks)if(performance.now()-task.at>1500)tasks.delete(id);if(tasks.size>=128){fail('Card event task limit exceeded');return}const taskId=crypto.randomUUID();tasks.set(taskId,{trusted,at:performance.now()});send('event',value,{taskId})},notifyVariables:value=>send('variables',value)}
}
