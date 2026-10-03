import {renderingInventory,identifyRenderingSources,externalUrl,MAX_RENDER_SOURCE} from './rendering-sources.js'
import {dependencyReferences} from './rendering-selection.js'
import {downloadRenderingSource} from './rendering-download.js'
import {renderingTrust} from './rendering-trust.js'

import {DEPENDENCY_LIMITS, RENDERING_CACHE_LIMITS, MAX_DEPENDENCY_IDENTITIES} from './rendering-limits.js'
export {DEPENDENCY_LIMITS} from './rendering-limits.js'
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('')
const envelope=value=>value?.fingerprint?{generation:0,graph:value}:value??{generation:0}

function discovery(limits) {
  const identities=new Set(),items=[],excluded=[],byKey=new Map()
  let capped=false,files=0
  return {
    items,excluded,
    add(dependencies,depth) {
      for(const dependency of dependencies){
        const key=dependency.url??dependency.raw
        const origins=dependency.origins??[]
        const prior=byKey.get(key)
        if(dependency.selected===false){
          if(prior)continue
          const previous=excluded.find(item=>item.key===key)
          if(previous)previous.origins=[...new Set([...previous.origins,...origins])]
          else if(excluded.length<MAX_DEPENDENCY_IDENTITIES)excluded.push({...dependency,key,depth,status:'disabled',origins})
          continue
        }
        const inactive=excluded.findIndex(item=>item.key===key);if(inactive>=0)excluded.splice(inactive,1)
        if(prior){prior.origins=[...new Set([...prior.origins,...origins])];if(dependency.adapterSupport===false)prior.adapterSupport=false;continue}
        if(identities.has(key))continue
        if(identities.size>=MAX_DEPENDENCY_IDENTITIES){capped=true;continue}
        identities.add(key)
        // Unresolved references are diagnostics, not downloaded files.
        if(dependency.url){if(files>=limits.count)continue;files++}
        const error=dependency.blocked?'Blocked or unresolved dependency':depth>limits.depth?'Dependency depth exceeds limit':null
        const item={key,url:dependency.url,depth,status:error?'failed':'queued',error,origins,adapterSupport:dependency.adapterSupport??null}
        items.push(item);byKey.set(key,item)
      }
    },
    metadata:()=>({discovered:identities.size,discoveryCapped:capped,omitted:identities.size-items.length}),
  }
}
function directGraph(sources,limits,trust) {
  const graph=discovery(limits)
  for(const source of sources)graph.add(dependencyReferences(source.content,undefined,source,trust),0)
  return {items:graph.items,excluded:graph.excluded,...graph.metadata(),complete:false}
}

async function cachedDepths(sources,graph,limits,trust,owner) {
  const items=graph.items.filter(item=>item.status==='ready'),byUrl=new Map(items.map(item=>[item.url,item])),depths=new Map(),queue=[],support=new Map(),replacements=new Set()
  if(byUrl.size!==items.length)throw Error('Invalid dependency cache identities')
  const add=(dependencies,depth)=>{
    for(const dependency of dependencies){
      if(dependency.selected===false)continue
      if(graph.status==='ready'&&(!dependency.url||!byUrl.has(dependency.url)))throw Error('Incomplete dependency cache')
      if(dependency.adapterSupport===false)support.set(dependency.url,false)
      else if(!support.has(dependency.url))support.set(dependency.url,dependency.adapterSupport)
      if(!byUrl.has(dependency.url)||depths.has(dependency.url))continue
      depths.set(dependency.url,depth);queue.push(dependency.url)
    }
  }
  for(const source of sources)add(dependencyReferences(source.content,undefined,source,trust),0)
  for(let i=0;i<queue.length;i++){
    const url=queue[i],depth=depths.get(url)
    if(depth>limits.depth)throw Error('Invalid dependency cache depth')
    const item=byUrl.get(url),candidate=trust.builtinCandidate?.(url),mode=trust.adapterIntent?.(owner,url)
    if(mode!=='original'&&(candidate||mode==='builtin')){
      if(support.get(url)!==true)throw Error('Unsupported built-in adapter invocation; choose original code explicitly')
      await trust.verifyBuiltin(owner,url,item.content);replacements.add(url)
    }else add(dependencyReferences(item.content,url,{owner,key:url,kind:'dependency',origins:item.origins??[]},trust),depth+1)
  }
  return items.map(item=>{
    const depth=depths.get(item.url)
    if(depth===undefined||item.depth!==undefined&&item.depth!==depth)throw Error('Invalid dependency cache depth')
    if(replacements.has(item.url)&&support.get(item.url)!==true)throw Error('Unsupported built-in adapter invocation')
    return {...item,depth,builtin:replacements.has(item.url)}
  })
}

function retainedCache(items,active=[]) {
  const activeUrls=new Set(active.map(item=>item.url)),byUrl=new Map()
  for(const item of items??[])if(item.content!==undefined){
    if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE)throw Error('Invalid inactive dependency cache')
    if(!activeUrls.has(item.url))byUrl.set(item.url,item)
  }
  const retained=[...byUrl.values()]
  const files=active.filter(item=>typeof item.content==='string')
  if(retained.length+files.length>RENDERING_CACHE_LIMITS.count||[...retained,...files].reduce((sum,item)=>sum+new TextEncoder().encode(item.content).byteLength,0)>RENDERING_CACHE_LIMITS.bytes)throw Error('Inactive dependency cache exceeds limit; uninstall dependencies to clear it')
  return retained
}

// A denominator is exact only once every reachable static source was explored.
export function dependencyProgress(graph) {
  const items=graph?.items??[]
  return {ready:items.filter(item=>item.status==='ready').length,failed:items.filter(item=>item.status==='failed').length,
    discovered:graph?.discovered??items.length,omitted:graph?.omitted??0,
    complete:graph?.complete===true,capped:graph?.discoveryCapped===true}
}

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
      const transaction=db.transaction('graphs',change?'readwrite':'readonly'),store=transaction.objectStore('graphs'),request=owner===undefined?store.openCursor():store.get(owner)
      let result,callbackError
      if(owner===undefined)result=[]
      request.onsuccess=()=>{
        try{
          if(owner===undefined){const cursor=request.result;if(cursor){result.push({owner:cursor.key,...envelope(cursor.value)});cursor.continue()};return}
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
    list:()=>operation(undefined),
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
  const states=new Map(),listeners=new Set(),cachedOwners=new Map(),cacheGenerations=new Map()
  let channel,disposed=false,accounted=false,initializing=null
  const account=records=>{
    let bytes=0
    for(const [owner,items] of cachedOwners)for(const item of items){
      if(!records.some(record=>record.owner===owner&&record.source===item.url&&record.content===item.content))bytes+=new TextEncoder().encode(item.content).byteLength
    }
    return bytes
  }
  trust.accountInactive?.(account,ensureCacheAccounted)
  const cacheItems=graph=>{
    if(!graph)return []
    if(!Array.isArray(graph.items)||graph.items.length>MAX_DEPENDENCY_IDENTITIES||graph.retained!==undefined&&(!Array.isArray(graph.retained)||graph.retained.length>RENDERING_CACHE_LIMITS.count))throw Error('Invalid dependency cache size')
    const all=[...graph.items,...(graph.retained??[])]
    // Failed downloads can contain source evidence; it remains inert but is
    // still charged. Ready identity validation is also used by restoration.
    const values=new Map()
    for(const item of all)if(item.content!==undefined){
      if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE)throw Error('Invalid dependency cache source')
      values.set(item.url,item)
    }
    retainedCache([...values.values()].map(item=>({...item,status:'ready'})))
    return [...values.values()]
  }
  const remember=(owner,graph,generation=0)=>{
    if(disposed||generation<(cacheGenerations.get(owner)??0))return
    const previous=cachedOwners.get(owner);cachedOwners.set(owner,cacheItems(graph))
    try{trust.reaccount?.();cacheGenerations.set(owner,generation)}catch(error){if(previous)cachedOwners.set(owner,previous);else cachedOwners.delete(owner);throw error}
  }
  async function ensureCacheAccounted() {
    await trust.cacheBudget?.ready()
    if(disposed)throw Error('Dependency cache manager disposed')
    if(accounted)return
    if(!initializing)initializing=(async()=>{
      const saved=store.list?await store.list():[]
      await trust.cacheBudget?.ready()
      if(disposed)throw Error('Dependency cache manager disposed')
      const nextOwners=new Map(cachedOwners),nextGenerations=new Map(cacheGenerations)
      for(const entry of saved){
        if((entry.generation??0)<(nextGenerations.get(entry.owner)??0))continue
        nextOwners.set(entry.owner,cacheItems(entry.graph));nextGenerations.set(entry.owner,entry.generation??0)
      }
      // Admit the whole persisted inventory atomically. A rejected owner must
      // never disappear into a successful prefix and permit later execution.
      const previous=new Map(cachedOwners)
      cachedOwners.clear();for(const [owner,items] of nextOwners)cachedOwners.set(owner,items)
      try{trust.reaccount?.()}catch(error){cachedOwners.clear();for(const [owner,items] of previous)cachedOwners.set(owner,items);throw error}
      cacheGenerations.clear();for(const [owner,generation] of nextGenerations)cacheGenerations.set(owner,generation)
      accounted=true
    })().finally(()=>{initializing=null})
    return initializing
  }
  // Eager reads are optional; every executable consumer awaits this retryable
  // producer precondition. It is not registered with the barrier it awaits.
  void ensureCacheAccounted().catch(()=>{})
  const emit=()=>{for(const listener of listeners)listener()}
  const current=state=>states.get(state.owner)===state
  const snapshot=state=>state?{...state,sources:undefined,controller:undefined,ready:undefined,cacheItems:undefined,items:state.items.map(item=>({...item}))}:null
  const broadcast=owner=>channel?.postMessage({owner})
  async function restore(state, saved) {
    if(!current(state))return
    state.restoring=true
    try{
      // A captured get result may arrive after a peer's completed uninstall.
      // Revalidate after async hashing, and commit only inside the current read.
      for(let attempt=0;attempt<8&&current(state);attempt++){
        const graph=saved.graph,usable=!saved.pending&&graph?.fingerprint===state.fingerprint
        if(graph){
          if(!Array.isArray(graph.items)||graph.items.length>MAX_DEPENDENCY_IDENTITIES)throw Error('Invalid dependency cache size')
          if(graph.retained!==undefined&&(!Array.isArray(graph.retained)||graph.retained.length>RENDERING_CACHE_LIMITS.count))throw Error('Invalid inactive dependency cache')
          state.cacheItems=[...(graph.items??[]),...(graph.retained??[])];retainedCache(state.cacheItems)
        }else if(!saved.pending)state.cacheItems=[]
        if(usable&&(!Array.isArray(graph.items)||graph.items.length>MAX_DEPENDENCY_IDENTITIES||graph.items.filter(item=>item.url).length>limits.count||graph.items.reduce((sum,item)=>sum+new TextEncoder().encode(item.content??'').byteLength,0)>limits.bytes))throw Error('Invalid dependency cache size')
        if(usable&&graph.items.some(item=>item.status==='ready'&&item.depth!==undefined&&(!Number.isSafeInteger(item.depth)||item.depth<0||item.depth>limits.depth)))throw Error('Invalid dependency cache depth')
        if(usable&&graph.discovered!==undefined&&(!Number.isSafeInteger(graph.discovered)||graph.discovered<graph.items.length||graph.discovered>MAX_DEPENDENCY_IDENTITIES||graph.omitted!==graph.discovered-graph.items.length||typeof graph.discoveryCapped!=='boolean'||typeof graph.complete!=='boolean'||graph.complete!==(graph.status==='ready')||graph.complete&&(graph.omitted||graph.discoveryCapped||graph.items.some(item=>item.status!=='ready'))))throw Error('Invalid dependency cache progress')
        // Derive minimum paths from this snapshot's declarations and exact
        // cached bytes before hashing; never trust a lowered depth hint alone.
        const prepared=usable?await cachedDepths(state.sources,graph,limits,trust,state.owner):null
        const commit=usable?await trust.prepare(state.owner,prepared):null
        if(!current(state))return
        const accepted=await store.readCurrent(state.owner,saved,()=>{
          if(!current(state))return false
          remember(state.owner,graph,saved.generation)
          commit?.()
          state.cacheGeneration=saved.generation
          const counts=usable?{
            // Older failed count-budget caches omitted at least one known file.
            discovered:graph.discovered??(graph.items.length+(/exceeds \d+ files/.test(graph.error??'')?1:0)),
            discoveryCapped:graph.discoveryCapped??/exceeds \d+ files/.test(graph.error??''),
            omitted:graph.omitted??(/exceeds \d+ files/.test(graph.error??'')?1:0),
            complete:graph.complete??(graph.status==='ready'&&graph.items.every(item=>item.status==='ready')),
            items:graph.items,excluded:graph.excluded??[],
          }:directGraph(state.sources,limits,trust)
          Object.assign(state,counts);state.retained=retainedCache(state.cacheItems,usable?graph.items:[]);state.error=usable?(graph.error??null):null
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
      const signature=JSON.stringify([sources.map(source=>[source.key,source.content,source.enabled!==false,source.preferenceKey??null,source.enablementAmbiguous===true,source.kind??null]).sort((a,b)=>a[0].localeCompare(b[0])),trust.selection?.(owner)??{}])
      const previous=states.get(owner)
      if(previous?.signature===signature&&previous.status!=='failed')return previous.ready
      previous?.controller?.abort();trust.removeOwner(owner)
      const state={owner,signature,sources,status:'loading',...directGraph(sources,limits,trust),retained:[],cacheItems:previous?.cacheItems??[],fingerprint:null,error:null,cacheGeneration:0}
      states.set(owner,state);emit()
      state.ready=(async()=>{
        try{
          await ensureCacheAccounted()
          state.fingerprint=await digest(signature)
          if(!current(state))return
          await restore(state,await store.get(owner))
        }catch(error){if(current(state)){state.status='failed';state.error=error.message;emit()}}
      })()
      return state.ready
    }))
  }
  async function acquire(owner) {
    await ensureCacheAccounted()
    const previous=states.get(owner)
    if(previous)await sync(previous.sources,[owner])
    const original=states.get(owner)
    if(!original)throw Error('Dependency resource is unavailable')
    await original.ready
    if(!current(original))throw Error('Dependency resource changed')
    original.controller?.abort()
    const pending=discovery(limits)
    for(const source of original.sources)pending.add(dependencyReferences(source.content,undefined,source,trust),0)
    const state={...original,items:pending.items,excluded:pending.excluded,...pending.metadata(),complete:false,status:'downloading',error:null,starting:true,controller:new AbortController()}
    states.set(owner,state);trust.removeOwner(owner);emit()
    try{
      state.cacheGeneration=await store.begin(owner)
      state.starting=false
      if(!current(state))return
      if(state.refreshPending){state.refreshPending=false;void refresh(owner)}
      broadcast(owner)
      const enqueue=(dependencies=[],depth=0)=>{
        pending.add(dependencies,depth);Object.assign(state,pending.metadata())
        if(state.omitted||state.discoveryCapped)state.error=(state.discoveryCapped?'Dependency discovery exceeds '+MAX_DEPENDENCY_IDENTITIES+' identities':'Dependency graph exceeds '+limits.count+' files')+'; '+state.discovered+(state.discoveryCapped?'+':'')+' discovered; graph incomplete'
      }
      enqueue()
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
          item.content=content
          const candidate=trust.builtinCandidate?.(item.url),mode=trust.adapterIntent?.(owner,item.url)
          if(mode!=='original'&&(candidate||mode==='builtin')){
            if(item.adapterSupport!==true)throw Error('Unsupported built-in adapter invocation; choose original code explicitly to download its graph')
            const adapter=await trust.verifyBuiltin(owner,item.url,content)
            controller.signal.throwIfAborted()
            if(!current(state))return
            item.builtin=true;item.adapter=adapter.kind
          }else enqueue(dependencyReferences(content,item.url,{owner,key:item.url,kind:'dependency',origins:item.origins},trust),item.depth+1)
          item.status='ready'
        }catch(error){item.status='failed';item.error=controller.signal.aborted?'Download cancelled or timed out':error.message}
        finally{clearTimeout(timer);state.controller.signal.removeEventListener('abort',abort)}
        emit()
        if(bytes>limits.bytes){for(const pending of state.items.filter(item=>item.status==='queued')){pending.status='failed';pending.error='Dependency graph exceeds byte limit'};break}
      }
      if(!current(state)||state.controller.signal.aborted)return
      for(const item of state.items)if(item.builtin&&item.adapterSupport!==true){item.status='failed';item.error='Unsupported built-in adapter invocation';item.builtin=false}
      state.status=state.error||state.items.some(item=>item.status==='failed')?'failed':'ready'
      state.complete=state.status==='ready'
      state.retained=retainedCache(state.cacheItems,state.items)
      // Check the combined executable/inactive/inert budget before publishing
      // any new persisted bytes; current bindings were already removed.
      const stored={fingerprint:state.fingerprint,status:state.status,items:state.items,excluded:state.excluded,retained:state.retained,error:state.error,discovered:state.discovered,discoveryCapped:state.discoveryCapped,omitted:state.omitted,complete:state.complete}
      remember(owner,stored,state.cacheGeneration)
      const published=await store.publish(owner,state.cacheGeneration,stored)
      if(!current(state))return
      state.controller=null
      if(!published){await refresh(owner);return}
      await restore(state,await store.get(owner))
      if(current(state)){emit();broadcast(owner)}
    }catch(error){if(current(state)){state.starting=false;state.controller=null;state.status='failed';state.complete=false;state.error=error.message;emit();broadcast(owner)}}
  }
  async function uninstall(owner) {
    const previous=states.get(owner)
    previous?.controller?.abort()
    const state=previous?{...previous,...directGraph(previous.sources,limits,trust),retained:[],cacheItems:[],status:'waiting',error:null,starting:true,controller:null}:null
    if(state)states.set(owner,state)
    trust.removeOwner(owner);emit()
    try{
      const generation=await store.remove(owner)
      accounted=false
      remember(owner,null,generation)
      if(state&&current(state)){state.cacheGeneration=generation;state.starting=false;if(state.refreshPending){state.refreshPending=false;await refresh(owner)}}
      broadcast(owner)
    }catch(error){if(state&&current(state)){state.starting=false;state.status='failed';state.error=error.message;emit()};throw error}
  }
  return {sync,acquire,uninstall,inspect:owner=>snapshot(states.get(owner)),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},dispose(){disposed=true;for(const state of states.values())state.controller?.abort();states.clear();cachedOwners.clear();cacheGenerations.clear();trust.accountInactive?.(null);channel?.close();channel=null;trust.clear();emit()}}
}
export const renderingDependencies=createRenderingDependencies()

// Called once after a resource import. Consent covers its selected transitive graph.
export async function offerRenderingDependencies(resource,kind,resourceId,{confirm=message=>globalThis.confirm(message),message,dependencies=renderingDependencies}={}) {
  const sources=await identifyRenderingSources(renderingInventory(resource,{kind,resourceId}))
  await dependencies.sync(sources)
  const roots=dependencies.inspect(`${kind}:${resourceId}`).items.map(item=>item.url??item.key)
  if(!roots.length)return
  const sourceList=roots.map(url=>'• '+url).join('\n')
  if(await confirm(typeof message==='function'?message(sourceList):message.replace('{sources}',sourceList)))void dependencies.acquire(`${kind}:${resourceId}`).catch(()=>{})
}
