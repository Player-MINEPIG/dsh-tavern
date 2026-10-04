import {MAX_RENDER_SOURCE} from './rendering-sources.js'

// Exact URL and decoded bytes are the identity. Permissions remain owner scoped.
export function uniqueSourceBytes(items,excluding=[]) {
  const seen=new Map()
  const add=item=>{
    const url=item.url??item.source
    let contents=seen.get(url);if(!contents)seen.set(url,contents=new Set())
    if(contents.has(item.content))return false
    contents.add(item.content);return true
  }
  for(const item of excluding)add(item)
  let bytes=0
  for(const item of items)if(add(item))bytes+=new TextEncoder().encode(item.content).byteLength
  return bytes
}

// Coalesce only trusted acquisition requests. Each graph retains a lease until
// publication; cancelling one owner cannot cancel another owner's request.
export function createSharedSourceDownloads({lookup,download}) {
  const pending=new Map(),active=new Set()
  let lastDownload=0
  return {
    async acquire(url,{signal,refresh=false}={}) {
      signal?.throwIfAborted()
      if(!refresh){
        const saved=await lookup(url)
        signal?.throwIfAborted()
        if(saved)return {...saved,release(){}}
      }
      let entry=refresh?null:pending.get(url)
      if(!entry){
        entry={controller:new AbortController(),users:new Set()}
        active.add(entry)
        const current=entry
        entry.promise=Promise.resolve().then(()=>download(url,{signal:current.controller.signal})).then(content=>{
          current.controller.signal.throwIfAborted()
          if(typeof content!=='string'||new TextEncoder().encode(content).byteLength>MAX_RENDER_SOURCE)throw Error('Source exceeds 8 MiB')
          lastDownload=Math.max(Date.now(),lastDownload+1)
          return {content,downloadedAt:lastDownload}
        })
        entry.promise.catch(()=>{})
        pending.set(url,entry)
      }
      const user={};entry.users.add(user)
      return new Promise((resolve,reject)=>{
        let settled=false,released=false
        const release=()=>{
          if(released)return;released=true
          signal?.removeEventListener('abort',abort);entry.users.delete(user)
          if(!entry.users.size){entry.controller.abort();active.delete(entry);if(pending.get(url)===entry)pending.delete(url)}
        }
        const abort=()=>{release();if(!settled){settled=true;reject(signal.reason??Error('Download cancelled'))}}
        signal?.addEventListener('abort',abort,{once:true})
        if(signal?.aborted){abort();return}
        entry.promise.then(value=>{if(!settled){settled=true;resolve({...value,release})}},error=>{release();if(!settled){settled=true;reject(error)}})
      })
    },
    dispose(){for(const entry of active)entry.controller.abort();active.clear();pending.clear()},
  }
}
