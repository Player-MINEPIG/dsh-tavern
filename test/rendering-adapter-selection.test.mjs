import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust,renderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {normalizeRenderingAdapters,updateRenderingAdapter} from '../packages/presentation/rendering-adapters.js'
import {ConversationSettingsStore} from '../packages/tavern-loader/src/conversation-settings.js'
import {normalizeClientConversationSettings,setClientConversationSettings} from '../packages/client/src/conversation-settings.js'
const owner='character:adapters',url='https://example.com/mvu.js',child='https://example.com/provider.js',content="import './provider.js'; export const synthetic=1;"
const descriptor=(source=url,kind='mvu-facade')=>({url:source,kind,version:1})
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const saved=read(key);if(saved.generation!==generation||!saved.pending)return false;map.set(key,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const trustFor=entry=>createRenderingTrust({candidates:[entry]})
const source=code=>({owner,key:'helper',kind:'helper',path:'scripts[0]',content:code,enabled:true})

test('local side-effect roots work offline, survive restart and ignore cached remote byte changes',async()=>{
 const entry=descriptor(),trust=trustFor(entry),store=memory(),calls=[]
 const manager=createRenderingDependencies({trust,store,download:async key=>{calls.push(key);return content}})
 const sources=[source(`import '${url}';`)];await manager.sync(sources);await manager.acquire(owner)
 assert.deepEqual(calls,[]);assert.equal(manager.inspect(owner).status,'ready');assert.equal(manager.inspect(owner).items[0].builtin,true)
 assert.equal(trust.inspect(owner,url).builtin,true);assert.equal(trust.inspect(owner,child),null)
 const restoredTrust=trustFor(entry),restored=createRenderingDependencies({trust:restoredTrust,store,download:()=>{throw Error('No restore network')}})
 await restored.sync(sources);assert.equal(restored.inspect(owner).status,'ready');assert.equal(restoredTrust.inspect(owner,url).builtin,true)
 const saved=await store.get(owner),generation=await store.begin(owner)
 await store.publish(owner,generation,{...saved.graph,items:saved.graph.items.map(item=>({...item,content:content+'// changed',builtin:true}))})
 const badTrust=trustFor(entry),bad=createRenderingDependencies({trust:badTrust,store});await bad.sync(sources)
 assert.equal(bad.inspect(owner).status,'ready');assert.equal(badTrust.inspect(owner,url).builtin,true);assert.equal(badTrust.inspect(owner,url).content,undefined)
})

test('unsupported local imports fail without fetching or falling back to original code',async()=>{
 for(const code of [`import {synthetic} from '${url}';`,`import('${url}');`]){
  const trust=trustFor(descriptor()),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return content+'// hash mismatch'}})
  await manager.sync([source(code)]);await manager.acquire(owner)
  assert.deepEqual(calls,[]);assert.equal(manager.inspect(owner).status,'failed');assert.equal(trust.inspect(owner,url),null)
  assert.ok(manager.inspect(owner).items[0].error);assert.equal(manager.inspect(owner).items[0].content,undefined)
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
 assert.deepEqual(calls,[late]);assert.equal(manager.inspect(owner).status,'failed');assert.equal(trust.inspect(owner,url),null)
})

test('schema replacement requires a complete helper accepted by the shared bounded schema interpreter',async()=>{
 const schemaUrl='https://example.com/mvu_zod.js',entry=descriptor(schemaUrl,'backend-schema')
 for(const complete of [true,false]){
  const code=`import {registerMvuSchema} from '${schemaUrl}';\n`+(complete?'const Schema=z.object({n:z.number()}); $(()=>{registerMvuSchema(Schema);});':'unknownApi();')
  const trust=trustFor(entry),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return content}})
  await manager.sync([source(code)]);await manager.acquire(owner)
  assert.deepEqual(calls,[]);assert.equal(manager.inspect(owner).status,complete?'ready':'failed')
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

test('unavailable upstream and arbitrary byte revisions cannot block local MVU, including after cache removal',async t=>{
 const actual='https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',store=memory(),trust=createRenderingTrust(),calls=[]
 const manager=createRenderingDependencies({trust,store,channelFactory:()=>null,download:async key=>{calls.push(key);throw Error('offline')}});t.after(()=>manager.dispose())
 const sources=[source(`import '${actual}';`)]
 await manager.sync(sources)
 assert.equal(manager.inspect(owner).status,'ready')
 assert.equal(trust.inspect(owner,actual).adapterVersion,1)
 assert.equal(trust.inspect(owner,actual).digest,undefined)
 await manager.acquire(owner,{refresh:true})
 assert.equal((await store.get(owner)).graph.items[0].content,undefined)
 await manager.uninstall(owner)
 assert.equal(manager.inspect(owner).status,'ready')
 assert.equal(trust.inspect(owner,actual).builtin,true)
 assert.deepEqual(calls,[])
})

test('a prior unsupported-byte failure becomes a local contract while original bytes remain inert and original choice remains explicit',async t=>{
 const entry=descriptor(),store=memory(),trust=trustFor(entry),calls=[]
 const manager=createRenderingDependencies({trust,store,channelFactory:()=>null,download:async key=>{calls.push(key);throw Error('offline')}});t.after(()=>manager.dispose())
 const sources=[source(`import '${url}';`)];await manager.sync(sources)
 const fingerprint=manager.inspect(owner).fingerprint,generation=await store.begin(owner)
 await store.publish(owner,generation,{fingerprint,status:'failed',items:[{url,key:url,status:'failed',depth:0,content:'UNREVIEWED NEW UPSTREAM BYTES',error:'Unsupported built-in adapter bytes'}],retained:[],discovered:1,discoveryCapped:false,omitted:0,complete:false})
 await manager.sync(sources)
 // A separate client exercises cold restoration rather than an in-memory shortcut.
 const coldTrust=trustFor(entry),cold=createRenderingDependencies({trust:coldTrust,store,channelFactory:()=>null,download:async()=>{throw Error('offline')}});t.after(()=>cold.dispose())
 await cold.sync(sources)
 assert.equal(cold.inspect(owner).status,'ready');assert.equal(coldTrust.inspect(owner,url).content,undefined)
 assert.equal(cold.inspect(owner).retained[0].content,'UNREVIEWED NEW UPSTREAM BYTES')
 await cold.acquire(owner)
 const saved=await store.get(owner)
 assert.equal(saved.graph.items[0].content,undefined)
 assert.equal(saved.graph.retained[0].content,'UNREVIEWED NEW UPSTREAM BYTES')
 coldTrust.setAdapterIntents(updateRenderingAdapter(undefined,owner,url,'original'))
 await cold.sync(sources)
 assert.equal(coldTrust.inspect(owner,url),null,'local metadata never becomes original-code approval')
 assert.equal(cold.inspect(owner).status,'changed')
 assert.deepEqual(calls,[])
})

test('switching an in-flight original download to local MVU cannot leave it blocked or publish late code',async t=>{
 const trust=trustFor(descriptor()),store=memory();let entered,release
 const started=new Promise(resolve=>{entered=resolve}),response=new Promise(resolve=>{release=resolve})
 trust.setAdapterIntents(updateRenderingAdapter(undefined,owner,url,'original'))
 const manager=createRenderingDependencies({trust,store,channelFactory:()=>null,download:async()=>{entered();return response}});t.after(()=>manager.dispose())
 const sources=[source(`import '${url}';`)];await manager.sync(sources)
 const pending=manager.acquire(owner);await started
 trust.setAdapterIntents(updateRenderingAdapter(undefined,owner,url,'builtin'));await manager.sync(sources)
 assert.equal(manager.inspect(owner).status,'ready');assert.equal(trust.inspect(owner,url).builtin,true)
 release('LATE ORIGINAL CODE');await pending
 assert.equal(manager.inspect(owner).status,'ready');assert.equal(trust.inspect(owner,url).content,undefined)
})
