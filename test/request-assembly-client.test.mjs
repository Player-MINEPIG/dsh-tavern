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
  ['zh-CN', '添加来源（已注册，未加入当前策略）', 'MVU 状态与更新指令', '选择来源并添加、保存规则、应用到当前会话后', '添加'],
  ['en', 'Add a source (registered, not in this strategy)', 'MVU state and update instructions', 'Select and add a source, save the rules, then apply them to the current session', 'Add'],
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
