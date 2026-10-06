import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnCardProbe,inputFor,burn,done} from '../scripts/fixtures/card-worker-probe.mjs'
import {settleCardLayoutWait} from '../packages/client/src/play/card-layout-wait-budget.js'

test('layout credit is bounded, settles once, and cannot transfer between entries or failures',()=>{
 const execution={waitMs:0,creditedWaitMs:0},wait={execution,deadline:120,started:0,succeeded:true}
 assert.equal(settleCardLayoutWait(wait,{current:execution,live:true,now:900,deadline:120}),1020)
 assert.equal(settleCardLayoutWait(wait,{current:execution,live:true,now:1000,deadline:1020}),1020)
 const next={execution,deadline:1020,started:900,succeeded:true}
 assert.equal(settleCardLayoutWait(next,{current:execution,live:true,now:1800,deadline:1020}),1120)
 assert.equal(execution.creditedWaitMs,1000)
 for(const overrides of [{live:false},{current:{}},{deadline:121},{succeeded:false}]){
  const token={waitMs:0,creditedWaitMs:0},pending={execution:token,deadline:120,started:0,succeeded:overrides.succeeded??true}
  const options={current:token,live:true,now:250,deadline:120,...overrides}
  assert.equal(settleCardLayoutWait(pending,options),options.deadline);assert.equal(token.creditedWaitMs,0)
 }
})

async function timer(code,{delay=250}={}){
 const probe=spawnCardProbe({onMeasure:(message,{post,later})=>later(delay,()=>post({kind:'measurement',requestId:message.value.requestId,value:{scrollHeight:300}}))})
 try{
  probe.init(inputFor(`${burn};setTimeout(()=>{${code}},30)`))
  return await probe.waitFor(message=>message.kind==='error'||message.kind==='view'&&message.value.includes('>DONE<'))
 }finally{await probe.close()}
}
test('a delayed native height measurement does not consume the resize timer computation budget',async()=>{
 const message=await timer(`window.parent.postMessage({type:'resizeIframe',height:document.body.scrollHeight},'*');${done}`)
 assert.equal(message.kind,'view',message.value)
})
test('runaway computation after a layout response still reaches the original computation limit',async()=>{
 const message=await timer(`void document.body.scrollHeight;burn(150);${done}`)
 assert.equal(message.kind,'error');assert.match(message.value,/CARD_EXECUTION_TIME/)
 assert.ok(Number(message.value.match(/creditedWaitMs=(\d+)/)[1])>=200)
})
test('repeated layout waits cannot acquire more than one second of credit in an entry',async()=>{
 const message=await timer(`for(let i=0;i<8;i++){void document.body.scrollHeight;}TavernUI.proposeMessage('UNREACHABLE');${done}`,{delay:300})
 assert.equal(message.kind,'error');assert.ok(Number(message.value.match(/creditedWaitMs=(\d+)/)[1])<=1000)
})
