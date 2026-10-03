import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectTemplateMetadata, PromptTemplateService, renderTemplate, TEMPLATE_SOURCE } from '../packages/prompt-template/index.js'
import { createMemorySources } from '../packages/memory-sources/index.js'
import { WorldBookStore } from '../packages/world-book-library/src/store.js'
import { createCharacterAdapter } from '../packages/character/src/index.js'
import { createWorldBookAdapter } from '../packages/tavern-loader/src/world-book-adapter.js'
import { createDefaultRegistry, assembleRequestAsync, BUILTINS } from '../packages/request-assembler/index.js'
const temp = t => { const dir=mkdtempSync(join(tmpdir(),'template-dependency-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir }
const row = content => ({id:'prompt-template:dependent',name:'Dependent',content,sessionIds:['s'],enabled:true})
const context = {sessionId:'s',preview:false,turn:1,step:0,assets:{},nativeMessages:[],inputIds:[]}
const usage = type => ({enabled:true,configRevision:1,checkCurrent:()=>true,strategy:(type==='world-book'?['worldbook.activate','worldbook.emit']:['prompt_template.expand','prompt_template.emit']).map(operation=>({operation}))})
const manage = (source,id) => source.setManagementMode({id,mode:'managed',expectedRevision:source.read({id}).revision,operationId:'manage-'+id})
function fixture(t,content,{embedded=false}={}) {
 const storageDir=temp(t),store=new WorldBookStore(storageDir)
 let card={id:'card',name:'Card',data:{description:'description',characterBook:{entries:[{id:0,keys:[],content:'EMBEDDED',comment:'Active',constant:true,enabled:true},{id:1,keys:['absent'],content:'INACTIVE_SECRET',comment:'Inactive',enabled:true}]}}}
 const characters={list:()=>[{id:card.id}],get:id=>{if(id!==card.id)throw Object.assign(Error(),{code:'CHARACTER_NOT_FOUND'});return structuredClone(card)}}
 const book=store.import({entries:{0:{uid:0,content:'WORLD',comment:'Active',constant:true},1:{uid:1,content:'INACTIVE_SECRET',comment:'Inactive',key:['absent']}}},{name:'Book'})
 let selection={worldBookIds:embedded?[]:[book.id],characterId:embedded?'card':null,selectionRevision:0}
 const service=createMemorySources({storageDir,store,characters,getSelection:()=>selection,resources:[row(content)]})
 const adapter=createWorldBookAdapter(store,{allowResource:(id,c)=>service.worldBooks.allowNative(id,c.requestAssembly)})
 const assets=()=>{const projected=adapter.resolve({selection:{worldBookIds:selection.worldBookIds},character:embedded?createCharacterAdapter(characters).resolve({selection:{characterCardId:card.id}}).character:null,requestAssembly:true});return {worldBookIds:selection.worldBookIds,character:embedded?structuredClone(card):null,loreEntries:projected.loreEntries,worldBookRevisions:Object.fromEntries(projected.resources.map(r=>[r.id,r.revision]))}}
 const sourceId=embedded?`character:${card.id}:embedded-world-book`:book.id,id=`world-book:${sourceId}`
 return {service,book,store,id,sourceId,card,adapter,characters,assets,changeCard:()=>{card.data.characterBook.entries[0].content='UPDATED'},changeSelection:()=>{selection={...selection,selectionRevision:selection.selectionRevision+1}},ctx:()=>({...context,assets:assets()})}
}

test('all official decorators and title metadata classify unsupported without running JS',t=>{
 const names=['activate','dont_activate','message_formatting','generate_before','generate_after','render_before','render_after','dont_preload','preload','only_preload','initial_variables','always_enabled','private','if','iframe','preprocessing','future_feature']
 for(const name of names){
  const resource=row(`@@${name} arbitrary()\n<%- 1 %>`),meta=inspectTemplateMetadata(resource)
  assert.equal(meta.supported,false,name);assert.equal(meta.decorators[0].recognized,name!=='future_feature')
  assert.throws(()=>new PromptTemplateService({storageDir:temp(t),resources:[resource]}),{code:'UNSUPPORTED_EVENT'})
 }
 for(const name of ['[InitialVariables]','[GENERATE:3:BEFORE]','[GENERATE:REGEX:abc]','[RENDER:AFTER]','[PRELOAD]','@INJECT pos=0,role=system'])assert.equal(inspectTemplateMetadata({name}).supported,false,name)
 assert.equal(inspectTemplateMetadata({content:'@@@preload\nliteral'}).supported,true)
 assert.equal(inspectTemplateMetadata({content:'text\n@@render_after'}).supported,true)
 assert.equal(inspectTemplateMetadata({content:'@@preload\n@@render_after\nbody'}).decorators.length,2)
})

test('unused MVU never gets read; actual variables/getvar require a distinct trusted proof',async t=>{
 let calls=0,current=true
 const resource={...row('STATIC'),variableResourceId:'mvu:bound'}
 const service=new PromptTemplateService({storageDir:temp(t),resources:[resource],resolveVariables:async request=>{calls++;assert.equal(request.id,'mvu:bound');assert.equal(request.event.consumer.id,resource.id);assert.equal(request.event.usage,'prompt-template-dependency');return {id:request.id,adapterId:'tavern.mvu',content:{stat_data:{n:4}},revision:7,checkCurrent:()=>current}}})
 assert.equal((await service.resolve(context)).blocks[0].text,'STATIC');assert.equal(calls,0)
 const currentRow=service.read({id:resource.id});service.update({id:resource.id,content:'<%- getvar("stat_data.n") %>:<%- variables.stat_data.n %>',expectedRevision:currentRow.revision,operationId:'read'})
 const result=await service.resolve(context);assert.equal(result.blocks[0].text,'4:4');assert.equal(calls,1)
 assert.equal(result.diagnostics.find(d=>d.code==='TAVERN_MEMORY_DEPENDENCY_VERSION').revision,7)
 current=false;assert.throws(()=>service.validateResolved(context),{code:'SOURCE_POLICY_CHANGED'})
})

test('raw MVU access and a forged VM completion cannot bypass denied dependency use',async t=>{
 for(const content of ['<%- getvar("x") %>','<%- variables.x %>','<% try { getvar("x") } catch {} globalThis.__result={value:"forged"} %>']){
  let calls=0
  const service=new PromptTemplateService({storageDir:temp(t),resources:[{...row(content),variableResourceId:'mvu:bound'}],getVariables:()=>({content:{x:'RAW_SECRET'}}),resolveVariables:()=>{calls++;throw Object.assign(Error('denied'),{code:'MVU_USAGE_DENIED'})}})
  await assert.rejects(service.resolve(context),{code:'MVU_USAGE_DENIED'});assert.equal(calls,1)
 }
 const service=new PromptTemplateService({storageDir:temp(t),resources:[{...row('<%- getvar("x") %>'),variableResourceId:'mvu:bound'}],getVariables:()=>({content:{x:'RAW_SECRET'}})})
 await assert.rejects(service.resolve(context),{code:'TEMPLATE_DEPENDENCY_UNAVAILABLE'})
})

test('managed world-book deny/unload is enforced for getwi despite native template',async t=>{
 const f=fixture(t,'<%- await getwi("Book","Active") %>');manage(f.service.worldBooks,f.id)
 await assert.rejects(f.service.templates.resolve(f.ctx()),{code:'TEMPLATE_DEPENDENCY_DENIED'})
 const events=[],stop=f.service.worldBooks.registerUsage(request=>{events.push(request);return usage('world-book')})
 const output=await f.service.templates.resolve(f.ctx());assert.equal(output.blocks[0].text,'WORLD')
 assert.equal(events.length,1);assert.equal(events[0].id,f.id);assert.equal(events[0].event.consumer.id,'prompt-template:dependent')
 stop();await assert.rejects(f.service.templates.resolve(f.ctx()),{code:'TEMPLATE_DEPENDENCY_DENIED'})
})

test('world-book helper reads only already activated entries and only requested books',async t=>{
 const f=fixture(t,'<%- await getwi("Book","Inactive") %>');manage(f.service.worldBooks,f.id)
 let calls=0;f.service.worldBooks.registerUsage(()=>{calls++;return usage('world-book')})
 await assert.rejects(f.service.templates.resolve(f.ctx()),{code:'TEMPLATE_DEPENDENCY_NOT_ACTIVE'});assert.equal(calls,1)
 const current=f.service.templates.read({id:'prompt-template:dependent'})
 f.service.templates.update({id:current.id,expectedRevision:current.revision,operationId:'unused',content:'<%- typeof __data %>:<%- await getchar() %>'})
 assert.equal((await f.service.templates.resolve(f.ctx())).blocks[0].text,'undefined:');assert.equal(calls,1)
})

test('dependency leases include content/selection and survive until all sources have resolved',async t=>{
 for(const mutate of ['content','selection','policy']){
  const f=fixture(t,'<%- await getwi("Book","Active") %>');manage(f.service.worldBooks,f.id)
  let policyCurrent=true;f.service.worldBooks.registerUsage(()=>({...usage('world-book'),checkCurrent:()=>policyCurrent}))
  const input=f.ctx(),registry=createDefaultRegistry()
  registry.register({id:TEMPLATE_SOURCE,pluginId:'test',name:'Template',resolve:c=>f.service.templates.resolve(c),validateResolved:f.service.templates.validateResolved})
  registry.register({id:'later',pluginId:'test',name:'Later',resolve:async()=>{await Promise.resolve();if(mutate==='selection')f.changeSelection();else if(mutate==='policy')policyCurrent=false;else f.store.update(f.book.id,{name:'Renamed'});return {blocks:[]}}})
  const preset=structuredClone(BUILTINS[0]);preset.rules.push({id:'template',kind:TEMPLATE_SOURCE},{id:'later',kind:'later'})
  await assert.rejects(assembleRequestAsync({...input,preset,registry}),{code:'SOURCE_POLICY_CHANGED'})
 }
})

test('embedded book has stable catalog identity and shares native/managed activation and dependency policy',async t=>{
 const f=fixture(t,'<%- await getwi("Card","Active") %>',{embedded:true}),embedded=f.service.worldBooks.list().find(r=>r.origin.kind==='embedded-character-book')
 assert.deepEqual(embedded,JSON.parse(JSON.stringify(embedded)));assert.equal(embedded.id,f.id);assert.equal(embedded.content.book.entries.length,2);assert.deepEqual(embedded.execution.managementModes,['native','managed'])
 assert.equal(f.assets().loreEntries.length,1);assert.equal((await f.service.templates.resolve(f.ctx())).blocks[0].text,'EMBEDDED')
 manage(f.service.worldBooks,f.id)
 assert.equal(f.adapter.resolve({selection:{worldBookIds:[]},character:f.card}).loreEntries.length,0)
 await assert.rejects(f.service.templates.resolve(f.ctx()),{code:'TEMPLATE_DEPENDENCY_DENIED'})
 f.service.worldBooks.registerUsage(()=>usage('world-book'))
 const input=f.ctx(),registry=createDefaultRegistry({worldbookPolicy:(c,o)=>f.service.worldBooks.filter(c,o),worldbookValidateResolved:f.service.worldBooks.validateResolved})
 const result=await assembleRequestAsync({...input,preset:structuredClone(BUILTINS[0]),registry})
 assert.equal(result.messages.filter(m=>m.content.some(b=>b.text==='EMBEDDED')).length,1)
 assert.equal((await f.service.templates.resolve(input)).blocks[0].text,'EMBEDDED')
 f.changeCard();assert.throws(()=>f.service.templates.validateResolved(input),{code:'SOURCE_POLICY_CHANGED'})
 await assert.rejects(f.service.templates.resolve(input),{code:'SOURCE_CONTENT_CHANGED'})
 assert.throws(()=>f.service.validateAssembly({snapshots:[{source:{sourceId:'worldbook',resourceId:f.sourceId}}]}),{code:'MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED'})
 assert.notEqual(f.service.worldBooks.read({id:f.id}).revision,embedded.revision)
})

test('VM lookup cycles and repeated lookup attempts are bounded; raw bodies are not prefetched',async()=>{
 let calls=0
 await assert.rejects(renderTemplate('<% for(let i=0;i<1000;i++) { try { __dependency(JSON.stringify({kind:"variables",args:[i]})) } catch {} } %>',{}, {timeLimit:500,resolveDependency:()=>{calls++;return {}}}),{code:'TEMPLATE_DEPENDENCY_LIMIT'})
 assert(calls<=32)
 assert.equal(await renderTemplate('<%- typeof __input %>:<%- typeof __data %>',{variables:{private:'SECRET'}}),'undefined:undefined')
})

test('native dependency requires explicit revocable permission from every installed handler',async t=>{
 const f=fixture(t,'<%- await getwi("Book","Active") %>')
 const abstain=f.service.worldBooks.registerUsage(()=>undefined)
 await assert.rejects(f.service.templates.resolve(f.ctx()),{code:'TEMPLATE_DEPENDENCY_DENIED'})
 abstain();assert.equal((await f.service.templates.resolve(f.ctx())).blocks[0].text,'WORLD')
 const stop=f.service.worldBooks.registerUsage(()=>usage('world-book')),input=f.ctx()
 assert.equal((await f.service.templates.resolve(input)).blocks[0].text,'WORLD')
 stop();assert.throws(()=>f.service.templates.validateResolved(input),{code:'SOURCE_POLICY_CHANGED'})
})
