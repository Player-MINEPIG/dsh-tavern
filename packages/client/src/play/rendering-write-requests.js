import {API_V1} from '../../../identity.js'
import {tavernFetch} from '../api-fetch.js'

// Internal execution leases. Downloaded source and saved script switches decide
// execution; these objects and their transport never enter the card VM.
export function createRenderingWriteRequests({request=tavernFetch}={}) {
 const entries=new Set(),listeners=new Set(),revocations=new Map()
 const emit=()=>{for(const listener of listeners)listener()}
 async function revokeRemote(grant) {
  let item=revocations.get(grant.grantId)
  if(item?.pending)return
  if(!item){item={id:crypto.randomUUID(),grant,pending:false,error:null};revocations.set(grant.grantId,item)}
  item.pending=true;item.error=null;emit()
  try{
   const response=await request(`${API_V1}/rendering-write-grants/${encodeURIComponent(grant.grantId)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)})
   if(!response.ok)throw Error('Server execution cleanup failed (HTTP '+response.status+')')
   revocations.delete(grant.grantId)
  }catch(error){item.error=String(error.message)}finally{item.pending=false;emit()}
 }
 function release(entry,notify=true){entry.generation++;entry.controller?.abort();entry.controller=null;if(entry.grant)void revokeRemote(entry.grant);entry.grant=null;if(notify)entry.onRevoke?.()}
 return Object.freeze({
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  listRevocations(){return [...revocations.values()].map(({id,pending,error})=>({id,pending,error}))},
  retryRevocation(id){const item=[...revocations.values()].find(item=>item.id===id);return item?revokeRemote(item.grant):Promise.resolve()},
  register({scope,owners,runs,modules,html,adapters=[],schemaDeclarations=[],downloaded,enabled,onRevoke}) {
   if(downloaded!==true||enabled!==true)throw Error('Card execution requires available sources and enabled scripts')
   const source=JSON.stringify({version:1,scope,owners,runs,modules,html,adapters,schemaDeclarations})
   const boundScope=JSON.parse(source).scope
   const entry={grant:null,generation:0,onRevoke};entries.add(entry)
   const identity=crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)).then(bytes=>({version:1,scope:boundScope,sha256:[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}))
   // Only a variables request reports a hashing failure.
   identity.catch(()=>{})
   const current=()=>{if(!entries.has(entry))throw new DOMException('Card execution stopped','AbortError')}
   let pending
   const acquire=async()=>{
    current()
    if(entry.grant)return structuredClone(entry.grant)
    if(pending)return pending
    const ticket=entry.generation,controller=new AbortController();entry.controller=controller
    const work=(async()=>{
     const sourceIdentity=await identity;current();controller.signal.throwIfAborted()
     const response=await request(`${API_V1}/rendering-write-grants`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({source,sourceIdentity,downloaded:true,enabled:true})})
     const grant=await response.json()
     if(!response.ok)throw Object.assign(Error(grant.error??'Card execution binding failed'),{code:grant.code})
     if(ticket!==entry.generation||!entries.has(entry)){if(typeof grant.grantId==='string')void revokeRemote(grant);throw new DOMException('Card execution stopped','AbortError')}
     if(typeof grant.grantId!=='string'||!grant.grantId||grant.sourceIdentity?.version!==1||grant.sourceIdentity?.sha256!==sourceIdentity.sha256||JSON.stringify(Object.entries(grant.sourceIdentity?.scope??{}).sort())!==JSON.stringify(Object.entries(boundScope).sort())){if(typeof grant.grantId==='string')void revokeRemote(grant);throw Error('Invalid execution binding response')}
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
