import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createLocalizedElement,
  rawText,
  setClientUiSettings,
  translate,
  translateVisibleText,
  uiMessage,
  uiText,
  unwrapText,
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

test('branded runtime children preserve resource names that collide with UI copy', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  const createElement = (type, props, ...children) => ({ type, props, children })
  const h = createLocalizedElement(createElement)
  for (const name of ['用户', '世界书', '角色卡', '预设', '角色卡/预设']) {
    assert.deepEqual(h('option', null, rawText(name)).children, [name])
    assert.deepEqual(h('span', null, rawText(name)).children, [name])
  }
})

test('UI templates localize literal copy without translating interpolated runtime data', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  assert.equal(unwrapText(uiText`当前会话：${'用户'}；绑定：${'世界书'}`), 'Current session: 用户; Binding: 世界书')
  const createElement = (type, props, ...children) => ({ type, props, children })
  const h = createLocalizedElement(createElement)
  assert.equal(h('img', { alt: uiText`${'角色卡'} 角色卡图片` }).props.alt, '角色卡 Character card image')
})

test('English static creation copy is complete and contains no Han characters', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  for (const [source, expected] of [['新预设', 'New preset'], ['新提示词', 'New prompt'], ['新用户', 'New user']]) {
    const translated = translateVisibleText(source)
    assert.equal(translated, expected)
    assert.doesNotMatch(translated, /[\u3400-\u9fff]/u)
  }
})

test('all existing Tavern React clients share the catalog-backed element boundary', () => {
  for (const file of [
    '../packages/client/src/index.js',
    '../packages/preset/src/client.js',
    '../packages/character/src/client.js',
    '../packages/world-book-library/src/client.js',
    '../packages/user/src/client.js',
    '../packages/session-template/src/client.js',
    '../packages/tavern-trace/src/client.js',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /createLocalizedElement/)
    assert.match(source, /rawText/)
    assert.match(source, /uiText/)
    assert.doesNotMatch(source, /createElement as h/)
  }
})

test('resource clients explicitly protect dynamic child, diagnostic, error, and comment surfaces', () => {
  const sources = Object.fromEntries([
    ['shell', '../packages/client/src/index.js'],
    ['preset', '../packages/preset/src/client.js'],
    ['character', '../packages/character/src/client.js'],
    ['worldBook', '../packages/world-book-library/src/client.js'],
    ['user', '../packages/user/src/client.js'],
    ['sessionTemplate', '../packages/session-template/src/client.js'],
    ['trace', '../packages/tavern-trace/src/client.js'],
  ].map(([name, file]) => [name, readFileSync(new URL(file, import.meta.url), 'utf8')]))

  assert.match(sources.shell, /status\.bound \? rawText\(status\.title\)/)
  assert.match(sources.shell, /rawText\(item\.message\)/)
  assert.match(sources.preset, /rawText\(prompt\.name \|\| prompt\.identifier\)/)
  assert.match(sources.preset, /status\.error \? rawText\(status\.text\)/)
  assert.match(sources.character, /rawText\(detail\.name\)/)
  assert.match(sources.character, /rawText\(`\$\{item\.message\}/)
  assert.match(sources.worldBook, /rawText\(entry\.comment/)
  assert.match(sources.worldBook, /rawText\(item\.message\)/)
  assert.match(sources.user, /rawText\(user\.name\)/)
  assert.match(sources.sessionTemplate, /rawText\(template\.name\)/)
  assert.match(sources.sessionTemplate, /rawText\(item\.message\)/)
  assert.match(sources.trace, /value\?\.name \? rawText\(value\.name\)/)
  assert.match(sources.trace, /rawText\(`\$\{item\.code\}: \$\{item\.message\}`\)/)
  for (const source of Object.values(sources)) assert.match(source, /rawText\((status\.text|error)/)
})

test('semantic dynamic messages translate as complete sentences without altering runtime values', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  const messages = [
    uiMessage('trace.storage.summary', { limits: 'up to 8 MiB total, up to 128 entries per session' }),
    uiMessage('trace.keywords.configured', { value: 'Primary: "酸橙，这片大地"' }),
    uiMessage('trace.keywords.matched', { value: 'No keyword matches' }),
    uiMessage('trace.bookBudget', { used: 8, limit: '', decisionCount: translate('trace.decisionCount.one', { count: 1 }) }),
    uiMessage('trace.recordAligned', { sequence: 42, reused: '', profile: 'Consistent', config: 'Consistent or no fields' }),
    uiMessage('trace.activationPending', { included: 1, pending: 1, truncated: '' }),
    uiMessage('trace.diagnostics', { count: 1 }),
    uiMessage('world.currentSession', { session: 'session-test' }),
    uiMessage('world.documentMeta', { count: 8 }),
    uiMessage('world.user.current', { name: '中文用户名' }),
    uiMessage('world.user.order'),
    uiMessage('world.user.editHint'),
    uiMessage('character.embeddedBook', { count: 8 }),
    uiMessage('template.currentSettingsReminder'),
  ].map(unwrapText)
  assert.match(messages[1], /酸橙，这片大地/)
  for (const message of messages) {
    const uiCopyWithoutRuntimeKeyword = message.replace('酸橙，这片大地', '').replace('中文用户名', '')
    assert.doesNotMatch(uiCopyWithoutRuntimeKeyword, /[\u3400-\u9fff]/u)
  }
})

test('reported mixed-copy surfaces use semantic messages instead of fragment translation', () => {
  const cases = [
    ['../packages/tavern-trace/src/client.js', ['trace.storage.summary', 'trace.keywords.configured', 'trace.keywords.matched', 'trace.bookBudget', 'trace.recordAligned', 'trace.activationPending', 'trace.diagnostics']],
    ['../packages/world-book-library/src/client.js', ['world.currentSession', 'world.catalogItem', 'world.documentMeta', 'world.user.title', 'world.user.current', 'world.user.none', 'world.user.empty', 'world.user.libraryEmpty', 'world.user.unsaved', 'world.user.saved', 'world.user.order', 'world.user.duplicate', 'world.user.appended', 'world.user.pendingAdd', 'world.user.pendingRemove', 'world.user.save', 'world.user.saveApplied', 'world.user.clear', 'world.user.saveSuccess', 'world.user.editContent', 'world.user.editHint', 'world.embeddedMeta', 'world.embeddedEmpty', 'world.diagnostics']],
    ['../packages/character/src/client.js', ['character.embeddedBook']],
    ['../packages/session-template/src/client.js', ['template.currentSettingsReminder']],
  ]
  for (const [file, keys] of cases) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    for (const key of keys) assert.match(source, new RegExp(`uiMessage\\('${key.replaceAll('.', '\\.')}'`))
  }
})

test('new-session integration copy has complete English translations', () => {
  setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
  for (const source of [
    '新会话',
    '当前设置或配置模板',
    '新会话与配置模板',
    '维持当前 Tavern 设置新开对话',
    '由当前设置创建',
    '根据所选模板新开干净对话',
    '模板与新会话操作已就绪。',
  ]) {
    assert.doesNotMatch(translateVisibleText(source), /[\u3400-\u9fff]/u, source)
  }
})
