import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8')
  .replace(/^import.*\n/gm,'').replace('export function','function')
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
function fixture(){
  let worker,now=0,serial=0,accept,photos=0,openings=0
  const posts=[],writes=[],actions=[],errors=[],timers=new Set()
  class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){}}
  const create=new Function('DEPENDENCY_LIMITS','TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout','performance',source+';return createVirtualCardRuntime')
    ({count:128,bytes:24*1024*1024},'',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=>String(++serial)},(fn,ms)=>{const timer={fn,ms};timers.add(timer);return timer},timer=>timers.delete(timer),{now:()=>now})
  const runtime=create({identityOpening:true},{onError:error=>errors.push(error),onAction:input=>{
    actions.push(input.operation)
    return input.operation==='send'?new Promise(resolve=>accept=resolve):{status:input.operation==='close'?'closed':'filled'}
  },onWrite:input=>{writes.push(input);return{variables:{}}},onPhotoPick:()=>photos++,onOpening:()=>{openings++;return{status:'empty'}}})
  const nonce=posts[0].nonce
  const message=(kind,value)=>worker.onmessage({data:{kind,nonce,value}})
  runtime.dispatch({type:'click'},{trusted:true});const taskId=posts.at(-1).taskId
  return {runtime,message,taskId,posts,writes,actions,errors,get photos(){return photos},get openings(){return openings},async acceptLate(){
    message('action',{requestId:1,taskId,operation:'fill',value:'Authored option'});await tick()
    message('action',{requestId:2,taskId,operation:'send',value:{mode:'direct',text:'Authored option'}});await tick()
    now=2000;accept({status:'accepted'});await tick()
  }}
}
test('accepted send does not renew expired MVU click authority',async()=>{
  const f=fixture();try{await f.acceptLate();f.message('write',{requestId:1,taskId:f.taskId,operation:'replace',value:{stat_data:{}},observedRevision:0,options:{}});await tick();assert.equal(f.writes.length,1);assert.equal(f.writes[0].cause,'script')}finally{f.runtime.dispose()}
})
test('late composer acceptance does not renew native photo picker activation',async()=>{
  const f=fixture();try{await f.acceptLate();f.message('photoPick',{requestId:1,taskId:f.taskId,id:1});await tick();assert.equal(f.photos,0)}finally{f.runtime.dispose()}
})
test('late composer acceptance does not renew opening selection activation',async()=>{
  const f=fixture();try{await f.acceptLate();f.message('identityOpening',{requestId:1,taskId:f.taskId,openingId:'default'});await tick();assert.equal(f.openings,0);assert.match(f.posts.at(-1).value.error,/user click/)}finally{f.runtime.dispose()}
})
test('late composer receipt still allows the one accepted own close',async()=>{
  const f=fixture();try{await f.acceptLate();f.message('action',{requestId:3,taskId:f.taskId,operation:'close'});await tick();assert.deepEqual(f.actions,['fill','send','close']);assert.equal(f.errors.length,0)}finally{f.runtime.dispose()}
})
