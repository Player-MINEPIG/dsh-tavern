import {API_V1} from '../../../identity.js'
import {tavernFetch} from '../api-fetch.js'

// Internal execution leases. Downloaded source and saved script switches decide
// execution; these objects and their transport never enter the card VM.
export function createRenderingWriteRequests({request=tavernFetch}={}) {
 const entries=new Set(),listeners=new Set(),revocations=new Map()
 const emit=()=>{for(const listener of listeners)listener()}
 async function revokeRemote(grant,remove) {
  const key=(remove?'mvu:':'rendering:')+grant.grantId
  let item=revocations.get(key)
  if(item?.pending)return
  if(!item){item={id:crypto.randomUUID(),grant,pending:false,error:null};item.remove=remove;revocations.set(key,item)}
  item.pending=true;item.error=null;emit()
  try{
   if(item.remove)await item.remove()
   else{const response=await request(`${API_V1}/rendering-write-grants/${encodeURIComponent(grant.grantId)}`,{method:'DELETE',keepalive:true,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw Error('Server execution cleanup failed (HTTP '+response.status+')')}
   revocations.delete(key)
  }catch(error){item.error=String(error.message)}finally{item.pending=false;emit()}
 }
 function release(entry,notify=true){entry.generation++;entry.controller?.abort();entry.controller=null;if(entry.started)void revokeRemote({grantId:entry.executionId});entry.executionId=crypto.randomUUID();entry.started=false;entry.grant=null;if(notify)entry.onRevoke?.()}
 return Object.freeze({
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  listRevocations(){return [...revocations.values()].map(({id,pending,error})=>({id,pending,error}))},
  retryRevocation(id){const item=[...revocations.values()].find(item=>item.id===id);return item?revokeRemote(item.grant,item.remove):Promise.resolve()},
  revokeMvuBinding(capability,remove){return revokeRemote({grantId:capability},remove)},
  register({scope,owners,runs,modules,html,adapters=[],schemaDeclarations=[],downloaded,enabled,onRevoke}) {
   if(downloaded!==true||enabled!==true)throw Error('Card execution requires available sources and enabled scripts')
   const source=JSON.stringify({version:1,scope,owners,runs,modules,html,adapters,schemaDeclarations})
   const boundScope=JSON.parse(source).scope
   const entry={grant:null,generation:0,onRevoke,executionId:crypto.randomUUID(),started:false};entries.add(entry)
   const identity=crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)).then(bytes=>({version:1,scope:boundScope,sha256:[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}))
   // Only a variables request reports a hashing failure.
   identity.catch(()=>{})
   const current=()=>{if(!entries.has(entry))throw new DOMException('Card execution stopped','AbortError')}
   let pending
   const acquire=async()=>{
    current()
    if(entry.grant)return structuredClone(entry.grant)
    if(pending)return pending
    const ticket=entry.generation,executionId=entry.executionId,controller=new AbortController();entry.controller=controller
    const work=(async()=>{
     const sourceIdentity=await identity;current();controller.signal.throwIfAborted()
     entry.started=true
     const response=await request(`${API_V1}/rendering-write-grants`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({source,sourceIdentity,executionId,downloaded:true,enabled:true})})
     const grant=await response.json()
     if(!response.ok)throw Object.assign(Error(grant.error??'Card execution binding failed'),{code:grant.code})
     if(ticket!==entry.generation||!entries.has(entry)){if(typeof grant.grantId==='string')void revokeRemote(grant);throw new DOMException('Card execution stopped','AbortError')}
     if(grant.grantId!==executionId||grant.sourceIdentity?.version!==1||grant.sourceIdentity?.sha256!==sourceIdentity.sha256||JSON.stringify(Object.entries(grant.sourceIdentity?.scope??{}).sort())!==JSON.stringify(Object.entries(boundScope).sort())){if(typeof grant.grantId==='string')void revokeRemote(grant);throw Error('Invalid execution binding response')}
     entry.grant={grantId:grant.grantId,sourceIdentity};return structuredClone(entry.grant)
    })()
    pending=work
    try{return await work}finally{if(pending===work)pending=null;if(entry.controller===controller)entry.controller=null}
   }
   return Object.freeze({
    getGrant:acquire,
    peekGrant:()=>entry.grant?structuredClone(entry.grant):null,
    async renew(){current();release(entry,false);try{await pending}catch{}current();return acquire()},
    dispose(){if(!entries.delete(entry))return;release(entry)},
   })
  },
  clear(){for(const entry of [...entries]){entries.delete(entry);release(entry)}},
 })
}
export const renderingWriteRequests=createRenderingWriteRequests()
