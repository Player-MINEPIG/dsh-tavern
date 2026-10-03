import {discoverDependencies, renderingInventory} from './rendering-sources.js'
import {downloadRenderingSource} from './rendering-download.js'
import {renderingTrust} from './rendering-trust.js'

export const DEPENDENCY_LIMITS = {count:24, depth:8, bytes:24*1024*1024}
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('')
const envelope=value=>value?.fingerprint?{generation:0,graph:value}:value??{generation:0}

// Publication and tombstones use the SAME IndexedDB read/write transaction.
// BroadcastChannel is only a wake-up signal, never the ordering authority.
export function dependencyStore(indexedDB = globalThis.indexedDB) {
  let database
  async function operation(owner, change, read) {
    if (!indexedDB) throw Error('Persistent dependency cache is unavailable')
    database ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open('dtv-rendering-dependencies',1)
      request.onupgradeneeded=()=>request.result.createObjectStore('graphs')
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error)
    })
    const db=await database
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('graphs',change?'readwrite':'readonly'),store=transaction.objectStore('graphs'),request=store.get(owner)
      let result,callbackError
      request.onsuccess=()=>{
        try{
          const saved=envelope(request.result)
          if(!change){result=read?read(saved):saved;return}
          const next=change(saved);result=next.result
          if(next.record)store.put(next.record,owner)
        }catch(error){callbackError=error;transaction.abort()}
      }
      transaction.oncomplete=()=>resolve(result)
      transaction.onerror=()=>reject(callbackError??transaction.error)
      transaction.onabort=()=>reject(callbackError??transaction.error??Error('Dependency cache transaction aborted'))
    })
  }
  const advance=(owner,pending)=>operation(owner,saved=>{
    const generation=saved.generation+1
    return {record:{generation,pending},result:generation}
  })
  return {
    get:owner=>operation(owner),
    // Acceptance runs synchronously while this readonly transaction excludes
    // a concurrent generation change. Hashing/preparation must happen first.
    readCurrent:(owner,snapshot,accept)=>operation(owner,null,saved=>saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false),
    begin:owner=>advance(owner,true),
    remove:owner=>advance(owner,false),
    publish:(owner,generation,graph)=>operation(owner,saved=>saved.generation===generation&&saved.pending?{record:{generation,graph,pending:false},result:true}:{result:false}),
  }
}

export function createRenderingDependencies({trust=renderingTrust,store=dependencyStore(),download=downloadRenderingSource,limits=DEPENDENCY_LIMITS,timeout=15000,channelFactory=()=>typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dtv-rendering-dependencies'):null}={}) {
  const states=new Map(),listeners=new Set()
  let channel
  const emit=()=>{for(const listener of listeners)listener()}
  const current=state=>states.get(state.owner)===state
  const snapshot=state=>state?{...state,sources:undefined,controller:undefined,ready:undefined,items:state.items.map(item=>({...item}))}:null
  const broadcast=owner=>channel?.postMessage({owner})
  async function restore(state, saved) {
    if(!current(state))return
    state.restoring=true
    try{
      // A captured get result may arrive after a peer's completed uninstall.
      // Revalidate after async hashing, and commit only inside the current read.
      for(let attempt=0;attempt<8&&current(state);attempt++){
        const graph=saved.graph,usable=!saved.pending&&graph?.fingerprint===state.fingerprint
        if(usable&&(!Array.isArray(graph.items)||graph.items.length>limits.count||graph.items.reduce((sum,item)=>sum+new TextEncoder().encode(item.content??'').byteLength,0)>limits.bytes))throw Error('Invalid dependency cache size')
        const commit=usable?await trust.prepare(state.owner,graph.items.filter(item=>item.status==='ready')):null
        if(!current(state))return
        const accepted=await store.readCurrent(state.owner,saved,()=>{
          if(!current(state))return false
          commit?.()
          state.cacheGeneration=saved.generation
          state.items=usable?graph.items:[];state.error=usable?(graph.error??null):null
          state.status=saved.pending?'remote':usable?graph.status:graph?'changed':'waiting'
          return true
        })
        if(!current(state))return
        if(accepted){emit();return}
        saved=await store.get(state.owner)
      }
      if(current(state))throw Error('Dependency cache keeps changing; retry download')
    }catch(error){if(current(state))trust.removeOwner(state.owner);throw error}
    finally{
      state.restoring=false
      if(current(state)&&state.refreshPending){state.refreshPending=false;await refresh(state.owner)}
    }
  }
  async function refresh(owner) {
    const previous=states.get(owner)
    if(!previous)return
    if(previous.status==='loading'||previous.restoring||previous.starting){previous.refreshPending=true;return}
    try{
      const saved=await store.get(owner)
      if(!current(previous)||saved.generation<(previous.cacheGeneration??0))return
      // A peer's older wake-up must never cancel the winning local acquisition.
      if(previous.controller&&saved.generation===(previous.cacheGeneration??0))return
      previous.controller?.abort();trust.removeOwner(owner)
      const state={...previous,controller:null};states.set(owner,state)
      state.ready=restore(state,saved).catch(error=>{if(current(state)){state.status='failed';state.error=error.message;emit()}})
      await state.ready
    }catch(error){if(current(previous)){previous.status='failed';previous.error=error.message;emit()}}
  }
  const connect=()=>{
    if(channel)return
    channel=channelFactory()
    if(channel)channel.onmessage=({data})=>{if(data&&typeof data.owner==='string')void refresh(data.owner)}
  }
  async function sync(sources, owners=[]) {
    connect()
    const groups=new Map(owners.filter(Boolean).map(owner=>[owner,[]]))
    for(const source of sources){if(!groups.has(source.owner))groups.set(source.owner,[]);groups.get(source.owner).push(source)}
    await Promise.all([...groups].map(async([owner,sources])=>{
      // Acquisition covers disabled declarations too; enablement stays separate.
      const signature=JSON.stringify(sources.map(({key,content})=>[key,content]).sort((a,b)=>a[0].localeCompare(b[0])))
      const previous=states.get(owner)
      if(previous?.signature===signature)return previous.ready
      previous?.controller?.abort();trust.removeOwner(owner)
      const state={owner,signature,sources,status:'loading',items:[],fingerprint:null,error:null,cacheGeneration:0}
      states.set(owner,state);emit()
      state.ready=(async()=>{
        try{
          state.fingerprint=await digest(signature)
          if(!current(state))return
          await restore(state,await store.get(owner))
        }catch(error){if(current(state)){state.status='failed';state.error=error.message;emit()}}
      })()
      return state.ready
    }))
  }
  async function acquire(owner) {
    const original=states.get(owner)
    if(!original)throw Error('Dependency resource is unavailable')
    await original.ready
    if(!current(original))throw Error('Dependency resource changed')
    original.controller?.abort()
    const state={...original,items:[],status:'downloading',error:null,starting:true,controller:new AbortController()}
    states.set(owner,state);trust.removeOwner(owner);emit()
    try{
      state.cacheGeneration=await store.begin(owner)
      state.starting=false
      if(!current(state))return
      if(state.refreshPending){state.refreshPending=false;void refresh(owner)}
      broadcast(owner)
      const enqueue=(dependencies,depth)=>{
        for(const dependency of dependencies){
          const key=dependency.url??dependency.raw
          if(state.items.some(item=>item.key===key))continue
          if(state.items.length>=limits.count){state.error='Dependency graph exceeds '+limits.count+' files';break}
          const error=dependency.blocked?'Blocked or unresolved dependency':depth>limits.depth?'Dependency depth exceeds limit':null
          state.items.push({key,url:dependency.url,depth,status:error?'failed':'queued',error})
        }
      }
      for(const source of state.sources)enqueue(discoverDependencies(source.content),0)
      let bytes=0
      for(let i=0;i<state.items.length;i++){
        if(!current(state)||state.controller.signal.aborted)return
        const item=state.items[i]
        if(item.status==='failed')continue
        item.status='downloading';emit()
        const controller=new AbortController(),abort=()=>controller.abort()
        state.controller.signal.addEventListener('abort',abort,{once:true})
        const timer=setTimeout(abort,timeout)
        try{
          const content=await download(item.url,{signal:controller.signal})
          controller.signal.throwIfAborted()
          if(!current(state))return
          bytes+=new TextEncoder().encode(content).byteLength
          if(bytes>limits.bytes)throw Error('Dependency graph exceeds byte limit')
          item.content=content;item.status='ready'
          enqueue(discoverDependencies(content,item.url),item.depth+1)
        }catch(error){item.status='failed';item.error=controller.signal.aborted?'Download cancelled or timed out':error.message}
        finally{clearTimeout(timer);state.controller.signal.removeEventListener('abort',abort)}
        emit()
        if(bytes>limits.bytes){for(const pending of state.items.filter(item=>item.status==='queued')){pending.status='failed';pending.error='Dependency graph exceeds byte limit'};break}
      }
      if(!current(state)||state.controller.signal.aborted)return
      state.status=state.error||state.items.some(item=>item.status==='failed')?'failed':'ready'
      const published=await store.publish(owner,state.cacheGeneration,{fingerprint:state.fingerprint,status:state.status,items:state.items,error:state.error})
      if(!current(state))return
      state.controller=null
      if(!published){await refresh(owner);return}
      await restore(state,await store.get(owner))
      if(current(state)){emit();broadcast(owner)}
    }catch(error){if(current(state)){state.starting=false;state.controller=null;state.status='failed';state.error=error.message;emit();broadcast(owner)}}
  }
  async function uninstall(owner) {
    const previous=states.get(owner)
    previous?.controller?.abort()
    const state=previous?{...previous,status:'waiting',items:[],error:null,starting:true,controller:null}:null
    if(state)states.set(owner,state)
    trust.removeOwner(owner);emit()
    try{
      const generation=await store.remove(owner)
      if(state&&current(state)){state.cacheGeneration=generation;state.starting=false;if(state.refreshPending){state.refreshPending=false;await refresh(owner)}}
      broadcast(owner)
    }catch(error){if(state&&current(state)){state.starting=false;state.status='failed';state.error=error.message;emit()};throw error}
  }
  return {sync,acquire,uninstall,inspect:owner=>snapshot(states.get(owner)),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},dispose(){for(const state of states.values())state.controller?.abort();states.clear();channel?.close();channel=null;trust.clear();emit()}}
}
export const renderingDependencies=createRenderingDependencies()

// Called once after a resource import. Consent covers its declared transitive graph.
export async function offerRenderingDependencies(resource,kind,resourceId,{confirm=message=>globalThis.confirm(message),message,dependencies=renderingDependencies}={}) {
  const sources=renderingInventory(resource,{kind,resourceId})
  if(!sources.some(source=>source.dependencies.length))return
  await dependencies.sync(sources)
  const roots=[...new Set(sources.flatMap(source=>source.dependencies.map(item=>item.url??item.raw)))]
  const sourceList=roots.map(url=>'• '+url).join('\n')
  if(await confirm(typeof message==='function'?message(sourceList):message.replace('{sources}',sourceList)))void dependencies.acquire(`${kind}:${resourceId}`).catch(()=>{})
}
