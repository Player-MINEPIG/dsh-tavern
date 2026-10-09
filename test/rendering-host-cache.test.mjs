import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,cpSync,readdirSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {createRenderingCache} from '../packages/rendering-cache/store.js'
import {createRenderingCacheHandler} from '../packages/rendering-cache/http.js'
import {secureTavernApi} from '../packages/tavern-loader/src/api-security.js'
import {hostDependencyStore,hostOpeningDataStore} from '../packages/client/src/play/host-rendering-cache.js'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
import {API_V1} from '../packages/identity.js'
const url='https://example.com/shared.js',A='character:A',B='character:B'
const graph=(content='export const version=1;',fingerprint='authored')=>({fingerprint,status:'ready',items:[{key:url,url,content,status:'ready',depth:0,downloadedAt:1}],retained:[]})
const publish=(store,owner,content)=>store.publish(owner,store.begin(owner),graph(content))
function fixture(t,options){const dir=mkdtempSync(join(tmpdir(),'tavern-host-cache-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:createRenderingCache(dir,options)}}
async function host(t,store,{admit=()=>({})}={}){
 const server=createServer(secureTavernApi(createRenderingCacheHandler(store,{getConnection:()=>({admit})})))
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)))
 const origin=`http://127.0.0.1:${server.address().port}`
 return {origin,request:(path,options={})=>fetch(origin+path,{...options,headers:{Origin:origin,...Object.fromEntries(new Headers(options.headers))}})}
}

test('Host stores one physical source across owners, preserves refresh versions and collects final references',t=>{
 const {dir,store}=fixture(t);publish(store,A,'one');publish(store,B,'one')
 const files=()=>readdirSync(join(dir,'rendering-cache/sources'))
 assert.equal(files().length,1);assert.equal(store.inventory().sources.length,1)
 const raw=JSON.parse(readFileSync(join(dir,'rendering-cache/index.json')));assert.equal(raw.graphs[0].graph.items[0].content,undefined)
 publish(store,A,'two');assert.equal(files().length,2);assert.equal(store.get(B).graph.items[0].content,'one')
 store.remove(B);assert.equal(files().length,1);assert.equal(store.source(url).content,'two')
 store.remove(A);assert.equal(files().length,0);assert.equal(store.get(A).graph,undefined);assert.equal(store.source(url),null)
})
test('copying the environment directory restores graphs and bytes without browser storage',t=>{
 const {dir,store}=fixture(t);publish(store,A)
 const copy=join(dir,'environment-copy');cpSync(join(dir,'rendering-cache'),join(copy,'rendering-cache'),{recursive:true})
 const restored=createRenderingCache(copy);assert.deepEqual(restored.get(A),store.get(A));assert.equal(restored.source(url).content,'export const version=1;')
})
test('Host generation CAS rejects stale publication after another client removes or replaces a graph',t=>{
 const {dir,store}=fixture(t),other=createRenderingCache(dir);publish(store,A)
 const stale=store.begin(A);assert.equal(store.get(A).pending,true);assert.ok(store.get(A).graph)
 other.remove(A);assert.equal(store.publish(A,stale,graph('late')),false);assert.equal(store.source(url),null)
 const older=store.begin(A),winner=other.begin(A);assert.equal(other.publish(A,winner,graph('new')),true);assert.equal(store.publish(A,older,graph('old')),false)
 assert.equal(store.get(A).graph.items[0].content,'new')
})
test('restart collects interrupted publication files without removing referenced bytes',t=>{
 const {dir,store}=fixture(t);publish(store,A,'one')
 const folder=join(dir,'rendering-cache/sources'),orphan='f'.repeat(64)+'.txt',temporary='e'.repeat(64)+'.txt.123.abcd.tmp'
 writeFileSync(join(folder,orphan),'abandoned');writeFileSync(join(folder,temporary),'partial')
 assert.equal(createRenderingCache(dir).get(A).graph.items[0].content,'one');assert.equal(readdirSync(folder).length,1)
})
test('Host validates canonical URLs and source hashes, and rejects altered disk bytes',t=>{
 const {dir,store}=fixture(t),value=store.begin(A)
 assert.throws(()=>store.publish(A,value,{...graph(),items:[{url:'https://127.0.0.1/secret',content:'bad'}]}),/Invalid dependency cache source/)
 assert.throws(()=>store.publish(A,value,{...graph(),items:[{url,content:'bad',contentDigest:'f'.repeat(64)}]}),/content changed/)
 store.publish(A,value,graph('one'));writeFileSync(join(dir,'rendering-cache/sources',readdirSync(join(dir,'rendering-cache/sources'))[0]),'two')
 assert.throws(()=>store.source(url),/content changed/);assert.throws(()=>store.get(A),/content changed/)
})
test('Host applies the shared physical budget across clients, without changing prior bytes on overflow',t=>{
 const {dir,store}=fixture(t,{limits:{count:2,bytes:6}});publish(store,A,'123456')
 const other=createRenderingCache(dir,{limits:{count:2,bytes:6}});publish(other,B,'123456')
 assert.equal(store.inventory().sources.length,1)
 const pending=other.begin(B);assert.throws(()=>other.publish(B,pending,graph('abcdef')),/shared limit/)
 assert.equal(store.get(A).graph.items[0].content,'123456');assert.equal(other.get(B).graph.items[0].content,'123456')
 assert.equal(readdirSync(join(dir,'rendering-cache/sources')).length,1)
})
test('legacy import keeps pending records and tombstones and cannot overwrite Host state',t=>{
 const {store}=fixture(t);assert.equal(store.import(A,{generation:7,pending:false,graph:graph()}),true)
 assert.equal(store.get(A).generation,7);store.remove(A)
 assert.equal(store.import(A,{generation:7,pending:false,graph:graph('old')}),false);assert.equal(store.get(A).graph,undefined)
 assert.equal(store.import(B,{generation:13,pending:true,graph:graph('pending')}),true);assert.equal(store.get(B).pending,true)
 assert.equal(store.import('removed',{generation:12,pending:false}),true);assert.equal(store.get('removed').graph,undefined)
})
test('HTTP clients from a fresh browser or port recover the same environment and independently install owners',async t=>{
 const {dir,store}=fixture(t),first=await host(t,store),one=hostDependencyStore({request:first.request})
 const trust=createRenderingTrust({budget:createRenderingCacheBudget()}),source=owner=>({owner,key:'helper',kind:'helper',enabled:true,content:`import '${url}';`})
 const manager=createRenderingDependencies({store:one,trust,download:async()=>graph().items[0].content,channelFactory:()=>null})
 await manager.sync([source(A)]);await manager.acquire(A);assert.equal(manager.inspect(A).status,'ready');manager.dispose()
 const copy=join(dir,'copy');cpSync(join(dir,'rendering-cache'),join(copy,'rendering-cache'),{recursive:true})
 const second=await host(t,createRenderingCache(copy)),two=hostDependencyStore({request:second.request}),coldTrust=createRenderingTrust({budget:createRenderingCacheBudget()})
 const cold=createRenderingDependencies({store:two,trust:coldTrust,download:async()=>{throw Error('External downloads must not happen')},channelFactory:()=>null});t.after(()=>cold.dispose())
 await cold.sync([source(A)]);assert.equal(cold.inspect(A).status,'ready');assert.equal(coldTrust.read(A,url),graph().items[0].content)
 await cold.sync([source(B)]);assert.equal(coldTrust.inspect(B,url),null);await cold.acquire(B);assert.equal(cold.inspect(B).status,'ready')
 const saved=await two.get(A);await two.remove(A);assert.equal(await two.readCurrent(A,saved,()=>{throw Error('Stale restore')}),false)
})
test('client migrates browser cache once, retries interrupted imports and never reimports a removed Host owner',async t=>{
 const {store}=fixture(t),{request}=await host(t,store);let failed=true,reads=0
 const legacy={async list(){reads++;return [{owner:A,generation:7,pending:false,graph:graph()}]}}
 const client=hostDependencyStore({legacy,request:async(path,options)=>{if(failed&&path.includes('/import?')){failed=false;throw Error('interrupted migration')}return request(path,options)}})
 await assert.rejects(client.list(),/interrupted/);assert.equal(store.get(A).generation,0)
 assert.equal((await client.list())[0].generation,7);assert.equal(reads,2);await client.remove(A)
 const reload=hostDependencyStore({legacy,request});await reload.list();assert.equal(store.get(A).graph,undefined)
})
test('Host cache requests retain Origin, desktop-token and DSH admission checks',async t=>{
 const {store}=fixture(t),{origin,request}=await host(t,store)
 assert.equal((await fetch(origin+API_V1+'/rendering-cache/graphs?owner=A',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403)
 const token=await fetch(origin+'/pmp-dsh-tavern/api/request-token',{headers:{'X-Tavern-Client':'embedded'}}).then(r=>r.json())
 assert.equal((await fetch(origin+API_V1+'/rendering-cache/graphs?owner=A',{method:'POST',headers:{'Content-Type':'application/json','X-Tavern-Request-Token':token.token},body:'{}'})).status,200)
 assert.equal((await request(API_V1+'/rendering-cache/graphs?owner=B',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,200)
 const blocked=await host(t,store,{admit:()=>({rejection:403})});assert.equal((await blocked.request(API_V1+'/rendering-cache/graphs')).status,403)
})
test('fixed opening cache rejects changed snapshots and prevents legacy reimport after removal',async t=>{
 const {store}=fixture(t),{request}=await host(t,store);assert.throws(()=>store.putOpening('changed'),/source changed/)
 assert.equal(store.opening().generation,0);store.removeOpening();let read=false
 const client=hostOpeningDataStore({request,legacy:{async get(){read=true;return 'old'}}});assert.equal(await client.get(),null);assert.equal(read,false)
 assert.equal(store.putOpening('old',{onlyMissing:true}),false)
})

test('target Cordis Host mounts the production cache route, restores after remount and unregisters on disposal', {skip:!process.env.DSH_TAVERN_COMPAT_ROOT}, async t=>{
 const {createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url'),{resolve}=await import('node:path')
 const require=createRequire(join(resolve(process.env.DSH_TAVERN_COMPAT_ROOT),'package.json'))
 const load=name=>import(pathToFileURL(require.resolve(name)).href)
 const {Context}=await load('@deepseek-ai/cordis'),{SystemPrompt}=await load('@deepseek-ai/dsh-system-prompt')
 const assembler=(await import('dsh-prompt-assembler/plugin')).default,tavern=await import('../packages/tavern-loader/src/index.js')
 const {dir}=fixture(t),ctx=new Context();let route
 const server=createServer((req,res)=>{if(route)return route.handler(req,res);res.statusCode=404;res.end()})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{
  for(const id of ['sessionController','workspaceController','directoryPickerController'])ctx.provide(id,{})
  ctx.provide('connection',{admit:()=>({})});ctx.provide('webServer',{register(value){route=value;return()=>{route=null}}})
  await ctx.plugin(SystemPrompt,{includeHarnessIdentity:false})
  await ctx.plugin(assembler,{storageDir:join(dir,'assembler')})
  const mount=()=>ctx.plugin({name:tavern.name,inject:tavern.inject,apply(scope){tavern.apply(scope,{storageDir:join(dir,'tavern')})}})
  let plugin=mount();await plugin;assert.ok(route)
  const origin=`http://127.0.0.1:${server.address().port}`,request=(path,options={})=>fetch(origin+path,{...options,headers:{Origin:origin,...Object.fromEntries(new Headers(options.headers))}})
  let client=hostDependencyStore({request});const value=await client.begin(A);assert.equal(await client.publish(A,value,graph()),true)
  await plugin.dispose();assert.equal(route,null)
  plugin=mount();await plugin;client=hostDependencyStore({request});assert.equal((await client.get(A)).graph.items[0].content,graph().items[0].content)
  await plugin.dispose();assert.equal(route,null)
 }finally{await ctx.fiber.dispose();await new Promise(resolve=>server.close(resolve))}
})
