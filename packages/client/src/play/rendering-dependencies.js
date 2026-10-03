import {discoverDependencies, renderingInventory} from './rendering-sources.js'
import {downloadRenderingSource} from './rendering-download.js'
import {renderingTrust} from './rendering-trust.js'

export const DEPENDENCY_LIMITS = {count:24, depth:8, bytes:24*1024*1024}
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('')

// Origin-private cache. Card Workers cannot reach IndexedDB or this module.
export function dependencyStore(indexedDB = globalThis.indexedDB) {
  let database
  async function operation(mode, callback) {
    if (!indexedDB) return undefined
    database ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open('dtv-rendering-dependencies',1)
      request.onupgradeneeded=()=>request.result.createObjectStore('graphs')
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error)
    })
    const db=await database
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('graphs',mode),request=callback(transaction.objectStore('graphs'))
      transaction.oncomplete=()=>resolve(request.result)
      transaction.onerror=()=>reject(transaction.error)
      transaction.onabort=()=>reject(transaction.error??Error('Dependency cache transaction aborted'))
    })
  }
  return {get:owner=>operation('readonly',store=>store.get(owner)),put:(owner,value)=>operation('readwrite',store=>store.put(value,owner)),delete:owner=>operation('readwrite',store=>store.delete(owner))}
}

export function createRenderingDependencies({trust=renderingTrust,store=dependencyStore(),download=downloadRenderingSource,limits=DEPENDENCY_LIMITS,timeout=15000,channelFactory=()=>typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dtv-rendering-dependencies'):null}={}) {
  const states=new Map(),listeners=new Set()
  let channel
  const connect=()=>{
    if(channel)return
    channel=channelFactory()
    if(channel)channel.onmessage=({data})=>{
      if(!data||typeof data.owner!=='string'||!['changing','changed'].includes(data.type))return
      const previous=states.get(data.owner)
      if(!previous)return
      previous.controller?.abort();trust.removeOwner(data.owner)
      if(data.type==='changing'){
        states.set(data.owner,{...previous,controller:null,status:data.status,items:[],error:null});emit()
      }else{
        states.delete(data.owner)
        void sync(previous.sources,[data.owner]).catch(()=>{})
      }
    }
  }
  const broadcast=(owner,type,status)=>channel?.postMessage({owner,type,status})
  const emit=()=>{for(const listener of listeners)listener()}
  const current=state=>states.get(state.owner)===state
  const snapshot=state=>state?{...state,sources:undefined,controller:undefined,ready:undefined,items:state.items.map(item=>({...item}))}:null
  async function sync(sources, owners=[]) {
    connect()
    const groups=new Map(owners.filter(Boolean).map(owner=>[owner,[]]))
    for(const source of sources){if(!groups.has(source.owner))groups.set(source.owner,[]);groups.get(source.owner).push(source)}
    await Promise.all([...groups].map(async([owner,sources])=>{
      // Enablement is independent of acquisition consent. Include disabled declarations too.
      const signature=JSON.stringify(sources.map(({key,content})=>[key,content]).sort((a,b)=>a[0].localeCompare(b[0])))
      const previous=states.get(owner)
      if(previous?.signature===signature)return previous.ready
      previous?.controller?.abort();trust.removeOwner(owner)
      const state={owner,signature,sources,status:'loading',items:[],fingerprint:null,error:null}
      states.set(owner,state);emit()
      state.ready=(async()=>{
        state.fingerprint=await digest(signature)
        if(!current(state))return
        try{
          const saved=await store.get(owner)
          if(!current(state))return
          if(saved?.fingerprint===state.fingerprint){
            if(!Array.isArray(saved.items)||saved.items.length>limits.count||saved.items.reduce((sum,item)=>sum+new TextEncoder().encode(item.content??'').byteLength,0)>limits.bytes)throw Error('Invalid dependency cache size')
            state.items=saved.items;state.status=saved.status
            await trust.install(owner,state.items.filter(item=>item.status==='ready'))
            if(!current(state))return
          }else state.status=saved?'changed':'waiting'
        }catch(error){if(current(state)){state.status='failed';state.error=error.message}}
        if(current(state))emit()
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
    const state={...original,items:[],status:'downloading',error:null,controller:new AbortController()}
    states.set(owner,state);trust.removeOwner(owner);emit();broadcast(owner,'changing','downloading')
    // A refresh during replacement must not resurrect the previous graph.
    try{await store.delete(owner)}catch(error){if(current(state)){state.status='failed';state.error=error.message;state.controller=null;emit()};return}
    if(!current(state))return
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
    try{
      await store.put(owner,{fingerprint:state.fingerprint,status:state.status,items:state.items})
      if(!current(state))return
      await trust.install(owner,state.items.filter(item=>item.status==='ready'))
    }catch(error){if(current(state)){state.status='failed';state.error=error.message}}
    if(current(state)){state.controller=null;emit();broadcast(owner,'changed')}
  }
  async function uninstall(owner) {
    const previous=states.get(owner)
    previous?.controller?.abort()
    const state=previous?{...previous,status:'waiting',items:[],error:null,controller:null}:null
    if(state)states.set(owner,state)
    trust.removeOwner(owner);emit();broadcast(owner,'changing','waiting')
    try{await store.delete(owner);if(!state||current(state))broadcast(owner,'changed')}catch(error){if(state&&current(state)){state.status='failed';state.error=error.message;emit()};throw error}
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
