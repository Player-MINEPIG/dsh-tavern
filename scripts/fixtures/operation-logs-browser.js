import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { OperationLogsPanel, diagnosticsCss } from '../../packages/client/src/play/diagnostics.js'
import { setClientUiSettings } from '../../packages/client/src/i18n.js'
const results = []
const check = (name, condition) => results.push({ name, pass: Boolean(condition) })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function run() {
  setClientUiSettings({ locale: 'en' })
  const style = document.createElement('style'); style.textContent = diagnosticsCss; document.head.append(style)
  const host = document.createElement('section'); host.style.cssText = 'width:280px;box-sizing:border-box'; document.body.append(host)
  const root = createRoot(host)
  const page = { ok: true, schemaVersion: 1, records: [{ id: 'a', operationId: 'op', stage: '<script>FAIL</script>' }, { id: 'b', eventVersion: 1, event: 'operation.completed', result: 'accepted', route: '/sessions/:id/user-message' }], nextCursor: 'cursor', storage: { available: true }, limits: {} }
  const calls = []
  const client = { async getOperationLogs(options) { calls.push(options); return page } }
  const mount = client => flushSync(() => root.render(createElement(OperationLogsPanel, { client })))
  const click = async text => { const button = [...host.querySelectorAll('button')].find(el => el.textContent === text); if (!button) throw new Error(`Missing ${text}`); await act(async () => { button.click(); await tick() }) }
  mount(client); await tick()
  check('panel makes no automatic requests', calls.length === 0)
  await act(async () => { host.querySelector('details').open = true; await new Promise(resolve => setTimeout(resolve, 30)) })
  check('opening panel loads latest records without an ID', calls.length === 1 && calls[0].operationId === '' && calls[0].limit === 5)
  check('advanced filter starts collapsed with an accessible label and explanation', !host.querySelector('.dtv-operation-advanced').open && host.querySelector('input').labels.length === 1 && document.getElementById(host.querySelector('input').getAttribute('aria-describedby')))
  check('explicit load renders metadata as text', calls.length === 1 && host.textContent.includes('<script>FAIL</script>') && !host.querySelector('script'))
  check('legacy and versioned events render together', host.textContent.includes('operation.completed') && host.textContent.includes('accepted'))
  await click('Older page')
  check('older page uses returned cursor', calls[1].before === 'cursor' && calls[1].limit === 5)
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
  mount({ getOperationLogs: async () => ({ ...page, records: [], nextCursor: null }) }); await tick()
  const emptyFilter = host.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(emptyFilter, '')
  emptyFilter.dispatchEvent(new Event('input', { bubbles: true })); await tick()
  await click('Load / refresh')
  check('empty page explains retention and disables older page', host.textContent.includes('No readable records') && [...host.querySelectorAll('button')].find(el => el.textContent === 'Older page').disabled)
  for (const [error, expected] of [[{ code: 'LOG_CURSOR_EXPIRED' }, 'expired through rotation'], [{ status: 500 }, 'Could not read']]) {
    mount({ getOperationLogs: async () => { throw error } }); await tick()
    await click('Load / refresh')
    check(`error ${error.code ?? error.status} remains actionable`, host.textContent.includes(expected))
  }
  const filteredCalls = []
  mount({ getOperationLogs: async options => { filteredCalls.push(options); return { ...page, records: [], nextCursor: 'filtered-cursor' } } }); await tick()
  const filter = host.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(filter, '  synthetic-operation  ')
  filter.dispatchEvent(new Event('input', { bubbles: true })); await tick()
  await click('Load / refresh'); await click('Older page')
  check('exact filter is trimmed and retained for older pages', filteredCalls.length === 2 && filteredCalls.every(call => call.operationId === 'synthetic-operation') && filteredCalls[1].before === 'filtered-cursor')
  check('no-match state explains how to clear filter', host.textContent.includes('No retained records match'))
  const longPage = { ...page, records: [{ id: 'long', timestamp: '2026-10-03T01:02:03Z', eventVersion: 1, operation: 'session.create', event: 'operation.failed', sessionId: 's'.repeat(128), operationId: 'o'.repeat(128), errorCode: 'TEST_ERROR' }] }
  mount({ getOperationLogs: async () => longPage }); await tick(); await click('Load / refresh')
  const detail = host.querySelector('.dtv-operation-row details'); detail.open = true
  await tick()
  const raw = host.querySelector('.dtv-operation-raw')
  check('long fields scroll locally at narrow widths', host.scrollWidth <= host.clientWidth + 1 && raw.scrollWidth > raw.clientWidth && getComputedStyle(raw).overflowX === 'auto' && raw.tabIndex === 0)
  let copied
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value } } })
  await click('Copy operation ID')
  check('copy preserves the complete operation ID and announces status', copied === 'o'.repeat(128) && host.textContent.includes('Operation ID copied'))
  await click('Copy troubleshooting locator')
  const locator = JSON.parse(copied)
  check('locator contains session and time without mislabeling a DSH run', locator.sessionId === 's'.repeat(128) && locator.timestamp === longPage.records[0].timestamp && locator.correlation === 'session-and-time-only' && !('runId' in locator))
  check('generation guidance is collapsed and explains accepted and native failures', !host.querySelector('.dtv-operation-guide').open && host.textContent.includes('Accepted input does not mean a successful model call') && host.textContent.includes('Tavern Trace at the top'))
  let closeFinish
  mount({ getOperationLogs: () => new Promise(resolve => { closeFinish = resolve }) }); await tick()
  await click('Load / refresh')
  host.querySelector('details').open = false; await new Promise(resolve => setTimeout(resolve, 30))
  await act(async () => { closeFinish(page); await tick() })
  check('closing panel discards in-flight response', !host.querySelector('.dtv-operation-row'))
  flushSync(() => root.unmount())
}
run().catch(error => check(`unexpected: ${error.message}`, false)).finally(() => {
  const report = document.createElement('pre'); report.id = 'results'; report.textContent = JSON.stringify(results); document.body.append(report)
})
