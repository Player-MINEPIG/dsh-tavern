import test from 'node:test'
import assert from 'node:assert/strict'
import {createRenderingDependencies,dependencyProgress} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
const owner='character:selection',root='https://example.com/root.js',disabled='https://example.com/disabled.js',shared='https://example.com/shared.js'
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const saved=read(key);if(saved.generation!==generation||!saved.pending)return false;map.set(key,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const source=(key,content,enabled=true)=>({owner,key,preferenceKey:'helper:id:'+key,kind:'helper',path:key,name:key,content,enabled})

test('only enabled defaults and stable saved choices enter the owner download graph; origins explain shared roots',async()=>{
 const trust=createRenderingTrust(),calls=[],manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return key===root?`import '${shared}';`:''}})
 trust.setEnablement({entries:[{owner,key:'helper:id:saved-off',enabled:false},{owner,key:'helper:id:saved-on',enabled:true}]})
 const sources=[source('on',`import '${root}';`),source('default-off',`import '${disabled}';`,false),source('saved-off',`import '${disabled}';`),source('saved-on',`import '${root}';`,false)]
 await manager.sync(sources);assert.equal(dependencyProgress(manager.inspect(owner)).discovered,1)
 assert.deepEqual(manager.inspect(owner).items[0].origins,['on','saved-on'])
 await manager.acquire(owner);assert.deepEqual(calls,[root,shared]);assert.equal(manager.inspect(owner).status,'ready')
 assert.equal(manager.inspect(owner).excluded[0].url,disabled);assert.throws(()=>trust.read(owner,disabled),/not downloaded/)
})

test('changing URL and helper intentions invalidates bindings, preserves inactive bytes and leaves other owners alone',async()=>{
 const trust=createRenderingTrust(),store=memory(),calls=[],sources=[source('on',`import '${root}'; import '${disabled}';`)]
 const manager=createRenderingDependencies({trust,store,download:async key=>{calls.push(key);return key===root?`import '${shared}';`:''}})
 await manager.sync([...sources,{...sources[0],owner:'preset:other'}]);await manager.acquire(owner);await manager.acquire('preset:other')
 trust.setEnablement({entries:[{owner,key:disabled,enabled:false}]});await manager.sync(sources)
 assert.equal(manager.inspect(owner).status,'changed');assert.equal((await store.get(owner)).graph.items.length,3)
 assert.throws(()=>trust.read(owner,root),/not downloaded/);assert.equal(trust.read('preset:other',disabled),'')
 calls.length=0;await manager.acquire(owner);assert.deepEqual(calls,[root,shared]);assert.equal(manager.inspect(owner).retained[0].url,disabled)
 assert.equal((await store.get(owner)).graph.retained[0].url,disabled)
 trust.setEnablement({entries:[{owner,key:'helper:id:on',enabled:false}]});calls.length=0
 await manager.acquire(owner);assert.deepEqual(calls,[]);assert.equal(manager.inspect(owner).discovered,0)
 assert.equal(manager.inspect(owner).retained.length,3);assert.throws(()=>trust.read(owner,root),/not downloaded/)
 await manager.uninstall(owner);assert.equal((await store.get(owner)).graph,undefined);assert.equal(trust.read('preset:other',disabled),'')
})

test('a disabled transitive URL is omitted with its descendants, while a shared enabled path remains selected',async()=>{
 const trust=createRenderingTrust(),calls=[]
 trust.setEnablement({entries:[{owner,key:disabled,enabled:false}]})
 const manager=createRenderingDependencies({trust,store:memory(),download:async key=>{calls.push(key);return key===root?`import '${disabled}'; import '${shared}';`:key===disabled?"import './provider.js';":''}})
 await manager.sync([source('on',`import '${root}';`)]);await manager.acquire(owner)
 assert.deepEqual(calls,[root,shared]);assert.equal(manager.inspect(owner).discovered,2)
 assert.equal(manager.inspect(owner).excluded[0].url,disabled);assert.deepEqual(manager.inspect(owner).excluded[0].origins,['on'])
})
