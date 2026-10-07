import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {installMvu} from '../packages/mvu-adapter/src/host.js'
import {PlayWorkspaceStore} from '../packages/play/src/workspace.js'
import {PlayMembershipService} from '../packages/play/src/membership.js'
import {SessionSelectionStore} from '../packages/tavern-loader/src/session-policy.js'

const input=()=>({id:'mvu:state',scope:{authority:'local',sessionId:'s'},event:{preview:false,turn:1,step:1,usage:'prompt-template-dependency',consumer:{adapterId:'tavern.prompt-templates',id:'prompt-template:display'}}})
const strategy=['read_content','render_state_and_update_instructions','provide_to_model']
async function fixture(t,{managed=true,shared=true}={}){
 const dir=mkdtempSync(join(tmpdir(),'mvu-prompt-dependency-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const storageDir=join(dir,'storage'),root=join(dir,'play');mkdirSync(root)
 const store=new PlayWorkspaceStore(storageDir);await store.bindRoot(root)
 const catalog=JSON.stringify({playthroughs:[{id:'p',path:'p/timeline.json',ext:{pmpDshTavern:{rootSessionId:'s',characterId:'c'}}}]})
 const put=(path,content)=>{let revision=null;try{revision=store.readFile(path).revision}catch{}return store.writeFile(path,content,{expectedRevision:revision,expectedRevisionPresent:true})}
 await store.createDir('p');put('p/timeline.json',JSON.stringify({nodes:[]}));put('catalog.json',catalog)
 const selections=new SessionSelectionStore(storageDir);selections.set('s',{characterCardId:'c'})
 const events=[],handlers=new Map(),session={id:'s',header:{id:'s',version:4,createdAt:1},snapshotEvents:()=>events},services=new Map([['sessions',new Map([['s',session]])]])
 const ctx={get:name=>services.get(name),provide:(name,value)=>services.set(name,value),on(name,fn){const list=handlers.get(name)??[];list.push(fn);handlers.set(name,list);return()=>{}},effect:fn=>fn()}
 const memberships=new PlayMembershipService(store)
 const service=installMvu(ctx,{storageDir,resources:[{...(shared?{sharing:'shared'}:{}), id:'mvu:state',characterId:'c',sessionIds:['s'],managementMode:managed?'managed':'native',initial:{stat_data:{hp:7}}}],sources:{register:()=>()=>{}},memberships,getSelection:id=>selections.get(id),getSelectionToken:id=>selections.selectionRevision(id),isActive:(r,id)=>r.characterId===selections.get(id).characterCardId})
 t.after(()=>service.dispose())
 let policy={revision:4,enabled:true};const requests=[],facts=[];service.observe(f=>facts.push(f))
 const allow=()=>service.registerUsage(request=>{requests.push(request);const current=policy;return{enabled:current.enabled,configRevision:current.revision,strategy,checkCurrent:()=>current===policy}},{providerId:'dsh-memory-manager'})
 const append=event=>{event={seq:events.length,...event};events.push(event);for(const handler of handlers.get('session/event')??[])handler(session,event);return event}
 return {service,ctx,append,events,store,memberships,selections,requests,facts,allow,put,restore:()=>put('catalog.json',catalog),reload:()=>{policy={revision:5,enabled:false}},read:()=>service.read({id:'mvu:state',scope:{sessionId:'s'}})}
}
const update=async f=>{const row=await f.read();await f.service.update({id:'mvu:state',scope:{sessionId:'s'},expectedRevision:row.revision,operationId:'update-'+row.revision,content:{stat_data:{hp:8}}})}

test('managed dependency uses MVU before-model policy, exact chain and trusted consumer, without applied facts',async t=>{
 const f=await fixture(t)
 assert.equal((await f.read()).content.stat_data.hp,7)
 const unconfigured=f.service.registerUsage(()=>undefined,{providerId:'dsh-memory-manager'})
 assert.equal(await f.service.resolvePromptDependency(input()),null,'installed manager without a decision never permits raw reads');unconfigured()
 f.allow();const result=await f.service.resolvePromptDependency(input())
 assert.equal(result.id,'mvu:state');assert.equal(result.adapterId,'tavern.mvu');assert.equal(result.content.stat_data.hp,7);assert.equal(result.revision,0);assert.equal(result.configRevision,4);assert.equal(result.checkCurrent(),true)
 assert.equal(f.requests[0].on,'before_model_request');assert.deepEqual(f.requests[0].event,input().event)
 assert.equal(f.requests[0].managementMode,'managed');assert.deepEqual(f.requests[0].scope,input().scope)
 result.content.stat_data.hp=99;assert.equal((await f.read()).content.stat_data.hp,7)
 assert.equal(f.facts.filter(f=>f.phase==='applied').length,0)
})

test('native policy default and managed denial/malformed leases never get confused',async t=>{
 const native=await fixture(t,{managed:false});assert.equal((await native.service.resolvePromptDependency(input())).checkCurrent(),true)
 for(const answer of [{enabled:false},{enabled:true},{enabled:true,checkCurrent:async()=>true}]){
  const f=await fixture(t);f.service.registerUsage(()=>answer);assert.equal(await f.service.resolvePromptDependency(input()),null)
 }
 const f=await fixture(t);f.service.registerUsage(()=>({enabled:true,checkCurrent:()=>true,strategy:['provide_to_model']}))
 await assert.rejects(f.service.resolvePromptDependency(input()),{code:'MVU_CONFIG'})
})

test('dependency leases expire on content, selection ABA, membership ABA, policy reload and service/manager removal',async t=>{
 for(const change of ['content','selection','membership','policy','manager','service','replacement','abort']){
  const f=await fixture(t),stop=f.allow(),controller=new AbortController(),result=await f.service.resolvePromptDependency({...input(),signal:controller.signal})
  assert.equal(result.checkCurrent(),true,change)
  if(change==='content')await update(f)
  if(change==='selection'){f.selections.set('s',{characterCardId:'other'});f.selections.set('s',{characterCardId:'c'})}
  if(change==='membership'){f.memberships.detach('p','s');f.restore()}
  if(change==='policy')f.reload()
  if(change==='manager')stop()
  if(change==='service')f.service.dispose()
  if(change==='replacement')f.ctx.provide('tavernMvu',{})
  if(change==='abort')controller.abort()
  assert.equal(result.checkCurrent(),false,change)
 }
})

test('mutations while policy awaits cannot return stale dependency data or a revived lease',async t=>{
 for(const change of ['content','selection','membership','policy','abort']){
  const f=await fixture(t),controller=new AbortController();let release,entered
  const waiting=new Promise(r=>{entered=r}),gate=new Promise(r=>{release=r});let current=true
  f.service.registerUsage(async()=>{entered();await gate;return{enabled:true,configRevision:1,strategy,checkCurrent:()=>current}})
  const pending=f.service.resolvePromptDependency({...input(),signal:controller.signal});const rejection=change==='abort'?assert.rejects(pending,{name:'AbortError'}):null
  await waiting
  if(change==='content')await update(f)
  if(change==='selection'){f.selections.set('s',{characterCardId:'x'});f.selections.set('s',{characterCardId:'c'})}
  if(change==='membership'){f.memberships.detach('p','s');f.restore()}
  if(change==='policy')current=false
  if(change==='abort')controller.abort()
  release();if(rejection)await rejection;else assert.equal(await pending,null,change)
 }
})

test('only current local session dependencies with explicit Host consumer metadata are accepted',async t=>{
 const f=await fixture(t);f.allow()
 for(const scope of [{sessionId:'s'},{authority:'remote',sessionId:'s'},{authority:'local',sessionId:'s',messageId:'old'},{authority:'local',sessionId:'s',mode:'greeting'}])await assert.rejects(f.service.resolvePromptDependency({...input(),scope}),{code:'MVU_SCOPE'})
 for(const event of [{...input().event,proof:true},{...input().event,consumer:{adapterId:'guest',id:'prompt-template:display'}},{...input().event,turn:-1}])await assert.rejects(f.service.resolvePromptDependency({...input(),event}),{code:'MVU_SCOPE'})
 await assert.rejects(f.service.resolvePromptDependency({...input(),scope:{authority:'local',sessionId:'foreign'}}),{code:'SCOPE_MISMATCH'})
 assert.equal(await f.service.resolvePromptDependency({...input(),id:'mvu:missing'}),null)
 const prior=await f.service.resolvePromptDependency(input());f.memberships.detach('p','s');assert.equal(prior.checkCurrent(),false)
 assert.equal((await f.service.resolvePromptDependency(input())).checkCurrent(),true,'fresh current read may attest a selected native session outside a playthrough')
})


const managerRoot=process.env.DSH_TAVERN_MEMORY_MANAGER_ROOT
test('actual optional manager gates MVU dependency and invalidates it on real configuration reload',{skip:!managerRoot},async t=>{
 const load=path=>import(pathToFileURL(join(resolve(managerRoot),path)).href)
 const {MemoryManager}=await load('src/manager.js'),{Usage}=await load('src/usage.js'),{installMvu:installAdapter}=await load('src/adapters/mvu.js')
 const f=await fixture(t),dir=mkdtempSync(join(tmpdir(),'mvu-dependency-manager-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const configPath=join(dir,'config.json');let revision=0
 const policy=rule=>({id:'mvu:state',adapterId:'tavern.mvu',type:'mvu-state',whitelist:[{sessionId:'s'}],blacklist:[],retrieve:{on:'before_model_request',rule,strategy:strategy.map(operation=>({operation}))}})
 const write=entries=>writeFileSync(configPath,JSON.stringify({schemaVersion:1,revision:++revision,presets:{},entries}))
 write([{...policy(true),retrieve:{}}]);const manager=await new MemoryManager({configPath}).init(),usage=new Usage(manager),stop=installAdapter(manager,f.service,usage)
 t.after(async()=>{stop();await manager.dispose()})
 assert.equal(await f.service.resolvePromptDependency(input()),null)
 write([policy(true)]);await manager.reload()
 const before=await f.service.resolvePromptDependency(input());assert.equal(before.checkCurrent(),true)
 write([policy(false)]);const reload=manager.reload();assert.equal(before.checkCurrent(),false,'reload start expires lease synchronously');await reload
 assert.equal(await f.service.resolvePromptDependency(input()),null)
 let entered,release;const waiting=new Promise(r=>{entered=r}),gate=new Promise(r=>{release=r})
 usage.registerCondition({id:'dependency-wait',test:async()=>{entered();await gate;return true}})
 write([policy('dependency-wait')]);await manager.reload()
 const pending=f.service.resolvePromptDependency(input());await waiting
 write([policy(false)]);await manager.reload();release();assert.equal(await pending,null)
 write([policy(true)]);await manager.reload();const accepted=await f.service.resolvePromptDependency(input());stop();assert.equal(accepted.checkCurrent(),false)
 assert.equal((await f.service.resolvePromptDependency(input())).checkCurrent(),true,'unload restores source defaults')
 assert.equal(manager.traces.filter(f=>f.phase==='applied').length,0)
})

test('every registered policy source must lease its dependency decision, including native abstention',async t=>{
 for(const managed of [false,true]){
  const f=await fixture(t,{managed});if(managed)f.allow()
  let decision;f.service.registerUsage(()=>decision)
  assert.equal(await f.service.resolvePromptDependency(input()),null,'unleased abstention does not release content')
  decision={enabled:false,checkCurrent:()=>true};assert.equal(await f.service.resolvePromptDependency(input()),null)
 }
})

test('all membership evidence is leased, including other timelines that introduce a conflicting membership',async t=>{
 const f=await fixture(t);f.allow()
 const catalog=JSON.parse(f.store.readFile('catalog.json').content)
 catalog.playthroughs.push({id:'q',path:'q/timeline.json',ext:{pmpDshTavern:{rootSessionId:'other',characterId:'conflicting-card'}}})
 f.put('q/timeline.json',JSON.stringify({nodes:[]}));f.put('catalog.json',JSON.stringify(catalog))
 const result=await f.service.resolvePromptDependency(input());assert.equal(result.checkCurrent(),true)
 f.put('q/timeline.json',JSON.stringify({nodes:[{id:'n',kind:'qa',parentVariantId:null,adoptedVariantId:'v',variants:[{id:'v',sessionId:'s',startEventId:0,endEventId:1}]}]}))
 assert.equal(result.checkCurrent(),false);assert.equal(await f.service.resolvePromptDependency(input()),null)
 f.put('q/timeline.json',JSON.stringify({nodes:[]}));assert.equal(result.checkCurrent(),false)
 assert.equal((await f.service.resolvePromptDependency(input())).checkCurrent(),true)
})

test('native reads attest absent catalog and unbound workspace without creating either',async t=>{
 const f=await fixture(t,{managed:false});delete f.service.resources[0].characterId
 const absent=join(f.store.get().rootPath,'empty');mkdirSync(absent);await f.store.bindRoot(absent)
 const first=await f.service.resolvePromptDependency(input());assert.equal(first.checkCurrent(),true)
 f.put('catalog.json',JSON.stringify({playthroughs:[]}));assert.equal(first.checkCurrent(),false)
 const empty=await f.service.resolvePromptDependency(input());assert.equal(empty.checkCurrent(),true)
 const unbound=new PlayWorkspaceStore(join(absent,'unbound-storage'))
 f.memberships.workspaceStore=unbound
 const detached=await f.service.resolvePromptDependency(input());assert.equal(detached.checkCurrent(),true)
 await unbound.bindRoot(absent);assert.equal(detached.checkCurrent(),false)
})


test('creating a directory that replaces absent catalog evidence expires the lease',async t=>{
 const f=await fixture(t,{managed:false});delete f.service.resources[0].characterId
 const empty=join(f.store.get().rootPath,'empty-directory');mkdirSync(empty);await f.store.bindRoot(empty)
 const result=await f.service.resolvePromptDependency(input());assert.equal(result.checkCurrent(),true)
 await f.store.createDir('catalog.json');assert.equal(result.checkCurrent(),false)
})


test('world-book request lease accepts only the known claimed input and official preparation records; future/unknown messages revoke it',async t=>{
 for(const change of ['prepared','series-start','invalid-series-start','unknown-header-field','unclaimed-user','future-reply','next-turn','prefix-change']){
  const f=await fixture(t,{managed:false,shared:false}),user={id:'claimed-user',role:'user',source:{kind:'user'},content:[{type:'text',text:'authored input'}]}
  f.append({type:'agent/inbox/spliced',data:{target:'next-turn',start:0,inserted:[user]}})
  f.append({type:'turn/start',data:{turn:1}})
  const result=await f.service.resolvePromptDependency({scope:{authority:'local',sessionId:'s'},event:{preview:false,turn:1,usage:'world-book-variable',consumer:{adapterId:'tavern.world-books',id:'world-book:character:c:embedded-world-book'}}})
  assert.equal(result.checkCurrent(),true)
  f.append({type:'step/start',data:{turn:1,step:0}})
  f.append({type:'system/message',data:{turn:1,step:0,message:{id:'system',role:'system',content:[{type:'text',text:'authored system'}]}}})
  f.append({type:'user/message',data:change==='unclaimed-user'?{...user,id:'other'}:user})
  f.append({type:'request/header',data:{header:{config:{}},reason:'changed',
   ...(change==='series-start'?{startsSeries:true}:{}),
   ...(change==='invalid-series-start'?{startsSeries:'true'}:{}),
   ...(change==='unknown-header-field'?{unknown:true}:{})}})
  f.append({type:'request/context',data:{provider:'fixture',model:'fixture',systemPromptUpdate:'in-history'}})
  if(change==='future-reply')f.append({type:'assistant/message',data:{turn:1,message:{id:'future',role:'assistant',content:[]}}})
  if(change==='next-turn')f.append({type:'turn/start',data:{turn:2}})
  if(change==='prefix-change')f.events[0]={...f.events[0],data:{...f.events[0].data,start:1}}
  assert.equal(result.checkCurrent(),['prepared','series-start'].includes(change),change)
  await f.service.flush()
 }
})

test('an installed Host rejects a stale character scope for the MVU preset source',async t=>{
 const f=await fixture(t,{managed:false,shared:false})
 await f.service.list({scope:{sessionId:'s'}})
 f.selections.set('s',{characterCardId:'other'})
 await assert.rejects(f.service.resolveRequest({sessionId:'s'}),{code:'MVU_USAGE_CANCELLED'})
})

test('log-only titles during prompt assembly accept known input references without relaxing initial write leases',async t=>{
 for(const change of ['fallback','provider','user','future-reference','unknown-source','unknown-field']){
  const f=await fixture(t,{managed:false,shared:false}),user={id:'title-input',role:'user',source:{kind:'user'},content:[{type:'text',text:'title input'}]}
  f.append({type:'agent/inbox/spliced',data:{target:'next-turn',start:0,inserted:[user]}})
  f.append({type:'turn/start',data:{turn:1}})
  const result=await f.service.resolvePromptDependency({scope:{authority:'local',sessionId:'s'},event:{preview:false,turn:1,usage:'world-book-variable',consumer:{adapterId:'tavern.world-books',id:'world-book:one'}}})
  const message=f.append({type:'user/message',data:user})
  f.append({type:'session/title',data:{title:'Title',messageSeqs:change==='user'?[]:[change==='future-reference'?message.seq+100:message.seq],
   source:change==='provider'?{kind:'provider',provider:'title-provider',model:{provider:'offline',model:'test'}}:{kind:change==='unknown-source'?'unknown':change==='user'?'user':'fallback'},
   ...(change==='unknown-field'?{unknown:true}:{})}})
  assert.equal(result.checkCurrent(),['fallback','provider','user'].includes(change),change)
  await f.service.flush()
 }
})

test('a shared world-book checkpoint lease expires when its session enters another turn',async t=>{
 const f=await fixture(t,{managed:false,shared:true})
 f.append({type:'turn/start',data:{turn:1}});await f.service.flush()
 const result=await f.service.resolvePromptDependency({scope:{authority:'local',sessionId:'s'},event:{preview:false,turn:1,usage:'world-book-variable',consumer:{adapterId:'tavern.world-books',id:'world-book:one'}}})
 assert.equal(result.checkCurrent(),true)
 const revision=(await f.read()).revision
 f.append({type:'turn/start',data:{turn:2}});await f.service.flush()
 assert.equal((await f.read()).revision,revision,'checkpoint changes need not change the state revision')
 assert.equal(result.checkCurrent(),false)
})

test('same-card fork references preserve ancestor defaults and current dependency reads with fresh leases',async t=>{
 for(const managed of [false,true]){
  const f=await fixture(t,{managed,shared:false});if(managed)f.allow()
  const instance=(await f.service.list({scope:{sessionId:'s'}}))[0],request={...input(),id:instance.id}
  const before=await f.service.resolvePromptDependency(request),revision=instance.revision
  const catalog=JSON.parse(f.store.readFile('catalog.json').content)
  catalog.playthroughs.push({id:'fork',path:'fork/timeline.json',ext:{pmpDshTavern:{rootSessionId:'child',characterId:'c'}}})
  f.put('fork/timeline.json',JSON.stringify({nodes:[{id:'ancestor',kind:'qa',parentVariantId:null,adoptedVariantId:'old',variants:[{id:'old',sessionId:'s',startEventId:0,endEventId:1}]}]}));f.put('catalog.json',JSON.stringify(catalog))
  assert.equal(before.checkCurrent(),false,'a reference change expires the old lease even when compatible')
  const defaults=f.service.getManagementDefaults({id:instance.id,scope:request.scope})
  assert.equal(defaults.checkCurrent(),true)
  const current=await f.service.resolvePromptDependency(request);assert.equal(current.id,instance.id);assert.equal(current.content.stat_data.hp,7);assert.equal(current.checkCurrent(),true)
  assert.equal((await f.service.read({id:instance.id,scope:request.scope})).revision,revision,'prompt/default reads never migrate state')
  catalog.playthroughs[1].ext.pmpDshTavern.characterId='foreign-card';f.put('catalog.json',JSON.stringify(catalog))
  assert.equal(defaults.checkCurrent(),false);assert.equal(current.checkCurrent(),false)
  assert.equal(f.service.getManagementDefaults({id:instance.id,scope:request.scope}),null)
  assert.equal(await f.service.resolvePromptDependency(request),null,'cross-card references remain rejected')
  catalog.playthroughs[1].ext.pmpDshTavern.characterId='c';f.put('catalog.json',JSON.stringify(catalog))
  delete f.service.resources.find(resource=>resource.id===instance.id).characterId
  assert.equal(f.service.getManagementDefaults({id:instance.id,scope:request.scope}),null)
  assert.equal(await f.service.resolvePromptDependency(request),null,'multiple references without a source card identity remain ambiguous')
 }
})

test('actual manager uses ancestor source defaults across same-card fork references without configuration or state writes',{skip:!managerRoot},async t=>{
 const load=path=>import(pathToFileURL(join(resolve(managerRoot),path)).href)
 const {MemoryManager}=await load('src/manager.js'),{Usage}=await load('src/usage.js'),{installMvu:installAdapter}=await load('src/adapters/mvu.js')
 const f=await fixture(t,{managed:false,shared:false}),instance=(await f.service.list({scope:{sessionId:'s'}}))[0]
 const dir=mkdtempSync(join(tmpdir(),'mvu-fork-defaults-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
 const configPath=join(dir,'config.json');writeFileSync(configPath,JSON.stringify({schemaVersion:1,revision:1,presets:{},entries:[]}))
 const manager=await new MemoryManager({configPath}).init(),usage=new Usage(manager),stop=installAdapter(manager,f.service,usage)
 t.after(async()=>{stop();await manager.dispose()})
 await manager.query({scope:{sessionId:'s'}})
 const request={id:instance.id,scope:{authority:'local',sessionId:'s'},event:{preview:true,usage:'world-book-variable',consumer:{adapterId:'tavern.world-books',id:'world-book:character:c:embedded-world-book'}}}
 const bytes=readFileSync(configPath),before=await f.service.resolvePromptDependency(request),row=await f.service.read({id:instance.id,scope:request.scope})
 assert.notEqual(before,null)
 assert.equal(before.checkCurrent(),true)
 const catalog=JSON.parse(f.store.readFile('catalog.json').content)
 catalog.playthroughs.push({id:'fork',path:'fork/timeline.json',ext:{pmpDshTavern:{rootSessionId:'child',characterId:'c'}}})
 f.put('fork/timeline.json',JSON.stringify({nodes:[{id:'ancestor',kind:'qa',parentVariantId:null,adoptedVariantId:'old',variants:[{id:'old',sessionId:'s',startEventId:0,endEventId:1}]}]}));f.put('catalog.json',JSON.stringify(catalog))
 assert.equal(before.checkCurrent(),false)
 const configuration=manager.configurationSnapshot({id:instance.id,adapterId:'tavern.mvu',sessionId:'s'})
 assert.equal(configuration.sourceDefault.available,true);assert.equal(configuration.scopePolicy,'source-bound')
 const fresh=await f.service.resolvePromptDependency(request);assert.equal(fresh.checkCurrent(),true);assert.equal(fresh.content.stat_data.hp,7)
 assert.deepEqual(readFileSync(configPath),bytes);assert.deepEqual((await f.service.read({id:instance.id,scope:request.scope})).content,row.content)
 assert.equal((await f.service.read({id:instance.id,scope:request.scope})).revision,row.revision)
 assert.equal(manager.traces.filter(fact=>fact.phase==='applied').length,0,'dependency access does not invent model delivery')
 catalog.playthroughs[1].ext.pmpDshTavern.characterId='foreign-card';f.put('catalog.json',JSON.stringify(catalog))
 assert.equal(fresh.checkCurrent(),false);assert.equal(manager.configurationSnapshot({id:instance.id,adapterId:'tavern.mvu',sessionId:'s'}).sourceDefault.available,false)
 assert.equal(await f.service.resolvePromptDependency(request),null)
})
