import test from 'node:test'
import assert from 'node:assert/strict'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
const url='https://example.com/root.js',source=owner=>({owner,key:'helper',content:`import '${url}';`})
function memory(){
 const records=new Map(),read=owner=>structuredClone(records.get(owner)??{generation:0})
 const advance=(owner,pending)=>{const generation=read(owner).generation+1;records.set(owner,{generation,pending});return generation}
 return {list:async()=>[...records].map(([owner,value])=>({owner,...structuredClone(value)})),get:async owner=>read(owner),begin:async owner=>advance(owner,true),remove:async owner=>advance(owner,false),readCurrent:async(owner,snapshot,accept)=>{const saved=read(owner);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},publish:async(owner,generation,graph)=>{const saved=read(owner);if(saved.generation!==generation||!saved.pending)return false;records.set(owner,{generation,graph:structuredClone(graph),pending:false});return true}}
}
async function fixture({sizes=[6],inert=4,limit=8}={}){
 const store=memory(),seed=createRenderingDependencies({store,trust:createRenderingTrust(),channelFactory:()=>null,download:async()=> 'x'.repeat(sizes.shift())})
 const owners=Array.from({length:sizes.length},(_,i)=>'preset:old'+i)
 for(const owner of owners){await seed.sync([{...source(owner),content:`import 'https://example.com/${owner.replace(':','-')}.js';`}]);await seed.acquire(owner)}
 seed.dispose()
 const budget=createRenderingCacheBudget(limit);budget.reserve('opening-inert',inert)
 const trust=createRenderingTrust({budget});let downloads=0
 const manager=createRenderingDependencies({store,trust,channelFactory:()=>null,download:async()=>{downloads++;return '12'}})
 return {store,budget,trust,manager,owners,downloads:()=>downloads}
}

test('failed whole-cache accounting blocks stage, prepare and acquisition across unchanged retries',async()=>{
 const f=await fixture();await f.manager.sync([source('character:new')])
 assert.equal(f.manager.inspect('character:new').status,'failed')
 for(let attempt=0;attempt<2;attempt++){
  await assert.rejects(()=>f.trust.stage('character:new',url,'12'),/shared byte budget/)
  await assert.rejects(()=>f.trust.install('character:new',[{url,content:'12'}]),/shared byte budget/)
  await assert.rejects(()=>f.manager.acquire('character:new'),/shared byte budget/)
 }
 assert.equal(f.downloads(),0);assert.equal(f.trust.inspect('character:new',url),null)
 assert.ok((await f.store.get(f.owners[0])).graph);assert.equal((await f.store.get('character:new')).graph,undefined)
 assert.equal(f.budget.snapshot().total,4);f.manager.dispose()
})

test('releasing inert bytes permits verified whole-cache retry, then old6 plus new2 counts exactly8',async()=>{
 const f=await fixture();await f.manager.sync([source('character:new')])
 f.budget.reserve('opening-inert',0)
 await f.manager.acquire('character:new')
 assert.equal(f.manager.inspect('character:new').status,'ready');assert.equal(f.trust.read('character:new',url),'12')
 assert.equal(f.budget.snapshot().total,8);assert.ok((await f.store.get(f.owners[0])).graph);f.manager.dispose()
})

test('explicit old-owner uninstall preserves a tombstone and allows new2 plus inert4 after reaccount',async()=>{
 const f=await fixture();await f.manager.sync([source('character:new')]);await f.manager.uninstall(f.owners[0]);await f.manager.acquire('character:new')
 assert.equal(f.manager.inspect('character:new').status,'ready');assert.equal(f.budget.snapshot().total,6)
 const removed=await f.store.get(f.owners[0]);assert.equal(removed.generation,2);assert.equal(removed.graph,undefined);f.manager.dispose()
})

test('a later oversized owner cannot leave an admitted prefix of the cold inventory',async()=>{
 const f=await fixture({sizes:[2,6]});await f.manager.sync([source('character:new')])
 assert.equal(f.manager.inspect('character:new').status,'failed');assert.equal(f.budget.snapshot().total,4)
 await assert.rejects(()=>f.trust.stage('character:new',url,'1'),/shared byte budget/)
 await assert.rejects(()=>f.manager.acquire('character:new'),/shared byte budget/)
 for(const owner of f.owners)assert.ok((await f.store.get(owner)).graph)
 assert.equal(f.downloads(),0);f.manager.dispose()
})

test('failed storage enumeration remains a precondition until a successful rescan',async()=>{
 const store=memory(),list=store.list;store.list=async()=>{throw Error('Synthetic inventory read failure')}
 const trust=createRenderingTrust(),manager=createRenderingDependencies({store,trust,channelFactory:()=>null,download:async()=> '12'})
 await manager.sync([source('character:new')]);await assert.rejects(()=>trust.stage('character:new',url,'12'),/inventory read failure/)
 await assert.rejects(()=>manager.acquire('character:new'),/inventory read failure/)
 store.list=list;await manager.acquire('character:new');assert.equal(trust.read('character:new',url),'12');manager.dispose()
})

test('disposed inventory cannot release a waiting stage into an unaccounted install',async()=>{
 const store=memory();let release
 store.list=()=>new Promise(resolve=>{release=resolve})
 const trust=createRenderingTrust(),manager=createRenderingDependencies({store,trust,channelFactory:()=>null})
 const pending=trust.stage('character:new',url,'12'),rejected=assert.rejects(pending,/disposed|cancelled/)
 await new Promise(resolve=>setImmediate(resolve));manager.dispose();release([]);await rejected
 assert.equal(trust.inspect('character:new',url),null);assert.equal(trust.cacheBudget.snapshot().total,0)
})

test('shared initializer failure survives settlement until the same key is explicitly retried successfully',async()=>{
 const budget=createRenderingCacheBudget(8),trust=createRenderingTrust({budget})
 budget.reserve('opening-inert',4);budget.trackInitialization('existing-opening-inert',Promise.reject(Error('Synthetic inert read failure')))
 await assert.rejects(()=>budget.ready(),/inert read failure/)
 await assert.rejects(()=>trust.stage('character:new',url,'12'),/inert read failure/)
 await assert.rejects(()=>trust.install('character:new',[{url,content:'12'}]),/inert read failure/)
 assert.equal(budget.snapshot().total,4)
 budget.trackInitialization('existing-opening-inert',Promise.reject(Error('Retry still unavailable')))
 await assert.rejects(()=>budget.ready(),/Retry still unavailable/)
 budget.trackInitialization('existing-opening-inert',Promise.resolve())
 await trust.install('character:new',[{url,content:'12'}]);assert.equal(budget.snapshot().total,6)
})

test('explicit uninstall supersedes a captured failed-inventory retry snapshot',async()=>{
 const f=await fixture();await f.manager.sync([source('character:new')])
 const captured=await f.store.list();let release
 f.store.list=()=>new Promise(resolve=>{release=()=>resolve(captured)})
 const retry=f.manager.sync([source('character:new')])
 await new Promise(resolve=>setImmediate(resolve));await f.manager.uninstall(f.owners[0])
 release();await retry;await f.manager.acquire('character:new')
 assert.equal(f.manager.inspect('character:new').status,'ready');assert.equal(f.budget.snapshot().total,6)
 assert.equal((await f.store.get(f.owners[0])).graph,undefined);assert.equal(f.trust.inspect(f.owners[0],url),null);f.manager.dispose()
})
