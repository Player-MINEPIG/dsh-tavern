import {DEPENDENCY_LIMITS} from './rendering-limits.js'
let active=0
function validateInput(data) {
 const runs=data.runs??[],modules=data.modules??{},html=data.html??''
 if(!Array.isArray(runs)||runs.length>128||!modules||typeof modules!=='object'||Array.isArray(modules)||Object.keys(modules).length>DEPENDENCY_LIMITS.count)throw Error('Card input count exceeds limit')
 let size=0
 const count=(value,limit)=>{if(typeof value!=='string'||value.length>limit)throw Error('Card input exceeds limit');size+=new TextEncoder().encode(value).byteLength;if(size>DEPENDENCY_LIMITS.bytes)throw Error('Card expanded input exceeds 24 MiB')}
 count(html,1024*1024)
 for(const run of runs){if(!run||typeof run!=='object')throw Error('Invalid card run');count(run.code,8*1024*1024);if(run.name!==undefined)count(run.name,2048)}
 for(const[name,code]of Object.entries(modules)){count(name,2048);count(code,8*1024*1024)}
 count(JSON.stringify({context:data.context??{},variables:data.variables??null,root:data.root??null,viewport:data.viewport??null}),256*1024)
 if(data.cardStorage){count(JSON.stringify(data.cardStorage),128*1024+1024);if(!/^[a-f0-9]{64}$/.test(data.cardStorage.scope)||!Array.isArray(data.cardStorage.entries))throw Error('Invalid card storage scope')}
 return {...data,runs,modules,html}
}
export function createVirtualCardRuntime(input,{onView,onProposal,onError,onAudit=()=>{},onGreetingReady=()=>null,onAction=async()=>{throw Error('Card input is unavailable')},onResize=()=>{},onActionEnd=()=>{},onPhotoPick=()=>{throw Error('Photo selection unavailable')},onMeasure=()=>{throw Error('Card layout surface unavailable')},onStorage=()=>{throw Error('Card storage unavailable')},onIdentityAction=async()=>{throw Error('Identity confirmation unavailable')},onOpening=async()=>{throw Error('Opening world books are unavailable')},onWrite=async()=>{throw Error('Variable writes are disabled')}}) {
 const data=validateInput(input)
 if(typeof TAVERN_CARD_WORKER_SOURCE!=='string')throw Error('Card worker unavailable in this build')
 if(active>=4)throw Error('This card cannot start while four other cards are running.')
 const nonce=crypto.randomUUID(),url=URL.createObjectURL(new Blob([TAVERN_CARD_WORKER_SOURCE],{type:'text/javascript'}))
 let worker;try{worker=new Worker(url)}finally{URL.revokeObjectURL(url)}active++
 let disposed=false,startupTimer,busyTimer,lastWriteId=0,lastMeasureId=0,lastStorageId=0,measurement=null,lastOpeningId=0,opening=null,lastIdentityActionId=0,identityAction=null
 let lastActionId=0,action=null
 const tasks=new Map(),pending=new Map()
 let lastPhotoPickId=0
 let controlSequence=0,lastViewSequence=-1,lastViewString
 const stop=()=>{if(disposed)return;disposed=true;clearTimeout(startupTimer);clearTimeout(busyTimer);if(identityAction){clearTimeout(identityAction.timer);identityAction.controller.abort();identityAction=null}if(opening){clearTimeout(opening.timer);opening.controller.abort();opening=null}for(const item of pending.values()){clearTimeout(item.timer);item.controller.abort()}pending.clear();if(measurement){clearTimeout(measurement.timer);measurement.controller.abort();measurement=null}if(action){clearTimeout(action.timer);action.controller.abort();action=null}worker.terminate();tasks.clear();active--}
 const fail=(message,operationId)=>{if(disposed)return;stop();onError(Object.assign(Error(message),operationId?{operationId,outcome:'unknown'}:{}))}
 const replyWrite=(requestId,value,operationId)=>{if(disposed)return;try{if(JSON.stringify(value).length>128*1024)throw Error();worker.postMessage({kind:'writeResult',nonce,requestId,value})}catch{fail('Write result could not be delivered; inspect the operation receipt before retrying',operationId)}}
 worker.onerror=()=>fail('Card worker failed')
 worker.onmessage=event=>{
  const message=event.data
  if(disposed||message?.nonce!==nonce)return
  if(message.kind==='busy'){if(!busyTimer)busyTimer=setTimeout(()=>fail('Card worker exceeded its response deadline'),1500);return}
  if(message.kind==='ready'){clearTimeout(startupTimer);startupTimer=null;try{const choice=onGreetingReady();if(choice)worker.postMessage({kind:'greetingSelection',nonce,value:{swiped:choice.swiped===true}})}catch{fail('Greeting lifecycle delivery failed')}return}
  if(message.kind==='idle'){clearTimeout(busyTimer);busyTimer=null;const task=tasks.get(message.value?.taskId);if(task)task.composerFinished=true;if(task?.accepted)onActionEnd();return}
  if(message.kind==='error'){fail(String(message.value).slice(0,300));return}
  if(message.kind==='cardStorage'){
   const value=message.value
   if(!data.cardStorage||!value||!Number.isSafeInteger(value.revision)||value.revision!==lastStorageId+1||JSON.stringify(value).length>128*1024){fail('Invalid card storage request');return}
   lastStorageId=value.revision
   let result;try{result={value:onStorage(value)}}catch(error){result={error:String(error.message).slice(0,200)}}
   if(disposed)return
   try{worker.postMessage({kind:'cardStorageResult',nonce,requestId:value.revision,value:result})}catch{fail('Card storage result could not be delivered')}
   return
  }
  if(message.kind==='proposal'){if(typeof message.value==='string'&&message.value.length<=4000)onProposal(message.value);else fail('Invalid card proposal');return}
  if(message.kind==='resize'){if(typeof message.value!=='number'||!Number.isFinite(message.value)||message.value<0||message.value>800){fail('Invalid card height');return}onResize(message.value);return}
  if(message.kind==='action'){
   const value=message.value
   if(action||!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastActionId||!['fill','send','saveMode','close'].includes(value.operation)||JSON.stringify(value).length>128*1024){fail('Invalid or duplicate card input request');return}
   lastActionId=value.requestId
   const task=tasks.get(value.taskId),fresh=task&&performance.now()-task.at<1500
   const valid=task?.trusted===true&&!task.composerFinished&&task.type==='click'&&!task.actions.has(value.operation)&&(value.operation==='close'?task.accepted===true:fresh)&&(value.operation!=='send'||task.actions.has('fill'))
   const respond=result=>{
    if(disposed)return
    try{worker.postMessage({kind:'actionResult',nonce,requestId:value.requestId,value:result})}catch{fail('Card input receipt could not be delivered')}
   }
   if(!valid){respond({error:'Card input requires a fresh trusted user click and one request per action'});return}
   task.actions.add(value.operation)
   clearTimeout(busyTimer);busyTimer=null
   const controller=new AbortController(),ticket={controller,taskId:value.taskId,timer:setTimeout(()=>fail(value.operation==='send'?'Card send outcome is unknown; inspect the session before retrying':'Card input response deadline exceeded'),10000)}
   action=ticket
   Promise.resolve().then(()=>{if(disposed||action!==ticket)return;return onAction({operation:value.operation,value:value.value,taskId:value.taskId,cause:'user-interaction',signal:controller.signal})}).then(result=>{
    if(disposed||action!==ticket)return
    action=null;clearTimeout(ticket.timer)
    if(value.operation==='send'&&result?.status==='accepted')task.accepted=true
    busyTimer=setTimeout(()=>fail('Card worker exceeded its response deadline'),1500)
    respond({value:result})
   },error=>{if(disposed||action!==ticket)return;action=null;clearTimeout(ticket.timer);busyTimer=setTimeout(()=>fail('Card worker exceeded its response deadline'),1500);respond({error:String(error.message).slice(0,300)})})
   return
  }
  if(message.kind==='identityAction'){
   const value=message.value
   if(data.identityAction!==true||identityAction||!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastIdentityActionId||JSON.stringify(value).length>128*1024){fail('Invalid identity action request');return}
   lastIdentityActionId=value.requestId
   const controller=new AbortController(),ticket={controller,timer:setTimeout(()=>fail('Identity confirmation expired'),300000)};identityAction=ticket
   Promise.resolve().then(()=>{if(disposed||identityAction!==ticket)return;return onIdentityAction(value.payload,{signal:controller.signal})}).then(result=>finish({value:result}),error=>finish({error:String(error.message).slice(0,300)}))
   function finish(result){if(disposed||identityAction!==ticket)return;identityAction=null;clearTimeout(ticket.timer);try{if(JSON.stringify(result).length>128*1024)throw Error();worker.postMessage({kind:'identityActionResult',nonce,requestId:value.requestId,value:result})}catch{fail('Identity result could not be delivered')}}
   return
  }
  if(message.kind==='identityOpening'){
   const value=message.value
   if(data.identityOpening!==true||opening||!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastOpeningId||!['default','police_done','hospital_done','alisa_party','pool'].includes(value.openingId)||JSON.stringify(value).length>1024){fail('Invalid opening selection request');return}
   lastOpeningId=value.requestId
   const task=tasks.get(value.taskId)
   const controller=new AbortController(),ticket={controller,timer:setTimeout(()=>fail('Opening confirmation expired; select the identity again'),300000)};opening=ticket
   Promise.resolve().then(()=>{if(disposed||opening!==ticket)return;if(task?.trusted!==true||task.type!=='click'||performance.now()-task.at>=1500)throw Error('Opening selection requires a user click in this card');return onOpening(value.openingId,{signal:controller.signal})}).then(result=>finish({value:result}),error=>finish({error:String(error.message).slice(0,300)}))
   function finish(result){if(disposed||opening!==ticket)return;opening=null;clearTimeout(ticket.timer);try{if(JSON.stringify(result).length>128*1024)throw Error();worker.postMessage({kind:'identityOpeningResult',nonce,requestId:value.requestId,value:result})}catch{fail('Opening result could not be delivered')}}
   return
  }
  if(message.kind==='photoPick'){
   const value=message.value,task=tasks.get(value?.taskId)
   if(!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastPhotoPickId||!Number.isSafeInteger(value.id)||value.id<=0||JSON.stringify(value).length>128*1024){fail('Invalid photo selection request');return}
   lastPhotoPickId=value.requestId
   if(task?.trusted!==true||task.type!=='click'||task.photoPicked||performance.now()-task.at>=1500)return
   task.photoPicked=true
   try{onPhotoPick(value)}catch(error){onError(error)}
   return
  }
  if(message.kind==='measure'){
   const value=message.value
   if(!Number.isSafeInteger(message.controlSequence??0)||(message.controlSequence??0)<0||(message.controlSequence??0)>controlSequence){fail('Invalid card control sequence');return}
   if(measurement||!value||!Number.isSafeInteger(value.requestId)||value.requestId<=lastMeasureId||!Number.isSafeInteger(value.id)||value.id<0||typeof value.view?.html!=='string'||typeof value.view?.styles!=='string'||JSON.stringify(value).length>1024*1024){fail('Invalid layout measurement');return}
   lastMeasureId=value.requestId
   const controller=new AbortController(),ticket={controller,timer:setTimeout(()=>fail('Card layout deadline exceeded'),1000)};measurement=ticket
   Promise.resolve().then(()=>{if(disposed||measurement!==ticket)return;return onMeasure(value,{signal:controller.signal,controlsCurrent:(message.controlSequence??0)===controlSequence})}).then(result=>{
    if(disposed||measurement!==ticket)return
    measurement=null;clearTimeout(ticket.timer)
    try{if(JSON.stringify(result).length>128*1024)throw Error('Card geometry output exceeds limit');worker.postMessage({kind:'measurement',nonce,requestId:value.requestId,value:result})}catch{fail('Card geometry could not be transferred')}
   },error=>{if(disposed||measurement!==ticket)return;measurement=null;clearTimeout(ticket.timer);try{worker.postMessage({kind:'measurement',nonce,requestId:value.requestId,error:String(error.message).slice(0,200)})}catch{fail('Card measurement failed')}})
   return
  }
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
   if(!Number.isSafeInteger(message.controlSequence??0)||(message.controlSequence??0)<0||(message.controlSequence??0)>controlSequence){fail('Invalid card control sequence');return}
   if((message.controlSequence??0)!==controlSequence)return
   if(lastViewSequence===controlSequence&&lastViewString===message.value)return
   lastViewSequence=controlSequence;lastViewString=message.value
   try{const view=JSON.parse(message.value);if(typeof view.html!=='string'||typeof view.styles!=='string')throw Error();onView(view)}catch{fail('Invalid card view')}
  }
 }
 startupTimer=setTimeout(()=>fail('Card worker exceeded its startup deadline'),15000)
 try{worker.postMessage({...data,kind:'init',nonce})}catch(error){stop();throw error}
 let events=0,epoch=performance.now()
 const send=(kind,value,metadata={})=>{if(disposed)return;const now=performance.now();if(now-epoch>1000){epoch=now;events=0}if(++events>128){fail('Card input rate limit exceeded');return}try{worker.postMessage({kind,nonce,value,...metadata})}catch{fail('Card input could not be transferred')}}
 return {dispose:stop,resize:value=>{if(!value||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||value.width<1||value.height<1||value.width>16384||value.height>16384){fail('Invalid card viewport');return}send('viewport',{width:value.width,height:value.height})},dispatch:(value,{trusted=false,control=false}={})=>{for(const[id,task]of tasks)if(performance.now()-task.at>1500&&task!==tasks.get(action?.taskId))tasks.delete(id);if(tasks.size>=128){fail('Card event task limit exceeded');return}if(control&&controlSequence>=Number.MAX_SAFE_INTEGER){fail('Card control sequence limit exceeded');return}const taskId=crypto.randomUUID();tasks.set(taskId,{trusted,type:value?.type,at:performance.now(),actions:new Set(),accepted:false,composerFinished:false});send('event',value,{taskId,controlSequence:control?++controlSequence:0})},notifyVariables:value=>send('variables',value)}
}
