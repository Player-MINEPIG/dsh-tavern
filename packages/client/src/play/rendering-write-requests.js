import {API_V1} from '../../../identity.js'
import {tavernFetch} from '../api-fetch.js'

// Only trusted React UI and bridge code hold these objects. Never expose to a VM.
export function createRenderingWriteRequests({request=tavernFetch}={}) {
 const entries=new Map(),listeners=new Set()
 const emit=()=>{for(const listener of listeners)listener()}
 const revokeRemote=grant=>request(`${API_V1}/rendering-write-grants/${encodeURIComponent(grant.grantId)}`,{method:'DELETE',headers:{'Content-Type':'application/json'}}).catch(()=>{})
 function revoke(entry){entry.generation++;clearTimeout(entry.expiryTimer);entry.controller?.abort();entry.controller=null;if(entry.grant)revokeRemote(entry.grant);entry.grant=null;entry.reviewed=false;entry.onRevoke?.();emit()}
 return Object.freeze({
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  list(){return [...entries.values()].map(({id,source,sourceIdentity,reviewed,grant,error})=>({id,source,sourceIdentity,reviewed,granted:!!grant,error}))},
  register({scope,owners,runs,modules,html,onRevoke}) {
   const id=crypto.randomUUID(),source=JSON.stringify({version:1,scope,owners,runs,modules,html})
   const entry={id,source,scope,sourceIdentity:null,reviewed:false,grant:null,generation:0,onRevoke};entries.set(id,entry);emit()
   crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)).then(bytes=>{
    if(!entries.has(id))return
    entry.sourceIdentity={version:1,scope,sha256:[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')};emit()
   }).catch(()=>{if(entries.has(id)){entry.error='Source hashing failed';emit()}})
   return {getGrant:()=>entry.grant?structuredClone(entry.grant):null,dispose:()=>{if(!entries.has(id))return;revoke(entry);entries.delete(id);emit()}}
  },
  review(id){const entry=entries.get(id);if(!entry?.sourceIdentity)throw Error('Source identity unavailable');revoke(entry);entry.reviewed=true;emit()},
  async authorize(id) {
   const entry=entries.get(id);if(!entry?.reviewed||!entry.sourceIdentity)throw Error('Review the complete source bundle first')
   if(entry.controller)throw Error('Authorization is already pending')
   const ticket=++entry.generation,controller=new AbortController();entry.controller=controller;entry.error=null
   try{
    const response=await request(`${API_V1}/rendering-write-grants`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({source:entry.source,sourceIdentity:entry.sourceIdentity,reviewed:true,write:true})})
    const grant=await response.json();if(!response.ok)throw Error(grant.error??'Write authorization failed')
    if(ticket!==entry.generation||!entries.has(id)){if(grant.grantId)revokeRemote(grant);return}
    if(!Number.isSafeInteger(grant.expiresAt)||grant.expiresAt<=Date.now()||typeof grant.grantId!=='string'||grant.sourceIdentity?.version!==1||grant.sourceIdentity?.sha256!==entry.sourceIdentity.sha256||JSON.stringify(Object.entries(grant.sourceIdentity?.scope??{}).sort())!==JSON.stringify(Object.entries(entry.scope).sort()))throw Error('Invalid write grant response')
    entry.grant={grantId:grant.grantId,sourceIdentity:entry.sourceIdentity};entry.expiryTimer=setTimeout(()=>revoke(entry),Math.min(30*60*1000,grant.expiresAt-Date.now()));emit()
   }catch(error){if(ticket===entry.generation){entry.error=error.message;emit();throw error}}finally{if(entry.controller===controller)entry.controller=null}
  },
  revoke(id){const entry=entries.get(id);if(entry)revoke(entry)},
  clear(){for(const entry of entries.values())revoke(entry);entries.clear();emit()},
 })
}
export const renderingWriteRequests=createRenderingWriteRequests()
