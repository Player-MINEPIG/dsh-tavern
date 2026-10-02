let active=0
export function createVirtualCardRuntime(data,{onView,onProposal,onError,onAudit=()=>{}}) {
  if(typeof TAVERN_CARD_WORKER_SOURCE!=='string')throw Error('Card worker unavailable in this build')
  if(active>=4)throw Error('Four external card runtimes are already active; close a card before starting another')
  const nonce=crypto.randomUUID(), url=URL.createObjectURL(new Blob([TAVERN_CARD_WORKER_SOURCE],{type:'text/javascript'}))
  let worker;try{worker=new Worker(url)}finally{URL.revokeObjectURL(url)}active++
  let disposed=false,timer
  const stop=()=>{if(disposed)return;disposed=true;clearTimeout(timer);worker.terminate();active--}
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
    if(message.kind==='audit'){onAudit(message.value);return}
    if(message.kind==='view'){
      if(typeof message.value!=='string'||message.value.length>1024*1024){fail('Card output exceeds 1 MiB');return}
      try{const view=JSON.parse(message.value);if(typeof view.html!=='string'||typeof view.styles!=='string')throw Error();onView(view)}catch{fail('Invalid card view')}
    }
  }
  watch(15000);try{worker.postMessage({...data,kind:'init',nonce})}catch(error){stop();throw error}
  let events=0,epoch=performance.now()
  const send=(kind,value)=>{if(disposed)return;const now=performance.now();if(now-epoch>1000){epoch=now;events=0}if(++events>128){fail('Card input rate limit exceeded');return}try{worker.postMessage({kind,nonce,value})}catch(error){fail('Card input could not be transferred')}}
  return {dispose:stop,dispatch:value=>send('event',value),notifyVariables:value=>send('variables',value)}
}
