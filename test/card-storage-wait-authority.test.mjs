import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MvuService} from '../packages/mvu-adapter/src/index.js'
import {createCardScopedStorage} from '../packages/client/src/play/card-scoped-storage.js'
import {createClientProbe,inputFor,listener} from '../scripts/fixtures/card-worker-probe.mjs'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('real MVU grants and session/source leases still deny writes revoked during storage waiting',async t=>{
 for(const kind of ['allowed','grant','source','session']){
  const storageDir=mkdtempSync(join(tmpdir(),'card-wait-authority-'));t.after(()=>rmSync(storageDir,{recursive:true,force:true}))
  const scope={playthroughId:'p',sessionId:'s',nodeId:'n',variantId:'v',endEventId:1,sessionFormatVersion:4},text="_.add('hp',-1);"
  const fingerprint=createHash('sha256').update(JSON.stringify(text)).digest('hex'),sourceIdentity={version:1,sha256:'a'.repeat(64),scope}
  let active=true,sourceCurrent=true
  const service=new MvuService({storageDir,resources:[{id:'mvu:card',sessionIds:['s'],initial:{stat_data:{hp:10}},schemaSource:'const Schema=z.object({hp:z.number().min(0)});'}],
   resolveScope:async()=>({writableHead:active,messageId:'reply',fingerprint}),
   authorizeCardWrite:async({grantId,sourceIdentity:identity})=>grantId==='grant'&&sourceCurrent&&JSON.stringify(identity)===JSON.stringify(sourceIdentity)?{valid:true,write:true,scope,checkCurrent:()=>sourceCurrent}:null})
  const events=[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'assistant/message',data:{turn:1,message:{id:'reply',content:[{type:'text',text}]} }},{seq:2,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}}]
  await service.ingest({id:'s',header:{id:'s',version:4},inheritedEventCount:0,snapshotEvents:()=>events});service.inspect=async()=>({header:{id:'s',version:4},events})
  service.registerUsage(request=>({enabled:request.event.cause==='user-interaction',checkCurrent:()=>true}))
  const binding=await service.createCardBinding({scope,sourceIdentity,grantId:'grant'}),snapshot=await service.snapshot(scope),results=[]
  const map=new Map(),storage=createCardScopedStorage({owners:['authored-owner'],scopeKey:'authored-session',sourceIdentity:'authored-source',storage:{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}})
  const probe=createClientProbe({delay:250,onStorage(request){
   const value=storage.request(request)
   if(kind==='grant')service.revokeCardBinding(binding.capability)
   if(kind==='source')sourceCurrent=false
   if(kind==='session')active=false
   return value
  },onWrite:async request=>{
   assert.equal(request.cause,'user-interaction')
   try{const value=await service.cardWrite({...request,capability:binding.capability,expectedRevision:request.observedRevision});results.push('applied');return value}
   catch(error){results.push(error.code);throw error}
  }})
  try{
   const code=listener(`localStorage.setItem('own','ok');Mvu.replaceMvuData({stat_data:{hp:3}}).then(()=>{document.getElementById('o').textContent='APPLIED'},()=>{document.getElementById('o').textContent='DENIED'})`)
   probe.start(inputFor(code,{variables:snapshot,cardStorage:storage.initial}));await probe.ready
   const target=Number(probe.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);probe.runtime.dispatch({type:'click',target},{trusted:true})
   const until=performance.now()+1500;while(!results.length&&performance.now()<until)await sleep(20)
   assert.deepEqual(results,[kind==='allowed'?'applied':kind==='session'?'MVU_READ_ONLY':'MVU_WRITE_DENIED'])
   const read=await service.read({id:'mvu:card',scope:{sessionId:'s'}})
   assert.equal(read.content.stat_data.hp,kind==='allowed'?3:9)
   assert.equal(read.revision,kind==='allowed'?2:1)
  }finally{storage.dispose();await probe.close()}
 }
})
