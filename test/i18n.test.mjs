import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createLocalizedElement,
  setClientUiSettings,
  translate,
  translateVisibleText,
} from '../packages/client/src/i18n.js'

test.afterEach(() => setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false }))

test('catalog switches Simplified Chinese and English with interpolation', () => {
  assert.equal(translate('settings.title'), 'Tavern 界面设置')
  setClientUiSettings({ locale: 'en', scale: 1.15 }, { announce: false })
  assert.equal(translate('settings.title'), 'Tavern UI settings')
  assert.equal(translate('settings.currentScale', { scale: 115 }), 'Current scale: 115%')
  assert.equal(translateVisibleText('当前会话：session-a；绑定：未绑定用户'), 'Current session: session-a; Binding: No user bound')
})

test('missing catalog keys use a stable localized fallback and never expose the raw key', () => {
  assert.equal(translate('catalog.key.that.does.not.exist'), '界面文本暂不可用')
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  assert.equal(translate('catalog.key.that.does.not.exist'), 'Interface text unavailable')
  assert.notEqual(translate('catalog.key.that.does.not.exist'), 'catalog.key.that.does.not.exist')
})

test('localized element factory translates UI copy and accessibility text but preserves resource values', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  const createElement = (type, props, ...children) => ({ type, props, children })
  const h = createLocalizedElement(createElement)
  const element = h('input', {
    title: '关闭用户面板',
    'aria-label': '关闭用户侧边栏',
    value: '中文角色资源名',
  }, '刷新')
  assert.equal(element.props.title, 'Close user panel')
  assert.equal(element.props['aria-label'], 'Close user sidebar')
  assert.equal(element.props.value, '中文角色资源名')
  assert.deepEqual(element.children, ['Refresh'])
})

test('all existing Tavern React clients share the catalog-backed element boundary', () => {
  for (const file of [
    '../packages/client/src/index.js',
    '../packages/preset/src/client.js',
    '../packages/character/src/client.js',
    '../packages/world-book-library/src/client.js',
    '../packages/user/src/client.js',
    '../packages/tavern-trace/src/client.js',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /createLocalizedElement/)
    assert.doesNotMatch(source, /createElement as h/)
  }
})
