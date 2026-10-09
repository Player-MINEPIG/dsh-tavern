import {API_V1} from '../../../identity.js'
import {tavernFetch} from '../api-fetch.js'
const ROOT=`${API_V1}/rendering-cache`
export function cacheRequest(request=tavernFetch){
  return async(path,{method='GET',body}={})=>{
    const response=await request(ROOT+path,{method,cache:'no-store',signal:AbortSignal.timeout(30000),...(method==='GET'?{}:{headers:{'Content-Type':'application/json'}}),...(body===undefined?{}:{body:JSON.stringify(body)})})
    const value=await response.json()
    if(!response.ok||value?.ok!==true)throw Error(value?.error??`Rendering cache: HTTP ${response.status}`)
    return value.value
  }
}
const ownerPath=(owner,suffix='')=>`/graphs${suffix}?owner=${encodeURIComponent(owner)}`
const hydrateInventory=inventory=>{
  const sources=new Map(inventory.sources.map(source=>[JSON.stringify([source.url,source.digest]),source.content]))
  return inventory.graphs.map(record=>{
    for(const item of [...(record.graph?.items??[]),...(record.graph?.retained??[])])if(item.contentDigest){const content=sources.get(JSON.stringify([item.url,item.contentDigest]));if(content===undefined)throw Error('Shared dependency bytes are missing');item.content=content}
    return record
  })
}
export function hostDependencyStore({request=tavernFetch,legacy}={}) {
  const call=cacheRequest(request)
  let initializing
  async function ready(){
    initializing??=(async()=>{
      // Never replace a Host record, including a deletion tombstone. Keep the
      // browser original so an interrupted import can be retried without loss.
      if(!legacy)return
      const entries=await legacy.list();if(!entries.length)return
      const inventory=await call('/graphs?metadata=1'),known=new Set(inventory.graphs.map(record=>record.owner))
      for(const {owner,...record} of entries)if(!known.has(owner))await call(ownerPath(owner,'/import'),{method:'POST',body:record})
    })().catch(error=>{initializing=null;throw error})
    await initializing
  }
  const operation=async(path,options)=>{await ready();return call(path,options)}
  const get=owner=>operation(ownerPath(owner))
  return {
    list:async()=>hydrateInventory(await operation('/graphs')),get,
    async readCurrent(owner,snapshot,accept){const saved=await get(owner);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},
    begin:owner=>operation(ownerPath(owner),{method:'POST',body:{}}),
    remove:owner=>operation(ownerPath(owner),{method:'DELETE'}),
    publish:(owner,generation,graph)=>operation(ownerPath(owner),{method:'PUT',body:{generation,graph}}),
    source:url=>operation(`/sources?url=${encodeURIComponent(url)}`),
  }
}
export function hostOpeningDataStore({request=tavernFetch,legacy}={}) {
  const call=cacheRequest(request)
  let initializing
  async function ready(){
    initializing??=(async()=>{
      if(!legacy)return
      const saved=await call('/opening')
      if(saved.generation===0){const content=await legacy.get();if(content!==undefined&&content!==null)await call('/opening',{method:'PUT',body:{content,onlyMissing:true}})}
    })().catch(error=>{initializing=null;throw error})
    await initializing
  }
  return {
    async get(){await ready();return (await call('/opening')).content},
    async put(content){await ready();return call('/opening',{method:'PUT',body:{content}})},
    async remove(){await ready();return call('/opening',{method:'DELETE'})},
  }
}
