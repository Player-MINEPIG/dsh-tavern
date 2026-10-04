import {DEPENDENCY_LIMITS, RENDERING_CACHE_LIMITS} from './rendering-limits.js'
import {mvuBuiltin,MVU_BUILTINS} from './mvu-builtins.js'
import {normalizeRenderingAdapters} from '../../../presentation/rendering-adapters.js'
import {createRenderingCacheBudget,renderingCacheBudget} from './rendering-cache-budget.js'
import { externalUrl, MAX_RENDER_SOURCE } from './rendering-sources.js'
import {uniqueSourceBytes} from './rendering-shared-sources.js'

// Outside-card executable cache. Only the resource acquisition lifecycle installs
// downloaded graphs. Script enablement and variable-write grants stay separate.
export function createRenderingTrust({builtin=mvuBuiltin,candidates=MVU_BUILTINS,budget=createRenderingCacheBudget()}={}) {
  const installs = new Map(), records = new Map(), intentions = new Map(), adapters = new Map(), listeners = new Set()
  let revision = 0, generation = 0
  let inactiveBytes=()=>0
  let cacheReady=async()=>{}
  const emit = () => { revision++; for (const listener of listeners) listener() }
  const keyFor = (owner, source) => JSON.stringify([owner,source])
  const reserveRecords=values=>{
    const snapshot=budget.snapshot(),old=new Map(snapshot.entries),next=new Map([
      ['executable',uniqueSourceBytes(values)],
      ['executable-inactive',inactiveBytes(values)],
    ])
    const total=snapshot.total+[...next].reduce((sum,[key,bytes])=>sum+bytes-(old.get(key)??0),0)
    if(total>snapshot.limit)throw Error('Rendering code and opening data cache exceed the shared byte budget')
    // Decrease first, then increase: transferring a cached source between active
    // and inactive never briefly double charges it. Failure leaves both old keys.
    for(const [key,bytes] of next)if(bytes<(old.get(key)??0))budget.reserve(key,bytes)
    for(const [key,bytes] of next)if(bytes>=(old.get(key)??0))budget.reserve(key,bytes)
  }
  return {
    cacheBudget:budget,
    accountInactive(callback,ready){const previous=inactiveBytes,previousReady=cacheReady;inactiveBytes=callback??(()=>0);cacheReady=ready??(async()=>{});try{reserveRecords([...records.values()])}catch(error){inactiveBytes=previous;cacheReady=previousReady;throw error}},
    reaccount(){reserveRecords([...records.values()])},
    revision: () => revision,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    isEnabled(owner, source, fallback = true) {
      return intentions.get(keyFor(owner,source)) ?? fallback
    },
    setEnablement(value) {
      const next = value?.entries ?? []
      if (JSON.stringify([...intentions]) === JSON.stringify(next.map(item=>[keyFor(item.owner,item.key),item.enabled]))) return
      const updated=new Map(next.map(item=>[keyFor(item.owner,item.key),item.enabled])),owners=new Set()
      for(const key of new Set([...intentions.keys(),...updated.keys()]))if(intentions.get(key)!==updated.get(key))owners.add(JSON.parse(key)[0])
      // A former enabled shortcut cannot lend its saved minimum depth during
      // the React update before the selected graph is refreshed.
      for(const [key,record] of records)if(owners.has(record.owner))records.set(key,{...record,depth:undefined})
      intentions.clear()
      for (const item of next) intentions.set(keyFor(item.owner,item.key),item.enabled)
      emit()
    },
    setAdapterIntents(value) {
      const next=value===undefined?[]:normalizeRenderingAdapters(value).entries
      const pairs=next.map(item=>[keyFor(item.owner,item.source),item.mode])
      if(JSON.stringify([...adapters])===JSON.stringify(pairs))return
      adapters.clear();for(const [key,mode] of pairs)adapters.set(key,mode);emit()
    },
    adapterIntent(owner,source){return adapters.get(keyFor(owner,source))},
    builtinCandidate(source){return candidates.find(item=>item.url===source)??null},
    selection(owner){const selected=values=>[...values].filter(([key])=>JSON.parse(key)[0]===owner).sort((a,b)=>a[0].localeCompare(b[0]));return {enablement:selected(intentions),adapters:selected(adapters)}},
    async verifyBuiltin(owner,source,content) {
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
      const descriptor=builtin(source,digest)
      if(!descriptor)throw Error('Unsupported built-in adapter bytes; choose original code explicitly to download its graph')
      return descriptor
    },
    async stage(owner, source, content) {
      if (typeof owner !== 'string' || owner.length > 300 || typeof source !== 'string' || source.length > 2048 || typeof content !== 'string' || content.length > MAX_RENDER_SOURCE) throw Error('Rendering source exceeds limit')
      if (source.startsWith('https:') && externalUrl(source) !== source) throw Error('Unsupported dependency URL')
      const key = keyFor(owner,source), ticket = {}, epoch = generation
      const ownerTicket=installs.get(owner)
      await cacheReady()
      await budget.ready()
      if(generation!==epoch||installs.get(owner)!==ownerTicket)throw Error('Rendering review was cancelled')
      if (!records.has(key) && records.size >= RENDERING_CACHE_LIMITS.count) throw Error('Rendering source count exceeds limit')
      const bytes=new TextEncoder().encode(content).byteLength
      if(bytes>MAX_RENDER_SOURCE||uniqueSourceBytes([...records.values()].filter(item=>keyFor(item.owner,item.source)!==key).concat({source,content}))>RENDERING_CACHE_LIMITS.bytes)throw Error('Rendering cache exceeds limit')
      const next={ticket,owner,source,content,approved:false,digest:null}
      reserveRecords([...records.values()].filter(item=>keyFor(item.owner,item.source)!==key).concat(next))
      records.set(key,next); emit()
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
      if (generation !== epoch || records.get(key)?.ticket !== ticket) throw Error('Rendering review was cancelled')
      records.set(key,{owner,source,content,digest,approved:false}); emit()
      return digest
    },
    removeOwner(owner) { reserveRecords([...records.values()].filter(item=>item.owner!==owner));installs.set(owner,{}); for(const [key,value] of records)if(value.owner===owner)records.delete(key);emit() },
    async prepare(owner, items) {
      if(!Array.isArray(items)||items.length>DEPENDENCY_LIMITS.count||items.reduce((sum,item)=>sum+new TextEncoder().encode(item.content??'').byteLength,0)>DEPENDENCY_LIMITS.bytes)throw Error('Rendering dependency graph exceeds limit')
      const epoch=generation,ticket={};installs.set(owner,ticket)
      await cacheReady()
      await budget.ready()
      if(epoch!==generation||installs.get(owner)!==ticket)throw Error('Dependency installation cancelled')
      const next=await Promise.all(items.map(async item=>{
        if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE||item.depth!==undefined&&(!Number.isSafeInteger(item.depth)||item.depth<0||item.depth>DEPENDENCY_LIMITS.depth))throw Error('Invalid cached dependency')
        const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
        if(item.contentDigest&&item.contentDigest!==digest)throw Error('Shared dependency content changed')
        if(item.builtin===true&&(!builtin(item.url,digest)||adapters.get(keyFor(owner,item.url))==='original'))throw Error('Invalid built-in adapter selection')
        return {owner,source:item.url,content:item.content,depth:item.depth,digest,approved:true,...(item.builtin===true?{builtin:true}:{})}
      }))
      return () => {
        if(epoch!==generation||installs.get(owner)!==ticket)throw Error('Dependency installation cancelled')
        const retained=[...records.values()].filter(item=>item.owner!==owner)
        if(retained.length+next.length>RENDERING_CACHE_LIMITS.count||uniqueSourceBytes([...retained,...next])>RENDERING_CACHE_LIMITS.bytes)throw Error('Rendering cache exceeds limit')
        reserveRecords([...retained,...next])
        for(const [key,value] of records)if(value.owner===owner)records.delete(key)
        for(const item of next)records.set(keyFor(owner,item.source),item)
        emit()
      }
    },
    async install(owner,items) { const commit=await this.prepare(owner,items);commit() },
    inspect(owner,source) { const value=records.get(keyFor(owner,source)); return value ? {...value,ticket:undefined} : null },
    approve(owner,source,digest) {
      const value = records.get(keyFor(owner,source))
      if (!value?.digest || digest !== value.digest) throw Error('Rendering content changed; review again')
      records.set(keyFor(owner,source),{...value,approved:true}); emit()
    },
    setBuiltin(owner,source,enabled) {
      const key=keyFor(owner,source),record=records.get(key)
      if(!record?.approved||!builtin(source,record.digest))throw Error('Built-in adapter requires downloaded exact supported bytes')
      records.set(key,{...record,builtin:enabled===true});emit()
    },
    revoke(owner,source) { reserveRecords([...records.values()].filter(item=>item.owner!==owner||item.source!==source));records.delete(keyFor(owner,source)); emit() },
    read(owner,source) {
      const value=records.get(keyFor(owner,source))
      if (source.startsWith('https:') && intentions.get(keyFor(owner,source)) === false) throw Error('Rendering source is disabled')
      if (!value?.approved) throw Error('Rendering dependency is not downloaded; open External code to download dependencies')
      return value.content
    },
    clear() { reserveRecords([]);generation++; records.clear(); emit() },
  }
}
export const renderingTrust = createRenderingTrust({budget:renderingCacheBudget})
