import {API_V1} from '../../../identity.js'
import {OPENING_IDENTITY_SHA256,OPENING_IDS,OPENING_SOURCES} from '../../../opening-worldbook/manifest.js'
import {tavernFetch} from '../api-fetch.js'
import {downloadRenderingSource} from './rendering-download.js'
import {renderingCacheBudget} from './rendering-cache-budget.js'
import {sourceSha256} from './source-sha256.js'

const sourceDescriptor=OPENING_SOURCES[0],counts={default:0,police_done:7,hospital_done:8,alisa_party:0,pool:15}
const clone=value=>JSON.parse(JSON.stringify(value))
const identityFields=['version','owner','sessionId','characterId','greetingIndex','greetingSha256','identitySha256']
const sameIdentity=(a,b)=>identityFields.every(key=>a?.[key]===b?.[key])
export function openingSourceIdentity({sessionId,greeting}) {
  const original=greeting?.options?.find(option=>option.index===greeting.index)?.text
  if(typeof sessionId!=='string'||!sessionId||sessionId.length>200||typeof greeting?.characterId!=='string'||!greeting.characterId||greeting.characterId.length>200||!Number.isSafeInteger(greeting.index)||greeting.index<0||typeof original!=='string')return null
  return Object.freeze({version:1,owner:'pmp-dsh-tavern',sessionId,characterId:greeting.characterId,greetingIndex:greeting.index,greetingSha256:sourceSha256(original),identitySha256:OPENING_IDENTITY_SHA256})
}

// Independent inert text store: one immutable public snapshot, never a module
// record, never parsed as JavaScript and never an execution approval.
export function openingDataStore(indexedDB=globalThis.indexedDB) {
  let database
  async function transact(write,value,remove=false) {
    if(!indexedDB)throw Error('Opening data cache is unavailable')
    database??=new Promise((resolve,reject)=>{const request=indexedDB.open('dtv-opening-inert-data',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    const db=await database
    return new Promise((resolve,reject)=>{const transaction=db.transaction('snapshots',write?'readwrite':'readonly'),store=transaction.objectStore('snapshots');let result;const request=remove?store.delete('fixed-opening-v1'):write?store.put(value,'fixed-opening-v1'):store.get('fixed-opening-v1');request.onsuccess=()=>{result=request.result};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error??Error('Opening cache transaction aborted'))})
  }
  return {get:()=>transact(false),put:value=>transact(true,value),remove:()=>transact(true,undefined,true)}
}
export function createOpeningSourceCache({store=openingDataStore(),budget=renderingCacheBudget,download=downloadRenderingSource}={}) {
  let content,initialError,initialization,reportedColdError=false,queue=Promise.resolve()
  const validate=value=>{if(typeof value!=='string'||value.length>sourceDescriptor.byteLength||new TextEncoder().encode(value).byteLength!==sourceDescriptor.byteLength||sourceSha256(value)!==sourceDescriptor.sha256)throw Error('Fixed opening data source changed; download the reviewed snapshot again');return value}
  // Charge an existing physical snapshot on cold start, before selection or any
  // execution. An empty store releases the conservative initial reservation.
  const initialize=()=>{
    const tracked=(async()=>{budget.reserve('opening-inert',sourceDescriptor.byteLength);const saved=await store.get();if(saved===undefined||saved===null){budget.reserve('opening-inert',0);content=undefined;return}try{content=validate(saved)}catch(error){await store.remove();budget.reserve('opening-inert',0);content=undefined;throw error}})().then(()=>{initialError=null},error=>{initialError=error;throw error})
    budget.trackInitialization('existing-opening-inert',tracked)
    initialization=tracked
    // The producer rejects for the shared barrier. This UI-facing promise
    // records the error without an unhandled rejection during module import.
    return tracked.catch(()=>{})
  }
  const ready=initialize()
  return Object.freeze({
    ready,
    async get({signal,onProgress=()=>{}}={}) {
      await ready;signal?.throwIfAborted()
      const operation=queue.then(async()=>{
        signal?.throwIfAborted();if(initialError&&!reportedColdError){reportedColdError=true;throw initialError}
        if(initialError){await initialize();signal?.throwIfAborted();if(initialError)throw initialError}
        await initialization;signal?.throwIfAborted()
        await budget.ready();signal?.throwIfAborted()
        if(content!==undefined){onProgress('cached');return {...sourceDescriptor,content}}
        budget.reserve('opening-inert',sourceDescriptor.byteLength);onProgress('downloading')
        try{const deadline=AbortSignal.timeout(15000),value=validate(await download(sourceDescriptor.url,{signal:signal?AbortSignal.any([signal,deadline]):deadline}));signal?.throwIfAborted();await store.put(value);content=value;signal?.throwIfAborted();onProgress('verified');return {...sourceDescriptor,content}}
        catch(error){if(content===undefined)budget.reserve('opening-inert',0);throw error}
      })
      queue=operation.catch(()=>{});return operation
    },
  })
}
let sourceCache
export const loadOpeningSource=options=>(sourceCache??=createOpeningSourceCache()).get(options)
// No network at initialization; account the fixed persisted data cache now.
if(typeof window!=='undefined'&&globalThis.indexedDB)sourceCache=createOpeningSourceCache()
export const openingInertCacheReady=sourceCache?.ready??Promise.resolve()

export function createIdentityOpeningBridge({sourceIdentity,identitySource,onProposal,onProgress=()=>{},request=tavernFetch,loadSource=loadOpeningSource,uuid=()=>crypto.randomUUID(),signal}={}) {
  if(!sourceIdentity||sourceIdentity.identitySha256!==OPENING_IDENTITY_SHA256||typeof identitySource!=='string'||sourceSha256(identitySource)!==OPENING_IDENTITY_SHA256)throw Error('Opening source binding is unavailable')
  const identity=Object.freeze(clone(sourceIdentity)),controller=new AbortController()
  signal?.addEventListener('abort',()=>controller.abort(),{once:true});if(signal?.aborted)controller.abort()
  let pending,disposed=false
  const current=()=>{if(disposed||controller.signal.aborted)throw Error('Opening card generation expired')}
  const currentTicket=ticket=>{current();if(pending!==ticket)throw Error('Opening selection cancelled')}
  const post=async(operation,body)=>{current();const response=await request(`${API_V1}/sessions/${encodeURIComponent(identity.sessionId)}/opening-worldbook/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});current();const raw=await response.text();if(raw.length>1024*1024||new TextEncoder().encode(raw).byteLength>1024*1024)throw Error('Opening response exceeds its limit');const value=JSON.parse(raw);if(!response.ok||value?.ok!==true)throw Object.assign(Error(String(value?.error??'Opening operation failed').slice(0,300)),{code:value?.code});return value}
  const end=(ticket,error,result)=>{if(pending!==ticket)return;pending=null;onProposal(null);if(error)ticket.reject(error);else ticket.resolve(result)}
  return Object.freeze({
    async request(openingId) {
      current();if(!OPENING_IDS.includes(openingId)||pending)throw Error('Invalid or pending opening selection')
      const ticket={openingId};pending=ticket
      try{
        onProgress('preparing')
        const source=counts[openingId]===0?undefined:await loadSource({signal:controller.signal,onProgress})
        currentTicket(ticket);const proposal=await post('prepare',{sourceIdentity:identity,openingId,identitySource,...(source?{source}:{})});currentTicket(ticket)
        if(!sameIdentity(proposal.sourceIdentity,identity)||proposal.openingId!==openingId||proposal.entryCount!==counts[openingId]||!Array.isArray(proposal.entries)||proposal.entries.length!==proposal.entryCount||!Number.isSafeInteger(proposal.expectedRevision)||proposal.expectedRevision<0||typeof proposal.proposalId!=='string'||!proposal.proposalId||proposal.proposalId.length>200||!/^[a-f0-9]{64}$/.test(proposal.entriesHash)||sourceSha256(JSON.stringify(proposal.entries))!==proposal.entriesHash||!Number.isFinite(proposal.expiresAt)||proposal.expiresAt<=Date.now())throw Error('Opening proposal does not match this selection')
        if(!proposal.entryCount){pending=null;onProgress('');return {ok:true,skipped:true,inserted:0,existing:0,updated:0,method:'empty-selection'}}
        ticket.proposal=clone(proposal);ticket.operationId=uuid();onProgress('')
        return await new Promise((resolve,reject)=>{ticket.resolve=resolve;ticket.reject=reject;onProposal({...clone(proposal),operationId:ticket.operationId,error:'',busy:false})})
      }catch(error){if(pending===ticket){pending=null;onProposal(null);onProgress('')}throw error}
    },
    async confirm(proposalId,{trusted=false}={}) {
      current();const ticket=pending
      if(trusted!==true||!ticket?.proposal||ticket.proposal.proposalId!==proposalId||ticket.busy)throw Error('Opening write requires its trusted confirmation button')
      if(ticket.proposal.expiresAt<=Date.now()){end(ticket,Error('Opening proposal expired'));return}
      ticket.busy=true;onProposal({...clone(ticket.proposal),operationId:ticket.operationId,error:'',busy:true})
      try{
        const receipt=await post('commit',{proposalId,expectedRevision:ticket.proposal.expectedRevision,operationId:ticket.operationId,sourceIdentity:identity,reviewed:true,write:true})
        if(receipt.method!=='session-local'||typeof receipt.receiptId!=='string'||!receipt.receiptId||typeof receipt.resourceId!=='string'||!receipt.resourceId||!Number.isSafeInteger(receipt.revision)||receipt.revision<=ticket.proposal.expectedRevision||['inserted','existing','updated'].some(key=>!Number.isSafeInteger(receipt[key])||receipt[key]<0)||receipt.inserted+receipt.existing+receipt.updated!==ticket.proposal.entryCount)throw Error('Opening write receipt is invalid')
        current();end(ticket,null,receipt)
      }catch(error){if(!disposed&&pending===ticket&&!controller.signal.aborted){ticket.busy=false;onProposal({...clone(ticket.proposal),operationId:ticket.operationId,error:error.message,busy:false})}}
    },
    cancel(){const ticket=pending;if(ticket?.reject)end(ticket,Error('Opening world-book confirmation cancelled'));else if(ticket){pending=null;onProposal(null);onProgress('')}},
    dispose(){if(disposed)return;disposed=true;controller.abort();const ticket=pending;if(ticket?.reject)end(ticket,Error('Opening card generation expired'));else pending=null},
  })
}
