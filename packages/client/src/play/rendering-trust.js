import {DEPENDENCY_LIMITS, RENDERING_CACHE_LIMITS} from './rendering-limits.js'
import {mvuBuiltin} from './mvu-builtins.js'
import { externalUrl, MAX_RENDER_SOURCE } from './rendering-sources.js'

// Outside-card executable cache. Only the resource acquisition lifecycle installs
// downloaded graphs. Script enablement and variable-write grants stay separate.
export function createRenderingTrust() {
  const installs = new Map(), records = new Map(), intentions = new Map(), listeners = new Set()
  let revision = 0, generation = 0
  const emit = () => { revision++; for (const listener of listeners) listener() }
  const keyFor = (owner, source) => JSON.stringify([owner,source])
  return {
    revision: () => revision,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    isEnabled(owner, source, fallback = true) {
      return intentions.get(keyFor(owner,source)) ?? fallback
    },
    setEnablement(value) {
      const next = value?.entries ?? []
      if (JSON.stringify([...intentions]) === JSON.stringify(next.map(item=>[keyFor(item.owner,item.key),item.enabled]))) return
      intentions.clear()
      for (const item of next) intentions.set(keyFor(item.owner,item.key),item.enabled)
      emit()
    },
    async stage(owner, source, content) {
      if (typeof owner !== 'string' || owner.length > 300 || typeof source !== 'string' || source.length > 2048 || typeof content !== 'string' || content.length > MAX_RENDER_SOURCE) throw Error('Rendering source exceeds limit')
      if (source.startsWith('https:') && externalUrl(source) !== source) throw Error('Unsupported dependency URL')
      const key = keyFor(owner,source), ticket = {}, epoch = generation
      if (!records.has(key) && records.size >= RENDERING_CACHE_LIMITS.count) throw Error('Rendering source count exceeds limit')
      const bytes=new TextEncoder().encode(content).byteLength
      if(bytes>MAX_RENDER_SOURCE||[...records.entries()].reduce((sum,[id,value])=>sum+(id===key?0:new TextEncoder().encode(value.content).byteLength),bytes)>RENDERING_CACHE_LIMITS.bytes)throw Error('Rendering cache exceeds limit')
      records.set(key,{ticket,owner,source,content,approved:false,digest:null}); emit()
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
      if (generation !== epoch || records.get(key)?.ticket !== ticket) throw Error('Rendering review was cancelled')
      records.set(key,{owner,source,content,digest,approved:false}); emit()
      return digest
    },
    removeOwner(owner) { installs.set(owner,{}); for(const [key,value] of records)if(value.owner===owner)records.delete(key);emit() },
    async prepare(owner, items) {
      if(!Array.isArray(items)||items.length>DEPENDENCY_LIMITS.count||items.reduce((sum,item)=>sum+new TextEncoder().encode(item.content??'').byteLength,0)>DEPENDENCY_LIMITS.bytes)throw Error('Rendering dependency graph exceeds limit')
      const epoch=generation,ticket={};installs.set(owner,ticket)
      const next=await Promise.all(items.map(async item=>{
        if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE||item.depth!==undefined&&(!Number.isSafeInteger(item.depth)||item.depth<0||item.depth>DEPENDENCY_LIMITS.depth))throw Error('Invalid cached dependency')
        const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
        return {owner,source:item.url,content:item.content,depth:item.depth,digest,approved:true}
      }))
      return () => {
        if(epoch!==generation||installs.get(owner)!==ticket)throw Error('Dependency installation cancelled')
        const retained=[...records.values()].filter(item=>item.owner!==owner)
        if(retained.length+next.length>RENDERING_CACHE_LIMITS.count||[...retained,...next].reduce((sum,item)=>sum+new TextEncoder().encode(item.content).byteLength,0)>RENDERING_CACHE_LIMITS.bytes)throw Error('Rendering cache exceeds limit')
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
      if(!record?.approved||!mvuBuiltin(source,record.digest))throw Error('Built-in adapter requires downloaded exact supported bytes')
      records.set(key,{...record,builtin:enabled===true});emit()
    },
    revoke(owner,source) { records.delete(keyFor(owner,source)); emit() },
    read(owner,source) {
      const value=records.get(keyFor(owner,source))
      if (source.startsWith('https:') && intentions.get(keyFor(owner,source)) === false) throw Error('Rendering source is disabled')
      if (!value?.approved) throw Error('Rendering dependency is not downloaded; open External code to download dependencies')
      return value.content
    },
    clear() { generation++; records.clear(); emit() },
  }
}
export const renderingTrust = createRenderingTrust()
