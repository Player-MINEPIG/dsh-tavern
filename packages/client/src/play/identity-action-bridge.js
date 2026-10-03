import {json,safeKey} from '../../../mvu-adapter/src/value.js'
import {normalizeVariables} from '../../../mvu-adapter/src/updates.js'
import {applyMvuSchema} from '../../../mvu-adapter/src/schema.js'
import {sourceSha256} from './source-sha256.js'

const limit=128*1024,plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const bounded=value=>{let nodes=0,bytes=0;const check=(item,depth)=>{if(++nodes>100000||depth>64)throw Error('Identity data exceeds structural limits');if(typeof item==='string'){if(item.length>limit||(bytes+=new TextEncoder().encode(item).byteLength)>limit)throw Error('Identity action exceeds 128 KiB');return}if(item===null||typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item))return;if(!item||typeof item!=='object'||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(item))||Object.getOwnPropertySymbols(item).length)throw Error('Identity action requires finite JSON');const descriptors=Object.getOwnPropertyDescriptors(item);for(const [key,property]of Object.entries(descriptors)){if(Array.isArray(item)&&key==='length')continue;safeKey(key);if(!Object.hasOwn(property,'value'))throw Error('Identity action cannot contain accessors');check(property.value,depth+1)}};check(value,0);const text=JSON.stringify(value);if(typeof text!=='string'||text.length>limit||new TextEncoder().encode(text).byteLength>limit)throw Error('Identity action exceeds 128 KiB');return json(value)}
const canonical=value=>JSON.stringify(value,(_,item)=>plain(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const equal=(a,b)=>canonical(a)===canonical(b)
const envelopeKeys=['stat_data','schema','mvu_schema','initialized_lorebooks','display_data','delta_data']
const identityKeys=['模板ID','难度','姓名','年龄','班级','个人信息','照片','来源','已选择','互斥开场','互斥开场ID','互斥开场触发码','开场选项','开场选项说明']
const difficulties={easy:'简单',normal:'普通',hard:'困难',extreme:'极难',outsider:'你是学生？',custom:'自定义'}
const identityOf=value=>value?.stat_data?.['系统']?.['_user身份']
export function prepareIdentityAction(packet,snapshot,model) {
 packet=bounded(packet)
 if(!plain(packet)||Object.keys(packet).some(key=>!['version','operation','value','openingId','perkIds','prompt','observedRevision'].includes(key))||packet.version!==1||packet.operation!=='replace'||typeof packet.prompt!=='string'||packet.prompt.length>4000||!Array.isArray(packet.perkIds)||packet.perkIds.length>3||new Set(packet.perkIds).size!==packet.perkIds.length)throw Error('Invalid identity action')
 if(snapshot?.status!=='available'||!Number.isSafeInteger(snapshot.currentRevision)||snapshot.currentRevision<0||packet.observedRevision!==snapshot.currentRevision||typeof snapshot.resourceId!=='string'||!snapshot.resourceId||!plain(snapshot.scope))throw Error('Identity current revision unavailable or changed')
 const baseline=bounded(snapshot.variables),input=packet.value,identity=identityOf(input),choice=model.choices.find(item=>item.id===packet.openingId),perks=model.perks.filter(item=>packet.perkIds.includes(item.id))
 if(!plain(input)||Object.keys(input).some(key=>!envelopeKeys.includes(key))||!plain(identity)||Object.keys(identity).some(key=>!identityKeys.includes(key))||!choice||perks.length!==packet.perkIds.length||!equal(perks.map(item=>item.id),packet.perkIds))throw Error('Invalid identity shape')
 if(!Object.hasOwn(difficulties,identity['模板ID'])||identity['难度']!==difficulties[identity['模板ID']]||identity['来源']!=='首楼学生证'||identity['已选择']!==true||identity['互斥开场ID']!==choice.id||identity['互斥开场']!==choice.label||identity['互斥开场触发码']!==choice.trigger)throw Error('Identity selection changed')
 for(const key of ['姓名','年龄','班级','个人信息','照片'])if(typeof identity[key]!=='string'||identity[key].length>(key==='照片'?65536:8192))throw Error('Invalid identity field')
 if(perks.length){if(identity['开场选项']!==perks.map(item=>item.label).join('、')||identity['开场选项说明']!=='已由首楼前端直接写入变量，AI不得二次发放或回退。')throw Error('Identity perks changed')}else if(Object.hasOwn(identity,'开场选项')||Object.hasOwn(identity,'开场选项说明'))throw Error('Unexpected identity perks')
 if(!plain(baseline.stat_data?.['角色'])||model.initialRoles.some(name=>!plain(baseline.stat_data['角色'][name])))throw Error('Identity initial roles unavailable')
 if(perks.some(item=>baseline.stat_data?.['系统']?.[item.key]!==item.value))throw Error('Identity perks have not been applied')
 const root=json(baseline.stat_data);root['系统']=plain(root['系统'])?root['系统']:{};root['系统']['_user身份']=json(identity)
 const expected={...baseline,stat_data:model.apply(root,identity)}
 // The backend owns these descriptors. Caller values cannot install a schema.
 const raw={...input,schema:baseline.schema}
 if(baseline.mvu_schema)raw.mvu_schema=baseline.mvu_schema;else delete raw.mvu_schema
 if(!equal(raw,expected)||model.message(identity)!==packet.prompt)throw Error('Identity candidate differs from the fixed transformation')
 const effective=normalizeVariables(raw)
 if(baseline.mvu_schema){effective.stat_data=applyMvuSchema(effective.stat_data,baseline.mvu_schema);effective.display_data=json(effective.stat_data)}
 const normalized=bounded(effective),message=model.message(identityOf(normalized))
 return freeze({value:bounded(raw),normalized,message,identity:json(identityOf(normalized)),perkIds:packet.perkIds,openingId:packet.openingId,expectedRevision:snapshot.currentRevision,scope:json(snapshot.scope),resourceId:snapshot.resourceId})
}
export function identityActionReview(value) {
 const visit=(item,key)=>{
  if(typeof item==='string'&&key==='照片')return item?{attached:true,characters:item.length,sha256:sourceSha256(item)}:''
  if(Array.isArray(item))return item.map(child=>visit(child))
  if(plain(item))return Object.fromEntries(Object.entries(item).map(([name,child])=>[name,visit(child,name)]))
  return item
 }
 return visit(value)
}

// Only trusted renderer code owns this bridge, bindings, leases and confirmations.
export function createIdentityActionBridge({model,prepareBinding,onState=()=>{},deliverMessage,clock=()=>performance.now(),wall=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}) {
 let disposed=false,generation=0,opening=null,ticket=null
 const emit=()=>{if(disposed)return;try{onState(ticket?{proposalId:ticket.id,operationId:ticket.operationId,state:ticket.state,busy:ticket.inFlight===true,error:ticket.error??'',coherent:ticket.coherent!==false,messagePresented:ticket.messagePresented===true,identity:identityActionReview(ticket.intent?.identity),current:identityActionReview(ticket.baseline),requested:identityActionReview(ticket.intent?.value),normalized:identityActionReview(ticket.intent?.normalized),message:ticket.intent?.message,opening:ticket.openingSummary,revision:ticket.receipt?.result?.revision??null}:null)}catch{/* Presentation failure cannot renew or authorize a ticket. */}}
 const authorized=item=>!disposed&&ticket===item&&item.authorization?.isCurrent()===true
 const live=item=>authorized(item)&&generation===item.generation
 const endGuest=(item,error,result)=>{if(item.settled)return;item.settled=true;clearTimeout(item.timer);if(error)item.reject(error);else item.resolve(result)}
 const acceptReceipt=(item,receipt)=>{
  const result=receipt?.result
  if(receipt?.operationId!==item.operationId||result?.status!=='available'||result.resourceId!==item.intent.resourceId||!equal(result.scope,item.intent.scope)||result.revision!==item.intent.expectedRevision+1||result.currentRevision!==result.revision)throw Error('Identity operation receipt does not match its request')
  item.receipt=freeze(bounded(receipt));item.state='committed'
  item.coherent=equal(result.variables,item.intent.normalized)
 }
 const present=async item=>{
  if(!live(item)||item.suppressed||!item.coherent)throw Error('Committed identity message cannot be presented in this scope')
  await deliverMessage(item.intent.message,item.messageLease)
  if(!live(item)||item.suppressed)throw Error('Identity message owner changed')
  item.messagePresented=true;item.error='';emit()
  endGuest(item,null,{ok:true,operationId:item.operationId,revision:item.receipt.result.revision,proposalReady:true})
 }
 const submit=async(item,at)=>{
  try{
   if(!live(item)||wall()>=item.expiresAt||!Number.isFinite(at)||at>clock()||clock()-at>=1500)throw Error('Identity confirmation expired')
   const current=item.authorization.binding.getSnapshot()
   if(current.status!=='available'||!Number.isSafeInteger(current.currentRevision)||current.currentRevision<0||current.resourceId!==item.intent.resourceId||!equal(current.scope,item.intent.scope)||(!item.retry&&current.currentRevision!==item.intent.expectedRevision))throw Error('Identity current revision changed')
   if(!live(item)||clock()-at>=1500)throw Error('Identity confirmation expired')
   item.state='pending';item.controller=new AbortController();emit()
   if(!live(item)||clock()-at>=1500)throw Error('Identity confirmation expired')
   item.admitted=true;item.inFlight=true
   const receipt=await item.authorization.binding.writeOperation({operation:'replace',value:item.intent.value,expectedRevision:item.intent.expectedRevision,operationId:item.operationId,cause:'user-interaction',signal:item.controller.signal})
   acceptReceipt(item,receipt)
   if(!live(item)||item.suppressed){if(!disposed&&ticket===item)emit();endGuest(item,Error('Identity committed after its presentation was cancelled'));return}
   if(!item.coherent){item.error='Identity committed; server result differs from the preview';emit();endGuest(item,null,{ok:true,operationId:item.operationId,revision:receipt.result.revision,proposalReady:false});return}
   try{await present(item)}catch(error){item.error='Identity committed; '+error.message;emit();endGuest(item,null,{ok:true,operationId:item.operationId,revision:receipt.result.revision,proposalReady:false})}
  }catch(error){
   if(error.operationReceipt){try{acceptReceipt(item,error.operationReceipt)}catch{item.state='unknown'}}
   else if(item.state==='pending'||item.admitted)item.state=error.code&&['REVISION_CONFLICT','MVU_WRITE_DENIED','MVU_READ_ONLY','MVU_USAGE_DENIED','MVU_USAGE_CANCELLED','MVU_SCHEMA','MVU_SCHEMA_CODE','MVU_JSON','MVU_IDEMPOTENCY_CONFLICT'].includes(error.code)?'rejected':'unknown'
   else item.state='rejected'
   item.error=error.message;if(!disposed&&ticket===item)emit()
   if(item.state!=='unknown')endGuest(item,error)
  }finally{
   item.inFlight=false;if(!disposed&&ticket===item)emit()
  }
 }
 return Object.freeze({
  beginOpening(openingId){if(ticket&&['accepted','pending','unknown'].includes(ticket.state))throw Error('Resolve the outstanding identity operation before selecting another opening');this.invalidate('Opening selection changed');opening={token:Symbol('opening'),generation,openingId,completed:false};return opening.token},
  completeOpening(token,result){if(disposed||opening?.token!==token||opening.generation!==generation)return false;if(result?.ok!==true||!['empty-selection','session-local'].includes(result.method))throw Error('Invalid opening completion');opening.completed=true;opening.result=freeze(bounded(result));return true},
  failOpening(token,reason){if(opening?.token===token&&opening.generation===generation)this.invalidate(reason)},
  async request(packet){
   packet=bounded(packet)
   if(disposed||ticket&&['preparing','prepared','accepted','pending','unknown'].includes(ticket.state)||!opening?.completed||opening.openingId!==packet.openingId)throw Error('A current completed opening is required')
   const completed=opening,item={id:uuid(),operationId:uuid(),generation,state:'preparing',settled:false,suppressed:false,expiresAt:wall()+300000};ticket=item;opening=null
   const answer=new Promise((resolve,reject)=>{item.resolve=resolve;item.reject=reject});answer.catch(()=>{})
   try{
    item.authorization=await prepareBinding();if(!live(item)||generation!==completed.generation||!completed.completed)throw Error('Identity owner changed')
    const snapshot=item.authorization.binding.getSnapshot();item.intent=prepareIdentityAction(packet,snapshot,model);item.baseline=bounded(snapshot.variables);item.messageLease=item.authorization.messageLease;item.openingSummary={openingId:completed.openingId,method:completed.result.method,receiptId:completed.result.receiptId??null,inserted:completed.result.inserted??0,existing:completed.result.existing??0}
    item.state='prepared';item.timer=setTimeout(()=>this.invalidate('Identity confirmation expired'),300000);emit()
   }catch(error){item.state='rejected';item.error=error.message;emit();endGuest(item,error)}
   return answer
  },
  confirm(proposalId,{trusted=false,at}={}){const item=ticket;if(trusted!==true||!item||item.id!==proposalId||item.state!=='prepared')return Promise.reject(Error('A native confirmation of this identity is required'));item.state='accepted';item.retry=false;emit();return submit(item,at)},
  retryOperation(proposalId,{trusted=false,at}={}){const item=ticket;if(trusted!==true||!item||item.id!==proposalId||item.state!=='unknown'||item.inFlight||!authorized(item))return Promise.reject(Error('This unknown identity operation cannot be retried'));item.generation=generation;item.state='accepted';item.retry=true;item.suppressed=false;emit();return submit(item,at)},
  async retryMessage(proposalId,{trusted=false}={}){const item=ticket;if(trusted!==true||!item||item.id!==proposalId||item.state!=='committed'||!live(item)||!item.coherent)throw Error('A current committed identity is required');item.suppressed=false;try{await present(item)}catch(error){item.error=error.message;emit();throw error}},
  invalidate(reason='Identity selection changed'){
   generation++;opening=null
   if(!ticket)return
   const item=ticket;item.suppressed=true;item.controller?.abort();clearTimeout(item.timer)
   if(['pending','accepted','unknown'].includes(item.state)){if(item.state!=='unknown')item.state='unknown';item.error=reason+'; identity may already have committed';emit();endGuest(item,Error(item.error));return}
   if(item.state==='committed'){item.error=reason+'; identity already committed';emit();return}
   item.state='cancelled';item.error=reason;emit();endGuest(item,Error(reason));ticket=null;emit()
  },
  cancel(proposalId){if(ticket?.id===proposalId)this.invalidate('Identity confirmation cancelled')},
  dispose(){if(disposed)return;this.invalidate('Identity owner disposed');disposed=true},
 })
}
