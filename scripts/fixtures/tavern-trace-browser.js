import { Component, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { TavernTraceView, installTavernTraceStyles } from '../../packages/tavern-trace/src/client.js'
import { MvuEventsTable } from '../../packages/tavern-trace/src/mvu-view.js'
import { setClientUiSettings } from '../../packages/client/src/i18n.js'

// Entirely authored provider payloads: a completed reply adds and removes a
// field. The whole Trace tab must survive the missing comparison cells.
const sid = 'fixture-child', id = 'mvu:trace', variables = { stat_data: { added: '<img src=x onerror=alert(1)>', changed: false } }
const version = { key: 'reply', revision: 1, source: { sessionId: sid, turn: 5, messageId: 'reply', messageSeq: 65, endSeq: 67 },
  variables, beforeAvailable: true, before: { removed: false, changed: null } }
const record = { id, name: 'Authored variable source', revision: 1, currentRevision: 1, managementMode: 'managed', capabilities: { edit: true }, content: variables }
const summary = { id: 'capture', turn: 5, step: 1, attempt: 1, recordedAt: 1, status: 'request-observed', contentStatus: 'reference-only' }
const detail = { ...summary, schemaVersion: 4, sessionId: sid, audit: { worldBooks: [], resources: { worldBooks: [] } }, sections: [], contexts: [] }
const storage = { kind: 'bounded-assembly-references', maxRecords: 256, maxRecordBytes: 2097152, maxTotalBytes: 16777216 }
const facts = { maxRecords: 2048, records: ['started', 'applied', 'completed'].map(phase => ({ id, eventId: 'reply', turn: 5, phase, revision: 1, detail: 'state-committed' })) }
const response = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
const calls = [], errors = [], results = []
globalThis.fetch = async url => {
  const parsed = new URL(url, 'http://fixture'), path = parsed.pathname
  calls.push(path)
  if (path.endsWith('/mvu/resources')) return response({ records: [record] })
  if (path.endsWith('/mvu/resource')) return response({ record })
  if (path.endsWith('/mvu/history')) return response({ versions: [version] })
  if (path.endsWith('/mvu/facts')) return response(facts)
  if (path.endsWith('/assemblies/capture')) return response({ record: detail })
  if (path.endsWith('/assemblies')) return response({ records: [summary], storage })
  throw new Error(`Unexpected fixture path ${path}`)
}
class SlotBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error, info) { errors.push({ message: error.message, stack: info.componentStack }) }
  render() { return this.state.failed ? h('div', { 'data-slot-error': 'conversation.view' }) : this.props.children }
}
window.addEventListener('error', event => errors.push({ message: event.message }))
window.addEventListener('unhandledrejection', event => errors.push({ message: String(event.reason) }))
installTavernTraceStyles()
const style = document.createElement('style')
style.textContent = 'html,body{height:100%;margin:0;font:14px system-ui;--dsw-alias-bg-base:#fff;--dsw-alias-label-primary:#222;--dsw-alias-label-tertiary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#ddd}.shell{height:100%;display:flex;flex-direction:column}.header{flex:none;height:76px}.body{display:flex;flex-direction:column;flex:1;min-height:0}.scrollBody{display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto}.viewArea{display:flex;flex-direction:column;flex:1 0 auto;min-height:auto}.composer{flex:none;height:120px;background:#fafafa;position:sticky;bottom:0}'
document.head.append(style)
document.body.innerHTML = '<div class="shell"><header class="header">Authored conversation · Trace selected</header><div class="body"><div class="scrollBody"><div class="viewArea"><div id="root" data-slot="conversation.view" style="display:contents"></div></div><div class="composer">Resident composer</div></div></div></div>'
const root = createRoot(document.getElementById('root'))
const unknownContainer = document.createElement('div'); unknownContainer.id = 'unknown-comparison'; document.body.append(unknownContainer)
const unknownRoot = createRoot(unknownContainer)
const before = JSON.stringify({ record, version, facts, detail })
const wait = () => new Promise(resolve => setTimeout(resolve, 400))
async function run() {
for (const [locale, absent, unknown] of [['zh-CN', '不存在', '未记录'], ['en', 'Absent', 'Not recorded']]) {
  setClientUiSettings({ locale, scale: 1 }, { announce: false })
  root.render(h(SlotBoundary, { key: locale },
    h(TavernTraceView, { sessionId: sid, useSession: select => select({ running: false }), useChat: select => select({ legacy: { nodes: [{ seq: 65 }] } }) })))
  await wait()
  const view = document.querySelector('.dttrace-root'), rect = view?.getBoundingClientRect(), text = view?.textContent ?? ''
  const cells = [...(view?.querySelectorAll('.dtmvu-table .dtmvu-table tbody td') ?? [])].map(cell => cell.textContent)
  results.push({ name: `${locale}: full Trace mounts through source/history/facts with missing comparison values`,
    pass: rect?.height > 100 && !!view?.querySelector('.dttrace-toolbar') && !!view?.querySelector('.dtmvu-variables') && cells.filter(value => value === absent).length === 2 && !errors.length,
    detail: { errors, height: rect?.height, absentCells: cells.filter(value => value === absent).length } })
  unknownRoot.render(h(SlotBoundary, { key: locale }, h(MvuEventsTable, { events: [{ eventId: 'unknown', phases: [], changes: [{ path: '/stat_data/known', beforeKnown: false, beforePresent: true, before: 'PRIVATE UNKNOWN', afterPresent: true, after: 'known value' }] }] })))
  await wait()
  results.push({ name: `${locale}: unknown comparison is labelled and values stay escaped`,
    pass: document.getElementById('unknown-comparison')?.textContent.includes(unknown) && !document.body.textContent.includes('PRIVATE UNKNOWN') && text.includes('<img src=x onerror=alert(1)>') && !view?.querySelector('img'), detail: errors })
}
results.push({ name: 'source payloads and metadata stay unchanged; read-only API paths only', pass: JSON.stringify({ record, version, facts, detail }) === before && calls.every(path => /\/(assemblies|capture|resources|resource|history|facts)$/.test(path)) })
for (const error of errors) results.push({ name: `React boundary error: ${error.message} ${error.stack ?? ''}`, pass: false })
const output = document.createElement('pre'); output.id = 'results'; output.textContent = JSON.stringify(results); document.body.append(output)
}
run()
