import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../packages/client/src/play/io-menu.js', import.meta.url), 'utf8')

test('sidebar IO menu does not own the empty-playthrough import input', () => {
  assert.doesNotMatch(source, /importPlaythrough|bindPlaythroughImport|type: 'file'|play\.io\.import/)
})

test('sidebar IO menu sizes to its content within the narrow sidebar budget', () => {
  assert.match(source, /data-placement=sidebar[^}]*width:max-content;min-width:0;max-width:168px/)
  assert.match(source, /data-placement=sidebar[^}]*\.dtv-play-io-item\{white-space:nowrap\}/)
})

test('sidebar IO menu exposes only static HTML and SillyTavern JSONL exports', () => {
  assert.match(source, /exportAs\('html'\)/)
  assert.match(source, /exportAs\('st'\)/)
  assert.doesNotMatch(source, /exportAs\('bundle'\)|exportBundle/)
})

test('the sidebar repair action opens a new native RP chat for the selected run, including missing characters', async t => {
  const { parseHTML } = await import('linkedom')
  const { act, createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { installPlaySlotOccupancy } = await import('../packages/client/src/play/occupancy.js')
  const { translate } = await import('../packages/client/src/i18n.js')
  const { window, document } = parseHTML('<html><head></head><body><main></main></body></html>')
  const globals = { window, document, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]))
  Object.assign(globalThis, globals)
  const root = createRoot(document.querySelector('main'))
  t.after(async () => {
    await act(async () => root.unmount())
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })
  const workspace = { selected: true, workspaceId: 'rp', rootPath: '/rp' }
  const rows = ['present', 'missing'].map(id => ({ id, path: id + '/timeline.json', title: id, ext: { pmpDshTavern: { characterId: id } } }))
  const resources = { workspace, characters: [{ id: 'present', name: 'Existing' }], missingCharacters: [{ id: 'missing', name: 'Missing' }], catalog: { playthroughs: rows }, timelines: {} }
  const snapshot = { resources, issues: [], loading: false }
  const diagnostics = { getSnapshot: () => snapshot, subscribe: () => () => {} }
  let sidebar, current = workspace
  const calls = [], sessionState = { byId: {}, ids: [] }, workspaceState = { items: [], archivedSessionIds: [] }
  const ctx = {
    slots: { inject: (_name, fn) => fn(), register(options, component) { if (options.name === 'sidebar.workspaces') sidebar = { options, component }; return () => {} } },
    uiWorkspace: { openSession: id => calls.push(['open', id]) },
    sessions: {
      async create(opts) { calls.push(['create', opts]); return 'new-chat' },
      using: (id, _options, fn) => fn({ ready: Promise.resolve({ session: {
        async rename() {}, async command(line) { calls.push(['command', id, line]); return { ok: true, value: { matched: true } } },
      } }) }),
    },
  }
  const occupancy = installPlaySlotOccupancy(ctx, { getWorkspace: async () => current }, { diagnostics, switchToNative: () => calls.push(['native']) })
  occupancy.setMode('play')
  await act(async () => root.render(createElement(sidebar.component, { ...sidebar.options.inject(), useSessions: fn => fn(sessionState), useWorkspaces: fn => fn(workspaceState) })))
  const menus = [...document.querySelectorAll('.dtv-play-io[data-placement="sidebar"]')]
  assert.equal(menus.length, 2)
  for (const [index, menu] of menus.entries()) {
    await act(async () => menu.querySelector('button').click())
    const repair = [...menu.querySelectorAll('button')].find(button => button.textContent === translate('play.io.repair'))
    if (index === 0) {
      current = { ...workspace, workspaceId: 'other' }
      await act(async () => repair.click())
      assert.deepEqual(calls, [])
      assert.equal(menu.querySelector('.dtv-play-io-error').textContent, translate('play.io.repairSelectionChanged'))
      current = workspace
    }
    await act(async () => repair.click())
    assert.deepEqual(calls.splice(0), [['create', { workspaceId: 'rp' }], ['native'], ['open', 'new-chat'], ['command', 'new-chat', '/tavern-repair assist ' + rows[index].id]])
  }
})
