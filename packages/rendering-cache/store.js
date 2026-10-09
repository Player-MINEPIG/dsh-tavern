import {createHash} from 'node:crypto'
import {mkdirSync,readdirSync,readFileSync,statSync,writeFileSync,renameSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {atomicJson,readJsonFile} from '../play/src/atomic-json.js'
import {externalUrl,MAX_RENDER_SOURCE,RENDERING_CACHE_LIMITS,MAX_DEPENDENCY_IDENTITIES} from './contract.js'
import {OPENING_SOURCES} from '../opening-worldbook/manifest.js'

const INDEX_LIMIT=16*1024*1024,GRAPH_LIMIT=2*1024*1024
const digest=content=>createHash('sha256').update(content).digest('hex')
const key=source=>digest(JSON.stringify([source.url,source.digest??source.contentDigest]))
const items=graph=>[...(graph?.items??[]),...(graph?.retained??[])]
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})}
const ownerId=owner=>{if(typeof owner!=='string'||!owner||owner.length>1024)fail('Invalid cache owner');return owner}
const generation=value=>{if(!Number.isSafeInteger(value)||value<0)fail('Invalid cache generation');return value}
const nextGeneration=value=>generation(value+1)

// Only inert UTF-8 data is stored here. No URL is fetched or code evaluated by
// the Host. The synchronous commit is the CAS boundary for all local clients.
export function createRenderingCache(storageDir,{limits=RENDERING_CACHE_LIMITS}={}) {
  const directory=join(storageDir,'rendering-cache'),sourceDir=join(directory,'sources'),indexPath=join(directory,'index.json')
  function load(){
    let index
    try{index=readJsonFile(indexPath,INDEX_LIMIT)}catch(error){if(error.code!=='ENOENT')throw error;index={version:1,graphs:[],sources:[],opening:{generation:0}}}
    if(index.version!==1||!Array.isArray(index.graphs)||!Array.isArray(index.sources)||index.graphs.length>MAX_DEPENDENCY_IDENTITIES||index.sources.length>limits.count)fail('Invalid persisted rendering cache',500)
    // Reclaim only our content files left by an interrupted publication or
    // post-commit collection. No unreferenced bytes count as a usable source.
    const referenced=new Set(index.sources.map(source=>key(source)+'.txt'))
    let files=[];try{files=readdirSync(sourceDir)}catch(error){if(error.code!=='ENOENT')throw error}
    for(const file of files)if(/^[a-f0-9]{64}\.txt$/.test(file)&&!referenced.has(file)||/^[a-f0-9]{64}\.txt\.[0-9]+\.[a-z0-9]+\.tmp$/.test(file))unlinkSync(join(sourceDir,file))
    return index
  }
  function read(source){
    if(externalUrl(source.url)!==source.url||!/^[a-f0-9]{64}$/.test(source.digest)||!Number.isSafeInteger(source.size)||source.size<0||source.size>MAX_RENDER_SOURCE)fail('Invalid persisted cache source',500)
    const path=join(sourceDir,key(source)+'.txt')
    if(statSync(path).size!==source.size)fail('Shared dependency content changed',500)
    const content=readFileSync(path,'utf8')
    if(digest(content)!==source.digest)fail('Shared dependency content changed',500)
    return content
  }
  function hydrate(index,record){
    const value=structuredClone(record)
    for(const item of items(value.graph))if(item.contentDigest){const source=index.sources.find(source=>key(source)===key(item));if(!source)fail('Shared dependency bytes are missing',500);item.content=read(source)}
    return value
  }
  function pack(graph){
    if(!graph||!Array.isArray(graph.items)||graph.items.length>MAX_DEPENDENCY_IDENTITIES||graph.retained!==undefined&&(!Array.isArray(graph.retained)||graph.retained.length>limits.count))fail('Invalid dependency cache graph')
    const value=structuredClone(graph),sources=new Map(),versions=new Map()
    for(const item of items(value)){
      if(!item||typeof item!=='object')fail('Invalid dependency cache item')
      if(item.content===undefined){if(item.contentDigest!==undefined&&(externalUrl(item.url)!==item.url||!/^[a-f0-9]{64}$/.test(item.contentDigest)))fail('Invalid dependency cache reference');continue}
      if(typeof item.content!=='string'||externalUrl(item.url)!==item.url||item.url.length>8192||Buffer.byteLength(item.content)>MAX_RENDER_SOURCE||Buffer.from(item.content).toString('utf8')!==item.content)fail('Invalid dependency cache source')
      if(versions.has(item.url)&&versions.get(item.url)!==item.content)fail('Conflicting dependency cache source versions')
      versions.set(item.url,item.content)
      const source={url:item.url,digest:digest(item.content),content:item.content,size:Buffer.byteLength(item.content),downloadedAt:Number.isSafeInteger(item.downloadedAt)&&item.downloadedAt>=0?item.downloadedAt:0}
      if(item.contentDigest&&item.contentDigest!==source.digest)fail('Shared dependency content changed')
      sources.set(key(source),source);item.contentDigest=source.digest;delete item.content
    }
    if(Buffer.byteLength(JSON.stringify(value))>GRAPH_LIMIT)fail('Dependency graph metadata exceeds limit',413)
    return {graph:value,sources}
  }
  function commit(prior,next,incoming=new Map()){
    if(next.graphs.length>MAX_DEPENDENCY_IDENTITIES)fail('Dependency owner limit exceeded',413)
    const refs=new Set(next.graphs.flatMap(record=>items(record.graph).filter(item=>item.contentDigest).map(key)))
    if(next.opening.sourceKey)refs.add(next.opening.sourceKey)
    const known=new Map(prior.sources.map(source=>[key(source),source])),sources=[]
    for(const ref of refs){
      const source=incoming.get(ref),existing=known.get(ref)
      if(!source&&!existing)fail('Shared dependency bytes are missing')
      if(source&&existing&&read(existing)!==source.content)fail('Shared dependency content changed',500)
      const {content,...metadata}=source??existing
      sources.push({...metadata,downloadedAt:Math.max(source?.downloadedAt??0,existing?.downloadedAt??0)})
    }
    if(sources.length>limits.count||sources.reduce((total,source)=>total+source.size,0)>limits.bytes)fail('Rendering code and opening data cache exceed the shared limit',413)
    next.sources=sources
    if(Buffer.byteLength(JSON.stringify(next,null,2))+1>INDEX_LIMIT)fail('Rendering cache metadata exceeds limit',413)
    mkdirSync(sourceDir,{recursive:true})
    const created=[]
    try{
      for(const [ref,source] of incoming)if(refs.has(ref)&&!known.has(ref)){
        const path=join(sourceDir,ref+'.txt'),temporary=path+'.'+process.pid+'.'+Math.random().toString(36).slice(2)+'.tmp'
        try{writeFileSync(temporary,source.content,{encoding:'utf8',flag:'wx',mode:0o600});renameSync(temporary,path);created.push(path)}finally{try{unlinkSync(temporary)}catch(error){if(error.code!=='ENOENT')throw error}}
      }
      atomicJson(indexPath,next,INDEX_LIMIT)
    }catch(error){for(const path of created)try{unlinkSync(path)}catch{};throw error}
    // A crash between index publication and collection can leave unreferenced
    // files, but never a graph pointing at unpublished or partly written bytes.
    for(const source of prior.sources)if(!refs.has(key(source)))try{unlinkSync(join(sourceDir,key(source)+'.txt'))}catch(error){if(error.code!=='ENOENT')throw error}
  }
  function current(index,owner){return index.graphs.find(record=>record.owner===owner)??{owner,generation:0}}
  function replace(index,owner,record,incoming){const next=structuredClone(index),at=next.graphs.findIndex(record=>record.owner===owner);if(at<0)next.graphs.push({owner,...record});else next.graphs[at]={owner,...record};commit(index,next,incoming)}
  function advance(owner,pending){ownerId(owner);const index=load(),saved=current(index,owner),value=nextGeneration(saved.generation);replace(index,owner,{generation:value,pending,...(pending&&saved.graph?{graph:saved.graph}:{})});return value}
  return Object.freeze({
    records(){return load().graphs},
    inventory(){const index=load();return {graphs:index.graphs,sources:index.sources.map(source=>({...source,content:read(source)}))}},
    list(){const index=load();return index.graphs.map(record=>hydrate(index,record))},
    get(owner){ownerId(owner);const index=load(),{owner:ignored,...record}=hydrate(index,current(index,owner));return record},
    begin:owner=>advance(owner,true),remove:owner=>advance(owner,false),
    publish(owner,value,graph){ownerId(owner);generation(value);const index=load(),saved=current(index,owner);if(saved.generation!==value||!saved.pending)return false;const packed=pack(graph);replace(index,owner,{generation:value,pending:false,graph:packed.graph},packed.sources);return true},
    import(owner,record){
      ownerId(owner);generation(record?.generation);const index=load();if(index.graphs.some(record=>record.owner===owner))return false
      const packed=record.graph?pack(record.graph):{sources:new Map()}
      replace(index,owner,{generation:Math.max(1,record.generation),pending:record.pending===true,...(packed.graph?{graph:packed.graph}:{})},packed.sources);return true
    },
    source(url){if(externalUrl(url)!==url)fail('Invalid cache URL');const index=load(),source=index.sources.filter(source=>source.url===url).sort((a,b)=>b.downloadedAt-a.downloadedAt)[0];return source?{content:read(source),contentDigest:source.digest,downloadedAt:source.downloadedAt}:null},
    opening(){const index=load(),source=index.sources.find(source=>key(source)===index.opening.sourceKey);return {generation:index.opening.generation,content:source?read(source):null}},
    putOpening(content,{onlyMissing=false}={}){
      const index=load();if(onlyMissing&&index.opening.generation!==0)return false
      const fixed=OPENING_SOURCES[0]
      if(typeof content!=='string'||Buffer.byteLength(content)!==fixed.byteLength||digest(content)!==fixed.sha256)fail('Fixed opening data source changed')
      const source={url:fixed.url,digest:fixed.sha256,content,size:fixed.byteLength,downloadedAt:0},next=structuredClone(index)
      next.opening={generation:nextGeneration(index.opening.generation),sourceKey:key(source)};commit(index,next,new Map([[key(source),source]]));return true
    },
    removeOpening(){const index=load(),next=structuredClone(index);next.opening={generation:nextGeneration(index.opening.generation)};commit(index,next)},
  })
}
