import test from 'node:test'
import assert from 'node:assert/strict'
import {settleCardStorageWait} from '../packages/client/src/play/card-storage-wait-budget.js'
import {spawnCardProbe,storageAck,inputFor,burn,listener,done,createClientProbe} from '../scripts/fixtures/card-worker-probe.mjs'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const numbers=error=>Object.fromEntries([...error.matchAll(/(elapsedMs|bridgeWaitMs|creditedWaitMs)=(\d+)/g)].map(([,key,value])=>[key,Number(value)]))
async function run(code,{delay=250,initial=false,onStorage,onMeasure}={}) {
 const probe=spawnCardProbe({onStorage:onStorage??((m,{post,later})=>later(delay,()=>storageAck(m,post))),onMeasure})
 try{
  probe.init(inputFor(initial?code:burn+';'+listener(code)))
  const initialized=await probe.waitFor(m=>['ready','error'].includes(m.kind))
  if(initial||initialized.kind==='error')return{message:initialized,messages:probe.messages}
  const after=probe.messages.length;probe.click()
  const message=await probe.waitFor(m=>['idle','error'].includes(m.kind),{after})
  return {message,messages:probe.messages}
 }finally{await probe.close()}
}

test('one wait is credited once only to its live execution, bounded by the IPC limit',()=>{
 const token={waitMs:0,creditedWaitMs:0},wait={execution:token,deadline:120,started:10}
 assert.equal(settleCardStorageWait(wait,{current:token,live:true,now:260,deadline:120}),370)
 assert.deepEqual(token,{waitMs:250,creditedWaitMs:250})
 assert.equal(settleCardStorageWait(wait,{current:token,live:true,now:900,deadline:370}),370)
 assert.deepEqual(token,{waitMs:250,creditedWaitMs:250})
 for(const options of [{current:{}},{live:false},{deadline:121}]){
  const old={waitMs:0,creditedWaitMs:0},pending={execution:old,deadline:120,started:0}
  const current={current:old,live:true,now:250,deadline:120,...options}
  assert.equal(settleCardStorageWait(pending,current),current.deadline)
  assert.equal(old.creditedWaitMs,0)
 }
 const long={waitMs:0,creditedWaitMs:0}
 assert.equal(settleCardStorageWait({execution:long,deadline:120,started:0},{current:long,live:true,now:2000,deadline:120}),1120)
 assert.deepEqual(long,{waitMs:2000,creditedWaitMs:1000})
})

test('controlled wait preserves remaining CPU time instead of starting a new allowance',async()=>{
 const success=await run(`burn(25);localStorage.setItem('own','ok');burn(30);${done}`)
 assert.equal(success.message.kind,'idle')
 for(const code of [`burn(180);localStorage.setItem('own','ok');${done}`,`localStorage.setItem('own','ok');burn(180);${done}`,`burn(80);localStorage.setItem('own','ok');burn(80);${done}`]){
  const result=await run(code);assert.equal(result.message.kind,'error');assert.match(result.message.value,/CARD_EXECUTION_TIME/)
  const n=numbers(result.message.value)
  if(result.messages.some(m=>m.kind==='cardStorage')){assert.ok(n.bridgeWaitMs>=200);assert.ok(n.creditedWaitMs>=200)}else assert.equal(n.creditedWaitMs,0)
 }
})

test('initial entries retain their two-second computation budget around storage',async()=>{
 const success=await run(burn+`;localStorage.setItem('own','ok');burn(1300);${done}`,{initial:true})
 assert.equal(success.message.kind,'ready')
 const failure=await run(burn+`;localStorage.setItem('own','ok');burn(2300);${done}`,{initial:true})
 assert.equal(failure.message.kind,'error');assert.match(failure.message.value,/CARD_EXECUTION_TIME; phase=initial/)
 assert.ok(numbers(failure.message.value).creditedWaitMs>=200)
})

test('sequential and pending-job storage waits remain in one execution',async()=>{
 const sequential=await run(`for(let i=0;i<3;i++)localStorage.setItem('own'+i,'ok');burn(20);${done}`)
 assert.equal(sequential.message.kind,'idle');assert.equal(sequential.messages.filter(m=>m.kind==='cardStorage').length,3)
 const pending=await run(`Promise.resolve().then(()=>{localStorage.setItem('own','ok');burn(20);${done}})`)
 assert.equal(pending.message.kind,'idle');assert.equal(pending.messages.filter(m=>m.kind==='cardStorage').length,1)
})

test('storage failure is still failure, without logging guest keys or error text',async()=>{
 const result=await run(`localStorage.setItem('PRIVATE_STORAGE_KEY','PRIVATE_STORAGE_VALUE');${done}`,{onStorage:(m,{post,later})=>later(250,()=>storageAck(m,post,{error:'PRIVATE_STORAGE_FAILURE'}))})
 assert.equal(result.message.kind,'error');assert.match(result.message.value,/CARD_EXECUTION_JS/)
 assert.doesNotMatch(result.message.value,/PRIVATE_STORAGE/)
 assert.ok(numbers(result.message.value).creditedWaitMs>=200)
 assert.ok(!result.messages.filter(m=>m.kind==='view').some(m=>m.value.includes('>DONE<')))
})

test('IPC timeout and disposal settle once; late acknowledgments cannot continue guest code',async()=>{
 for(const dispose of [false,true]){
  const probe=spawnCardProbe({onStorage:(m,{post,later})=>{if(dispose)later(100,()=>post({kind:'dispose'}));later(1150,()=>storageAck(m,post))}})
  try{
   probe.init(inputFor(listener(`localStorage.setItem('own','ok');${done}`)));await probe.waitFor(m=>m.kind==='ready');probe.click()
   if(dispose)await probe.exited
   else{const error=await probe.waitFor(m=>m.kind==='error');assert.match(error.value,/storage response deadline/)}
   await sleep(150);assert.ok(!probe.messages.filter(m=>m.kind==='view').some(m=>m.value.includes('>DONE<')))
  }finally{await probe.close()}
 }
})

test('catching a timed-out storage operation cannot continue with a proposal or variable write',async()=>{
 const result=await run(`try{localStorage.setItem('own','ok')}catch{};TavernUI.proposeMessage('UNREACHABLE');Mvu.replaceMvuData({});${done}`,{delay:1150})
 assert.equal(result.message.kind,'error');assert.match(result.message.value,/storage response deadline/)
 assert.ok(!result.messages.some(m=>['proposal','write'].includes(m.kind)))
 assert.ok(!result.messages.filter(m=>m.kind==='view').some(m=>m.value.includes('>DONE<')))
})

test('wrong nonce, request ID and duplicate old ack do not settle a newer wait',async()=>{
 const requests=[]
 const result=await run(`localStorage.setItem('own1','ok');localStorage.setItem('own2','ok');${done}`,{onStorage:(m,{post,later})=>{
  requests.push(m.value.revision)
  post({kind:'cardStorageResult',nonce:'wrong',requestId:m.value.revision,value:{value:{}}})
  post({kind:'cardStorageResult',requestId:m.value.revision+20,value:{value:{}}})
  if(m.value.revision===2)storageAck({...m,value:{revision:1}},post,{error:'OLD_ACK_MUST_NOT_APPLY'})
  later(250,()=>{storageAck(m,post);storageAck(m,post,{error:'DUPLICATE_ACK_MUST_NOT_APPLY'})})
 }})
 assert.equal(result.message.kind,'idle');assert.deepEqual(requests,[1,2])
})

test('a successful layout suspension preserves short computation with its own bounded credit',async()=>{
 const result=await run(`document.getElementById('b').getBoundingClientRect();burn(30);${done}`,{onMeasure:(m,{post,later})=>later(250,()=>post({kind:'measurement',requestId:m.value.requestId,value:{rect:{x:0,y:0,width:1,height:1,top:0,left:0,right:1,bottom:1}}}))})
 assert.equal(result.message.kind,'idle');assert.ok(result.messages.some(message=>message.kind==='view'&&message.value.includes('>DONE<')))
})

test('a queued entry cannot borrow the previous execution storage credit',async()=>{
 let count=0
 const probe=spawnCardProbe({onStorage:(m,{post,later})=>later(250,()=>{storageAck(m,post);if(++count===1)storageAck(m,post,{error:'STALE_ACK'})})})
 try{
  probe.init(inputFor(burn+`;let n=0;`+listener(`if(++n===1){localStorage.setItem('own','ok');${done}}else{burn(180);document.getElementById('o').textContent='UNREACHABLE'}`)))
  await probe.waitFor(m=>m.kind==='ready');probe.click();await probe.waitFor(m=>m.kind==='cardStorage');probe.click()
  const error=await probe.waitFor(m=>m.kind==='error');assert.match(error.value,/CARD_EXECUTION_TIME/);assert.equal(numbers(error.value).creditedWaitMs,0)
  assert.ok(probe.messages.filter(m=>m.kind==='view').some(m=>m.value.includes('>DONE<')))
 }finally{await probe.close()}
})

test('storage waiting does not refresh trusted click age or turn timer writes into user writes',async()=>{
 for(const timer of [false,true]){
  let trustedNow=0
  const writes=[],probe=createClientProbe({delay:250,clock:{now:()=>trustedNow},onStorage(){if(!timer)trustedNow=1501;return{}},onWrite:async request=>{writes.push(request.cause);throw Error('Fixture policy denied')}})
  try{
   const write=`Mvu.replaceMvuData({}).catch(()=>{document.getElementById('o').textContent='DENIED'})`
   probe.start(inputFor(listener(`localStorage.setItem('own','ok');${timer?`setTimeout(()=>${write},16)`:write}`)))
   await probe.ready;const target=Number(probe.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);probe.runtime.dispatch({type:'click',target},{trusted:true})
   const until=performance.now()+1000;while(!probe.views.some(v=>v.html.includes('>DENIED<'))&&performance.now()<until)await sleep(20)
   assert.deepEqual(writes,['script']);assert.ok(probe.views.some(v=>v.html.includes('>DENIED<')))
  }finally{await probe.close()}
 }
})

test('pending-job count remains cumulative through a storage suspension',async()=>{
 const result=await run(`let p=Promise.resolve();for(let i=0;i<220;i++)p=p.then(()=>{if(i===80)localStorage.setItem('own','ok')});p.then(()=>{${done}})`)
 assert.equal(result.message.kind,'error');assert.match(result.message.value,/pending job limit/);assert.equal(result.messages.filter(m=>m.kind==='cardStorage').length,1)
})

test('the actual client busy watchdog ends repeated storage waits after 1.5 seconds',async()=>{
 const probe=createClientProbe({delay:600})
 try{
  probe.start(inputFor(listener(`for(let i=0;i<5;i++)localStorage.setItem('own'+i,'ok');${done}`)))
  await probe.ready;const target=Number(probe.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);probe.runtime.dispatch({type:'click',target},{trusted:true})
  const until=performance.now()+2500;while(!probe.errors.length&&performance.now()<until)await sleep(20)
  assert.match(probe.errors[0],/response deadline/);assert.ok(probe.clientTimers.includes(1500));assert.ok(!probe.views.some(view=>view.html.includes('>DONE<')))
 }finally{await probe.close()}
})

test('the existing startup wall watchdog is independent of credited initialization waits',async()=>{
 const probe=createClientProbe({delay:500})
 try{
  probe.start(inputFor(`for(let i=0;i<100;i++)localStorage.setItem('own','ok');${done}`))
  const until=performance.now()+16500;while(!probe.errors.length&&performance.now()<until)await sleep(50)
  assert.match(probe.errors[0],/startup deadline/);assert.ok(probe.clientTimers.includes(15000));assert.ok(probe.messages.filter(m=>m.kind==='cardStorage').length>20);assert.ok(!probe.messages.some(m=>m.kind==='ready'))
 }finally{await probe.close()}
})

test('storage completion after client disposal cannot write into a replacement generation',async()=>{
 const first=createClientProbe({delay:250}),second=createClientProbe()
 try{
  first.start(inputFor(listener(`localStorage.setItem('old','ok');${done}`)));await first.ready
  const target=Number(first.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);first.runtime.dispatch({type:'click',target},{trusted:true});await sleep(80);first.runtime.dispose()
  second.start(inputFor(listener(done)));await second.ready;const next=Number(second.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);second.runtime.dispatch({type:'click',target:next},{trusted:true});await sleep(350)
  assert.ok(!first.views.some(view=>view.html.includes('>DONE<')));assert.ok(second.views.some(view=>view.html.includes('>DONE<')))
 }finally{await first.close();await second.close()}
})
