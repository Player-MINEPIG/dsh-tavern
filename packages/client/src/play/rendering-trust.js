import {mvuBuiltin} from './mvu-builtins.js'
import { externalUrl, MAX_RENDER_SOURCE } from './rendering-sources.js'

// Ephemeral, outside-card authority. Never restore approvals from card data,
// workspace files or localStorage; a reload requires a fresh review.
export function createRenderingTrust() {
  const records = new Map(), intentions = new Map(), listeners = new Set()
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
      if (!records.has(key) && records.size >= 64) throw Error('Rendering source count exceeds limit')
      const bytes=new TextEncoder().encode(content).byteLength
      if(bytes>MAX_RENDER_SOURCE||[...records.entries()].reduce((sum,[id,value])=>sum+(id===key?0:new TextEncoder().encode(value.content).byteLength),bytes)>64*1024*1024)throw Error('Rendering cache exceeds limit')
      records.set(key,{ticket,owner,source,content,approved:false,digest:null}); emit()
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
      if (generation !== epoch || records.get(key)?.ticket !== ticket) throw Error('Rendering review was cancelled')
      records.set(key,{owner,source,content,digest,approved:false}); emit()
      return digest
    },
    inspect(owner,source) { const value=records.get(keyFor(owner,source)); return value ? {...value,ticket:undefined} : null },
    approve(owner,source,digest) {
      const value = records.get(keyFor(owner,source))
      if (!value?.digest || digest !== value.digest) throw Error('Rendering content changed; review again')
      records.set(keyFor(owner,source),{...value,approved:true}); emit()
    },
    setBuiltin(owner,source,enabled) {
      const key=keyFor(owner,source),record=records.get(key)
      if(!record?.approved||!mvuBuiltin(source,record.digest))throw Error('Built-in adapter requires reviewed exact supported bytes')
      records.set(key,{...record,builtin:enabled===true});emit()
    },
    revoke(owner,source) { records.delete(keyFor(owner,source)); emit() },
    read(owner,source) {
      const value=records.get(keyFor(owner,source))
      if (source.startsWith('https:') && intentions.get(keyFor(owner,source)) === false) throw Error('Rendering source is disabled')
      if (!value?.approved) throw Error('Rendering dependency requires content review')
      return value.content
    },
    clear() { generation++; records.clear(); emit() },
  }
}
export const renderingTrust = createRenderingTrust()
