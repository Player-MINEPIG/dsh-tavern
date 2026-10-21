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
const rows = ['first', 'second', 'empty', 'surviving', 'unknown', 'failed', 'archived'].map(id => ({ id, ...(id === 'archived' ? { ext: { pmpDshTavern: { archivedAt: '2026-10-21T00:00:00.000Z' } } } : {}) }))

async function run() {
  setClientUiSettings({ locale: 'en' })
  const host = document.createElement('section'); document.body.append(host)
  const root = createRoot(host)
  let refreshed = 0
  const controller = { async refresh() { refreshed++ } }
  const inspections = [], archived = []
  const client = {
    getWorkspace: async () => workspace,
    getCatalog: async () => ({ playthroughs: rows }),
    async inspectPlaythrough(id) {
      inspections.push(id)
      if (id === 'failed') throw new Error('lookup failed')
      return { id, status: ['first', 'second'].includes(id) ? 'invalid' : id === 'empty' ? 'empty' : id === 'surviving' ? 'available' : 'unavailable', workspaceScope }
    },
    async archiveInvalidPlaythrough(id, options) { archived.push({ id, options }); return { id, status: 'archived', workspaceScope } },
  }
  const mount = (value = client, binding = workspace) => flushSync(() => root.render(createElement(InvalidPlaythroughArchive, { client: value, controller, workspace: binding })))
  const click = async () => { await act(async () => { host.querySelector('button').click(); await tick() }) }
  mount(); await tick()
  check('opening diagnostics does not inspect or mutate any playthrough', inspections.length === 0 && archived.length === 0)
  await click()
  check('one click archives multiple confirmed invalid playthroughs in exact preview order', archived.map(row => row.id).join(',') === 'first,second')
  check('each archive is bound to the inspected workspace', archived.every(row => row.options.expectedWorkspaceScope === workspaceScope))
  check('empty, surviving, uncertain and failed rows are reported and retained', host.textContent.includes('Archived 2; preserved 3; failed 1.') && !inspections.includes('archived'))
  check('archive completion refreshes sidebar resources once', refreshed === 1)
  check('archive keeps the diagnostics action usable', !host.querySelector('button').disabled)
  setClientUiSettings({ locale: 'zh-CN' }); mount({ ...client }); await tick(); await click()
  check('Chinese action and counts are translated', host.textContent.includes('一键归档失效周目') && host.textContent.includes('已归档 2，已保留 3，失败 1'))
  setClientUiSettings({ locale: 'en' })
  let finish
  const obsolete = { ...client, getCatalog: async () => ({ playthroughs: [rows[0]] }), inspectPlaythrough: () => new Promise(resolve => { finish = resolve }) }
  const count = archived.length
  mount(obsolete); await tick(); await click()
  check('pending check disables repeat clicks', host.querySelector('button').disabled)
  mount(obsolete, { ...workspace, rootPath: '/other' }); await tick()
  await act(async () => { finish({ status: 'invalid', workspaceScope }); await tick() })
  check('workspace switch discards old check and does not archive old IDs', archived.length === count && !host.textContent.includes('Archived 1'))
  mount({ ...client, inspectPlaythrough: async () => ({ status: 'invalid', workspaceScope: 'different' }) }); await tick(); await click()
  check('server workspace changes stop the caller before mutation', archived.length === count && host.textContent.includes('Could not complete the check'))
  mount({ ...client, getCatalog: async () => { throw new Error('old host') } }); await tick(); await click()
  check('unavailable Host leaves an actionable retry and no successful result', host.textContent.includes('Could not complete the check') && !host.querySelector('button').disabled)
  mount(obsolete); await tick(); await click()
  const beforeUnmount = refreshed
  flushSync(() => root.unmount())
  await act(async () => { finish({ status: 'invalid', workspaceScope }); await tick() })
  check('unmount discards old completion without archiving or refreshing', archived.length === count && refreshed === beforeUnmount)
}
run().catch(error => check(`runtime error: ${error.stack}`, false)).finally(() => {
  const output = document.createElement('pre'); output.id = 'results'; output.textContent = JSON.stringify(results); document.body.append(output)
})
