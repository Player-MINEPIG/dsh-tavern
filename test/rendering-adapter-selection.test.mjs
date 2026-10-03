import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust,renderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {normalizeRenderingAdapters,updateRenderingAdapter} from '../packages/presentation/rendering-adapters.js'
import {ConversationSettingsStore} from '../packages/tavern-loader/src/conversation-settings.js'
import {normalizeClientConversationSettings,setClientConversationSettings} from '../packages/client/src/conversation-settings.js'
const owner='character:adapters',url='https://example.com/mvu.js',child='https://example.com/provider.js',content="import './provider.js'; export const synthetic=1;"
const descriptor=(source=url,kind='mvu-facade')=>({url:source,kind,version:1,sha256:createHash('sha256').update(content).digest('hex')})
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const saved=read(key);if(saved.generation!==generation||!saved.pending)return false;map.set(key,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const trustFor=entry=>createRenderingTrust({candidates:[entry],builtin:(source,hash)=>source===entry.url&&hash===entry.sha256?entry:null})
const source=code=>({owner,key:'helper',kind:'helper',path:'scripts[0]',content:code,enabled:true})

test('exact supported side-effect root defaults to the builtin and never fetches provider children; restore rehashes',async()=>{
 const entry=descriptor(),trust=trustFor(entry),store=memory(),calls=[]
 const manager=createRenderingDependencies({trust,store,download:async key=>{calls.push(key);return content}})
 const sources=[source(`import '${url}';`)];await manager.sync(sources);await manager.acquire(owner)
 assert.deepEqual(calls,[url]);assert.equal(manager.inspect(owner).status,'ready');assert.equal(manager.inspect(owner).items[0].builtin,true)
 assert.equal(trust.inspect(owner,url).builtin,true);assert.equal(trust.inspect(owner,child),null)
 const restoredTrust=trustFor(entry),restored=createRenderingDependencies({trust:restoredTrust,store,download:()=>{throw Error('No restore network')}})
 await restored.sync(sources);assert.equal(restored.inspect(owner).status,'ready');assert.equal(restoredTrust.inspect(owner,url).builtin,true)
 const saved=await store.get(owner),generation=await store.begin(owner)
 await store.publish(owner,generation,{...saved.graph,items:saved.graph.items.map(item=>({...item,content:content+'// changed',builtin:true}))})
 const badTrust=trustFor(entry),bad=createRenderingDependencies({trust:badTrust,store});await bad.sync(sources)
 assert.equal(bad.inspect(owner).status,'failed');assert.match(bad.inspect(owner).error,/Unsupported built-in adapter bytes/);assert.equal(badTrust.inspect(owner,url),null)
})

test('known roots with unsupported calls or changed hashes remain explicit failures, never provider traversal',async()=>{
 for(const code of [`import {synthetic} from '${url}';`,`import('${url}');`,`import '${url}';`]){
  const trust=trustFor(descriptor()),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return content+'// hash mismatch'}})
  await manager.sync([source(code)]);await manager.acquire(owner)
  assert.deepEqual(calls,[url]);assert.equal(manager.inspect(owner).status,'failed');assert.equal(trust.inspect(owner,url),null)
  assert.ok(manager.inspect(owner).items[0].error);assert.equal(manager.inspect(owner).items[0].content,content+'// hash mismatch')
 }
})

test('explicit original override traverses its graph; disablement outranks the default adapter',async()=>{
 const trust=trustFor(descriptor()),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return key===url?content:''}})
 trust.setAdapterIntents(updateRenderingAdapter(undefined,owner,url,'original'))
 await manager.sync([source(`import '${url}';`)]);await manager.acquire(owner)
 assert.deepEqual(calls,[url,child]);assert.equal(manager.inspect(owner).status,'ready');assert.equal(trust.inspect(owner,url).builtin,undefined)
 trust.setEnablement({entries:[{owner,key:url,enabled:false}]});calls.length=0;await manager.acquire(owner)
 assert.deepEqual(calls,[]);assert.equal(manager.inspect(owner).discovered,0);assert.equal(trust.inspect(owner,url),null)
})

test('all selected references must support a replacement, including a later shared dependency',async()=>{
 const trust=trustFor(descriptor()),calls=[],late='https://example.com/late.js'
 const manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return key===url?content:`import {synthetic} from '${url}';`}})
 await manager.sync([source(`import '${late}'; import '${url}';`)]);await manager.acquire(owner)
 assert.deepEqual(calls,[url,late]);assert.equal(manager.inspect(owner).status,'failed');assert.equal(trust.inspect(owner,url),null)
})

test('schema replacement requires a complete helper accepted by the shared bounded schema interpreter',async()=>{
 const schemaUrl='https://example.com/mvu_zod.js',entry=descriptor(schemaUrl,'backend-schema')
 for(const complete of [true,false]){
  const code=`import {registerMvuSchema} from '${schemaUrl}';\n`+(complete?'const Schema=z.object({n:z.number()}); $(()=>{registerMvuSchema(Schema);});':'unknownApi();')
  const trust=trustFor(entry),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return content}})
  await manager.sync([source(code)]);await manager.acquire(owner)
  assert.deepEqual(calls,[schemaUrl]);assert.equal(manager.inspect(owner).status,complete?'ready':'failed')
  assert.equal(trust.inspect(owner,schemaUrl)?.builtin,complete?true:undefined)
 }
})

test('adapter preferences persist as owner-scoped choices without approval or write capabilities',()=>{
 const directory=mkdtempSync(join(tmpdir(),'adapter-prefs-'))
 try{
  const preferences=updateRenderingAdapter(undefined,owner,url,'original'),store=new ConversationSettingsStore(directory)
  store.set({textScale:1,actionScale:1,interactiveCards:false,renderingAdapters:preferences})
  const saved=new ConversationSettingsStore(directory).get();setClientConversationSettings(saved,{announce:false})
  assert.deepEqual(normalizeClientConversationSettings({...saved,textScale:1.25}).renderingAdapters,preferences)
  assert.equal(renderingTrust.adapterIntent(owner,url),'original');assert.equal(renderingTrust.adapterIntent('character:copy',url),undefined)
  assert.equal(renderingTrust.inspect(owner,url),null)
  for(const extra of [{approved:true},{digest:'fake'},{grant:{}}])assert.throws(()=>normalizeRenderingAdapters({...preferences,entries:[{...preferences.entries[0],...extra}]}),/Invalid/)
  for(const source of ['http://example.com/a.js','https://user:pass@example.com/a.js','https://example.com/a.js#hash'])assert.throws(()=>updateRenderingAdapter(undefined,owner,source,'builtin'),/Invalid/)
  assert.equal(updateRenderingAdapter(preferences,owner,url,undefined).entries.length,0)
 }finally{setClientConversationSettings({},{announce:false});rmSync(directory,{recursive:true,force:true})}
})
