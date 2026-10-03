import {Worker} from 'node:worker_threads'
import {readFileSync} from 'node:fs'
import {DEPENDENCY_LIMITS} from '../../packages/client/src/play/rendering-limits.js'
import {cardWorkerDefines} from '../build-card-worker.mjs'

export const workerSource=JSON.parse((await cardWorkerDefines()).TAVERN_CARD_WORKER_SOURCE)
export const inputFor=(code,extra={})=>({html:'<button id="b">Run</button><output id="o"></output>',runs:[{name:'authored-fixture.js',code}],context:{},variables:{status:'available',scope:{mode:'initial'},revision:1,variables:{}},viewport:{width:480,height:800},cardStorage:{scope:'0'.repeat(64),entries:[]},...extra})
export const burn='function burn(ms){const end=Date.now()+ms;while(Date.now()<end){}}'
export const listener=body=>`document.getElementById('b').addEventListener('click',()=>{${body}})`
export const done=`document.getElementById('o').textContent='DONE'`
const adapter=`const{parentPort,workerData}=require('node:worker_threads');globalThis.crypto??=require('node:crypto').webcrypto;globalThis.self={postMessage:m=>parentPort.postMessage(m),close(){parentPort.close()}};parentPort.on('message',data=>self.onmessage({data}));eval(workerData);`
export function spawnCardProbe({onStorage,onMeasure}={}) {
 const worker=new Worker(adapter,{eval:true,workerData:workerSource}),nonce='authored-budget-fixture'
 const messages=[],observers=new Set(),timers=new Set(),exited=new Promise(resolve=>worker.once('exit',resolve))
 const post=data=>worker.postMessage({nonce,...data})
 const later=(ms,fn)=>{const timer=setTimeout(()=>{timers.delete(timer);fn()},ms);timers.add(timer)}
 worker.on('message',message=>{
  messages.push(message)
  if(message.kind==='cardStorage')onStorage?.(message,{post,later,messages})
  if(message.kind==='measure')onMeasure?.(message,{post,later,messages})
  for(const observer of observers)observer(message)
 })
 const waitFor=(predicate,{after=0,timeout=10000}={})=>new Promise((resolve,reject)=>{
  const old=messages.slice(after).find(predicate);if(old)return resolve(old)
  const timer=setTimeout(()=>{observers.delete(check);reject(Error('Authored Worker fixture timed out'))},timeout)
  const check=message=>{if(predicate(message)){clearTimeout(timer);observers.delete(check);resolve(message)}}
  observers.add(check)
 })
 return {messages,exited,post,later,waitFor,init:input=>post({kind:'init',...input}),click(){const view=JSON.parse(messages.findLast(m=>m.kind==='view').value),target=Number(view.html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);post({kind:'event',taskId:'authored-task',value:{type:'click',target}})},async close(){for(const timer of timers)clearTimeout(timer);await worker.terminate()}}
}
export const storageAck=(message,post,value={value:{revision:message.value.revision}})=>post({kind:'cardStorageResult',requestId:message.value.revision,value})

// The real production client owns the wall watchdog and trusted-task timestamps.
// Only this authored transport adapter delays IPC replies in transit.
export function createClientProbe({delay=0,onStorage=()=>({}),onWrite,onOpening,onIdentityAction,onMeasure,clock=performance}={}) {
 const clientSource=readFileSync(new URL('../../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export function','function')
 const messages=[],errors=[],views=[],children=[],transportTimers=new Set(),clientTimers=[]
 let readyResolve,runtime,closed=false
 const ready=new Promise(resolve=>{readyResolve=resolve})
 class BrowserWorker {
  constructor(){this.child=new Worker(adapter,{eval:true,workerData:workerSource});children.push(this);this.child.on('message',data=>{messages.push(data);this.onmessage?.({data});if(data.kind==='ready')readyResolve();});this.child.on('error',()=>this.onerror?.())}
  postMessage(data){if(data.kind==='cardStorageResult'&&delay){const timer=setTimeout(()=>{transportTimers.delete(timer);if(!closed)this.child.postMessage(data)},typeof delay==='function'?delay(data):delay);transportTimers.add(timer)}else this.child.postMessage(data)}
  terminate(){closed=true;for(const timer of transportTimers)clearTimeout(timer);this.child.terminate()}
 }
 const timers=(fn,ms)=>{clientTimers.push(ms);return setTimeout(fn,ms)}
 const api=new Function('DEPENDENCY_LIMITS','TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','setTimeout','clearTimeout','performance',clientSource+';return createVirtualCardRuntime')(DEPENDENCY_LIMITS,workerSource,BrowserWorker,{createObjectURL:()=> 'blob:authored-fixture',revokeObjectURL(){}},class{},timers,clearTimeout,clock)
 return {messages,errors,views,ready,clientTimers,start(input){runtime=api(input,{onView:view=>views.push(view),onError:error=>errors.push(error.message),onProposal(){},onStorage,onWrite,onOpening,onIdentityAction,onMeasure});return runtime},get runtime(){return runtime},async close(){runtime?.dispose();await Promise.all(children.map(child=>child.child.terminate()))}}
}
