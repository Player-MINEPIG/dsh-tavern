import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ConversationSettingsStore,createConversationSettingsApiHandler} from '../packages/tavern-loader/src/conversation-settings.js'
import {normalizeScriptEnablement,updateScriptEnablement} from '../packages/presentation/script-enablement.js'
import {setClientConversationSettings,normalizeClientConversationSettings} from '../packages/client/src/conversation-settings.js'
import {createRenderingTrust,renderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {helperScripts,renderingInventory,identifyRenderingSources,globalRenderingOwner} from '../packages/client/src/play/rendering-sources.js'
const card = scripts=>({data:{extensions:{tavern_helper:{scripts}}}})
const inventory = async(scripts,id='one')=>identifyRenderingSources(renderingInventory(card(scripts),{kind:'character',resourceId:id}))

test('native enable/disable and disabled folders are inherited without importing trust',async()=>{
 const scripts=[{id:'on',content:'1',enabled:true},{id:'off',content:'2',enabled:false},{id:'disabled',content:'3',disabled:true},{type:'folder',value:{disabled:true,scripts:[{id:'child',content:'4',enabled:true}]}}]
 assert.deepEqual(helperScripts(card(scripts)).map(x=>x.enabled),[true,false,false,false])
 const trust=createRenderingTrust(),entries=await inventory(scripts)
 for(const entry of entries){assert.equal(trust.isEnabled(entry.owner,entry.preferenceKey,entry.enabled),entry.enabled);assert.equal(trust.inspect(entry.owner,entry.key),null)}
})
test('stable IDs and unique content survive reorder; indistinguishable duplicates refuse persistent identity',async()=>{
 const scripts=[{id:'id-a',content:'1'},{content:'2'},{content:'3'},{content:'3'}]
 const before=await inventory(scripts),after=await inventory([scripts[1],scripts[0],scripts[2],scripts[3]])
 assert.equal(before[0].preferenceKey,after[1].preferenceKey)
 assert.equal(before[1].preferenceKey,after[0].preferenceKey)
 assert.equal(before[2].preferenceKey,null)
 assert.equal(before[3].preferenceKey,null)
 assert.equal(before[2].enablementAmbiguous,true)
 assert.equal(before[3].enablementAmbiguous,true)
 assert.notEqual((await inventory([{content:'changed'}]))[0].preferenceKey,before[1].preferenceKey)
 const duplicateIds=await inventory([{id:'same',content:'1'},{id:'same',content:'2'}])
 assert.notEqual(duplicateIds[0].preferenceKey,duplicateIds[1].preferenceKey)
})
test('enablement round-trips through settings, isolates owners, and resets without granting trust',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'tavern-enable-'))
 try{
  const entry=(await inventory([{id:'same',content:'1',enabled:false}]))[0]
  const preferences=updateScriptEnablement(undefined,entry.owner,entry.preferenceKey,true)
  const store=new ConversationSettingsStore(directory)
  store.set({textScale:1,actionScale:1,interactiveCards:false,scriptEnablement:preferences})
  const saved=new ConversationSettingsStore(directory).get()
  setClientConversationSettings(saved,{announce:false})
  assert.equal(renderingTrust.isEnabled(entry.owner,entry.preferenceKey,false),true)
  assert.equal(renderingTrust.isEnabled('character:two',entry.preferenceKey,false),false)
  assert.equal(renderingTrust.inspect(entry.owner,entry.key),null)
  assert.throws(()=>renderingTrust.read(entry.owner,entry.key),/not downloaded/)
  const appearance=normalizeClientConversationSettings({...saved,textScale:1.25,bubbleStyle:undefined})
  assert.deepEqual(appearance.scriptEnablement,preferences)
  assert.equal(appearance.interactiveCards,false)
  setClientConversationSettings({...saved,scriptEnablement:updateScriptEnablement(preferences,entry.owner,entry.preferenceKey,undefined)},{announce:false})
  assert.equal(renderingTrust.isEnabled(entry.owner,entry.preferenceKey,false),false)
 }finally{setClientConversationSettings({},{announce:false});rmSync(directory,{recursive:true,force:true})}
})
test('normalizing a pending save has no runtime effect; source approval remains byte-bound and ephemeral',async()=>{
 const trust=createRenderingTrust(),owner='character:one',key='https://example.com/x.js'
 const digest=await trust.stage(owner,key,'1');trust.approve(owner,key,digest)
 trust.setEnablement(updateScriptEnablement(undefined,owner,key,false));assert.throws(()=>trust.read(owner,key),/disabled/)
 trust.setEnablement(updateScriptEnablement(undefined,owner,key,true));assert.equal(trust.read(owner,key),'1')
 await trust.stage(owner,key,'2');assert.throws(()=>trust.read(owner,key),/not downloaded/)
 trust.approve(owner,key,trust.inspect(owner,key).digest);trust.revoke(owner,key);assert.throws(()=>trust.read(owner,key),/not downloaded/)
 trust.clear();assert.equal(trust.isEnabled(owner,key),true);assert.equal(trust.inspect(owner,key),null)
 setClientConversationSettings({},{announce:false})
 normalizeClientConversationSettings({scriptEnablement:updateScriptEnablement(undefined,owner,key,false)})
 assert.equal(renderingTrust.isEnabled(owner,key),true)
})
test('global preferences use canonical workspace identity and reject authority fields',async()=>{
 const owner=path=>globalRenderingOwner({getWorkspace:async()=>({selected:true,rootPath:path})})
 assert.notEqual(await owner('/synthetic/a'),await owner('/synthetic/b'))
 assert.equal(await owner('/synthetic/a'),await owner('/synthetic/a'))
 assert.equal(await globalRenderingOwner({}),null)
 const good={schemaVersion:1,entries:[{owner:'character:one',key:'helper:id:a',enabled:true}]}
 for(const patch of [{approved:true},{writeGrant:{}},{source:'unknown'}])assert.throws(()=>normalizeScriptEnablement({...good,...patch}),/Invalid/)
 assert.throws(()=>normalizeScriptEnablement({...good,entries:[{...good.entries[0],approved:true}]}),/Invalid/)
})

test('shared dependency rows aggregate active roots without enabling disabled helpers',async()=>{
 const {renderingEntries}=await import('../packages/client/src/play/rendering-sources.js')
 const scripts=[{id:'off',content:'import "https://example.com/shared.js";',enabled:false},{id:'on',content:'import "https://example.com/shared.js";',enabled:true}]
 const sources=await inventory(scripts),trust=createRenderingTrust()
 let rows=renderingEntries(sources,trust),shared=rows.find(entry=>entry.key==='https://example.com/shared.js')
 assert.equal(shared.enabled,true);assert.equal(shared.origins.length,2)
 assert.equal(rows.find(entry=>entry.id==='off').enabled,false)
 trust.setEnablement(updateScriptEnablement(undefined,sources[1].owner,sources[1].preferenceKey,false))
 rows=renderingEntries(sources,trust);assert.equal(rows.find(entry=>entry.key===shared.key).enabled,false)
 // Disabling the shared dependency does not alter either root's saved intention.
 trust.setEnablement(updateScriptEnablement(undefined,sources[0].owner,shared.key,false))
 assert.equal(trust.isEnabled(sources[1].owner,sources[1].preferenceKey,true),true)
})
test('a workspace switch while reading code cannot assign it the new global owner',async()=>{
 const {readRenderingWorkspace}=await import('../packages/client/src/play/rendering-sources.js')
 let root='/synthetic/one'
 const client={getWorkspace:async()=>({selected:true,rootPath:root})}
 const result=await readRenderingWorkspace(client,async()=>{root='/synthetic/two';return {rules:[]}})
 assert.equal(result.owner,null)
})

test('S1: saved A choice follows named duplicate source through exact A/B reorder',async()=>{
 const A={name:'A',content:'1',enabled:true},B={name:'B',content:'1',enabled:true}
 const before=await inventory([A,B]),trust=createRenderingTrust()
 trust.setEnablement(updateScriptEnablement(undefined,before[0].owner,before[0].preferenceKey,false))
 const after=await inventory([B,A])
 assert.equal(trust.isEnabled(after[0].owner,after[0].preferenceKey,after[0].enabled),true,'B must not inherit A disable')
 assert.equal(trust.isEnabled(after[1].owner,after[1].preferenceKey,after[1].enabled),false,'A retains its saved disable')
})

test('S1: indistinguishable duplicates ignore stale index-based overrides and preserve each native default',async()=>{
 const {renderingEntries}=await import('../packages/client/src/play/rendering-sources.js')
 const A={name:'same',content:'1',enabled:true},B={name:'same',content:'1',enabled:false}
 const before=await inventory([A,B]),trust=createRenderingTrust()
 assert.ok(before.every(entry=>entry.enablementAmbiguous&&entry.preferenceKey===null))
 // Neither legacy source-path keys nor old digest-plus-path keys may choose an entry.
 trust.setEnablement({schemaVersion:1,entries:before.map(entry=>({owner:entry.owner,key:entry.key,enabled:!entry.enabled}))})
 assert.deepEqual(renderingEntries(await inventory([B,A]),trust).filter(x=>x.kind==='helper').map(x=>x.enabled),[false,true])
})

test('S3: successful PUT wins over delayed initial GET success, error and runtime broadcasts',async()=>{
 const {createConversationSettingsPersistence,getClientConversationSettings}=await import('../packages/client/src/conversation-settings.js')
 for(const failGet of [false,true]){
  let resolveGet,rejectGet
  const applied=[],statuses=[],busy=[],changes=[],requests=[]
  const saved={textScale:1,actionScale:1,interactiveCards:false,scriptEnablement:updateScriptEnablement(undefined,'character:one','helper:id:one',false)}
  const old={textScale:1,actionScale:1,interactiveCards:true,scriptEnablement:updateScriptEnablement(undefined,'character:one','helper:id:one',true)}
  setClientConversationSettings({},{announce:false})
  const stop=renderingTrust.subscribe(()=>changes.push(renderingTrust.isEnabled('character:one','helper:id:one')))
  const persistence=createConversationSettingsPersistence({
   request:(method,body)=>{requests.push({method,body});return method==='GET'?new Promise((resolve,reject)=>{resolveGet=resolve;rejectGet=reject}):Promise.resolve(saved)},
   apply:value=>{applied.push(value);setClientConversationSettings(value,{announce:false})},
   status:(key,error)=>statuses.push([key,error?.message]),busy:value=>busy.push(value),
  })
  const load=persistence.load();await persistence.save(saved)
  failGet?rejectGet(Error('old GET failed')):resolveGet(old)
  await load
  assert.deepEqual(requests,[{method:'GET',body:undefined},{method:'PUT',body:saved}])
  assert.deepEqual(applied,[saved]);assert.deepEqual(changes,[false])
  assert.equal(getClientConversationSettings().interactiveCards,false)
  assert.equal(renderingTrust.isEnabled('character:one','helper:id:one'),false)
  assert.deepEqual(statuses.map(x=>x[0]),['saving','saved']);assert.deepEqual(busy,[true,true,false])
  persistence.dispose();stop()
 }
 setClientConversationSettings({},{announce:false})
})

test('S3: stale writes and disposed responses do not publish settings, errors or busy state',async()=>{
 const {createConversationSettingsPersistence}=await import('../packages/client/src/conversation-settings.js')
 const pending=[],applied=[],statuses=[],busy=[]
 const controller=createConversationSettingsPersistence({request:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),apply:v=>applied.push(v),status:key=>statuses.push(key),busy:v=>busy.push(v)})
 const first=controller.save({textScale:1,actionScale:1}),second=controller.save({textScale:1.25,actionScale:1})
 pending[1].resolve({textScale:1.25,actionScale:1});await second
 pending[0].reject(Error('stale'));await first
 assert.deepEqual(applied,[{textScale:1.25,actionScale:1}]);assert.deepEqual(statuses,['saving','saving','saved']);assert.deepEqual(busy,[true,true,false])
 const read=controller.load();controller.dispose();pending[2].resolve({textScale:1,actionScale:1});await read
 assert.equal(applied.length,1)
})
