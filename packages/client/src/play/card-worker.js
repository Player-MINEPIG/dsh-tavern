import {createAsyncJobDrain} from './quickjs-async-jobs.js'
import { newQuickJSAsyncWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-asyncify'
import { VIRTUAL_DOM_BOOTSTRAP } from './virtual-dom-runtime.js'
import {CARD_STORAGE_RUNTIME,validateCardStorage,cardStorageBytes,CARD_STORAGE_VALUE_LIMIT} from './card-scoped-storage.js'
import {IDENTITY_OPENING_RUNTIME} from './identity-opening-runtime.js'

function validateInput(data) {
 const runs=data.runs??[],modules=data.modules??{},html=data.html??''
 if(!Array.isArray(runs)||runs.length>128||!modules||typeof modules!=='object'||Array.isArray(modules)||Object.keys(modules).length>24)throw Error('Card input count exceeds limit')
 let size=0
 const count=(value,limit)=>{if(typeof value!=='string'||value.length>limit)throw Error('Card input exceeds limit');size+=new TextEncoder().encode(value).byteLength;if(size>24*1024*1024)throw Error('Card expanded input exceeds 24 MiB')}
 count(html,1024*1024)
 for(const run of runs){if(!run||typeof run!=='object')throw Error('Invalid card run');count(run.code,8*1024*1024);if(run.name!==undefined)count(run.name,2048)}
 for(const[name,code]of Object.entries(modules)){count(name,2048);count(code,8*1024*1024)}
 count(JSON.stringify({context:data.context??{},variables:data.variables??null,root:data.root??null,viewport:data.viewport??null}),256*1024)
 if(data.cardStorage){validateCardStorage(data.cardStorage.entries);count(JSON.stringify(data.cardStorage),128*1024+1024);if(!/^[a-f0-9]{64}$/.test(data.cardStorage.scope))throw Error('Invalid card storage scope')}
 return {...data,runs,modules,html}
}

let compiler, vm, runtime, drainJob, nonce, destroyed=false, deadline=0, operations=0, current, context, viewport, lastView='', ready=false
const timers=new Map(),pendingMessages=[],pendingWrites=new Set();let lastWriteId=0
let openingPending=null,lastOpeningId=0
let activeCause='script',activeTask=null,layoutCalls=0,layoutId=0,layoutPending=null,queue=Promise.resolve(),queued=0
const startupTasks=[]
let nextViewport,viewportQueued=false
let photoPickId=0,lastPhotoTask=null
let messages=0, messageEpoch=0
let storagePending=null,storageRevision=0
const reply=(kind,value)=>{const now=performance.now();if(now-messageEpoch>1000){messages=0;messageEpoch=now}if(++messages>256){dispose();throw Error('Card message rate limit exceeded')}self.postMessage({nonce,kind,value})}
function dispose(){if(destroyed)return;destroyed=true;for(const timer of timers.values())clearTimeout(timer);timers.clear();if(layoutPending)clearTimeout(layoutPending.timer);if(storagePending){clearTimeout(storagePending.timer);storagePending.reject(Error('Card storage generation expired'));storagePending=null}startupTasks.length=0;self.close()}
function fail(error){try{self.postMessage({nonce,kind:'error',value:String(error?.message??error).slice(0,300)})}finally{dispose()}}
async function evaluate(code,name='card.js',module=false,initial=false){
 if(destroyed)throw Error('Card disposed')
 if(typeof code!=='string'||code.length>8*1024*1024)throw Error('Card source exceeds 8 MiB')
 deadline=performance.now()+(initial?2000:120);operations=0
 const result=await vm.evalCodeAsync(code,name,{type:module?'module':'global'})
 if(result.error){result.error.dispose();throw Error('Card execution failed: '+String(name).slice(0,160))}
 const value=vm.typeof(result.value)==='string'?vm.getString(result.value):undefined;result.value.dispose()
 let jobs=0;while(runtime.hasPendingJob()){if(++jobs>200)throw Error('Card pending job limit exceeded');await drainJob()}
 return value
}
async function snapshot(){
 const value=await evaluate('__view()')
 if(typeof value!=='string'||value.length>1024*1024)throw Error('Card output exceeds 1 MiB')
 if(value!==lastView){lastView=value;reply('view',value)}
}
function enter(callback,cause='script',taskId=null){
 if(destroyed)return
 if(!ready){if(startupTasks.length>=64)return fail(Error('Card startup task limit exceeded'));startupTasks.push([callback,cause,taskId]);return}
 if(++queued>128)return fail(Error('Card task queue limit exceeded'))
 queue=queue.then(async()=>{if(destroyed)return;activeCause=cause;activeTask=taskId;layoutCalls=0;reply('busy');try{await callback();await snapshot();reply('idle')}catch(error){fail(error)}finally{activeCause='script';activeTask=null;queued--}})
}

async function init(input){
 const data=validateInput(input)
 const started=performance.now();nonce=data.nonce;context=data.context;current=data.variables;viewport=data.viewport
 const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('')
 const audit={compiler:'@babel/standalone@7.26.10 (react preset only)',sources:[],compiled:[]}
 for(const script of data.runs)audit.sources.push({name:script.name,sha256:await hash(script.code)})
 for(const [name,code] of Object.entries(data.modules??{}))audit.sources.push({name,sha256:await hash(code)})
 const QuickJS=await newQuickJSAsyncWASMModuleFromVariant(variant)
 if(destroyed)return
 runtime=QuickJS.newRuntime();runtime.setMemoryLimit(192*1024*1024);runtime.setMaxStackSize(1024*1024)
 runtime.setInterruptHandler(()=>performance.now()>deadline)
 const modules=data.modules??{}
 runtime.setModuleLoader(name=>Object.hasOwn(modules,name)?modules[name]:{error:Error('Unreviewed module')},(base,name)=>{try{return new URL(name,base).href}catch{return name}})
 vm=runtime.newContext();drainJob=createAsyncJobDrain(runtime,{version:TAVERN_QUICKJS_VERSION,isCurrent:()=>!destroyed})
 const native=vm.newFunction('__host',value=>{
  if(++operations>10000||performance.now()>deadline)throw Error('Card bridge budget exceeded')
  const input=vm.getString(value);if(input.length>128*1024)throw Error('Card bridge input exceeds limit')
  let output
  try{
   const {op,args=[]}=JSON.parse(input)
   let result=null
   if(op==='reportError'){if(typeof args[0]!=='string'||args[0].length>200)throw Error('Invalid card error');fail(Error(args[0]))}
   else if(op==='context')result=context
   else if(op==='boundScope'){if(!current||current.status!=='available')throw Error('Variable snapshot unavailable');result={mode:current.scope?.mode??'message',messageId:current.scope?.messageId??null}}
   else if(op==='cardStorageScope'){if(!data.cardStorage)throw Error('Card storage unavailable');result=data.cardStorage.scope}
   else if(op==='cardStorageSnapshot'){if(!data.cardStorage)throw Error('Card storage unavailable');result=data.cardStorage.entries}
   else if(op==='viewport'){if(!viewport||!Number.isSafeInteger(viewport.width)||!Number.isSafeInteger(viewport.height)||viewport.width<1||viewport.height<1||viewport.width>16384||viewport.height>16384)throw Error('Card viewport unavailable');result={width:viewport.width,height:viewport.height}}
   else if(op==='variables'){
    const options=args[0]
    if(!current||current.status!=='available')throw Error('Variable snapshot unavailable')
    if(options!==null&&options!==undefined&&(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['type','message_id'].includes(key))||(options.type!==undefined&&options.type!=='message')||(options.message_id!==undefined&&options.message_id!==current.scope?.messageId)))throw Error('Variable scope is bound to this card')
    result=current.variables
   }else if(op==='variableWrite'){
    const [requestId,operation,value,options]=args
    if(!Number.isSafeInteger(requestId)||requestId<=lastWriteId||pendingWrites.size>=32||!['patch','replace'].includes(operation))throw Error('Invalid variable write request')
    const observedRevision=current?.currentRevision??current?.revision
    if(!Number.isSafeInteger(observedRevision)||observedRevision<0)throw Error('Variable snapshot unavailable')
    lastWriteId=requestId;pendingWrites.add(requestId)
    reply('write',{requestId,operation,value,options,observedRevision,cause:activeCause,taskId:activeTask})
   }else if(op==='photoPick'){
    const [id,view]=args
    if(!activeTask||activeTask===lastPhotoTask||!Number.isSafeInteger(id)||id<=0||typeof view?.html!=='string'||typeof view?.styles!=='string')throw Error('Photo selection requires a new user click')
    lastPhotoTask=activeTask;reply('photoPick',{requestId:++photoPickId,id,view,taskId:activeTask})
   }else if(op==='propose'){
    if(typeof args[0]!=='string'||args[0].length>4000)throw Error('Proposal exceeds limit')
    reply('proposal',args[0])
   }else if(op==='identityOpening'){
    const [requestId,openingId]=args
    if(data.identityOpening!==true||openingPending!==null||!Number.isSafeInteger(requestId)||requestId<=lastOpeningId||!['default','police_done','hospital_done','alisa_party','pool'].includes(openingId))throw Error('Invalid opening selection request')
    lastOpeningId=requestId;openingPending=requestId
    reply('identityOpening',{requestId,openingId,taskId:activeTask})
   }else if(op==='timer'){
    const [id,delay,interval]=args
    if(!Number.isSafeInteger(id)||id<1||timers.has(id)||timers.size>=128)throw Error('Card timer limit exceeded')
    const ms=Math.max(16,Math.min(60000,Number(delay)||0))
    timers.set(id,setTimeout(()=>{timers.delete(id);enter(()=>evaluate(`__tick(${id},${interval===true})`),interval===true?'interval':'script')},ms))
   }else if(op==='clearTimer'){clearTimeout(timers.get(args[0]));timers.delete(args[0])}
   else throw Error('Unsupported card capability')
   output=JSON.stringify({value:result})
  }catch(error){output=JSON.stringify({error:String(error.message).slice(0,200)})}
  if(output.length>128*1024)throw Error('Card bridge output exceeds limit')
  return vm.newString(output)
 });vm.setProp(vm.global,'__host',native);native.dispose()
 const storage=vm.newAsyncifiedFunction('__cardStorage',async handle=>{
  if(!data.cardStorage||storagePending||performance.now()>deadline)throw Error('Card storage unavailable')
  const raw=vm.getString(handle);if(raw.length>128*1024)throw Error('Card storage input exceeds limit')
  const value=JSON.parse(raw)
  if(!['set','remove','clear'].includes(value.operation)||value.operation!=='clear'&&(typeof value.key!=='string'||!value.key||value.key.length>512)||value.operation==='set'&&(typeof value.value!=='string'||value.value.length>CARD_STORAGE_VALUE_LIMIT||cardStorageBytes(value.value)>CARD_STORAGE_VALUE_LIMIT))throw Error('Invalid card storage request')
  const requestId=++storageRevision
  const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{storagePending=null;reject(Error('Card storage response deadline exceeded'))},1000);storagePending={requestId,resolve,reject,timer};reply('cardStorage',{...value,revision:requestId})})
  if(destroyed)throw Error('Card storage generation expired')
  return vm.newString(JSON.stringify(result))
 });vm.setProp(vm.global,'__cardStorage',storage);storage.dispose()
 const layout=vm.newAsyncifiedFunction('__layout',async handle=>{
  if(++layoutCalls>16||layoutPending||performance.now()>deadline)throw Error('Card layout budget exceeded')
  const raw=vm.getString(handle);if(raw.length>1024*1024)throw Error('Card layout input exceeds limit')
  const value=JSON.parse(raw)
  if(!Number.isSafeInteger(value.id)||value.id<0||typeof value.view?.html!=='string'||typeof value.view?.styles!=='string'||!['',null,undefined,'::before','::after'].includes(value.pseudo))throw Error('Invalid card measurement')
  const requestId=++layoutId
  const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{layoutPending=null;reject(Error('Card layout response deadline exceeded'))},1000);layoutPending={requestId,resolve,reject,timer};reply('measure',{...value,requestId})})
  if(destroyed)throw Error('Card disposed')
  return vm.newString(JSON.stringify(result))
 });vm.setProp(vm.global,'__layout',layout);layout.dispose()
 await evaluate(TAVERN_VIRTUAL_DOM_SOURCE,'virtual-dom.js',false,true)
 await evaluate(VIRTUAL_DOM_BOOTSTRAP,'card-bootstrap.js',false,true)
 if(data.cardStorage)await evaluate(CARD_STORAGE_RUNTIME,'card-storage.js',false,true)
 if(data.identityOpening===true)await evaluate(IDENTITY_OPENING_RUNTIME,'identity-opening.js',false,true)
 await evaluate(`__setMvuRevision(${Number.isSafeInteger(data.variables?.revision)?data.variables.revision:-1})`,'initial-revision.js',false,true)
 await evaluate(`document.body.innerHTML=${JSON.stringify(data.html)}`,'card-html.js',false,true)
 for(const key of ['html','body']){
  const root=data.root?.[key]??{},className=root.className??'',style=root.style??''
  if(typeof className!=='string'||className.length>4096||typeof style!=='string'||style.length>16384)throw Error('Invalid card root presentation')
  await evaluate(`document.${key==='html'?'documentElement':'body'}.setAttribute('class',${JSON.stringify(className)});document.${key==='html'?'documentElement':'body'}.setAttribute('style',${JSON.stringify(style)});`,'card-root.js',false,true)
 }
 for(const script of data.runs){
  if(script.type==='text/babel'||script.type==='text/jsx'){
   if(!compiler){
    compiler=runtime.newContext();deadline=performance.now()+2000
    const result=await compiler.evalCodeAsync('globalThis.console={log(){},warn(){},error(){}};'+TAVERN_BABEL_SOURCE,'fixed-babel-7.26.10.js')
    if(result.error){const error=compiler.dump(result.error);result.error.dispose();throw Error('Fixed JSX compiler initialization failed: '+error.message)}result.value.dispose()
   }
   deadline=performance.now()+2000
   const result=await compiler.evalCodeAsync(`Babel.transform(${JSON.stringify(script.code)},{presets:['react'],babelrc:false,configFile:false}).code`,'compile-jsx.js')
   if(result.error){const error=compiler.dump(result.error);result.error.dispose();throw Error('JSX compilation failed: '+error.message)}
   const code=compiler.getString(result.value);result.value.dispose()
   audit.compiled.push({name:script.name,input:await hash(script.code),output:await hash(code)})
   await evaluate(code,script.name,false,true)
  }else await evaluate(script.code,script.name,script.module,true)
 }
 compiler?.dispose();compiler=null
 await evaluate('__ready()','ready.js',false,true);await snapshot();ready=true;const memory=runtime.computeMemoryUsage();audit.memory=vm.dump(memory);memory.dispose();audit.coldStartMs=performance.now()-started;reply('audit',audit);reply('ready');for(const message of pendingMessages.splice(0))self.onmessage({data:message});for(const task of startupTasks.splice(0))enter(...task)
}
self.onmessage=event=>{
 const data=event.data
 if(!data||typeof data!=='object')return
 if(data.kind==='init'){if(nonce)return;init(data).catch(fail);return}
 if(data.nonce!==nonce||destroyed)return
 if(data.kind==='cardStorageResult'){if(!storagePending||data.requestId!==storagePending.requestId)return;const pending=storagePending;storagePending=null;clearTimeout(pending.timer);pending.resolve(data.value);return}
 if(data.kind==='measurement'){if(!layoutPending||data.requestId!==layoutPending.requestId)return;const pending=layoutPending;layoutPending=null;clearTimeout(pending.timer);if(data.error)pending.reject(Error(String(data.error).slice(0,200)));else pending.resolve(data.value);return}
 if(data.kind==='dispose'){dispose();return}
 if(!ready){if(['writeResult','variables','viewport','identityOpeningResult'].includes(data.kind)){if(data.kind==='viewport'){const index=pendingMessages.findIndex(message=>message.kind==='viewport');if(index>=0)pendingMessages.splice(index,1)}if(pendingMessages.length>=64){fail(Error('Card startup message limit exceeded'));return}pendingMessages.push(data)}return}
 if(data.kind==='viewport'){if(!data.value||!Number.isSafeInteger(data.value.width)||!Number.isSafeInteger(data.value.height)||data.value.width<1||data.value.height<1||data.value.width>16384||data.value.height>16384)return fail(Error('Invalid card viewport'));nextViewport={width:data.value.width,height:data.value.height};if(!viewportQueued){viewportQueued=true;enter(()=>{viewport=nextViewport;nextViewport=null;viewportQueued=false;return evaluate('__viewportChanged()')})}}
 else if(data.kind==='event')enter(()=>evaluate(`__domEvent(${JSON.stringify(data.value)})`),'script',data.taskId)
 else if(data.kind==='writeResult'){if(!pendingWrites.delete(data.requestId))return;enter(()=>evaluate(`__writeResult(${JSON.stringify(data.requestId)},${JSON.stringify(data.value)})`))}
 else if(data.kind==='identityOpeningResult'){if(openingPending!==data.requestId)return;openingPending=null;enter(()=>evaluate(`__identityOpeningResult(${JSON.stringify(data.requestId)},${JSON.stringify(data.value)})`))}
 else if(data.kind==='variables')enter(()=>{if(current?.status==='available'&&data.value?.status==='available'&&(data.value.currentRevision??data.value.revision)<(current.currentRevision??current.revision))return;current=data.value;return evaluate(`__notifyVariables(${JSON.stringify(current)})`)})
 else if(data.kind==='dispose')dispose()
}
