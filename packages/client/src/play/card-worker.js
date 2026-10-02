import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'
import { VIRTUAL_DOM_BOOTSTRAP } from './virtual-dom-runtime.js'

let compiler, vm, runtime, nonce, destroyed=false, deadline=0, operations=0, current, context, lastView='', ready=false
const timers=new Map()
let messages=0, messageEpoch=0
const reply=(kind,value)=>{const now=performance.now();if(now-messageEpoch>1000){messages=0;messageEpoch=now}if(++messages>256){dispose();throw Error('Card message rate limit exceeded')}self.postMessage({nonce,kind,value})}
function dispose(){if(destroyed)return;destroyed=true;for(const timer of timers.values())clearTimeout(timer);timers.clear();compiler?.dispose();compiler=null;vm?.dispose();runtime?.dispose();vm=runtime=null}
function fail(error){try{self.postMessage({nonce,kind:'error',value:String(error?.message??error).slice(0,300)})}finally{dispose()}}
function evaluate(code,name='card.js',module=false,initial=false){
 if(destroyed)throw Error('Card disposed')
 if(typeof code!=='string'||code.length>8*1024*1024)throw Error('Card source exceeds 8 MiB')
 deadline=performance.now()+(initial?2000:120);operations=0
 const result=vm.evalCode(code,name,{type:module?'module':'global'})
 if(result.error){const error=vm.dump(result.error);result.error.dispose();throw Error(String(error?.message??'Card execution failed'))}
 const value=vm.dump(result.value);result.value.dispose()
 const jobs=runtime.executePendingJobs(200)
 if(jobs.error){jobs.error.dispose();throw Error('Card asynchronous execution failed')}
 if(runtime.hasPendingJob())throw Error('Card pending job limit exceeded')
 return value
}
function snapshot(){
 const value=evaluate('__view()')
 if(typeof value!=='string'||value.length>1024*1024)throw Error('Card output exceeds 1 MiB')
 if(value!==lastView){lastView=value;reply('view',value)}
}
function enter(callback){if(destroyed)return;reply('busy');try{callback();snapshot();reply('idle')}catch(error){fail(error)}}
async function init(data){
 const started=performance.now();nonce=data.nonce;context=data.context;current=data.variables
 const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('')
 const audit={compiler:'@babel/standalone@7.26.10 (react preset only)',sources:[],compiled:[]}
 for(const script of data.runs)audit.sources.push({name:script.name,sha256:await hash(script.code)})
 for(const [name,code] of Object.entries(data.modules??{}))audit.sources.push({name,sha256:await hash(code)})
 const QuickJS=await newQuickJSWASMModuleFromVariant(variant)
 if(destroyed)return
 runtime=QuickJS.newRuntime();runtime.setMemoryLimit(192*1024*1024);runtime.setMaxStackSize(1024*1024)
 runtime.setInterruptHandler(()=>performance.now()>deadline)
 const modules=data.modules??{}
 runtime.setModuleLoader(name=>Object.hasOwn(modules,name)?modules[name]:{error:Error('Unreviewed module')},(base,name)=>{try{return new URL(name,base).href}catch{return name}})
 vm=runtime.newContext()
 const native=vm.newFunction('__host',value=>{
  if(++operations>10000||performance.now()>deadline)throw Error('Card bridge budget exceeded')
  const input=vm.getString(value);if(input.length>128*1024)throw Error('Card bridge input exceeds limit')
  let output
  try{
   const {op,args=[]}=JSON.parse(input)
   let result=null
   if(op==='context')result=context
   else if(op==='variables'){
    const options=args[0]
    if(!current||current.status!=='available')throw Error('Variable snapshot unavailable')
    if(options!==null&&options!==undefined&&(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['type','message_id'].includes(key))||(options.type!==undefined&&options.type!=='message')||(options.message_id!==undefined&&options.message_id!==current.scope?.messageId)))throw Error('Variable scope is bound to this card')
    result=current.variables
   }else if(op==='propose'){
    if(typeof args[0]!=='string'||args[0].length>4000)throw Error('Proposal exceeds limit')
    reply('proposal',args[0])
   }else if(op==='timer'){
    const [id,delay,interval]=args
    if(!Number.isSafeInteger(id)||id<1||timers.has(id)||timers.size>=128)throw Error('Card timer limit exceeded')
    const ms=Math.max(16,Math.min(60000,Number(delay)||0))
    timers.set(id,setTimeout(()=>{timers.delete(id);enter(()=>evaluate(`__tick(${id},${interval===true})`))},ms))
   }else if(op==='clearTimer'){clearTimeout(timers.get(args[0]));timers.delete(args[0])}
   else throw Error('Unsupported card capability')
   output=JSON.stringify({value:result})
  }catch(error){output=JSON.stringify({error:String(error.message).slice(0,200)})}
  if(output.length>128*1024)throw Error('Card bridge output exceeds limit')
  return vm.newString(output)
 });vm.setProp(vm.global,'__host',native);native.dispose()
 evaluate(TAVERN_VIRTUAL_DOM_SOURCE,'virtual-dom.js',false,true)
 evaluate(VIRTUAL_DOM_BOOTSTRAP,'card-bootstrap.js',false,true)
 evaluate(`document.body.innerHTML=${JSON.stringify(data.html)}`,'card-html.js',false,true)
 for(const script of data.runs){
  if(script.type==='text/babel'||script.type==='text/jsx'){
   if(!compiler){
    compiler=runtime.newContext();deadline=performance.now()+2000
    const result=compiler.evalCode('globalThis.console={log(){},warn(){},error(){}};'+TAVERN_BABEL_SOURCE,'fixed-babel-7.26.10.js')
    if(result.error){const error=compiler.dump(result.error);result.error.dispose();throw Error('Fixed JSX compiler initialization failed: '+error.message)}result.value.dispose()
   }
   deadline=performance.now()+2000
   const result=compiler.evalCode(`Babel.transform(${JSON.stringify(script.code)},{presets:['react'],babelrc:false,configFile:false}).code`,'compile-jsx.js')
   if(result.error){const error=compiler.dump(result.error);result.error.dispose();throw Error('JSX compilation failed: '+error.message)}
   const code=compiler.getString(result.value);result.value.dispose()
   audit.compiled.push({name:script.name,input:await hash(script.code),output:await hash(code)})
   evaluate(code,script.name,false,true)
  }else evaluate(script.code,script.name,script.module,true)
 }
 compiler?.dispose();compiler=null
 evaluate('__ready()','ready.js',false,true);ready=true;snapshot();const memory=runtime.computeMemoryUsage();audit.memory=vm.dump(memory);memory.dispose();audit.coldStartMs=performance.now()-started;reply('audit',audit);reply('ready')
}
self.onmessage=event=>{
 const data=event.data
 if(!data||typeof data!=='object')return
 if(data.kind==='init'){if(nonce)return;init(data).catch(fail);return}
 if(data.nonce!==nonce||destroyed||!ready)return
 if(data.kind==='event')enter(()=>evaluate(`__domEvent(${JSON.stringify(data.value)})`))
 else if(data.kind==='variables'){current=data.value;enter(()=>evaluate(`__notifyVariables(${JSON.stringify(current)})`))}
 else if(data.kind==='dispose')dispose()
}
