import {externalUrl,MAX_RENDER_SOURCE} from './rendering-sources.js'
import {RENDERING_CACHE_LIMITS,MAX_DEPENDENCY_IDENTITIES} from './rendering-limits.js'
import {uniqueSourceBytes} from './rendering-shared-sources.js'

const envelope=value=>value?.fingerprint?{generation:0,graph:value}:value??{generation:0}
const hash=async content=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
const sourceKey=(url,digest)=>JSON.stringify([url,digest])
const items=graph=>[...(graph?.items??[]),...(graph?.retained??[])]
const references=graph=>new Set(items(graph).filter(item=>item.contentDigest).map(item=>sourceKey(item.url,item.contentDigest)))
const legacy=graph=>items(graph).some(item=>typeof item.content==='string')

// Persist source bytes once. Graphs contain only owner-local metadata and exact
// content references. Every publication, reference release and tombstone uses
// one transaction across both stores.
export function dependencyStore(indexedDB=globalThis.indexedDB) {
  let database,initializing
  async function open(){
    if(!indexedDB)throw Error('Persistent dependency cache is unavailable')
    database??=new Promise((resolve,reject)=>{
      const request=indexedDB.open('dtv-rendering-dependencies',2)
      let finished=false
      request.onupgradeneeded=()=>{
        const db=request.result
        if(!db.objectStoreNames.contains('graphs'))db.createObjectStore('graphs')
        if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources').createIndex('url','url')
      }
      request.onsuccess=()=>{const db=request.result;if(finished){db.close();return};finished=true;db.onversionchange=()=>{db.close();database=null;initializing=null};resolve(db)}
      request.onerror=()=>{if(finished)return;finished=true;database=null;reject(request.error)}
      request.onblocked=()=>{if(finished)return;finished=true;database=null;reject(Error('Dependency cache upgrade is blocked; reload other Tavern tabs'))}
    })
    return database
  }
  async function pack(graph){
    if(!graph)return {graph,sources:new Map()}
    if(!Array.isArray(graph.items)||graph.items.length>MAX_DEPENDENCY_IDENTITIES||graph.retained!==undefined&&(!Array.isArray(graph.retained)||graph.retained.length>RENDERING_CACHE_LIMITS.count))throw Error('Invalid dependency cache size')
    const identities=new Map()
    for(const item of items(graph))if(item.content!==undefined){
      if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE)throw Error('Invalid dependency cache source')
      if(identities.has(item.url)&&identities.get(item.url).content!==item.content)throw Error('Conflicting dependency cache source versions')
      identities.set(item.url,item)
    }
    if(identities.size>RENDERING_CACHE_LIMITS.count||uniqueSourceBytes([...identities.values()])>RENDERING_CACHE_LIMITS.bytes)throw Error('Dependency cache exceeds limit')
    const sources=new Map(),known=new Map()
    const convert=async item=>{
      if(item.content===undefined)return {...item}
      if(externalUrl(item.url)!==item.url||typeof item.content!=='string'||new TextEncoder().encode(item.content).byteLength>MAX_RENDER_SOURCE)throw Error('Invalid dependency cache source')
      let contents=known.get(item.url);if(!contents)known.set(item.url,contents=new Map())
      let digest=contents.get(item.content)
      if(!digest){digest=await hash(item.content);contents.set(item.content,digest)}
      if(item.contentDigest&&item.contentDigest!==digest)throw Error('Shared dependency content changed')
      const key=sourceKey(item.url,digest),source={url:item.url,digest,content:item.content,downloadedAt:Number.isSafeInteger(item.downloadedAt)?item.downloadedAt:0}
      sources.set(key,source)
      const {content,...metadata}=item
      return {...metadata,contentDigest:digest}
    }
    const [active,retained]=await Promise.all([Promise.all((graph.items??[]).map(convert)),Promise.all((graph.retained??[]).map(convert))])
    return {graph:{...graph,items:active,...(graph.retained!==undefined?{retained}:{})},sources}
  }
  function failure(transaction,error,state){state.error=error;transaction.abort()}
  function replace(transaction,owner,saved,record,sources,state,done=()=>{}){
    const graphs=transaction.objectStore('graphs'),bytes=transaction.objectStore('sources'),old=references(saved.graph),next=references(record.graph)
    const keys=new Set([...old,...next]);let remaining=keys.size
    for(const key of keys){
      const request=bytes.get(key)
      request.onsuccess=()=>{
        try{
          const prior=request.result,incoming=sources.get(key),delta=Number(next.has(key))-Number(old.has(key))
          if(incoming&&prior&&prior.content!==incoming.content)throw Error('Shared dependency content changed')
          if(!prior&&!incoming){if(next.has(key))throw Error('Shared dependency bytes are missing')}
          else{
            const count=(prior?.references??0)+delta
            if(count<=0)bytes.delete(key)
            else{const value=prior??incoming;bytes.put({...value,downloadedAt:Math.max(value.downloadedAt??0,incoming?.downloadedAt??0),references:count},key)}
          }
          if(!--remaining)done()
        }catch(error){failure(transaction,error,state)}
      }
    }
    graphs.put(record,owner)
    if(!remaining)done()
  }
  function hydrate(transaction,saved,done,state){
    const record=structuredClone(envelope(saved)),requests=items(record.graph).filter(item=>item.contentDigest)
    let remaining=requests.length
    if(!remaining){done(record);return}
    for(const item of requests){
      const request=transaction.objectStore('sources').get(sourceKey(item.url,item.contentDigest))
      request.onsuccess=()=>{
        try{
          const source=request.result
          if(!source||source.url!==item.url||source.digest!==item.contentDigest||typeof source.content!=='string')throw Error('Shared dependency bytes are missing')
          item.content=source.content
          if(!--remaining)done(record)
        }catch(error){failure(transaction,error,state)}
      }
    }
  }
  function transactionResult(transaction,state){
    return new Promise((resolve,reject)=>{
      transaction.oncomplete=()=>resolve(state.result)
      transaction.onerror=()=>reject(state.error??transaction.error)
      transaction.onabort=()=>reject(state.error??transaction.error??Error('Dependency cache transaction aborted'))
    })
  }
  async function migrate(db){
    const state={result:[]},transaction=db.transaction('graphs','readonly'),request=transaction.objectStore('graphs').openCursor()
    request.onsuccess=()=>{const cursor=request.result;if(cursor){const saved=envelope(cursor.value);if(legacy(saved.graph))state.result.push({owner:cursor.key,saved});cursor.continue()}}
    const entries=await transactionResult(transaction,state)
    if(!entries.length)return
    const prepared=await Promise.all(entries.map(async entry=>({...entry,...await pack(entry.saved.graph)})))
    const write=db.transaction(['graphs','sources'],'readwrite'),result={}
    const next=index=>{
      const entry=prepared[index];if(!entry)return
      const read=write.objectStore('graphs').get(entry.owner)
      read.onsuccess=()=>{
        try{
          const current=envelope(read.result)
          if(current.generation===entry.saved.generation&&current.pending===entry.saved.pending&&legacy(current.graph))replace(write,entry.owner,current,{...current,graph:entry.graph},entry.sources,result,()=>next(index+1))
          else next(index+1)
        }catch(error){failure(write,error,result)}
      }
    };next(0)
    await transactionResult(write,result)
  }
  async function ready(){
    const db=await open()
    initializing??=migrate(db).catch(error=>{initializing=null;throw error})
    await initializing;return db
  }
  async function operation(owner,change,read){
    const db=await ready(),transaction=db.transaction(['graphs','sources'],change?'readwrite':'readonly'),state={result:owner===undefined?[]:undefined}
    const graphs=transaction.objectStore('graphs'),request=owner===undefined?graphs.openCursor():graphs.get(owner)
    request.onsuccess=()=>{
      try{
        if(owner===undefined){const cursor=request.result;if(cursor){const key=cursor.key;hydrate(transaction,cursor.value,saved=>state.result.push({owner:key,...saved}),state);cursor.continue()};return}
        const saved=envelope(request.result)
        if(change){const next=change(saved);state.result=next.result;if(next.record)replace(transaction,owner,saved,next.record,next.sources??new Map(),state);return}
        hydrate(transaction,saved,value=>{state.result=read?read(value):value},state)
      }catch(error){failure(transaction,error,state)}
    }
    return transactionResult(transaction,state)
  }
  const advance=(owner,pending)=>operation(owner,saved=>({record:{generation:saved.generation+1,pending,...(pending&&saved.graph?{graph:saved.graph}:{})},result:saved.generation+1}))
  return {
    list:()=>operation(undefined),get:owner=>operation(owner),
    readCurrent:(owner,snapshot,accept)=>operation(owner,null,saved=>saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false),
    begin:owner=>advance(owner,true),remove:owner=>advance(owner,false),
    async publish(owner,generation,graph){const packed=await pack(graph);return operation(owner,saved=>saved.generation===generation&&saved.pending?{record:{generation,graph:packed.graph,pending:false},sources:packed.sources,result:true}:{result:false})},
    async source(url){
      const db=await ready(),transaction=db.transaction('sources','readonly'),state={},request=transaction.objectStore('sources').index('url').getAll(url)
      request.onsuccess=()=>{state.result=request.result.filter(value=>value.references>0).sort((a,b)=>(b.downloadedAt??0)-(a.downloadedAt??0))[0]??null}
      const source=await transactionResult(transaction,state)
      if(source&&(externalUrl(source.url)!==source.url||typeof source.content!=='string'||new TextEncoder().encode(source.content).byteLength>MAX_RENDER_SOURCE||await hash(source.content)!==source.digest))throw Error('Shared dependency content changed')
      return source?{content:source.content,contentDigest:source.digest,downloadedAt:source.downloadedAt}:null
    },
  }
}
