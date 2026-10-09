import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
const url='https://example.com/shared.js',A='character:A',B='character:B',C='character:C'
const source=(owner,root=url)=>({owner,key:'helper',kind:'helper',enabled:true,content:`import '${root}';`})
function memory(){
  const records=new Map(),read=owner=>structuredClone(records.get(owner)??{generation:0})
  const advance=(owner,pending)=>{const generation=read(owner).generation+1;records.set(owner,{generation,pending});return generation}
  return {list:async()=>[...records].map(([owner,value])=>({owner,...structuredClone(value)})),get:async owner=>read(owner),begin:async owner=>advance(owner,true),remove:async owner=>advance(owner,false),readCurrent:async(owner,snapshot,accept)=>{const saved=read(owner);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},publish:async(owner,generation,graph)=>{const saved=read(owner);if(saved.generation!==generation||!saved.pending)return false;records.set(owner,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const managerFor=options=>createRenderingDependencies({channelFactory:()=>null,...options})
const defer=()=>{let resolve;const promise=new Promise(value=>{resolve=value});return {promise,resolve}}

test('new owners reuse exact source bytes but acquire their own graph and keep enablement independent',async()=>{
  const budget=createRenderingCacheBudget(6),trust=createRenderingTrust({budget}),calls=[]
  const manager=managerFor({trust,store:memory(),download:async key=>{calls.push(key);return '123456'}})
  await manager.sync([source(A),source(B)])
  await manager.acquire(A);assert.equal(trust.inspect(B,url),null)
  await manager.acquire(B);assert.deepEqual(calls,[url]);assert.equal(trust.read(B,url),'123456');assert.equal(budget.snapshot().total,6)
  trust.setEnablement({entries:[{owner:B,key:url,enabled:false}]})
  await manager.sync([source(B)]);await manager.acquire(B)
  assert.equal(trust.inspect(B,url),null);assert.equal(trust.read(A,url),'123456');assert.equal(budget.snapshot().total,6)
  await manager.uninstall(A);assert.equal(budget.snapshot().total,6)
  await manager.uninstall(B);assert.equal(budget.snapshot().total,0);manager.dispose()
})

test('cold persisted inventory supplies a new owner without fetching or installing the old owner',async()=>{
  const store=memory(),first=managerFor({store,trust:createRenderingTrust(),download:async()=> '123456'})
  await first.sync([source(A)]);await first.acquire(A);first.dispose()
  const budget=createRenderingCacheBudget(6),trust=createRenderingTrust({budget}),manager=managerFor({store,trust,download:async()=>{throw Error('Unexpected network')}})
  await manager.sync([source(B)]);assert.equal(trust.inspect(A,url),null);assert.equal(trust.inspect(B,url),null)
  await manager.acquire(B);assert.equal(trust.read(B,url),'123456');assert.equal(budget.snapshot().total,6)
  await manager.uninstall(A);assert.equal(trust.read(B,url),'123456');assert.equal(budget.snapshot().total,6);manager.dispose()
})

test('explicit refresh creates a new exact version without replacing another owner and charges both versions once',async()=>{
  let content='123456',requests=0
  const budget=createRenderingCacheBudget(12),trust=createRenderingTrust({budget}),manager=managerFor({store:memory(),trust,download:async()=>{requests++;return content}})
  await manager.sync([source(A),source(B),source(C)]);await manager.acquire(A);await manager.acquire(B)
  content='abcdef';await manager.acquire(A,{refresh:true})
  assert.equal(trust.read(A,url),'abcdef');assert.equal(trust.read(B,url),'123456');assert.equal(budget.snapshot().total,12)
  await manager.acquire(C);assert.equal(trust.read(C,url),'abcdef');assert.equal(requests,2);assert.equal(budget.snapshot().total,12)
  await manager.acquire(A,{refresh:true});assert.equal(requests,3);assert.equal(budget.snapshot().total,12)
  await manager.uninstall(A);assert.equal(trust.read(C,url),'abcdef');assert.equal(budget.snapshot().total,12)
  await manager.uninstall(C);assert.equal(budget.snapshot().total,6);assert.equal(trust.read(B,url),'123456')
  await manager.uninstall(B);assert.equal(budget.snapshot().total,0);manager.dispose()
})

test('different exact URLs do not alias merely because their decoded bytes match',async()=>{
  const other=url+'?version=2',calls=[],budget=createRenderingCacheBudget(6),trust=createRenderingTrust({budget})
  const manager=managerFor({store:memory(),trust,download:async key=>{calls.push(key);return '123'}})
  await manager.sync([source(A),source(B,other)]);await manager.acquire(A);await manager.acquire(B)
  assert.deepEqual(calls,[url,other]);assert.equal(budget.snapshot().total,6);manager.dispose()
})

test('sharing bytes never inherits another owner original-mode choice or bypasses builtin hash verification',async()=>{
  const descriptor={url,sha256:createHash('sha256').update('good').digest('hex'),kind:'mvu-facade',version:1}
  const trust=createRenderingTrust({candidates:[descriptor],builtin:(source,hash)=>source===url&&hash===descriptor.sha256?descriptor:null})
  trust.setAdapterIntents({schemaVersion:1,entries:[{owner:A,source:url,mode:'original'}]})
  let requests=0;const manager=managerFor({store:memory(),trust,download:async()=>{requests++;return 'changed'}})
  await manager.sync([source(A),source(B)]);await manager.acquire(A);await manager.acquire(B)
  assert.equal(requests,1);assert.equal(manager.inspect(A).status,'ready');assert.equal(manager.inspect(B).status,'failed')
  assert.match(manager.inspect(B).items[0].error,/Unsupported built-in adapter bytes/);assert.equal(trust.inspect(B,url),null)
  assert.equal(trust.read(A,url),'changed');manager.dispose()
})

test('concurrent owners coalesce a download and one uninstall cannot cancel the other owner lease',async()=>{
  const entered=defer(),complete=defer();let requests=0,networkSignal
  const trust=createRenderingTrust(),manager=managerFor({store:memory(),trust,download:async(key,{signal})=>{requests++;networkSignal=signal;entered.resolve();return complete.promise}})
  await manager.sync([source(A),source(B)])
  const first=manager.acquire(A),second=manager.acquire(B);await entered.promise;await new Promise(resolve=>setImmediate(resolve))
  await manager.uninstall(A);assert.equal(networkSignal.aborted,false);complete.resolve('123456');await Promise.all([first,second])
  assert.equal(requests,1);assert.equal(trust.inspect(A,url),null);assert.equal(trust.read(B,url),'123456');manager.dispose()
})

test('a cancelled sole download cannot publish bytes or lend late data to another owner',async()=>{
  const entered=defer(),complete=defer();let requests=0,networkSignal
  const trust=createRenderingTrust(),store=memory(),manager=managerFor({store,trust,download:async(key,{signal})=>{requests++;networkSignal=signal;if(requests===1){entered.resolve();return complete.promise}return 'fresh'}})
  await manager.sync([source(A),source(B)]);const first=manager.acquire(A);await entered.promise
  await manager.uninstall(A);complete.resolve('obsolete');await first;assert.equal(networkSignal.aborted,true)
  await manager.acquire(B);assert.equal(requests,2);assert.equal(trust.read(B,url),'fresh');assert.equal((await store.get(A)).graph,undefined);manager.dispose()
})

test('shared content references are rehashed before executable preparation',async()=>{
  const trust=createRenderingTrust(),digest=createHash('sha256').update('expected').digest('hex')
  await assert.rejects(()=>trust.install(A,[{url,content:'changed',contentDigest:digest}]),/Shared dependency content changed/)
  assert.equal(trust.inspect(A,url),null);assert.equal(trust.cacheBudget.snapshot().total,0)
})
