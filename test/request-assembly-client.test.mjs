import { CoreRequestBackend } from 'dsh-prompt-assembler/core-backend'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { AssemblyPanel } from '../packages/request-assembler/client.js'
import { BUILTINS, createDefaultRegistry } from '../packages/request-assembler/index.js'
import { registerTavernMvuSource, registerTavernTemplateSource } from 'dsh-prompt-assembler/adapters/tavern'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AssemblyPresetStore } from '../packages/request-assembler/store.js'
import { RequestAssembler } from '../packages/request-assembler/runtime.js'
import { createAssemblyApi } from 'dsh-prompt-assembler/server'

test('standalone and embedded panels share last applied snapshot and refresh without losing drafts', async t => {
  const { AssemblyPanel: Standalone } = await import('dsh-prompt-assembler/panel')
  const directory = mkdtempSync(join(tmpdir(), 'shared-panel-'))
  const keys = ['window', 'document', 'fetch', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]])), settings = getClientUiSettings()
  const { window, document } = parseHTML('<html><body><div id="standalone"></div><div id="embedded"></div></body></html>')
  Object.assign(globalThis, { window, document, getComputedStyle: () => ({ display: 'block' }), IS_REACT_ACT_ENVIRONMENT: true })
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  const store = new AssemblyPresetStore(directory)
  const a = store.save({ ...BUILTINS[0], name: 'From sidebar' }), b = store.save({ ...BUILTINS[0], name: 'From Tavern' })
  store.apply('shared', a.id)
  const runtime = new RequestAssembler({ ctx: { get: () => ({ requestAssemblyVersion: 1 }) }, store, resources: { compile: () => ({ assemblyInput: {} }) } })
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  const api = createAssemblyApi({ store, runtime, agents: () => new Map(), sessions: () => ({ get: () => null }) })
  const fetcher = async (url, options = {}) => {
    assert.ok(url.startsWith('/dsh-prompt-assembler/api/v1/assembly-presets'))
    const req = Readable.from(options.body ? [Buffer.from(options.body)] : [])
    Object.assign(req, { url, method: options.method ?? 'GET' })
    let response
    await api(req, { setHeader() {}, end(body) { response = new Response(body, { status: this.statusCode, headers: { 'Content-Type': 'application/json' } }) } })
    return response
  }
  globalThis.fetch = fetcher
  const one = document.getElementById('standalone'), two = document.getElementById('embedded'), roots = [createRoot(one), createRoot(two)]
  const button = (container, text) => [...container.querySelectorAll('button')].find(b => b.textContent === text)
  const select = container => container.querySelector('.dta-library select') ?? container.querySelector('select')
  t.after(async () => { await act(() => roots.forEach(root => root.unmount())); setClientUiSettings(settings, { announce: false }); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } rmSync(directory, { recursive: true, force: true }) })
  await act(() => { roots[0].render(h(Standalone, { sessionId: 'shared', standalone: true, locale: 'en', fetcher, close() {} })); roots[1].render(h(AssemblyPanel, { sessionId: 'shared', close() {} })) })
  await act(() => Simulate.change(select(two), { target: { value: b.id } }))
  await act(() => Simulate.click(button(two, 'Apply to this session')))
  assert.equal(store.selection('shared').id, b.id)
  for (const container of [one, two]) assert.ok(container.textContent.includes('Applied: From Tavern'))
  const name = one.querySelector('.dta-grid label input')
  await act(() => Simulate.change(name, { target: { value: 'Sidebar draft' } }))
  assert.equal(store.selection('shared').id, b.id)
  await act(() => Simulate.click(button(two, 'Apply to this session')))
  assert.equal(one.querySelector('.dta-grid label input').value, 'Sidebar draft')
  await act(() => Simulate.click(button(one, 'Save rules')))
  assert.equal(store.get(a.id).name, 'Sidebar draft')
  assert.equal(store.selection('shared').id, b.id)
  assert.ok(two.textContent.includes('Sidebar draft'), 'other panel refreshes the library')
  await act(() => Simulate.click(button(one, 'Apply to this session')))
  assert.equal(store.selection('shared').name, 'Sidebar draft')
  for (const container of [one, two]) assert.ok(container.textContent.includes('Applied: Sidebar draft'))
})

for (const [locale, label, sourceName, help, add] of [
  ['zh-CN', '添加模块（当前有独立内容）', 'MVU 状态与更新指令', '模块只列出当前提供独立内容的来源', '添加'],
  ['en', 'Add a module (current independent content)', 'MVU state and update instructions', 'Modules list sources with independent content', 'Add'],
]) test(`assembly source discovery uses clear localized labels without changing presets: ${locale}`, async t => {
  const keys = ['window', 'document', 'fetch', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]])), settings = getClientUiSettings()
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, getComputedStyle: () => ({ display: 'block' }), IS_REACT_ACT_ENVIRONMENT: true })
  setClientUiSettings({ locale, scale: 1 }, { announce: false })
  const registry = createDefaultRegistry()
  registerTavernMvuSource(registry, { hasModule: () => true, resolveRequest: () => ({ blocks: [] }), validateResolved() {} })
  const presets = structuredClone(BUILTINS), original = structuredClone(presets), calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET' })
    assert.equal(options.method ?? 'GET', 'GET', 'opening or adding to a draft must not save or apply a preset')
    return new Response(JSON.stringify({ presets, sources: registry.list(), selection: presets[0], capability: true }), { headers: { 'Content-Type': 'application/json' } })
  }
  const container = document.getElementById('root'), root = createRoot(container)
  t.after(async () => {
    await act(() => root.unmount())
    setClientUiSettings(settings, { announce: false })
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value
    }
  })
  await act(() => root.render(h(AssemblyPanel, { sessionId: 's', close() {} })))
  assert.equal(container.querySelector('label[for="dta-add-source"]').textContent, label)
  assert(container.textContent.includes(help))
  const chooser = container.querySelector('#dta-add-source')
  assert.equal(chooser.querySelector('option[value="tavern.mvu/state"]').textContent, `DSH Tavern · ${sourceName}`)
  assert.equal(container.querySelectorAll('.dta-row').length, original[0].rules.length)
  assert(!original.some(preset => preset.rules.some(rule => rule.kind === 'tavern.mvu/state')))
  await act(() => Simulate.change(chooser, { target: { value: 'tavern.mvu/state' } }))
  const addButton = [...container.querySelectorAll('button')].find(button => button.textContent === add)
  await act(() => Simulate.click(addButton))
  assert.equal(container.querySelectorAll('.dta-row').length, original[0].rules.length + 1)
  assert([...container.querySelectorAll('.dta-row .dta-name')].some(element => element.textContent.startsWith(sourceName)))
  const mvuRow = [...container.querySelectorAll('.dta-row')].at(-1)
  assert.equal(mvuRow.querySelectorAll('textarea').length, 0, 'MVU generates its content and ignores rule text')
  for (const text of (locale === 'zh-CN' ? ['包含内容', '内容来源', '手动编辑', '修改入口', 'stat_data', 'InitVar', 'instructions', 'Tavern Trace', '没有界面编辑器'] : ['Included content', 'Content origin', 'Manual editing', 'Where to edit', 'stat_data', 'InitVar', 'instructions', 'Tavern Trace', 'no UI editor'])) assert(mvuRow.textContent.includes(text), text)
  assert([...mvuRow.querySelectorAll('button')].some(button => button.textContent === (locale === 'zh-CN' ? '删除' : 'Delete')))
  assert.equal(Boolean(container.querySelector('#dta-add-source option[value="tavern.mvu/state"]')), false)
  assert.deepEqual(presets, original)
  assert(calls.length > 0 && calls.every(call => call.method === 'GET'))
})

// Integration of the extracted component: source descriptors drive parser discovery.
for (const nativeOnly of [false, true]) test(`extracted view exposes one parser editor and resets the available default: native=${nativeOnly}`, async t => {
  const { AssemblyPanel: Panel } = await import('dsh-prompt-assembler/panel')
  const { createDshRegistry, BUILTINS: NATIVE } = await import('dsh-prompt-assembler')
  const keys = ['window', 'document', 'fetch', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, getComputedStyle: () => ({ display: 'block' }), IS_REACT_ACT_ENVIRONMENT: true })
  const registry = nativeOnly ? createDshRegistry() : createDefaultRegistry()
  if (!nativeOnly) registerTavernTemplateSource(registry, { hasModule:()=>false, resolve:()=>({blocks:[]}), parseText:(_c,r)=>({blocks:[{id:'text',type:'text',text:r.text}]}), validateResolved() {} })
  registry.register({id:'thirdparty.strict',pluginId:'thirdparty',name:'Strict text',roles:['system'],lifetimes:['request'],supportsModule:false,parseText:(_c,r)=>({blocks:[{id:'text',type:'text',text:r.text}]})})
  registry.register({id:'memory-manager.resources',pluginId:'dsh-memory-manager',name:'Empty managed resources',moduleAvailable:()=>false,resolve:()=>({blocks:[]})})
  const presets = structuredClone(nativeOnly ? NATIVE : BUILTINS), calls = []
  const fetcher = async (url, options = {}) => {
    calls.push({ url, ...options })
    const body = options.body ? JSON.parse(options.body) : {}
    return new Response(JSON.stringify(options.method === 'PUT' ? { selection: presets.find(p => p.id === body.id) } : { presets, sources: registry.list(), defaultPresetId: presets[0].id, selection: presets[0], capability: true }), { headers: { 'Content-Type': 'application/json' } })
  }
  const container = document.getElementById('root'), root = createRoot(container)
  t.after(async () => { await act(() => root.unmount()); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } })
  await act(() => root.render(h(Panel, { sessionId: 'fixture', fetcher, close() {} })))
  const chooser = container.querySelector('#dta-add-parser')
  assert.equal(chooser.value, nativeOnly ? 'dsh.text' : 'tavern.text')
  assert.equal(container.querySelector('#dta-add-source'), null, 'already listed builtins and parser-only providers are absent from the module picker')
  await act(() => Simulate.click([...container.querySelectorAll('button')].find(b => b.textContent === '添加自定义文本')))
  const row = [...container.querySelectorAll('.dta-row')].at(-1)
  assert(row.textContent.includes('文本解析器'))
  assert.equal(row.querySelectorAll('textarea').length, 1)
  for (const id of ['custom','preset','pmp-dsh-tavern/prompt-template']) assert.equal(chooser.querySelector(`option[value="${id}"]`),null, 'legacy Tavern parser aliases are hidden')
  assert(chooser.querySelector('option[value="dsh.text"]'))
  assert.equal(!!chooser.querySelector('option[value="tavern.text"]'),!nativeOnly)
  const parser = row.querySelector('.dta-fields select')
  await act(() => Simulate.change(parser, {target:{value:'thirdparty.strict'}}))
  assert.equal(row.querySelectorAll('textarea').length,1,'supplied-content hints do not hide a parser text editor')
  assert.equal(row.querySelector('.dta-grid select').value,'system','switching a parser adjusts unsupported role settings')
  assert.equal(row.querySelector('.dta-properties select').value,'request')
  // Saved strategies have no draft edits: reload the session component before reset.
  await act(() => root.render(h(Panel, { sessionId: 'fresh-fixture', fetcher, close() {} })))
  await act(() => Simulate.click([...container.querySelectorAll('button')].find(b => b.textContent === '应用默认装配策略')))
  assert.equal(JSON.parse(calls.findLast(c => c.method === 'PUT').body).id, presets[0].id)
  await act(() => Simulate.click([...container.querySelectorAll('button')].find(b => b.textContent === '创建')))
  assert.equal(container.querySelectorAll('.dta-row').length, presets[0].rules.length, 'new strategy starts from the available default')
  assert.equal(container.querySelector('.dta-grid label input').disabled, false, 'new strategies can be named')
  assert(!container.textContent.includes('内置策略不能改名或删除'))
  await act(() => Simulate.click([...container.querySelectorAll('button')].find(b => b.textContent === '根据当前配置预览')))
  const created = JSON.parse(calls.findLast(c => c.url.endsWith('/preview')).body).preset
  assert.equal(created.format, presets[0].format); assert.equal(created.rules.length, presets[0].rules.length)
})

test('legacy text aliases preview through one parser without changing saved rules or source modules',async t=>{
 const {AssemblyPanel:Panel}=await import('dsh-prompt-assembler/panel')
 const keys=['window','document','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]))
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,getComputedStyle:()=>({display:'block'}),IS_REACT_ACT_ENVIRONMENT:true})
 const registry=createDefaultRegistry();registerTavernTemplateSource(registry,{hasModule:()=>false,resolve:()=>({blocks:[]}),parseText:()=>({blocks:[]}),validateResolved(){}})
 const preset=structuredClone(BUILTINS[0]);preset.rules.push({id:'old-custom',kind:'custom',role:'user',lifetime:'request',text:'{{user}}',enabled:true},{id:'old-ejs',kind:'pmp-dsh-tavern/prompt-template',inputMode:'text',role:'preserve',lifetime:'request',text:'<%- 1 %>',enabled:true})
 const before=structuredClone(preset),calls=[]
 const fetcher=async(url,options={})=>{calls.push({url,...options});return new Response(JSON.stringify(options.method==='POST'?{preview:{nodes:[],messages:[],diagnostics:[]}}:{presets:[preset],selection:preset,sources:registry.list(),capability:true}),{headers:{'Content-Type':'application/json'}})}
 const root=createRoot(document.getElementById('root'));t.after(async()=>{await act(()=>root.unmount());for(const k of keys){if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k]}})
 await act(()=>root.render(h(Panel,{sessionId:'s',fetcher,close(){}})))
 assert.deepEqual([...document.querySelectorAll('#dta-add-parser option')].map(o=>o.value),['dsh.text','tavern.text'])
 await act(()=>Simulate.click([...document.querySelectorAll('button')].find(b=>b.textContent==='根据当前配置预览')))
 const sent=JSON.parse(calls.findLast(c=>c.method==='POST').body).preset
 assert.equal(sent.rules.find(r=>r.id==='preset').kind,'preset','resource source rules retain their identity')
 assert.equal(sent.rules.find(r=>r.id==='old-custom').kind,'tavern.text')
 assert.equal(sent.rules.find(r=>r.id==='old-ejs').kind,'tavern.text');assert.equal(sent.rules.find(r=>r.id==='old-ejs').role,'preserve')
 assert.deepEqual(preset,before);assert(calls.every(c=>!c.method||c.method==='GET'||c.url.endsWith('/preview')))
})
