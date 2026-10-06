import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { AssemblyPanel } from '../packages/request-assembler/client.js'
import { BUILTINS, createDefaultRegistry } from '../packages/request-assembler/index.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'

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
  registry.register({ id: 'tavern.mvu/state', pluginId: 'pmp-dsh-tavern', name: 'MVU state', roles: ['system'], lifetimes: ['request'], resolve: () => ({ blocks: [] }) })
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
  assert(mvuRow.textContent.includes(locale === 'zh-CN' ? '不编辑变量' : 'does not edit variables'))
  assert([...mvuRow.querySelectorAll('button')].some(button => button.textContent === (locale === 'zh-CN' ? '删除' : 'Delete')))
  assert.equal(Boolean(container.querySelector('#dta-add-source option[value="tavern.mvu/state"]')), false)
  assert.deepEqual(presets, original)
  assert(calls.length > 0 && calls.every(call => call.method === 'GET'))
})

// Integration of the extracted component: source descriptors drive parser discovery.
for (const nativeOnly of [false, true]) test(`extracted view exposes one parser editor and resets the available default: native=${nativeOnly}`, async t => {
  const { AssemblyPanel: Panel } = await import('dsh-prompt-assembler/client')
  const { createDshRegistry, BUILTINS: NATIVE } = await import('dsh-prompt-assembler')
  const keys = ['window', 'document', 'fetch', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, getComputedStyle: () => ({ display: 'block' }), IS_REACT_ACT_ENVIRONMENT: true })
  const registry = nativeOnly ? createDshRegistry() : createDefaultRegistry()
  registry.register({id:'pmp-dsh-tavern/prompt-template',pluginId:'pmp-dsh-tavern',name:'Empty templates',roles:['system'],lifetimes:['request'],moduleAvailable:()=>false,resolve:()=>({blocks:[]}),parseText:(_c,r)=>({blocks:[{id:'text',type:'text',text:r.text}]})})
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
  assert.equal(chooser.value, nativeOnly ? 'dsh.text' : 'custom')
  assert.equal(container.querySelector('#dta-add-source'), null, 'already listed builtins and parser-only providers are absent from the module picker')
  await act(() => Simulate.click([...container.querySelectorAll('button')].find(b => b.textContent === '添加自定义文本')))
  const row = [...container.querySelectorAll('.dta-row')].at(-1)
  assert(row.textContent.includes('文本解析器'))
  assert.equal(row.querySelectorAll('textarea').length, 1)
  assert(chooser.querySelector('option[value="pmp-dsh-tavern/prompt-template"]'), 'empty modules can still expose a real text parser')
  const parser = row.querySelector('.dta-fields select')
  await act(() => Simulate.change(parser, {target:{value:'pmp-dsh-tavern/prompt-template'}}))
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
