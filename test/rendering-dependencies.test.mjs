import test from 'node:test'
import assert from 'node:assert/strict'
import {createRenderingDependencies,DEPENDENCY_LIMITS,dependencyProgress} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
const url='https://example.com/root.js',child='https://example.com/child.js'
const source=(owner='character:A',content=`import '${url}'`)=>({owner,key:owner+':helper',content,enabled:true})
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const current=read(key);if(current.generation!==generation||!current.pending)return false;map.set(key,{generation,graph:structuredClone(graph),pending:false});return true}}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}

test('waiting, loading, uninstall and source replacement retain unique static root counts without fetching',async()=>{
 const store=memory(),calls=[]
 const manager=createRenderingDependencies({store,trust:createRenderingTrust(),download:async url=>{calls.push(url);return ''}})
 const code=`import '${url}#one'; import '${url}#two'; export * from '${child}'; import('${child}');`
 const hydration=manager.sync([source('character:A',code),source('character:A',code)])
 assert.equal(dependencyProgress(manager.inspect('character:A')).discovered,2)
 await hydration;assert.equal(manager.inspect('character:A').status,'waiting');assert.equal(calls.length,0)
 assert.deepEqual(dependencyProgress(manager.inspect('character:A')),{ready:0,failed:0,discovered:2,omitted:0,complete:false,capped:false})
 await manager.acquire('character:A');await manager.uninstall('character:A')
 assert.equal(dependencyProgress(manager.inspect('character:A')).discovered,2);assert.equal(dependencyProgress(manager.inspect('character:A')).ready,0)
 const restored=createRenderingDependencies({store,trust:createRenderingTrust()});await restored.sync([source('character:A',code)])
 assert.equal(dependencyProgress(restored.inspect('character:A')).discovered,2)
 await manager.sync([source('character:A',`import '${child}?v=1'; import '${child}?v=2'`)])
 assert.equal(dependencyProgress(manager.inspect('character:A')).discovered,2,'meaningful query identities remain distinct')
})

test('more than 24 relative modules converge with fanout, shared URLs and cycles, then restore and redownload',async()=>{
 const owner='character:A',files=89,store=memory(),calls=[],trust=createRenderingTrust()
 let revision=1
 const manager=createRenderingDependencies({store,trust,download:async key=>{
  calls.push(key)
  if(key===url)return Array.from({length:files},(_,i)=>`export * from './part-${i}.js';`).join('\n')
  return `import './root.js'; import './part-0.js'; export const version=${revision};`
 }})
 await manager.sync([source()]);await manager.acquire(owner)
 const graph=manager.inspect(owner);assert.equal(graph.status,'ready');assert.equal(graph.complete,true);assert.equal(graph.discovered,files+1)
 assert.equal(calls.length,files+1);assert.equal(new Set(calls).size,calls.length)
 const restored=createRenderingDependencies({store,trust:createRenderingTrust(),download:()=>{throw Error('No restore fetch')}})
 await restored.sync([source()]);assert.equal(restored.inspect(owner).complete,true);assert.equal(restored.inspect(owner).items.length,files+1)
 revision=2;await manager.acquire(owner);assert.match(trust.read(owner,'https://example.com/part-5.js'),/version=2/)
 assert.equal(DEPENDENCY_LIMITS.count,128)
})

test('a genuine file-budget overflow preserves discovered/omitted counts and cannot report complete x/x',async()=>{
 const calls=[],store=memory(),limits={...DEPENDENCY_LIMITS,count:3}
 const manager=createRenderingDependencies({store,limits,trust:createRenderingTrust(),download:async key=>{calls.push(key);return key===url?Array.from({length:5},(_,i)=>`import './${i}.js';`).join('\n'):''}})
 await manager.sync([source()]);await manager.acquire('character:A')
 const progress=dependencyProgress(manager.inspect('character:A'))
 assert.deepEqual(progress,{ready:3,failed:0,discovered:6,omitted:3,complete:false,capped:false});assert.equal(calls.length,3)
 assert.match(manager.inspect('character:A').error,/6 discovered; graph incomplete/)
 const restored=createRenderingDependencies({store,limits,trust:createRenderingTrust()});await restored.sync([source()])
 assert.deepEqual(dependencyProgress(restored.inspect('character:A')),progress)
})

test('discovery metadata is bounded and labels larger known graphs as lower bounds',async()=>{
 const references=Array.from({length:4100},(_,i)=>`import './${i}.js';`).join('\n')
 const manager=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),limits:{...DEPENDENCY_LIMITS,count:1},download:async()=>references})
 await manager.sync([source()]);await manager.acquire('character:A')
 assert.deepEqual(dependencyProgress(manager.inspect('character:A')),{ready:1,failed:0,discovered:4096,omitted:4095,complete:false,capped:true})
})

test('over-limit persisted progress cannot falsely claim a complete graph',async()=>{
 const store=memory(),manager=createRenderingDependencies({store,trust:createRenderingTrust(),download:async()=>''})
 await manager.sync([source()]);await manager.acquire('character:A')
 const saved=await store.get('character:A'),generation=await store.begin('character:A')
 await store.publish('character:A',generation,{...saved.graph,discovered:2,omitted:1,complete:true})
 const trust=createRenderingTrust(),restored=createRenderingDependencies({store,trust});await restored.sync([source()])
 assert.equal(restored.inspect('character:A').status,'failed');assert.match(restored.inspect('character:A').error,/Invalid dependency cache progress/)
 assert.throws(()=>trust.read('character:A',url),/not downloaded/)
})

test('unresolved diagnostics do not consume the unique file download budget',async()=>{
 const calls=[],manager=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),limits:{...DEPENDENCY_LIMITS,count:2},download:async key=>{calls.push(key);return ''}})
 await manager.sync([source('character:A',`import(variable); import(variable); import '${url}'; import '${child}';`)])
 await manager.acquire('character:A')
 assert.equal(calls.length,2);assert.equal(manager.inspect('character:A').omitted,0)
 assert.deepEqual(dependencyProgress(manager.inspect('character:A')),{ready:2,failed:1,discovered:3,omitted:0,complete:false,capped:false})
})

test('the depth budget accepts root zero through eight and never fetches depth nine',async()=>{
 for(const overflow of [false,true]){
  const calls=[],manager=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),download:async key=>{
   const depth=Number(new URL(key).pathname.match(/depth-(\d+)/)[1]);calls.push(depth)
   return depth<8||overflow?`import './depth-${depth+1}.js';`:''
  }})
  await manager.sync([source('character:A',"import 'https://example.com/depth-0.js';")]);await manager.acquire('character:A')
  assert.deepEqual(calls,[0,1,2,3,4,5,6,7,8])
  assert.equal(manager.inspect('character:A').status,overflow?'failed':'ready')
  if(overflow)assert.match(manager.inspect('character:A').items.at(-1).error,/depth exceeds/)
 }
})

test('network and computed imports leave final totals unknown; legacy truncated caches are lower bounds',async()=>{
 for(const content of ["import('./missing.js')",'import(variable)']){
  const manager=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),download:async key=>{if(key!==url)throw Error('network');return content}})
  await manager.sync([source()]);await manager.acquire('character:A');assert.equal(dependencyProgress(manager.inspect('character:A')).complete,false)
 }
 const store=memory(),manager=createRenderingDependencies({store,trust:createRenderingTrust(),download:async()=>''})
 await manager.sync([source()]);await manager.acquire('character:A')
 const saved=await store.get('character:A'),generation=await store.begin('character:A')
 const legacy={...saved.graph,status:'failed',error:'Dependency graph exceeds 24 files'}
 for(const key of ['discovered','discoveryCapped','omitted','complete'])delete legacy[key]
 await store.publish('character:A',generation,legacy)
 const restored=createRenderingDependencies({store,trust:createRenderingTrust()});await restored.sync([source()])
 assert.deepEqual(dependencyProgress(restored.inspect('character:A')),{ready:1,failed:0,discovered:2,omitted:1,complete:false,capped:true})
})

test('one acquisition converges cyclic graph, deduplicates shared children and restores without network',async()=>{
 const store=memory(),trust=createRenderingTrust(),calls=[]
 const manager=createRenderingDependencies({store,trust,download:async url=>{calls.push(url);return url===child?`export * from '${url.replace('child','root')}'`:`import '${child}'; export * from '${child}';`}})
 await manager.sync([source()]);assert.equal(calls.length,0);assert.equal(manager.inspect('character:A').status,'waiting')
 await manager.acquire('character:A');assert.deepEqual(calls,[url,child]);assert.equal(manager.inspect('character:A').status,'ready')
 assert.match(trust.read('character:A',url),/import/);assert.throws(()=>trust.read('character:B',url),/not downloaded/)
 const restoredTrust=createRenderingTrust(),restored=createRenderingDependencies({store,trust:restoredTrust,download:()=>{throw Error('unexpected network')}})
 await restored.sync([source()]);assert.equal(restored.inspect('character:A').status,'ready');assert.equal(restoredTrust.read('character:A',url),trust.read('character:A',url))
 await restored.uninstall('character:A');assert.throws(()=>restoredTrust.read('character:A',url),/not downloaded/)
 const next=createRenderingDependencies({store,trust:createRenderingTrust()});await next.sync([source()]);assert.equal(next.inspect('character:A').status,'waiting')
})

test('resource change invalidates downloaded graph and requires one explicit updated acquisition',async()=>{
 const trust=createRenderingTrust(),manager=createRenderingDependencies({store:memory(),trust,download:async()=>''})
 await manager.sync([source()]);await manager.acquire('character:A')
 await manager.sync([source('character:A',`import '${child}'`)]);assert.equal(manager.inspect('character:A').status,'changed');assert.throws(()=>trust.read('character:A',url),/not downloaded/)
 await manager.acquire('character:A');assert.equal(trust.read('character:A',child),'')
})

test('uninstall and source replacement suppress late downloads, persist no obsolete graph',async()=>{
 for(const action of ['uninstall','change']){
  const wait=deferred(),entered=deferred(),store=memory(),trust=createRenderingTrust(),manager=createRenderingDependencies({store,trust,download:async()=>{entered.resolve();return wait.promise}})
  await manager.sync([source()]);const pending=manager.acquire('character:A');await entered.promise
  if(action==='uninstall')await manager.uninstall('character:A');else await manager.sync([source('character:A',`import '${child}'`)])
  wait.resolve('export const obsolete=1');await pending
  assert.throws(()=>trust.read('character:A',url),/not downloaded/);assert.equal((await store.get('character:A')).graph,undefined)
 }
})

test('count, depth, bytes, blocked URL and individual network failures remain explicit and bounded',async()=>{
 for(const kind of ['count','depth','bytes','blocked','network']){
  let calls=0
  const manager=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),limits:{count:2,depth:1,bytes:1000},download:async u=>{calls++;if(kind==='network')throw Error('CORS unavailable');if(kind==='bytes')return ' '.repeat(1001);return `import '${u}x';`}})
  await manager.sync([source('character:A',kind==='blocked'?"import 'http://localhost/foo'":`import '${url}'`)])
  await manager.acquire('character:A');const graph=manager.inspect('character:A')
  assert.equal(graph.status,'failed',kind);assert.ok(graph.error||graph.items.some(item=>item.error),kind);assert.ok(graph.items.length<=2);assert.ok(calls<=2)
 }
})

test('parallel owners cannot cancel or inherit one another, and redownload replaces exact bytes',async()=>{
 let revision=1
 const trust=createRenderingTrust(),manager=createRenderingDependencies({store:memory(),trust,download:async()=>`export const version=${revision}`})
 await manager.sync([source(),source('preset:B')]);await Promise.all([manager.acquire('character:A'),manager.acquire('preset:B')])
 assert.equal(manager.inspect('character:A').status,'ready');assert.equal(manager.inspect('preset:B').status,'ready')
 revision=2;await manager.acquire('character:A');assert.match(trust.read('character:A',url),/2$/);assert.match(trust.read('preset:B',url),/1$/)
 await manager.uninstall('character:A');assert.match(trust.read('preset:B',url),/1$/)
})

test('import asks once with selected roots; decline never fetches',async()=>{
 const {offerRenderingDependencies}=await import('../packages/client/src/play/rendering-dependencies.js')
 for(const accepted of [false,true]){
  let prompts=0,calls=0
  const dependencies=createRenderingDependencies({store:memory(),trust:createRenderingTrust(),download:async()=>{calls++;return ''}})
  const resource={data:{extensions:{tavern_helper:{scripts:[{enabled:false,content:`import '${url}'`},{content:`import '${url}'`}]}}}}
  await offerRenderingDependencies(resource,'character','A',{dependencies,message:roots=>'Download graph:\n'+roots,confirm:text=>{prompts++;assert.match(text,/https:\/\/example.com\/root.js/);assert.equal(text.split(url).length,2);return accepted}})
  if(accepted)for(let i=0;i<30&&dependencies.inspect('character:A').status!=='ready';i++)await new Promise(resolve=>setTimeout(resolve,1))
  assert.equal(prompts,1);assert.equal(calls,accepted?1:0)
 }
})

test('empty resource source set invalidates old graph; aborted hydration cannot resurrect it',async()=>{
 const store=memory(),trust=createRenderingTrust(),manager=createRenderingDependencies({store,trust,download:async()=>''})
 await manager.sync([source()]);await manager.acquire('character:A')
 await manager.sync([],['character:A']);assert.throws(()=>trust.read('character:A',url),/not downloaded/)
 const wait=deferred(),readStarted=deferred()
 const delayed=createRenderingDependencies({store:{...store,get:async owner=>{readStarted.resolve();await wait.promise;return store.get(owner)}},trust,download:async()=>''})
 const pending=delayed.sync([source()]);await readStarted.promise;await delayed.uninstall('character:A');wait.resolve();await pending
 assert.throws(()=>trust.read('character:A',url),/not downloaded/)
})

test('another tab invalidates running bindings when uninstalling a shared persisted graph',async()=>{
 const channels=new Set(),store=memory()
 const channelFactory=()=>{const channel={postMessage(data){for(const other of channels)if(other!==channel)other.onmessage?.({data})},close(){channels.delete(channel)}};channels.add(channel);return channel}
 const trustA=createRenderingTrust(),trustB=createRenderingTrust()
 const a=createRenderingDependencies({store,trust:trustA,download:async()=>'',channelFactory}),b=createRenderingDependencies({store,trust:trustB,download:async()=>'',channelFactory})
 await a.sync([source()]);await a.acquire('character:A');await b.sync([source()]);assert.equal(trustB.read('character:A',url),'')
 await a.uninstall('character:A');await new Promise(resolve=>setTimeout(resolve,5));assert.throws(()=>trustB.read('character:A',url),/not downloaded/);assert.equal(b.inspect('character:A').status,'waiting')
 a.dispose();b.dispose()
})

test('redownload removes old persisted graph before network and refresh cannot restore it mid-flight',async()=>{
 const store=memory(),trust=createRenderingTrust(),wait=deferred(),entered=deferred();let slow=false
 const manager=createRenderingDependencies({store,trust,download:async()=>{if(slow){entered.resolve();return wait.promise};return 'export const v=1'}})
 await manager.sync([source()]);await manager.acquire('character:A');slow=true
 const pending=manager.acquire('character:A');await entered.promise
 const restored=createRenderingDependencies({store,trust:createRenderingTrust()});await restored.sync([source()]);assert.equal(restored.inspect('character:A').status,'remote')
 wait.resolve('export const v=2');await pending;assert.match(trust.read('character:A',url),/2$/)
})

function queuedBus(){
 const channels=[],queued=[]
 return {queued,channelFactory(){const channel={postMessage(data){for(const other of channels)if(other!==channel)queued.push({to:other,data:structuredClone(data)})},close(){}};channels.push(channel);return channel},deliver(){for(const {to,data} of queued.splice(0))to.onmessage?.({data})}}
}

test('review R1: simultaneous acquisitions with queued notifications elect a storage winner and settle both tabs',async()=>{
 const store=memory(),bus=queuedBus(),aDone=deferred(),bDone=deferred(),aEntered=deferred(),bEntered=deferred()
 const trustA=createRenderingTrust(),trustB=createRenderingTrust()
 const a=createRenderingDependencies({store,trust:trustA,channelFactory:()=>bus.channelFactory(),download:async()=>{aEntered.resolve();return aDone.promise}})
 const b=createRenderingDependencies({store,trust:trustB,channelFactory:()=>bus.channelFactory(),download:async()=>{bEntered.resolve();return bDone.promise}})
 await a.sync([source()]);await b.sync([source()]);const ap=a.acquire('character:A'),bp=b.acquire('character:A')
 await Promise.all([aEntered.promise,bEntered.promise]);assert.equal(bus.queued.length,2)
 bus.deliver();aDone.resolve('export const winner=1');bDone.resolve('export const winner=2');await Promise.all([ap,bp])
 for(let i=0;i<4;i++){bus.deliver();await new Promise(resolve=>setTimeout(resolve,1))}
 assert.deepEqual([a.inspect('character:A').status,b.inspect('character:A').status],['ready','ready'])
 assert.equal(trustA.read('character:A',url),'export const winner=2');assert.equal(trustB.read('character:A',url),'export const winner=2');assert.equal(bus.queued.length,0)
 a.dispose();b.dispose()
})

test('review R2: completed uninstall rejects older publication even with all uninstall messages held',async()=>{
 const store=memory(),bus=queuedBus(),done=deferred(),entered=deferred(),trustA=createRenderingTrust(),trustB=createRenderingTrust()
 const a=createRenderingDependencies({store,trust:trustA,channelFactory:()=>bus.channelFactory(),download:async()=>{entered.resolve();return done.promise}})
 const b=createRenderingDependencies({store,trust:trustB,channelFactory:()=>bus.channelFactory(),download:()=>{throw Error('must not download')}})
 await a.sync([source()]);await b.sync([source()]);const ap=a.acquire('character:A');await entered.promise
 bus.deliver();await new Promise(resolve=>setTimeout(resolve,1));await b.uninstall('character:A')
 assert.equal((await store.get('character:A')).graph,undefined)
 done.resolve('export const obsolete=1');await ap
 assert.equal((await store.get('character:A')).graph,undefined,'a completed uninstall cannot be undone before notification delivery')
 for(let i=0;i<4;i++){bus.deliver();await new Promise(resolve=>setTimeout(resolve,1))}
 const third=createRenderingDependencies({store,trust:createRenderingTrust(),channelFactory:()=>null});await third.sync([source()])
 assert.deepEqual([a.inspect('character:A').status,b.inspect('character:A').status,third.inspect('character:A').status],['waiting','waiting','waiting'])
 assert.throws(()=>trustA.read('character:A',url),/not downloaded/);assert.throws(()=>trustB.read('character:A',url),/not downloaded/)
 a.dispose();b.dispose();third.dispose()
})

test('review R3: captured hydration snapshot cannot restore after uninstall, with delivered or absent notifications',async()=>{
 for(const notify of [true,false]){
  const store=memory(),bus=queuedBus(),trustA=createRenderingTrust(),trustB=createRenderingTrust(),captured=deferred(),release=deferred()
  const channelFactory=()=>notify?bus.channelFactory():null
  const a=createRenderingDependencies({store,trust:trustA,channelFactory,download:async()=> 'export const syntheticOnly=1'})
  await a.sync([source()]);await a.acquire('character:A')
  let delayed=true,obsoleteInstalls=0
  trustB.subscribe(()=>{if(trustB.inspect('character:A',url)?.approved)obsoleteInstalls++})
  const delayedStore={...store,get:async key=>{const snapshot=await store.get(key);if(delayed){delayed=false;captured.resolve();await release.promise};return snapshot}}
  const b=createRenderingDependencies({store:delayedStore,trust:trustB,channelFactory,download:()=>{throw Error('No download allowed')}})
  const pending=b.sync([source()]);await captured.promise;assert.equal(b.inspect('character:A').status,'loading')
  await a.uninstall('character:A');assert.equal((await store.get('character:A')).generation,2);assert.equal((await store.get('character:A')).graph,undefined)
  bus.deliver();assert.equal(bus.queued.length,0);release.resolve();await pending
  assert.equal(b.inspect('character:A').status,'waiting');assert.equal(b.inspect('character:A').cacheGeneration,2)
  assert.throws(()=>trustB.read('character:A',url),/not downloaded/);assert.equal(obsoleteInstalls,0,'no transient obsolete executable cache publication')
  a.dispose();b.dispose()
 }
})

test('hydration checks storage generation after asynchronous source preparation without any notifications',async()=>{
 const store=memory(),a=createRenderingDependencies({store,trust:createRenderingTrust(),channelFactory:()=>null,download:async()=> 'export const syntheticOnly=1'})
 await a.sync([source()]);await a.acquire('character:A')
 const captured=deferred(),release=deferred(),trust=createRenderingTrust();let obsoleteInstalls=0
 trust.subscribe(()=>{if(trust.inspect('character:A',url)?.approved)obsoleteInstalls++})
 const delayedTrust={...trust,prepare:async(...args)=>{const commit=await trust.prepare(...args);captured.resolve();await release.promise;return commit}}
 const b=createRenderingDependencies({store,trust:delayedTrust,channelFactory:()=>null})
 const pending=b.sync([source()]);await captured.promise;await a.uninstall('character:A');release.resolve();await pending
 assert.equal(b.inspect('character:A').status,'waiting');assert.equal(b.inspect('character:A').cacheGeneration,2)
 assert.equal(obsoleteInstalls,0);assert.throws(()=>trust.read('character:A',url),/not downloaded/)
 a.dispose();b.dispose()
})

test('delayed pending snapshot observes publication in the same generation without notifications',async()=>{
 const store=memory(),entered=deferred(),download=deferred(),captured=deferred(),release=deferred()
 const a=createRenderingDependencies({store,trust:createRenderingTrust(),channelFactory:()=>null,download:async()=>{entered.resolve();return download.promise}})
 await a.sync([source()]);const acquisition=a.acquire('character:A');await entered.promise
 let delayed=true;const trust=createRenderingTrust()
 const b=createRenderingDependencies({store:{...store,get:async key=>{const snapshot=await store.get(key);if(delayed){delayed=false;captured.resolve();await release.promise};return snapshot}},trust,channelFactory:()=>null})
 const hydration=b.sync([source()]);await captured.promise;download.resolve('export const current=1');await acquisition;release.resolve();await hydration
 assert.equal(b.inspect('character:A').status,'ready');assert.equal(b.inspect('character:A').cacheGeneration,1);assert.equal(trust.read('character:A',url),'export const current=1')
 a.dispose();b.dispose()
})
