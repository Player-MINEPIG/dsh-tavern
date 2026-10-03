import test from 'node:test'
import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {cardWorkerDefines} from '../scripts/build-card-worker.mjs'

// Exercise the packaged browser Worker itself. This adapter only supplies its
// message port in Node; guest code still executes inside the same QuickJS VM.
const source=JSON.parse((await cardWorkerDefines()).TAVERN_CARD_WORKER_SOURCE)
async function probe({delay=0,kind='storage'}={}) {
 const code=kind==='storage'?`document.getElementById('b').addEventListener('click',()=>{localStorage.setItem('own-fixture','ok');let n=0;for(let i=0;i<100000;i++)n=(n+i)|0;document.getElementById('o').textContent='DONE'})`
  :kind==='js'?`document.getElementById('b').addEventListener('click',()=>{throw Error('PRIVATE_GUEST_EXCEPTION_MARKER')})`
  :`document.getElementById('b').addEventListener('click',()=>{while(true){}})`
 const worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');globalThis.crypto??=require('node:crypto').webcrypto;globalThis.self={postMessage:m=>parentPort.postMessage(m),close(){}};parentPort.on('message',data=>self.onmessage({data}));eval(workerData);`,{eval:true,workerData:source})
 const nonce='authored-diagnostic-fixture'
 try {
  return await new Promise((resolve,reject)=>{
   let view,eventSent=false
   const deadline=setTimeout(()=>reject(Error('Packaged Worker fixture timed out')),10000)
   const finish=value=>{clearTimeout(deadline);resolve(value)}
   worker.on('error',reject)
   worker.on('message',message=>{
    if(message.kind==='view')view=JSON.parse(message.value)
    if(message.kind==='ready'&&!eventSent){eventSent=true;const match=view.html.match(/<button[^>]*data-dtv-node="(\d+)"/);assert(match);worker.postMessage({kind:'event',nonce,taskId:'own-task',value:{type:'click',target:Number(match[1])}})}
    if(message.kind==='cardStorage')setTimeout(()=>worker.postMessage({kind:'cardStorageResult',nonce,requestId:message.value.revision,value:{value:{revision:message.value.revision}}}),delay)
    if(message.kind==='error')finish({error:message.value})
    if(message.kind==='idle'&&view?.html.includes('>DONE<'))finish({done:true})
   })
   worker.postMessage({kind:'init',nonce,html:'<button id="b">Run</button><output id="o"></output>',modules:{},runs:[{name:'authored-fixture.js',code}],context:{},variables:{status:'available',scope:{mode:'initial'},revision:1,variables:{}},viewport:{width:480,height:800},cardStorage:{scope:'0'.repeat(64),entries:[]}})
  })
 }finally{await worker.terminate()}
}

test('ordinary storage and short computation complete in the packaged Worker',async()=>{
 assert.deepEqual(await probe(),{done:true})
})
test('delayed storage distinguishes a wall deadline from guest exceptions',async()=>{
 const result=await probe({delay:250})
 assert.match(result.error,/CARD_EXECUTION_TIME; phase=event/)
 assert.ok(Number(result.error.match(/bridgeWaitMs=(\d+)/)[1])>=200)
})
test('guest exception details never enter the diagnostic',async()=>{
 const result=await probe({kind:'js'})
 assert.match(result.error,/CARD_EXECUTION_JS; phase=event/)
 assert.doesNotMatch(result.error,/PRIVATE_GUEST_EXCEPTION_MARKER/)
})
test('pure runaway computation is still stopped by the existing time limit',async()=>{
 const result=await probe({kind:'loop'})
 assert.match(result.error,/CARD_EXECUTION_TIME; phase=event/)
 assert.match(result.error,/bridgeWaitMs=0/)
 assert.ok(Number(result.error.match(/elapsedMs=(\d+)/)[1])>=120)
})
