import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { MvuRoundSection, mvuStyles } from '../packages/tavern-trace/src/mvu-view.js'
import { installTavernTraceStyles } from '../packages/tavern-trace/src/client.js'
import { setClientUiSettings } from '../packages/client/src/i18n.js'

const variables = count => ({ stat_data: Object.fromEntries(Array.from({ length: count }, (_, i) => [`value${String(i).padStart(2, '0')}`, i])), mvu_schema: { owned: true } })
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function fixture(t, { count = 45, latest = true, intercept } = {}) {
  const previous = Object.fromEntries(['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]))
  const { window, document } = parseHTML('<html><head></head><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, IS_REACT_ACT_ENVIRONMENT: true })
  setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
  const calls = [], content = variables(count)
  const history = { key: 'reply', revision: 3, source: { turn: 1 }, variables: variables(count), beforeAvailable: false }
  history.variables.stat_data.value00 = -1
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url, 'http://fixture'), action = parsed.pathname.split('/').at(-1)
    const body = options.body ? JSON.parse(options.body) : null
    const scope = body?.scope ?? JSON.parse(parsed.searchParams.get('scope'))
    const record = { id: `mvu:${scope.sessionId}`, name: 'Test variables', revision: 4, currentRevision: 4, capabilities: { edit: true }, content }
    const call = { action, scope, body, signal: options.signal }; calls.push(call)
    const intercepted = await intercept?.(call)
    if (intercepted) return intercepted
    if (action === 'resources') return response({ records: [record] })
    if (action === 'history') return response({ versions: [history] })
    if (action === 'facts') return response({ records: [], maxRecords: 2048 })
    if (action === 'resource') return response({ record })
    if (action === 'update') return response({ content: body.content, revision: 5 })
    throw new Error(`Unexpected request ${action}`)
  }
  const container = document.getElementById('root'), root = createRoot(container)
  let props = { sessionId: 's', turn: 1, latest, running: false }
  const render = async changes => { props = { ...props, ...changes }; await act(() => root.render(h(MvuRoundSection, props))) }
  t.after(async () => {
    await act(() => root.unmount())
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value
    }
  })
  await render()
  return {
    container, document, calls, render,
    rows: () => [...container.querySelectorAll('.dtmvu-variables tbody tr')],
    button: name => [...container.querySelectorAll('button')].find(button => button.textContent === name),
    click: async element => { assert.ok(element); await act(() => Simulate.click(element)) },
    change: async (element, value) => { assert.ok(element); await act(() => Simulate.change(element, { target: { value } })) },
  }
}

test('20-row pagination covers boundaries, filtering, no results and scope reset', async t => {
  const ui = await fixture(t)
  assert.equal(ui.rows().length, 20)
  assert.equal(ui.rows()[0].cells?.[0]?.textContent ?? ui.rows()[0].firstElementChild.textContent, '/stat_data/value00')
  assert.equal(ui.button('上一页').disabled, true)
  await ui.click(ui.button('下一页')); assert.equal(ui.rows().length, 20)
  await ui.click(ui.button('下一页')); assert.equal(ui.rows().length, 5); assert.equal(ui.button('下一页').disabled, true)
  assert.ok(ui.container.textContent.includes('第 3 / 3 页 · 45 条 · 每页 20 条'))
  await ui.change(ui.container.querySelector('input'), 'value0')
  assert.equal(ui.rows().length, 10); assert.ok(ui.container.textContent.includes('第 1 / 1 页 · 10 条'))
  await ui.change(ui.container.querySelector('input'), 'missing')
  assert.equal(ui.rows().length, 1); assert.equal(ui.rows()[0].textContent, '没有匹配的变量')
  assert.ok(ui.container.textContent.includes('第 1 / 1 页 · 0 条'))
  assert.equal(ui.button('上一页').disabled, true); assert.equal(ui.button('下一页').disabled, true)
  await ui.render({ sessionId: 'other' })
  assert.equal(ui.container.querySelector('input').value, ''); assert.equal(ui.rows().length, 20)
  assert.ok(ui.container.textContent.includes('第 1 / 3 页'))
})

test('latest current read enables row-end inline edit and shows source-validated saved value', async t => {
  const ui = await fixture(t, { intercept: call => call.action === 'update' ? response({ content: { ...call.body.content, stat_data: { ...call.body.content.stat_data, value00: 42 } }, revision: 7 }) : null })
  assert.equal(ui.container.querySelector('select').value, 'current')
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '0')
  assert.ok(!ui.button('编辑当前变量'))
  await ui.click(ui.rows()[0].querySelector('button'))
  assert.ok(ui.rows()[0].querySelector('td:nth-child(2) textarea'))
  assert.equal(ui.rows()[0].querySelector('td:last-child button').textContent, '保存')
  assert.equal(ui.button('下一页').disabled, true)
  await ui.change(ui.container.querySelector('textarea'), '41')
  await ui.click(ui.button('保存'))
  assert.equal(ui.container.querySelector('textarea'), null)
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '42')
  const update = ui.calls.find(call => call.action === 'update').body
  assert.equal(update.expectedRevision, 4); assert.equal(update.content.stat_data.value00, 41)
  assert.deepEqual(update.content.mvu_schema, { owned: true })
  assert.deepEqual(update.scope, { authority: 'local', sessionId: 's' })
  assert.ok(update.operationId); assert.ok(ui.container.textContent.includes('已保存，来源版本 r7'))
})

test('rejected saves retain draft and stable retry ID; cancel and refresh read current again', async t => {
  let failure = 'MVU_SCHEMA'
  const ui = await fixture(t, { intercept: call => call.action === 'update' ? response({ code: failure, error: 'Rejected fixture' }, 409) : null })
  await ui.click(ui.rows()[0].querySelector('button'))
  await ui.change(ui.container.querySelector('textarea'), '-4')
  await ui.click(ui.button('保存'))
  assert.equal(ui.container.querySelector('textarea').value, '-4'); assert.ok(ui.container.querySelector('[role=alert]').textContent.includes('MVU_SCHEMA'))
  failure = 'REVISION_CONFLICT'; await ui.click(ui.button('保存'))
  assert.equal(ui.container.querySelector('textarea').value, '-4'); assert.ok(ui.container.querySelector('[role=alert]').textContent.includes('版本冲突'))
  const saves = ui.calls.filter(call => call.action === 'update')
  assert.equal(saves[0].body.operationId, saves[1].body.operationId)
  await ui.change(ui.container.querySelector('textarea'), 'invalid JSON'); await ui.click(ui.button('保存'))
  assert.equal(ui.calls.filter(call => call.action === 'update').length, 2)
  assert.equal(ui.container.querySelector('textarea').value, 'invalid JSON')
  await ui.click(ui.button('取消')); assert.equal(ui.container.querySelector('textarea'), null)
  await ui.click(ui.button('刷新')); assert.equal(ui.calls.filter(call => call.action === 'resource').length, 2)
})

test('selected history remains read-only across refresh; old rounds never read current', async t => {
  const ui = await fixture(t)
  await ui.click(ui.button('下一页'))
  await ui.change(ui.container.querySelector('select'), 'reply')
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '-1')
  assert.ok(ui.container.textContent.includes('第 1 / 3 页'))
  assert.equal(ui.container.querySelector('.dtmvu-row-actions button'), null)
  await ui.render({ lastVisibleSeq: 8 })
  assert.equal(ui.container.querySelector('select').value, 'reply')
  assert.equal(ui.container.querySelector('.dtmvu-row-actions button'), null)
  await ui.render({ sessionId: 'historical', latest: false })
  assert.equal(ui.container.querySelector('select').value, '')
  assert.equal(ui.calls.filter(call => call.action === 'resource' && call.scope.sessionId === 'historical').length, 0)
  assert.equal(ui.container.querySelector('.dtmvu-row-actions button'), null)
})

test('failed current read does not substitute history or enable editing', async t => {
  const ui = await fixture(t, { intercept: call => call.action === 'resource' ? response({ code: 'SOURCE_UNAVAILABLE', error: 'Unavailable' }, 503) : null })
  assert.equal(ui.container.querySelector('select').value, 'current')
  assert.equal(ui.container.querySelector('.dtmvu-variables'), null)
  assert.ok(ui.container.textContent.includes('SOURCE_UNAVAILABLE')); assert.ok(ui.container.textContent.includes('暂不可编辑'))
  await ui.change(ui.container.querySelector('select'), '')
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '-1')
  assert.equal(ui.container.querySelector('.dtmvu-row-actions button'), null)
})

test('running state disables save and switching scope aborts in-flight save without leaking its result', async t => {
  let release
  const ui = await fixture(t, { intercept: call => call.action === 'update' ? new Promise(resolve => { release = resolve }) : null })
  await ui.click(ui.rows()[0].querySelector('button'))
  await ui.change(ui.container.querySelector('textarea'), '9')
  await ui.render({ running: true }); assert.equal(ui.button('保存').disabled, true); assert.equal(ui.container.querySelector('textarea').value, '9')
  await ui.render({ running: false }); await ui.click(ui.button('保存'))
  const update = ui.calls.find(call => call.action === 'update')
  await ui.render({ sessionId: 'other' })
  assert.equal(update.signal.aborted, true); assert.equal(ui.container.querySelector('textarea'), null)
  await act(() => release(response({ content: variables(1), revision: 999 })))
  assert.ok(!ui.container.textContent.includes('r999')); assert.ok(ui.container.textContent.includes('mvu:other'))
})

test('Trace stylesheet refresh reuses only its owned node and includes MVU table styling', async t => {
  const ui = await fixture(t, { latest: false })
  const old = ui.document.createElement('style'); old.dataset.pluginCss = 'pmp-dsh-tavern-trace'; old.textContent = '.old{}'; ui.document.head.append(old)
  const other = ui.document.createElement('style'); other.dataset.pluginCss = 'another-plugin'; other.textContent = '.keep{}'; ui.document.head.append(other)
  installTavernTraceStyles(); installTavernTraceStyles()
  assert.equal(ui.document.querySelectorAll('style[data-plugin-css="pmp-dsh-tavern-trace"]').length, 1)
  assert.equal(ui.document.querySelector('style[data-plugin-css="pmp-dsh-tavern-trace"]'), old)
  assert.ok(old.textContent.includes(mvuStyles)); assert.equal(other.textContent, '.keep{}')
})

test('new source revisions refresh idle current views but preserve and identify stale drafts', async t => {
  let revision = 4
  const ui = await fixture(t, { intercept: call => {
    const content = { ...variables(45), stat_data: { ...variables(45).stat_data, value00: revision } }
    const record = { id: `mvu:${call.scope.sessionId}`, name: 'Current revisions', revision, currentRevision: revision, capabilities: { edit: true }, content }
    if (call.action === 'resources') return response({ records: [record] })
    if (call.action === 'resource') return response({ record })
  } })
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '4')
  await ui.render({ running: true })
  revision = 5; await ui.render({ running: false, lastVisibleSeq: 9 })
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '5')
  assert.equal(ui.calls.filter(call => call.action === 'resource').length, 2)
  await ui.click(ui.rows()[0].querySelector('button')); await ui.change(ui.container.querySelector('textarea'), '99')
  revision = 6; await ui.render({ lastVisibleSeq: 10 })
  assert.equal(ui.container.querySelector('textarea').value, '99')
  assert.equal(ui.calls.filter(call => call.action === 'resource').length, 2)
  assert.ok(ui.container.textContent.includes('来源已更新到 r6，草稿仍基于 r5'))
  await ui.click(ui.button('取消'))
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '6')
  assert.equal(ui.calls.filter(call => call.action === 'resource').length, 3)
  await ui.change(ui.container.querySelector('select'), 'reply')
  revision = 7; await ui.render({ lastVisibleSeq: 11 })
  assert.equal(ui.container.querySelector('select').value, 'reply')
  assert.equal(ui.rows()[0].querySelector('pre').textContent, '-1')
  assert.equal(ui.calls.filter(call => call.action === 'resource').length, 3)
})
