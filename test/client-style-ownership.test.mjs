import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parse } from 'acorn'
import { parseHTML } from 'linkedom'
import { PLUGIN_ID } from '../packages/identity.js'
import { installTavernStyle } from '../packages/client-style.js'

const installers = [
  ['client/src/index.js', 'installStyles', '-shell'],
  ['preset/src/client.js', 'installPresetStyles', ''],
  ['character/src/client.js', 'installCharacterStyles', '-character'],
  ['world-book-library/src/client.js', 'installWorldBookStyles', '-world-book'],
  ['user/src/client.js', 'installUserStyles', '-user'],
  ['tavern-trace/src/client.js', 'installTavernTraceStyles', '-trace'],
  ['client/src/play/chat.js', 'installPlayChatStyles', '-play-chat'],
  ['client/src/play/sidebar.js', 'installStyles', '-play-sidebar'],
  ['client/src/play/notice.js', 'installStyles', '-play-notice'],
  ['client/src/play/io-menu.js', 'installStyles', '-play-io'],
  ['client/src/play/turn-actions.js', 'installStyles', '-play-turn-actions'],
  ['client/src/play/draft-opening.js', 'styles', '-drafts', 'data-dtv-drafts'],
  ['client/src/play/opening-layout.js', 'installStyles', '-opening-layout', 'data-dtv-opening-layout'],
]

// Exercise each actual installer without mounting its unrelated React UI.
function installer(path, name, document) {
  const source = readFileSync(new URL(`../packages/${path}`, import.meta.url), 'utf8')
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  const node = ast.body.map(node => node.declaration ?? node)
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  assert.ok(node, `${path}: ${name} not found`)
  return vm.runInNewContext(`(${source.slice(node.start, node.end)})`, {
    document, PLUGIN_ID, css: '.fixture { position: fixed }',
    diagnosticsCss: '', presentationCss: '', installTavernStyle,
    installPlayChatStyles() {},
  })
}

for (const [path, name, suffix, marker] of installers) {
  test(`${path} survives foreign style claiming and restores after owner cleanup`, () => {
    const original = globalThis.document
    const { document } = parseHTML('<html><head></head><body></body></html>')
    globalThis.document = document
    try {
      const install = installer(path, name, document)
      const appended = []
      const append = document.head.append.bind(document.head)
      document.head.append = (...nodes) => {
        appended.push(...nodes.map(node => node.getAttribute('data-plugin')))
        append(...nodes)
      }
      install()
      const style = document.head.querySelector('style')
      assert.deepEqual(appended, [PLUGIN_ID], 'ownership must be assigned before append')
      assert.equal(style.dataset.pluginCss, `${PLUGIN_ID}${suffix}`)
      if (marker) assert.equal(style.hasAttribute(marker), true)
      install()
      assert.equal(document.head.querySelectorAll('style').length, 1)
      // The official loader claims every unowned document style on materialize.
      const foreign = document.createElement('style')
      foreign.textContent = '.foreign { color: red }'
      append(foreign)
      for (const tag of document.querySelectorAll('style:not([data-plugin])')) tag.dataset.plugin = 'fixture-competitor'
      for (const tag of document.querySelectorAll('style[data-plugin="fixture-competitor"]')) tag.remove()
      assert.equal(style.isConnected, true)
      // A retained tag from an earlier version must not keep a foreign owner.
      style.dataset.plugin = 'previous-competitor'
      install()
      assert.equal(style.dataset.plugin, PLUGIN_ID)
      assert.equal(document.head.querySelectorAll('style').length, 1)
      for (const tag of document.querySelectorAll(`style[data-plugin="${PLUGIN_ID}"]`)) tag.remove()
      assert.equal(document.head.querySelectorAll('style').length, 0)
      install()
      assert.equal(document.head.querySelectorAll('style').length, 1)
      assert.equal(document.head.querySelector('style').dataset.plugin, PLUGIN_ID)
    } finally {
      if (original === undefined) delete globalThis.document
      else globalThis.document = original
    }
  })
}

test('legacy marker tags are reclaimed without duplicates and refreshed on replacement', () => {
  const original = globalThis.document
  const { document } = parseHTML('<html><head><style data-dtv-drafts data-plugin="old-owner">old</style></head><body></body></html>')
  globalThis.document = document
  try {
    const old = document.head.firstChild
    const current = installTavernStyle(`${PLUGIN_ID}-drafts`, 'new', 'data-dtv-drafts')
    assert.equal(current, old)
    assert.equal(current.textContent, 'new')
    assert.equal(current.dataset.plugin, PLUGIN_ID)
    assert.equal(document.head.querySelectorAll('style').length, 1)
  } finally {
    if (original === undefined) delete globalThis.document
    else globalThis.document = original
  }
})
