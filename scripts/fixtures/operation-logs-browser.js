import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { OperationLogsPanel } from '../../packages/client/src/play/diagnostics.js'
import { setClientUiSettings } from '../../packages/client/src/i18n.js'
const results = []
const check = (name, condition) => results.push({ name, pass: Boolean(condition) })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function run() {
  setClientUiSettings({ locale: 'en' })
  const host = document.createElement('section'); document.body.append(host)
  const root = createRoot(host)
  const page = { ok: true, schemaVersion: 1, records: [{ id: 'a', operationId: 'op', stage: '<script>FAIL</script>' }, { id: 'b', eventVersion: 1, event: 'operation.completed', result: 'accepted', route: '/sessions/:id/user-message' }], nextCursor: 'cursor', storage: { available: true }, limits: {} }
  const calls = []
  const client = { async getOperationLogs(options) { calls.push(options); return page } }
  const mount = client => flushSync(() => root.render(createElement(OperationLogsPanel, { client })))
  const click = async text => { const button = [...host.querySelectorAll('button')].find(el => el.textContent === text); if (!button) throw new Error(`Missing ${text}`); await act(async () => { button.click(); await tick() }) }
  mount(client); await tick()
  check('panel makes no automatic requests', calls.length === 0)
  await click('Load / refresh')
  check('explicit load renders metadata as text', calls.length === 1 && host.textContent.includes('<script>FAIL</script>') && !host.querySelector('script'))
  check('legacy and versioned events render together', host.textContent.includes('operation.completed') && host.textContent.includes('accepted'))
  await click('Older page')
  check('older page uses returned cursor', calls[1].before === 'cursor')
  let blob
  const originalCreate = URL.createObjectURL
  const originalClick = HTMLAnchorElement.prototype.click
  URL.createObjectURL = value => { blob = value; return 'blob:fixture' }
  HTMLAnchorElement.prototype.click = function () { check('download filename is stable', this.download === 'tavern-operation-logs.jsonl') }
  await click('Export this page')
  const lines = (await blob.text()).trim().split('\n').map(JSON.parse)
  check('export contains metadata and exactly the displayed page', lines[0].type === 'metadata' && lines[0].nextCursor === 'cursor' && lines[1].id === 'a' && lines[2].eventVersion === 1 && lines.length === 3)
  URL.createObjectURL = originalCreate; HTMLAnchorElement.prototype.click = originalClick
  mount({ getOperationLogs: async () => { throw Object.assign(new Error('old Host'), { status: 404 }) } }); await tick()
  await click('Load / refresh')
  check('old Host is unavailable without crashing the panel', host.textContent.includes('does not provide operation logs'))
  let finish
  mount({ getOperationLogs: () => new Promise(resolve => { finish = resolve }) }); await tick()
  await click('Load / refresh')
  const input = host.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'different')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick(); await act(async () => { finish(page); await tick() })
  check('obsolete filter response never replaces the new view', !host.querySelector('pre'))
  mount({ getOperationLogs: async () => ({ ...page, storage: { available: false, code: 'LOG_DISABLED' } }) }); await tick()
  await click('Load / refresh')
  check('degraded storage is explicit', host.textContent.includes('incomplete or storage is degraded'))
  flushSync(() => root.unmount())
}
run().catch(error => check(`unexpected: ${error.message}`, false)).finally(() => {
  const report = document.createElement('pre'); report.id = 'results'; report.textContent = JSON.stringify(results); document.body.append(report)
})
