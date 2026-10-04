import {createRenderingDependencies} from '../../packages/client/src/play/rendering-dependencies.js'
import {dependencyStore} from '../../packages/client/src/play/rendering-dependency-store.js'
import {createRenderingTrust} from '../../packages/client/src/play/rendering-trust.js'
import {createRenderingCacheBudget} from '../../packages/client/src/play/rendering-cache-budget.js'

;(async()=>{
const results=[],url='https://example.com/shared.js',A='character:authored-A',B='character:authored-B',C='character:authored-C'
const source=owner=>({owner,key:'helper',kind:'helper',enabled:true,content:`import '${url}';`})
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
const scope=key=>({open:(name,version)=>indexedDB.open(name+'-shared-fixture-'+key,version)})
const open=(key,version=2)=>new Promise((resolve,reject)=>{const request=indexedDB.open('dtv-rendering-dependencies-shared-fixture-'+key,version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>request.result.createObjectStore('graphs')})
const raw=async key=>{
  const db=await open(key),transaction=db.transaction(['graphs','sources'],'readonly'),report={}
  for(const name of ['graphs','sources']){const request=transaction.objectStore(name).getAll();request.onsuccess=()=>{report[name]=request.result}}
  await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});db.close();return report
}
const create=(key,download,budget=createRenderingCacheBudget())=>{
  const store=dependencyStore(scope(key)),trust=createRenderingTrust({budget}),manager=createRenderingDependencies({store,trust,download,channelFactory:()=>null})
  return {store,trust,manager,budget}
}
const defer=()=>{let resolve;const promise=new Promise(value=>{resolve=value});return {promise,resolve}}
globalThis.fetch=()=>Promise.reject(Error('No external network is permitted in this authored fixture'))
try{
  let calls=0;const one='export const version=1;',two='export const version=2;',bytes=new TextEncoder().encode(one).length
  let f=create('reuse',async()=>{calls++;return one},createRenderingCacheBudget(bytes))
  await f.manager.sync([source(A),source(B)]);await f.manager.acquire(A)
  check('a cached public source gives another owner no execution record before its own acquisition',f.trust.inspect(B,url)===null)
  await f.manager.acquire(B);let stored=await raw('reuse')
  check('two real IndexedDB owner graphs share one physical source and one network request',calls===1&&stored.sources.length===1&&stored.sources[0].references===2&&stored.graphs.every(row=>row.graph.items[0].content===undefined),{calls,physicalSources:stored.sources.length,references:stored.sources[0].references})
  check('two installed owners charge the exact source bytes once',f.budget.snapshot().total===bytes)
  f.manager.dispose();f=create('reuse',async()=>{throw Error('Unexpected cold network')},createRenderingCacheBudget(bytes))
  await f.manager.sync([source(C)]);await f.manager.acquire(C);stored=await raw('reuse')
  check('cold new-owner acquisition reuses persisted bytes without installing unrelated owners',f.trust.inspect(A,url)===null&&f.trust.read(C,url)===one&&stored.sources[0].references===3&&f.budget.snapshot().total===bytes)
  await f.manager.uninstall(A);await f.manager.uninstall(B);stored=await raw('reuse')
  check('uninstalling two cards preserves the third card physical bytes',stored.sources.length===1&&stored.sources[0].references===1&&f.trust.read(C,url)===one)
  await f.manager.uninstall(C);stored=await raw('reuse')
  check('last owner uninstall releases physical bytes and leaves source-free tombstones',stored.sources.length===0&&stored.graphs.every(row=>!row.graph)&&f.budget.snapshot().total===0);f.manager.dispose()

  calls=0;let current=one;f=create('versions',async()=>{calls++;return current},createRenderingCacheBudget(bytes*2))
  await f.manager.sync([source(A),source(B),source(C)]);await f.manager.acquire(A);await f.manager.acquire(B)
  current=two;await f.manager.acquire(A,{refresh:true});await f.manager.acquire(C);stored=await raw('versions')
  check('explicit refresh keeps another owner version and new owners reuse the latest downloaded version',calls===2&&f.trust.read(A,url)===two&&f.trust.read(B,url)===one&&f.trust.read(C,url)===two&&stored.sources.length===2&&f.budget.snapshot().total===bytes*2,{calls,physicalSources:stored.sources.length})
  await f.manager.uninstall(B);stored=await raw('versions')
  check('unreferenced old version is collected while shared refreshed version remains',stored.sources.length===1&&stored.sources[0].references===2&&f.budget.snapshot().total===bytes)
  await f.manager.uninstall(A);await f.manager.uninstall(C);f.manager.dispose()

  const legacy=await open('legacy',1),transaction=legacy.transaction('graphs','readwrite')
  for(const owner of [A,B])transaction.objectStore('graphs').put({generation:1,pending:false,graph:{fingerprint:'authored-old-owner',status:'ready',items:[{key:url,url,status:'ready',content:one,depth:0}],retained:[]}},owner)
  await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});legacy.close()
  f=create('legacy',async()=>{throw Error('Unexpected legacy network')},createRenderingCacheBudget(bytes))
  await f.manager.sync([source(C)]);await f.manager.acquire(C);stored=await raw('legacy')
  check('v1 duplicated owner sources migrate to one physical v2 source without network or approval inheritance',stored.sources.length===1&&stored.sources[0].references===3&&stored.graphs.every(row=>row.graph.items[0].content===undefined)&&f.trust.inspect(A,url)===null&&f.trust.read(C,url)===one&&f.budget.snapshot().total===bytes)
  f.manager.dispose()

  const oldConnection=await open('blocked',1),oldWrite=oldConnection.transaction('graphs','readwrite')
  oldWrite.objectStore('graphs').put({generation:1,pending:false,graph:{fingerprint:'authored-old-owner',status:'ready',items:[{key:url,url,status:'ready',content:one,depth:0}],retained:[]}},A)
  await new Promise(resolve=>oldWrite.oncomplete=resolve)
  f=create('blocked',async()=>{throw Error('Unexpected blocked-cache network')},createRenderingCacheBudget(bytes))
  await f.manager.sync([source(B)])
  check('an old tab blocking the cache upgrade reports failure and grants no owner record',f.manager.inspect(B).status==='failed'&&f.manager.inspect(B).error.includes('reload other Tavern tabs')&&f.trust.inspect(B,url)===null)
  oldConnection.close();await f.manager.acquire(B);stored=await raw('blocked')
  check('explicit retry after closing the old tab migrates and reuses preserved source bytes',f.manager.inspect(B).status==='ready'&&stored.sources.length===1&&stored.sources[0].references===2&&f.budget.snapshot().total===bytes)
  f.manager.dispose()

  f=create('tamper',async()=>one);await f.manager.sync([source(A)]);await f.manager.acquire(A)
  const badDb=await open('tamper'),badWrite=badDb.transaction('sources','readwrite'),cursor=badWrite.objectStore('sources').openCursor()
  cursor.onsuccess=()=>{const row=cursor.result;if(row)row.update({...row.value,content:one+'\n/* altered */'})}
  await new Promise(resolve=>badWrite.oncomplete=resolve);badDb.close()
  await f.manager.sync([source(B)]);await f.manager.acquire(B)
  check('cached bytes changed under a content digest cannot be borrowed or installed',f.manager.inspect(B).status==='failed'&&f.manager.inspect(B).items[0].error.includes('Shared dependency content changed')&&f.trust.inspect(B,url)===null)
  f.manager.dispose();f=create('tamper',async()=>{throw Error('Unexpected tamper recovery network')})
  await f.manager.sync([source(A)])
  check('cold restoration rehashes referenced bytes and refuses altered source content',f.manager.inspect(A).status==='failed'&&f.trust.inspect(A,url)===null)
  f.manager.dispose()

  const start1=defer(),start2=defer(),end1=defer(),end2=defer()
  const first=create('race',async()=>{start1.resolve();return end1.promise}),second=create('race',async()=>{start2.resolve();return end2.promise})
  await first.manager.sync([source(A)]);await second.manager.sync([source(A)])
  const p1=first.manager.acquire(A);await start1.promise;const p2=second.manager.acquire(A);await start2.promise
  end1.resolve(one);await p1;end2.resolve(two);await p2;stored=await raw('race')
  check('competing publications cannot leave an orphan source or overwrite the winning owner generation',stored.sources.length===1&&stored.sources[0].content===two&&stored.sources[0].references===1&&second.trust.read(A,url)===two)
  first.manager.dispose();second.manager.dispose()

  const started=defer(),finish=defer();let slow=false
  f=create('uninstall-race',async()=>{if(slow){started.resolve();return finish.promise}return one})
  await f.manager.sync([source(A),source(B)]);await f.manager.acquire(A);await f.manager.acquire(B);slow=true
  const stale=f.manager.acquire(A,{refresh:true});await started.promise
  const pending=await f.store.get(A)
  check('pending refresh preserves referenced bytes while revoking the owner execution record',pending.pending===true&&pending.graph.items[0].content===one&&f.trust.inspect(A,url)===null&&f.trust.read(B,url)===one)
  await dependencyStore(scope('uninstall-race')).remove(A);finish.resolve(two);await stale;stored=await raw('uninstall-race')
  check('completed uninstall rejects late refreshed publication and preserves another owner shared bytes',stored.sources.length===1&&stored.sources[0].content===one&&stored.sources[0].references===1&&f.trust.inspect(A,url)===null&&f.trust.read(B,url)===one)
  f.manager.dispose()
}catch(error){results.push({name:'Unexpected: '+error.stack,pass:false})}
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
