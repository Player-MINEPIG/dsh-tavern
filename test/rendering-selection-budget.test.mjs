import test from 'node:test'
import assert from 'node:assert/strict'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
const root='https://example.com/root.js'
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {list:async()=>[...map].map(([owner,record])=>({owner,...structuredClone(record)})),get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const saved=read(key);if(saved.generation!==generation||!saved.pending)return false;map.set(key,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const source=owner=>({owner,key:'helper',preferenceKey:'helper:id:a',kind:'helper',content:`import '${root}';`,enabled:true})

test('stage and prepared install atomically preserve old records and reservations when inert data leaves insufficient space',async()=>{
 const budget=createRenderingCacheBudget(10),trust=createRenderingTrust({budget})
 await trust.install('character:A',[{url:root,content:'1234'}]);budget.reserve('opening-inert',3)
 const before=budget.snapshot()
 await assert.rejects(()=>trust.stage('character:A',root,'12345678'),/shared byte budget/)
 assert.equal(trust.read('character:A',root),'1234');assert.deepEqual(budget.snapshot(),before)
 await assert.rejects(()=>trust.install('character:A',[{url:root,content:'12345678'}]),/shared byte budget/)
 assert.equal(trust.read('character:A',root),'1234');assert.deepEqual(budget.snapshot(),before)
 trust.clear();assert.equal(budget.snapshot().total,3)
})

test('cold owner caches, active sources and inactive archives share one budget with inert data without double charging',async()=>{
 const store=memory(),first=createRenderingDependencies({store,trust:createRenderingTrust(),download:async()=> ' '.repeat(10)})
 await first.sync([source('preset:other')]);await first.acquire('preset:other');first.dispose()
 const budget=createRenderingCacheBudget(30),trust=createRenderingTrust({budget}),manager=createRenderingDependencies({store,trust,download:async()=> ' '.repeat(10)})
 budget.reserve('opening-inert',7)
 await manager.sync([source('character:A')]);assert.equal(budget.snapshot().total,17)
 await manager.acquire('character:A');assert.equal(budget.snapshot().total,27)
 assert.deepEqual(new Map(budget.snapshot().entries).get('executable'),10)
 trust.setEnablement({entries:[{owner:'character:A',key:'helper:id:a',enabled:false}]})
 await manager.sync([source('character:A')]);assert.equal(budget.snapshot().total,27);assert.equal(new Map(budget.snapshot().entries).get('executable'),undefined)
 await manager.acquire('character:A');assert.equal(manager.inspect('character:A').retained.length,1);assert.equal(budget.snapshot().total,27)
 await manager.uninstall('character:A');assert.equal(budget.snapshot().total,17);assert.ok((await store.get('preset:other')).graph)
 manager.dispose();assert.equal(budget.snapshot().total,7)
})

test('cold inactive cache plus inert data can block a new graph before publication, without deleting another owner',async()=>{
 const store=memory(),first=createRenderingDependencies({store,trust:createRenderingTrust(),download:async()=> ' '.repeat(10)})
 await first.sync([source('preset:other')]);await first.acquire('preset:other');first.dispose()
 const budget=createRenderingCacheBudget(24),trust=createRenderingTrust({budget}),manager=createRenderingDependencies({store,trust,download:async()=> ' '.repeat(10)})
 budget.reserve('opening-inert',7);await manager.sync([source('character:A')]);await manager.acquire('character:A')
 assert.equal(manager.inspect('character:A').status,'failed');assert.match(manager.inspect('character:A').error,/shared byte budget/)
 assert.equal((await store.get('character:A')).graph,undefined);assert.ok((await store.get('preset:other')).graph)
 assert.equal(trust.inspect('character:A',root),null);assert.equal(budget.snapshot().total,17)
 manager.dispose()
})
