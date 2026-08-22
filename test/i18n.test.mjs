import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MESSAGE_CATALOG,
  SUPPORTED_LOCALES,
  UI_LOCALES,
  createLocalizedElement,
  getMessageCatalogs,
  installMessageCatalogs,
  rawText,
  resetMessageCatalogs,
  setClientUiSettings,
  translate,
  translateVisibleText,
  uiMessage,
  unwrapText,
} from '../packages/client/src/i18n.js'
import {
  DEFAULT_UI_LOCALE,
  SUPPORTED_UI_LOCALES,
} from '../packages/ui-settings/src/locale-contract.js'
import { uiSettingsConstants } from '../packages/tavern-loader/src/index.js'
import { PanelHeader } from '../packages/client/src/index.js'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

test.afterEach(() => {
  resetMessageCatalogs()
  setClientUiSettings({ locale: DEFAULT_UI_LOCALE, scale: 1 }, { announce: false })
})

function clientUiSources() {
  const files = [
    'packages/client/src/index.js',
    'packages/client/src/state.js',
    'packages/client/src/i18n.js',
    'packages/client/src/i18n/runtime.js',
    'packages/preset/src/client.js',
    'packages/character/src/client.js',
    'packages/character/src/client-state.js',
    'packages/world-book-library/src/client.js',
    'packages/user/src/client.js',
    'packages/session-template/src/client.js',
    'packages/tavern-trace/src/client.js',
  ]
  return files.map(file => ({ file, source: readFileSync(join(root, file), 'utf8') }))
}

function stripCommentsAndCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\bconst css = `[\s\S]*?`/, 'const css = ``')
}

function quotedStrings(source) {
  const text = stripCommentsAndCss(source)
  const values = []
  const pattern = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].slice(1, -1)
    values.push(raw.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return values
}

function installSyntheticLocale() {
  const synthetic = Object.freeze({
    ...MESSAGE_CATALOG[DEFAULT_UI_LOCALE],
    'panel.close': ']]{title}[[',
  })
  installMessageCatalogs({ 'xx-TEST': synthetic })
  return synthetic
}

test('client, settings UI, and server share one locale registry with complete semantic catalogs', () => {
  assert.deepEqual(SUPPORTED_LOCALES, SUPPORTED_UI_LOCALES)
  assert.deepEqual(UI_LOCALES.map(locale => locale.id), SUPPORTED_UI_LOCALES)
  assert.deepEqual(uiSettingsConstants.allowedLocales, SUPPORTED_UI_LOCALES)
  const expectedKeys = Object.keys(MESSAGE_CATALOG[DEFAULT_UI_LOCALE]).toSorted()
  for (const locale of Object.keys(MESSAGE_CATALOG)) {
    const catalog = MESSAGE_CATALOG[locale]
    assert.deepEqual(Object.keys(catalog).toSorted(), expectedKeys, locale)
    for (const key of expectedKeys) assert.equal(typeof catalog[key], 'string', `${locale}:${key}`)
  }
  const runtimeSource = readFileSync(new URL('../packages/client/src/i18n/runtime.js', import.meta.url), 'utf8')
  assert.match(runtimeSource, /DEFAULT_UI_LOCALE/)
  assert.doesNotMatch(runtimeSource, /MESSAGE_CATALOG\[['"]zh-CN['"]\]/)
  assert.doesNotMatch(runtimeSource, /LEGACY_SOURCE_CATALOGS|LEGACY_REPLACEMENTS|SOURCE_EN/)
})

test('translate falls back through DEFAULT_UI_LOCALE rather than a hardcoded locale id', () => {
  assert.equal(translate('settings.title'), MESSAGE_CATALOG[DEFAULT_UI_LOCALE]['settings.title'])
  assert.equal(translate('catalog.key.that.does.not.exist'), MESSAGE_CATALOG[DEFAULT_UI_LOCALE]['common.unavailable'])
  const other = SUPPORTED_UI_LOCALES.find(locale => locale !== DEFAULT_UI_LOCALE)
  setClientUiSettings({ locale: other, scale: 1 }, { announce: false })
  assert.equal(translate('settings.title'), MESSAGE_CATALOG[other]['settings.title'])
  assert.equal(translate('catalog.key.that.does.not.exist'), MESSAGE_CATALOG[DEFAULT_UI_LOCALE]['common.unavailable'])
  assert.notEqual(translate('catalog.key.that.does.not.exist'), 'catalog.key.that.does.not.exist')
})

test('synthetic third locale can change panel.close word order without editing business components', () => {
  installSyntheticLocale()
  setClientUiSettings({ locale: 'xx-TEST', scale: 1 }, { announce: false })
  const title = '关闭用户侧边栏 / Close preset / 世界书'
  assert.equal(translate('panel.close', { title }), `]]${title}[[`)
  const tree = PanelHeader({ title: rawText(title), close() {} })
  const button = tree.props.children[1]
  assert.equal(button.props.title, `]]${title}[[`)
  assert.equal(button.props['aria-label'], `]]${title}[[`)
  assert.equal(unwrapText(tree.props.children[0].props.children), title)
  for (const { file, source } of clientUiSources()) {
    if (file.endsWith('runtime.js') || file.endsWith('i18n.js')) continue
    assert.doesNotMatch(source, /xx-TEST/, file)
  }
})

test('PanelHeader uses one semantic close template and interpolates the title verbatim', () => {
  const title = '关闭用户侧边栏 / Close preset / 世界书'
  const tree = PanelHeader({ title: rawText(title), close() {} })
  const button = tree.props.children[1]
  const expected = translate('panel.close', { title })
  assert.equal(button.props.title, expected)
  assert.equal(button.props['aria-label'], expected)
  assert.match(readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8'), /uiMessage\('panel.close'/)
})

test('localized element factory unwraps branded UI copy and preserves resource values', () => {
  const other = SUPPORTED_UI_LOCALES.find(locale => locale !== DEFAULT_UI_LOCALE)
  setClientUiSettings({ locale: other, scale: 1 }, { announce: false })
  const createElement = (type, props, ...children) => ({ type, props, children })
  const h = createLocalizedElement(createElement)
  const element = h('input', {
    title: uiMessage('panel.close', { title: unwrapText(uiMessage('nav.user')) }),
    'aria-label': uiMessage('panel.close', { title: unwrapText(uiMessage('nav.user')) }),
    value: '中文角色资源名',
  }, uiMessage('common.refresh'))
  assert.equal(element.props.title, translate('panel.close', { title: translate('nav.user') }))
  assert.equal(element.props.value, '中文角色资源名')
  assert.deepEqual(element.children, [translate('common.refresh')])
})

test('raw resource names, keywords and similar UI words stay verbatim in every catalog including the synthetic locale', () => {
  const samples = [
    '关闭用户侧边栏 / Close preset / 世界书',
    '用户',
    'Close preset',
    '世界书{name}',
    '"酸橙，这片大地"',
  ]
  const locales = [...SUPPORTED_UI_LOCALES, 'xx-TEST']
  installSyntheticLocale()
  for (const locale of locales) {
    setClientUiSettings({ locale, scale: 1 }, { announce: false })
    for (const sample of samples) {
      assert.equal(unwrapText(uiMessage('preset.currentSessionBound', { name: sample })), translate('preset.currentSessionBound', { name: sample }))
      assert.match(unwrapText(uiMessage('preset.currentSessionBound', { name: sample })), new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.deepEqual(createLocalizedElement((type, props, ...children) => children)('span', null, rawText(sample)), [sample])
    }
  }
})

test('translateVisibleText is an identity helper and does not scan source copy', () => {
  const other = SUPPORTED_UI_LOCALES.find(locale => locale !== DEFAULT_UI_LOCALE)
  setClientUiSettings({ locale: other, scale: 1 }, { announce: false })
  assert.equal(translateVisibleText('当前会话：session-a；绑定：未绑定用户'), '当前会话：session-a；绑定：未绑定用户')
  assert.equal(translateVisibleText('新预设'), '新预设')
})

test('all Tavern React clients share the catalog-backed element boundary and semantic messages', () => {
  for (const { file, source } of clientUiSources().filter(item => item.file.endsWith('client.js') || item.file.endsWith('index.js'))) {
    if (file.endsWith('state.js')) continue
    assert.match(source, /createLocalizedElement/, file)
    assert.match(source, /rawText/, file)
    assert.match(source, /uiMessage/, file)
    assert.doesNotMatch(source, /createElement as h/, file)
    assert.doesNotMatch(source, /translateVisibleText/, file)
    assert.doesNotMatch(source, /uiText`/, file)
  }
})

test('resource clients explicitly protect dynamic child, diagnostic, error, and comment surfaces', () => {
  const sources = Object.fromEntries(clientUiSources().map(({ file, source }) => [file, source]))
  const shell = sources['packages/client/src/index.js']
  const preset = sources['packages/preset/src/client.js']
  const character = sources['packages/character/src/client.js']
  const worldBook = sources['packages/world-book-library/src/client.js']
  const user = sources['packages/user/src/client.js']
  const sessionTemplate = sources['packages/session-template/src/client.js']
  const trace = sources['packages/tavern-trace/src/client.js']
  assert.match(shell, /status\.bound \? rawText\(status\.title\)/)
  assert.match(shell, /rawText\(item\.message\)/)
  assert.match(preset, /rawText\(prompt\.name \|\| prompt\.identifier\)/)
  assert.match(character, /rawText\(detail\.name\)/)
  assert.match(worldBook, /rawText\(entry\.comment/)
  assert.match(user, /rawText\(user\.name\)/)
  assert.match(sessionTemplate, /rawText\(template\.name\)/)
  assert.match(trace, /value\?\.name \? rawText\(value\.name\)/)
  assert.match(trace, /rawText\(`\$\{item\.code\}: \$\{item\.message\}`\)/)
})

test('destructive confirmations use semantic messages and preserve runtime names verbatim', () => {
  const runtimeName = '关闭用户侧边栏 / Close preset / 世界书'
  const confirmation = unwrapText(uiMessage('character.confirmDelete', { name: runtimeName }))
  assert.match(confirmation, new RegExp(runtimeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const { file, source } of clientUiSources()) {
    for (const call of source.matchAll(/window\.confirm\(([^\n]+)\)/g)) {
      assert.match(call[1], /uiMessage\(/, `${file}: ${call[0]}`)
    }
  }
})

test('production client sources have no leftover Chinese source-copy replacement path', () => {
  for (const { file, source } of clientUiSources()) {
    assert.doesNotMatch(source, /LEGACY_SOURCE_CATALOGS|LEGACY_REPLACEMENTS|SOURCE_EN_TRANSFORMS/, file)
  }
})

test('client production sources outside catalogs do not contain UI-owned Chinese or English sentences', () => {
  const allowedExact = new Set([
    'DT', '✕', '⠿', '●', 'marker', 'system', 'user', 'assistant', 'replace', 'append',
    'GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'Content-Type', 'application/json',
    'application/octet-stream', 'image/png', 'before_char', 'after_char', 'and_any', 'and_all',
    'not_any', 'not_all', 'low', 'medium', 'high', 'xhigh', 'current', 'template',
  ])
  const allowed = [
    /^[a-z][a-z0-9]*(\.[a-z0-9_-]+)+$/i,
    /^dsh-tavern/,
    /^pmp-dsh-tavern/,
    /^dtv-|^dtt-|^dcc-|^dwb-|^dtu-|^dttrace-/,
    /^\/dsh-tavern\//,
    /^\/pmp-dsh-tavern\//,
    /^[A-Za-z0-9_./:?&=+-]+$/,
    /^[0-9.%]+$/,
    /^request\/header/,
    /^secondary=/,
    /^ \/ (override|weight|roll)/,
    /^HTTP /,
    /^\.json/,
  ]
  const findings = []
  for (const { file, source } of clientUiSources()) {
    if (file.includes('/i18n/catalogs/') || file.endsWith('/i18n/runtime.js') || file.endsWith('/i18n.js') || file.endsWith('\\i18n.js')) {
      if (file.endsWith('runtime.js') || file.endsWith('i18n.js')) {
        assert.doesNotMatch(source, /LEGACY_SOURCE_CATALOGS/)
      }
      continue
    }
    for (const value of quotedStrings(source)) {
      if (value === '' || allowedExact.has(value)) continue
      if (allowed.some(pattern => pattern.test(value))) continue
      if (/[\u3400-\u9fff]/u.test(value)) findings.push(`${file}: ${JSON.stringify(value)}`)
      else if (/[A-Za-z]{3,}/.test(value) && /\s/.test(value) && !/[{}$/]/.test(value) && value.length > 12) {
        findings.push(`${file}: ${JSON.stringify(value)}`)
      }
    }
  }
  assert.deepEqual(findings, [])
})

test('installing a catalog does not require editing resource panels', () => {
  const before = getMessageCatalogs()
  installSyntheticLocale()
  assert.notEqual(getMessageCatalogs(), before)
  assert.equal(typeof getMessageCatalogs()['xx-TEST']['panel.close'], 'string')
})
