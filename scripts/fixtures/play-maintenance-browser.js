import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { InvalidPlaythroughArchive } from '../../packages/client/src/play/diagnostics.js'
import { setClientUiSettings } from '../../packages/client/src/i18n.js'

const results = []
const check = (name, condition) => results.push({ name, pass: Boolean(condition) })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const workspace = { selected: true, workspaceId: 'workspace', rootPath: '/fixture' }
const workspaceScope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
const rows = ['corrupt', 'unreadable', 'moved', 'no-session', 'healthy', 'draft'].map(id => ({ id, path: `card/${id}/timeline.json`, ext: { pmpDshTavern: id === 'draft' ? { draftId: id } : {} } }))

function fixture() {
  let catalog = { playthroughs: structuredClone(rows), ext: { thirdParty: 'keep' } }
  const state = { refreshes: 0, writes: 0, inspections: 0 }
  const snapshot = () => ({ availabilityReady: true, resources: { workspace, catalog }, issues: catalog.playthroughs.filter(row => ['corrupt', 'unreadable', 'moved', 'no-session'].includes(row.id) && !row.ext.pmpDshTavern.archivedAt).map(playthrough => ({ kind: 'timeline', playthrough })) })
  const controller = { async refresh() { state.refreshes++ }, getSnapshot: snapshot }
  const client = {
    getWorkspace: async () => workspace,
    async updateCatalog(mutator, options) {
      check('catalog write carries the starting workspace identity', options.expectedWorkspaceScope === workspaceScope)
      catalog = await mutator(catalog)
      state.writes++
      return catalog
    },
    inspectPlaythrough() { state.inspections++; throw new Error('Strict cleanup inspection must not run for archive') },
  }
  return { client, controller, state, catalog: () => catalog }
}

async function run() {
  setClientUiSettings({ locale: 'en' })
  const host = document.createElement('section'); document.body.append(host)
  const root = createRoot(host)
  let f = fixture()
  const mount = (value = f, binding = workspace) => flushSync(() => root.render(createElement(InvalidPlaythroughArchive, { client: value.client, controller: value.controller, workspace: binding, availabilityReady: value.controller.getSnapshot().availabilityReady })))
  const click = async () => { await act(async () => { host.querySelector('button').click(); await tick() }) }
  mount(); await tick()
  check('opening diagnostics does not inspect or mutate any playthrough', f.state.refreshes === 0 && f.state.writes === 0)
  await click()
  check('one click archives corrupt, unreadable, moved and unavailable-session diagnostics in one catalog commit', f.catalog().playthroughs.filter(row => row.ext.pmpDshTavern.archivedAt).map(row => row.id).join(',') === 'corrupt,unreadable,moved,no-session' && f.state.writes === 1)
  check('archive uses diagnostics without strict cleanup inspection', f.state.inspections === 0)
  check('healthy run and healthy opening draft remain visible', f.catalog().playthroughs.filter(row => !row.ext.pmpDshTavern.archivedAt).map(row => row.id).join(',') === 'healthy,draft')
  check('archive reports counts and keeps the action usable', host.textContent.includes('Archived 4; preserved 2; failed 0.') && !host.querySelector('button').disabled)
  check('archive refreshes diagnostics before selecting targets and after writing', f.state.refreshes === 2)
  check('archive retains catalog extension metadata', f.catalog().ext.thirdParty === 'keep')
  f = fixture(); setClientUiSettings({ locale: 'zh-CN' }); mount(); await tick(); await click()
  check('Chinese action and counts are translated', host.textContent.includes('一键归档失效周目') && host.textContent.includes('已归档 4，已保留 2，失败 0'))
  setClientUiSettings({ locale: 'en' })
  for (const phase of ['pending', 'error']) {
    f = fixture()
    const ready = f.controller.getSnapshot
    f.controller.getSnapshot = () => ({ ...ready(), availabilityReady: false })
    mount(); await tick()
    check(`archive action is disabled while mirror status is ${phase}`, host.querySelector('button').disabled && !host.textContent.includes('Archived 0'))
    f.controller.getSnapshot = ready
    mount(); await tick()
    check(`archive action enables after ${phase} mirror becomes ready`, !host.querySelector('button').disabled)
  }
  let finish
  f = fixture()
  f.controller.refresh = () => new Promise(resolve => { finish = resolve })
  mount(); await tick(); await click()
  check('pending diagnostics refresh disables repeat clicks', host.querySelector('button').disabled)
  mount(f, { ...workspace, rootPath: '/other' }); await tick()
  await act(async () => { finish(); await tick() })
  check('workspace switch discards old diagnostics and does not archive old IDs', f.state.writes === 0 && !host.textContent.includes('Archived 4'))
  f = fixture()
  f.controller.getSnapshot = () => ({ availabilityReady: true, resources: null, error: { code: 'PLAY_WORKSPACE_READ_FAILED' }, issues: [{ kind: 'workspace' }] })
  mount(); await tick(); await click()
  check('unknown workspace failure refuses archive and explains retry', f.state.writes === 0 && host.textContent.includes('Could not complete the check'))
  f = fixture()
  f.controller.getSnapshot = () => ({ ...fixture().controller.getSnapshot(), resources: { workspace: { ...workspace, rootPath: '/other' } } })
  mount(); await tick(); await click()
  check('workspace change during refreshed diagnostics prevents any catalog write', f.state.writes === 0)
  f = fixture()
  f.controller.refresh = () => new Promise(resolve => { finish = resolve })
  mount(); await tick(); await click()
  flushSync(() => root.unmount())
  await act(async () => { finish(); await tick() })
  check('unmount discards pending diagnostics without archiving', f.state.writes === 0)
}
run().catch(error => check(`runtime error: ${error.stack}`, false)).finally(() => {
  const output = document.createElement('pre'); output.id = 'results'; output.textContent = JSON.stringify(results); document.body.append(output)
})
