import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderTemplate, inspectTemplateMetadata, PromptTemplateService, TEMPLATE_SOURCE } from '../packages/prompt-template/index.js'
import { WorldBookStore } from '../packages/world-book-library/src/store.js'
import { WorldBookMemorySource } from '../packages/memory-sources/world-books.js'
import { createMemorySources } from '../packages/memory-sources/index.js'
import { createWorldBookAdapter } from '../packages/tavern-loader/src/world-book-adapter.js'
import { hash } from '../packages/memory-sources/policy.js'
import { createDefaultRegistry, assembleRequestAsync, BUILTINS } from '../packages/request-assembler/index.js'
const temp = t => { const dir = mkdtempSync(join(tmpdir(), 'template-test-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir }
const template = { id: 'prompt-template:fixture', name: 'Fixture', sessionIds: ['s'], content: '<% for(const x of [1,2]) { %><%- await Promise.resolve(x) %><% } %>:<%= getvar("name") %>', enabled: true, variables: { name: '<&' } }
const context = { sessionId: 's', turn: 1, step: 0, preview: true, assets: {}, nativeMessages: [], inputIds: [] }
const chain = type => (type === 'world-book' ? ['worldbook.activate','worldbook.emit'] : ['prompt_template.expand','prompt_template.emit']).map(operation => ({ operation }))
const lease = (type, checkCurrent = () => true) => ({ enabled: true, configRevision: 1, strategy: chain(type), checkCurrent })

test('async JS, code blocks, comments, escaping and bounded snapshot helpers', async () => {
  assert.equal(await renderTemplate(template.content, { variables: template.variables }), '12:&lt;&amp;')
  const source = '<%# ignored %><%- getvar("a[0].x") %>|<%- getvar("missing",{defaults:7}) %>|<%- await getwi("Book",4) %>|<%- await getpreset("Guide") %>|<%- await getchar() %>'
  const data = { variables: { a: [{ x: 3 }] }, worldBooks: [{ id: 'b', name: 'Book', entries: [{ uid: 4, content: 'LORE' }] }], preset: { prompts: [{ identifier: 'guide', name: 'Guide', content: 'PROMPT' }] }, character: { id: 'c', data: { description: 'CHAR' } } }
  const before = structuredClone(data)
  assert.equal(await renderTemplate(source, data), '3|7|LORE|PROMPT|CHAR')
  assert.deepEqual(data, before)
  assert.equal(await renderTemplate('a\n<% const a = 1; -%>\nb'), 'a\nb')
})

test('Host capabilities, scope claims, setters and imports remain unavailable', async () => {
  for (const script of ["process.cwd()", "require('node:fs')", "fetch('https://example.com')", "setvar('x',1)", "execute('/sys')", "getvar('x',{scope:'global'})", "getvar('constructor')", "await import('node:fs')"]) {
    await assert.rejects(renderTemplate(`<%- ${script} %>`), error => /^TEMPLATE_/.test(error.code))
  }
  assert.equal(await renderTemplate('<%- typeof process %>:<%- typeof fetch %>:<%- typeof globalThis.require %>'), 'undefined:undefined:undefined')
})

test('CPU, promises, output, syntax, abort and VM state isolation are bounded', async () => {
  await assert.rejects(renderTemplate('<% while(true){} %>', {}, { timeLimit: 20 }), /interrupt|limit|failed|budget/i)
  await assert.rejects(renderTemplate('<% await new Promise(()=>{}) %>'), { code: 'TEMPLATE_UNSETTLED' })
  await assert.rejects(renderTemplate('<%- "x".repeat(100) %>', {}, { maxOutput: 20 }), /output limit/)
  await assert.rejects(renderTemplate('<% invalid ('), /Unclosed/)
  await assert.rejects(renderTemplate('x', {}, { signal: AbortSignal.abort() }))
  await renderTemplate('<% globalThis.secret=42 %>')
  assert.equal(await renderTemplate('<%- typeof secret %>'), 'undefined')
})

test('metadata classification preserves original code and reports unsupported lifecycle', () => {
  const content = '<% if(arbitrary()){} %>'
  assert.deepEqual(inspectTemplateMetadata({ name: '[GENERATE:BEFORE] Guide', content }), { language:'ejs-style',originalTags:['GENERATE:BEFORE'],suggestedOn:'before_model_request',placementRequired:true,supported:true,diagnostics:[],content })
  assert.equal(inspectTemplateMetadata({ name: '[PRELOAD]', content }).supported, false)
})

test('resource list/read, CAS, idempotency, original text and restart ownership', async t => {
  const storageDir = temp(t), service = new PromptTemplateService({ storageDir, resources: [template] })
  const row = service.read({ id: template.id })
  assert.equal(row.content, template.content)
  assert.throws(() => service.read({ id: template.id, scope: { sessionId: 'other' } }), { code: 'FORBIDDEN' })
  const args = { id: row.id, content: 'changed <%- 3 %>', expectedRevision: row.revision, operationId: 'edit' }
  const edited = service.update(args)
  assert.deepEqual(service.update(args), edited)
  assert.throws(() => service.update({ ...args, operationId: 'stale' }), { code: 'REVISION_CONFLICT' })
  service.setManagementMode({ id: row.id, mode: 'managed', expectedRevision: edited.revision, operationId: 'manage' })
  const unconfigured = service.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  assert.equal((await service.resolve(context)).blocks.length, 0); unconfigured()
  const stop = service.registerUsage(() => lease('prompt-template'), { providerId: 'dsh-memory-manager' })
  const output = await service.resolve(context)
  assert.equal(output.blocks[0].text, 'changed 3')
  assert.equal(output.blocks[0].children[0].text, args.content)
  stop()
  const restored = new PromptTemplateService({ storageDir, resources: [] })
  assert.equal(restored.read({ id: row.id }).storedManagementMode, 'managed')
  assert.equal((await restored.resolve(context)).blocks.length, 1)
})

test('policy lease is rechecked after async variable reads and every resource', async t => {
  let current = true
  const service = new PromptTemplateService({ storageDir: temp(t), resources: [{ ...template, variableResourceId: 'mvu:test' }], resolveVariables: async () => { current = false; return { id:'mvu:test', adapterId:'tavern.mvu', content:{}, revision:1, checkCurrent:()=>true } } })
  const row = service.read({ id: template.id })
  service.setManagementMode({ id: row.id, mode: 'managed', expectedRevision: row.revision, operationId: 'manage' })
  service.registerUsage(() => lease('prompt-template', () => current))
  await assert.rejects(service.resolve(context), { code: 'SOURCE_POLICY_CHANGED' })
})

test('catalog presets validate and unsupported lifecycle/strategy/store remain rejected', t => {
  const service = new PromptTemplateService({ storageDir: temp(t), resources: [] })
  service.validateConfig(service.optionCatalog.presets[0].configuration)
  for (const config of [{ store: {} },{ retrieve: { on:'render',strategy:chain('prompt-template') } },{ retrieve:{ on:'before_model_request',strategy:[{operation:'execute'}] } }]) assert.throws(() => service.validateConfig(config))
})

test('world-book delivery policy gates both paths after one native activation', async t => {
  const storageDir = temp(t), store = new WorldBookStore(storageDir)
  const doc = store.import({ entries: { 0: { uid:0,key:['key'],content:'LORE',constant:true } } }, { name: 'Book' })
  const service = new WorldBookMemorySource({ storageDir, store }), id = `world-book:${doc.id}`
  const row = service.read({ id })
  service.setManagementMode({ id, mode:'managed',expectedRevision:row.revision,operationId:'manage' })
  const adapter = createWorldBookAdapter(store, { allowResource: (id,c) => service.allowNative(id,c.requestAssembly) })
  assert.equal(adapter.resolve({ selection:{worldBookIds:[doc.id]} }).loreEntries.length, 1)
  const projected = adapter.resolve({ selection:{worldBookIds:[doc.id]},requestAssembly:true })
  assert.equal(projected.loreEntries.length, 1)
  const input = { ...context, assets: { loreEntries: projected.loreEntries, worldBookIds:[doc.id], worldBookRevisions:{[doc.id]:hash(doc)} } }
  const registry = createDefaultRegistry({ worldbookPolicy:(c,o)=>service.filter(c,o) })
  const preset = structuredClone(BUILTINS[0])
  const unconfigured = service.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  let output = await assembleRequestAsync({ ...input, preset, registry })
  assert.equal(output.messages.length, 0)
  unconfigured()
  const stop = service.registerUsage(() => lease('world-book'), { providerId: 'dsh-memory-manager' })
  output = await assembleRequestAsync({ ...input, preset, registry })
  assert.equal(output.messages.filter(m=>m.content[0]?.text==='LORE').length,1)
  stop()
  assert.equal((await assembleRequestAsync({ ...input,preset,registry })).messages.length,1)
})

test('world-book stale activation cannot be attributed to a changed resource', async t => {
  const storageDir=temp(t),store=new WorldBookStore(storageDir),doc=store.import({ entries:{0:{uid:0,content:'one',constant:true}} })
  const service=new WorldBookMemorySource({storageDir,store}),output={blocks:[{id:'entry',type:'text',text:'one',source:{resourceId:doc.id}}]}
  await assert.rejects(service.filter({...context,assets:{worldBookRevisions:{[doc.id]:'stale'}}},output),{code:'SOURCE_CONTENT_CHANGED'})
})

test('real assembly registers template separately and records original plus expanded text', async t => {
  const storageDir=temp(t),store=new WorldBookStore(storageDir),service=createMemorySources({storageDir,store,resources:[template]})
  const registry=createDefaultRegistry()
  registry.register({id:TEMPLATE_SOURCE,pluginId:'pmp-dsh-tavern',name:'Template',resolve:c=>service.templates.resolve(c)})
  const preset=structuredClone(BUILTINS[0]);preset.rules.push({id:'template',kind:TEMPLATE_SOURCE,enabled:true,role:'system',lifetime:'request'})
  const result=await assembleRequestAsync({...context,preset,registry})
  assert.equal(result.nodes.at(-1).text,'12:&lt;&amp;')
  assert.equal(result.nodes.at(-1).children[0].text,template.content)
  assert.equal(service.templates.read({id:template.id}).content,template.content)
  const observations=[];service.templates.observe(f=>observations.push(f))
  const session={id:'s',snapshotEvents:()=>[{type:'request/assembly',seq:1,data:{messages:result.messages,metadata:{owner:'pmp-dsh-tavern',assembly:{...result,preview:false}}}}]}
  service.observeRequest({messages:result.messages},session)
  assert.equal(observations[0].phase,'applied')
})

test('a later async source cannot use an expired template lease', async t => {
  const service=new PromptTemplateService({storageDir:temp(t),resources:[template]})
  const row=service.read({id:template.id});service.setManagementMode({id:row.id,mode:'managed',expectedRevision:row.revision,operationId:'manage'})
  let current=true;service.registerUsage(()=>lease('prompt-template',()=>current))
  const registry=createDefaultRegistry()
  registry.register({id:TEMPLATE_SOURCE,pluginId:'test',name:'Template',resolve:c=>service.resolve(c),validateResolved:service.validateResolved})
  registry.register({id:'later',pluginId:'test',name:'Later',resolve:async()=>{await Promise.resolve();current=false;return {blocks:[]}}})
  const preset=structuredClone(BUILTINS[0]);preset.rules.push({id:'template',kind:TEMPLATE_SOURCE},{id:'later',kind:'later'})
  await assert.rejects(assembleRequestAsync({...context,preset,registry}),{code:'SOURCE_POLICY_CHANGED'})
})

test('managed world books cannot retain snapshots from native execution', t => {
  const storageDir=temp(t),store=new WorldBookStore(storageDir),doc=store.import({entries:{0:{uid:0,content:'one',constant:true}}})
  const service=createMemorySources({storageDir,store}),id=`world-book:${doc.id}`,row=service.worldBooks.read({id})
  service.worldBooks.setManagementMode({id,mode:'managed',expectedRevision:row.revision,operationId:'manage'})
  service.worldBooks.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  assert.throws(()=>service.validateAssembly({snapshots:[{source:{sourceId:'worldbook',resourceId:doc.id}}]}),{code:'MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED'})
})
