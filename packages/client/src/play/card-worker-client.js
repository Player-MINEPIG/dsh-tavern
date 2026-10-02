let active=0
export function createVirtualCardRuntime(data,{onView,onProposal,onError,onAudit=()=>{},onWrite=async()=>{throw Error('Variable writes are disabled')}}) {
  if(typeof TAVERN_CARD_WORKER_SOURCE!=='string')throw Error('Card worker unavailable in this build')
  if(active>=4)throw Error('Four external card runtimes are already active; close a card before starting another')
  const nonce=crypto.randomUUID(), url=URL.createObjectURL(new Blob([TAVERN_CARD_WORKER_SOURCE],{type:'text/javascript'}))
  let worker;try{worker=new Worker(url)}finally{URL.revokeObjectURL(url)}active++
  let disposed=false,timer
  const tasks=new Map()
  const stop=()=>{if(disposed)return;disposed=true;clearTimeout(timer);worker.terminate();tasks.clear();active--}
  const fail=message=>{if(disposed)return;stop();onError(Error(message))}
  const watch=ms=>{clearTimeout(timer);timer=setTimeout(()=>fail('Card worker exceeded its response deadline'),ms)}
  worker.onerror=()=>fail('Card worker failed')
  worker.onmessage=event=>{
    const message=event.data
    if(disposed||message?.nonce!==nonce)return
    if(message.kind==='busy'){if(!timer)watch(1500);return}
    if(['ready','idle'].includes(message.kind)){clearTimeout(timer);timer=null;return}
    if(message.kind==='error'){fail(String(message.value).slice(0,300));return}
    if(message.kind==='proposal'){if(typeof message.value==='string'&&message.value.length<=4000)onProposal(message.value);else fail('Invalid card proposal');return}
    if(message.kind==='write'){
      const value=message.value
      if(!value||!Number.isSafeInteger(value.requestId)||!['patch','replace'].includes(value.operation)||JSON.stringify(value).length>128*1024){fail('Invalid variable write request');return}
      const task=tasks.get(value.taskId)
      const cause=task?.trusted===true&&performance.now()-task.at<1500?'user-interaction':value.cause==='interval'?'interval':'script'
      Promise.resolve().then(()=>onWrite({operation:value.operation,value:value.value,options:value.options,cause})).then(snapshot=>{
        if(!disposed)worker.postMessage({kind:'writeResult',nonce,requestId:value.requestId,value:{variables:snapshot.variables}})
      },error=>{if(!disposed)worker.postMessage({kind:'writeResult',nonce,requestId:value.requestId,value:{error:{message:String(error.message).slice(0,300),code:error.code}}})})
      return
    }
    if(message.kind==='audit'){onAudit(message.value);return}
    if(message.kind==='view'){
      if(typeof message.value!=='string'||message.value.length>1024*1024){fail('Card output exceeds 1 MiB');return}
      try{const view=JSON.parse(message.value);if(typeof view.html!=='string'||typeof view.styles!=='string')throw Error();onView(view)}catch{fail('Invalid card view')}
    }
  }
  watch(15000);try{worker.postMessage({...data,kind:'init',nonce})}catch(error){stop();throw error}
  let events=0,epoch=performance.now()
  const send=(kind,value,metadata={})=>{if(disposed)return;const now=performance.now();if(now-epoch>1000){epoch=now;events=0}if(++events>128){fail('Card input rate limit exceeded');return}try{worker.postMessage({kind,nonce,value,...metadata})}catch(error){fail('Card input could not be transferred')}}
  return {dispose:stop,dispatch:(value,{trusted=false}={})=>{for(const[id,task]of tasks)if(performance.now()-task.at>1500)tasks.delete(id);if(tasks.size>=128){fail('Card event task limit exceeded');return}const taskId=crypto.randomUUID();tasks.set(taskId,{trusted,at:performance.now()});send('event',value,{taskId})},notifyVariables:value=>send('variables',value)}
}
