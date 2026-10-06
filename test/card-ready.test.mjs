import test from 'node:test'
import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {cardWorkerDefines} from '../scripts/build-card-worker.mjs'

const source=JSON.parse((await cardWorkerDefines()).TAVERN_CARD_WORKER_SOURCE)
const snapshot=(revision,hp)=>({version:1,status:'available',scope:{sessionId:'authored-session'},revision,currentRevision:revision,variables:{stat_data:{hp}}})
async function probe(code,{variables=snapshot(1,7),afterReady,idleCount=1}={}){
 const worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');globalThis.crypto??=require('node:crypto').webcrypto;globalThis.self={postMessage:m=>parentPort.postMessage(m),close(){}};parentPort.on('message',data=>self.onmessage({data}));eval(workerData);`,{eval:true,workerData:source})
 const nonce='authored-ready-fixture'
 try{return await new Promise((resolve,reject)=>{
  let view
  const timeout=setTimeout(()=>reject(Error('Packaged ready fixture timed out')),10000)
  const finish=result=>{clearTimeout(timeout);resolve(result)}
  worker.on('error',error=>{clearTimeout(timeout);reject(error)})
  worker.on('message',message=>{
   if(message.kind==='view')view=JSON.parse(message.value)
   if(message.kind==='error')finish({error:message.value})
   if(message.kind==='ready'){
    if(afterReady)afterReady(worker,nonce)
    else finish({html:view.html})
   }
   if(message.kind==='idle'&&afterReady&&--idleCount===0)finish({html:view.html})
  })
  worker.postMessage({kind:'init',nonce,html:'<output id="result">Loading</output>',modules:{},runs:[{name:'authored-ready.js',code}],context:{},variables,viewport:{width:480,height:800}})
 })}finally{await worker.terminate()}
}

test('packaged card startup sends ready to document and window once, before window load',async()=>{
 const result=await probe(`const order=[];const out=document.getElementById('result');document.addEventListener('DOMContentLoaded',()=>{order.push('document');out.textContent=order.join(',')});window.addEventListener('DOMContentLoaded',()=>{order.push('window');out.textContent=order.join(',')});window.addEventListener('load',()=>{order.push('load');out.textContent=order.join(',')});`)
 assert.match(result.html,/>document,window,load<\/output>/)
})
test('bound MVU display reads its initial whole snapshot and a committed update inside the packaged card',async()=>{
 const result=await probe(`let updates=0;function render(){const data=getAllVariables();document.getElementById('result').textContent=_.get(data,'stat_data.hp')+':'+updates}$(errorCatched(async()=>{await waitGlobalInitialized('Mvu');render();eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,()=>{updates++;render()})}));`,{afterReady:(worker,nonce)=>worker.postMessage({kind:'variables',nonce,value:snapshot(2,9)})})
 assert.match(result.html,/>9:1<\/output>/)
})
test('MVU display refuses an unavailable snapshot instead of inventing initialized data',async()=>{
 const result=await probe(`$(errorCatched(async()=>{await waitGlobalInitialized('Mvu');getAllVariables()}));`,{variables:{version:1,status:'unavailable',scope:{sessionId:'authored-session'},revision:0,variables:{}}})
 assert.equal(result.error,'Variable snapshot unavailable')
})

test('packaged MVU display redraws when availability recovers without a new revision',async()=>{
 const result=await probe(`let updates=0;eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,()=>{updates++;document.getElementById('result').textContent=getAllVariables().stat_data.hp+':'+updates});`,{idleCount:2,afterReady:(worker,nonce)=>{
  worker.postMessage({kind:'variables',nonce,value:{...snapshot(1,7),status:'unavailable',variables:{}}})
  worker.postMessage({kind:'variables',nonce,value:snapshot(1,7)})
 }})
 assert.match(result.html,/>7:1<\/output>/)
})
