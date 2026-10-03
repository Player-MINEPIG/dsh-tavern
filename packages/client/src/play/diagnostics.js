import { createElement, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createLocalizedElement, rawText, uiMessage } from '../i18n.js'
import { playthroughDisplayTitle } from './title.js'
import { workspaceDiagnosticReport } from './diagnostics-state.js'
import { operationLabel, operationResult, operationObjects, operationPageJsonl } from './operation-log-view.js'

const h = createLocalizedElement(createElement)

export const diagnosticsCss = `
.dtv-diagnostic-summary{display:flex;align-items:center;gap:4px;margin:4px 8px;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font-size:11px}
.dtv-diagnostic-summary button,.dtv-diagnostic-warning{border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:5px}
.dtv-diagnostic-summary button:hover,.dtv-diagnostic-warning:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-diagnostic-summary>button:first-child{flex:1;min-width:0;text-align:left;overflow-wrap:anywhere}.dtv-diagnostic-summary>button:last-child{flex:none}
.dtv-diagnostic-warning{flex:none;min-width:28px;min-height:28px;color:var(--dsw-alias-state-warning,#ce942c)}
.dtv-diagnostic-card{border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:12px;display:flex;flex-direction:column;gap:10px;overflow-wrap:anywhere}
.dtv-diagnostic-card h3{font-size:13px;margin:0}.dtv-diagnostic-card p{margin:0;font-size:12px;line-height:1.6}
.dtv-diagnostic-card details{font-size:11px}.dtv-diagnostic-card summary{cursor:pointer;padding:5px 0}.dtv-diagnostic-card pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;margin:8px 0;user-select:text}
.dtv-operation-log{min-width:0}.dtv-operation-log>.dtv-actions{flex-wrap:wrap;margin:10px 0}
.dtv-operation-advanced{margin:10px 0}.dtv-operation-advanced label{display:flex;flex-direction:column;gap:6px;font-size:12px}
.dtv-operation-advanced input{box-sizing:border-box;width:100%;min-width:0;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-background-primary,transparent);color:inherit;font:inherit}
.dtv-operation-list{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.dtv-operation-row{min-width:0;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px}
.dtv-operation-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px}.dtv-operation-heading time{font-size:11px;color:var(--dsw-alias-label-secondary)}
.dtv-operation-result{display:block;margin:5px 0;font-size:12px}.dtv-operation-result[data-tone=warning]{font-weight:600}
.dtv-operation-object{display:flex;gap:6px;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary)}.dtv-operation-object span{flex:none}.dtv-operation-object code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;user-select:text}
.dtv-operation-log .dtv-operation-raw{white-space:pre;overflow:auto;overflow-wrap:normal;max-height:240px;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px}
.dtv-operation-id{display:block;overflow:auto;white-space:nowrap;max-width:100%;padding:6px 0;user-select:text}.dtv-operation-row .dtv-actions{flex-wrap:wrap}
`

export function WorkspaceDiagnosticSummary({ snapshot, controller }) {
  if (snapshot.loading || !snapshot.showSummary) return null
  return h('div', { className: 'dtv-diagnostic-summary', role: 'status' },
    h('button', { type: 'button', onClick: () => controller.open() },
      uiMessage(snapshot.error ? 'diagnostics.workspaceSummary' : 'diagnostics.timelineSummary', { count: snapshot.issues.length })),
    h('button', { type: 'button', onClick: () => controller.dismiss(), title: uiMessage('diagnostics.dismiss'), 'aria-label': uiMessage('diagnostics.dismiss') }, '×'),
  )
}

export function PlaythroughDiagnosticWarning({ playthrough, controller }) {
  return h('button', {
    type: 'button', className: 'dtv-diagnostic-warning',
    title: uiMessage('diagnostics.playthrough', { name: playthroughDisplayTitle(playthrough) }),
    'aria-label': uiMessage('diagnostics.playthrough', { name: playthroughDisplayTitle(playthrough) }),
    onClick: () => controller.open(playthrough.id),
  }, '⚠')
}

function explanation(issue) {
  if (issue.code === 'PLAY_NO_AVAILABLE_SESSION') return ['diagnostics.sessionUnavailable', 'diagnostics.sessionUnavailableHint']
  if (issue.code === 'PLAY_SESSION_NOT_FOUND') return ['diagnostics.sessionMissing', 'play.sidebar.missingSessionHistory']
  if (issue.code === 'PLAY_PATH_NOT_FOUND') return ['diagnostics.fileMissing', 'diagnostics.restoreFile']
  return [issue.kind === 'workspace' ? 'diagnostics.workspaceFailed' : 'diagnostics.timelineFailed', 'diagnostics.retryHint']
}

export function WorkspaceDiagnosticsPanel({ client, controller, playthroughId = null, showAll, close }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [copyStatus, setCopyStatus] = useState(null)
  const issues = playthroughId === null ? snapshot.issues : snapshot.issues.filter(issue => issue.kind === 'workspace' || issue.playthroughId === playthroughId)
  const copy = async selected => {
    try {
      await navigator.clipboard.writeText(workspaceDiagnosticReport(snapshot, selected))
      setCopyStatus('diagnostics.copied')
    } catch { setCopyStatus('diagnostics.copyFailed') }
  }
  return h('section', { className: 'dtv-panel dtv-diagnostics', 'aria-label': uiMessage('nav.diagnostics') },
    h('div', { className: 'dtv-header' },
      h('span', { className: 'dtv-title' }, uiMessage('nav.diagnostics')),
      h('button', { type: 'button', className: 'dtv-close', onClick: close, 'aria-label': uiMessage('common.close') }, '×'),
    ),
    h('div', { className: 'dtv-body' },
      h(OperationLogsPanel, { client }),
      h('p', { className: 'dtv-note' }, uiMessage('diagnostics.scope')),
      snapshot.resources?.workspace?.rootPath ? h('p', { className: 'dtv-note' }, rawText(snapshot.resources.workspace.rootPath)) : null,
      h('div', { className: 'dtv-actions' },
        h('button', { type: 'button', className: 'dtv-button', disabled: snapshot.loading, onClick: () => { setCopyStatus(null); void controller.refresh() } }, uiMessage('diagnostics.recheck')),
        h('button', { type: 'button', className: 'dtv-button', disabled: snapshot.loading || issues.length === 0, onClick: () => copy(issues) }, uiMessage('diagnostics.copy')),
      ),
      playthroughId !== null ? h('button', { type: 'button', className: 'dtv-button', onClick: showAll }, uiMessage('diagnostics.showAll', { count: snapshot.issues.length })) : null,
      copyStatus ? h('p', { className: 'dtv-status', role: 'status', 'data-error': copyStatus === 'diagnostics.copyFailed' }, uiMessage(copyStatus)) : null,
      snapshot.loading ? h('p', { className: 'dtv-note', role: 'status' }, uiMessage('diagnostics.loading'))
        : issues.length === 0 ? h('p', { className: 'dtv-note', role: 'status' }, uiMessage(snapshot.resources?.workspace?.selected === false ? 'diagnostics.noWorkspace' : playthroughId !== null ? 'diagnostics.noPlaythroughIssues' : 'diagnostics.empty')) : null,
      ...issues.map(issue => {
        const [cause, suggestion] = explanation(issue)
        const title = [issue.characterName, playthroughDisplayTitle(issue.playthrough)].filter(Boolean).join(' · ')
        return h('article', { className: 'dtv-diagnostic-card', key: issue.key },
          title ? h('h3', null, rawText(title)) : null,
          h('p', null, uiMessage(cause)),
          h('p', { className: 'dtv-note' }, uiMessage(suggestion)),
          h('details', null,
            h('summary', null, uiMessage('diagnostics.technical')),
            h('pre', null, rawText(workspaceDiagnosticReport(snapshot, [issue]))),
          ),
          h('button', { type: 'button', className: 'dtv-button', onClick: () => copy([issue]) }, uiMessage('diagnostics.copyOne')),
        )
      }),
    ),
  )
}

// User-triggered reads only: opening the panel reads once; no background polling.
export function OperationLogsPanel({ client }) {
  const [operationId, setOperationId] = useState('')
  const [page, setPage] = useState(null)
  const [status, setStatus] = useState(null)
  const [copyStatus, setCopyStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const filterHelpId = useId()
  useEffect(() => {
    setPage(null); setStatus(null); setBusy(false); setCopyStatus(null)
    return () => { generation.current++ }
  }, [client])
  const load = async before => {
    const current = ++generation.current
    setBusy(true)
    setStatus(null)
    try {
      if (!client?.getOperationLogs) { setStatus('diagnostics.logsUnavailable'); return }
      const value = await client.getOperationLogs({ operationId: operationId.trim(), before, limit: 100 })
      if (current === generation.current) setPage(value)
    } catch (error) {
      if (current === generation.current) {
        setPage(null)
        setStatus(error?.status === 404 ? 'diagnostics.logsUnavailable' : error?.code === 'LOG_CURSOR_EXPIRED' ? 'diagnostics.logsExpired' : 'diagnostics.logsFailed')
      }
    } finally { if (current === generation.current) setBusy(false) }
  }
  const download = () => {
    if (!page) return
    const url = URL.createObjectURL(new Blob([operationPageJsonl(page)], { type: 'application/x-ndjson' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'tavern-operation-logs.jsonl'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copyId = async id => {
    try { await navigator.clipboard.writeText(id); setCopyStatus('diagnostics.logsIdCopied') }
    catch { setCopyStatus('diagnostics.copyFailed') }
  }
  return h('details', {
    className: 'dtv-diagnostic-card dtv-operation-log',
    onToggle: event => {
      if (event.target !== event.currentTarget) return
      if (event.currentTarget.open) { if (!page && !busy) void load() }
      else { generation.current++; setBusy(false) }
    },
  },
    h('summary', null, uiMessage('diagnostics.logsTitle')),
    h('p', null, uiMessage('diagnostics.logsScope')),
    h('details', { className: 'dtv-operation-advanced' },
      h('summary', null, uiMessage('diagnostics.logsAdvanced')),
      h('p', { id: filterHelpId, className: 'dtv-note' }, uiMessage('diagnostics.logsIdHelp')),
      h('label', null, uiMessage('diagnostics.logsFilter'), h('input', {
        value: operationId, maxLength: 128, placeholder: 'operationId', 'aria-describedby': filterHelpId,
        onChange: event => { generation.current++; setBusy(false); setPage(null); setStatus(null); setCopyStatus(null); setOperationId(event.target.value) },
        onKeyDown: event => { if (event.key === 'Enter' && !busy) { event.preventDefault(); void load() } },
      })),
    ),
    operationId.trim() ? h('p', { className: 'dtv-note' }, uiMessage('diagnostics.logsFiltered', { id: operationId.trim() })) : null,
    h('div', { className: 'dtv-actions' },
      h('button', { type: 'button', className: 'dtv-button', disabled: busy, onClick: () => load() }, uiMessage('diagnostics.logsLoad')),
      h('button', { type: 'button', className: 'dtv-button', disabled: busy || !page?.nextCursor, onClick: () => load(page.nextCursor) }, uiMessage('diagnostics.logsOlder')),
      h('button', { type: 'button', className: 'dtv-button', disabled: busy || !page, onClick: download }, uiMessage('diagnostics.logsExport')),
    ),
    h('p', { className: 'dtv-note' }, uiMessage('diagnostics.logsPrivacy')),
    busy ? h('p', { role: 'status' }, uiMessage('diagnostics.logsLoading')) : null,
    status ? h('p', { role: 'status' }, uiMessage(status)) : null,
    copyStatus ? h('p', { role: 'status' }, uiMessage(copyStatus)) : null,
    page ? h('div', { 'aria-busy': busy },
      h('p', { role: 'status' }, uiMessage(page.storage.available && !page.storage.dropped && !page.storage.skippedRecords ? 'diagnostics.logsReady' : 'diagnostics.logsDegraded', { count: page.records.length })),
      page.records.length === 0 ? h('p', { className: 'dtv-note' }, uiMessage(operationId.trim() ? 'diagnostics.logsNoMatch' : 'diagnostics.logsEmpty')) : null,
      h('ol', { className: 'dtv-operation-list', 'aria-label': uiMessage('diagnostics.logsRecords') }, ...page.records.map((row, index) => {
        const result = operationResult(row)
        return h('li', { className: 'dtv-operation-row', key: row.id ?? index },
          h('div', { className: 'dtv-operation-heading' },
            h('strong', null, operationLabel(row)),
            row.timestamp ? h('time', { dateTime: row.timestamp }, rawText(new Date(row.timestamp).toLocaleString())) : null,
          ),
          h('span', { className: 'dtv-operation-result', 'data-tone': result.tone }, result.label),
          ...operationObjects(row).map(object => h('div', { className: 'dtv-operation-object', key: object.key }, h('span', null, object.label), object.key === 'scope' ? h('span', null, object.value) : h('code', { title: rawText(object.value) }, rawText(object.value)))),
          h('details', null,
            h('summary', null, uiMessage('diagnostics.logsDetails')),
            row.operationId ? h('div', null,
              h('p', null, uiMessage('diagnostics.logsIdShort')),
              h('code', { className: 'dtv-operation-id' }, rawText(row.operationId)),
              h('button', { type: 'button', className: 'dtv-button', onClick: () => copyId(row.operationId), 'aria-label': uiMessage('diagnostics.logsCopyIdFor', { id: row.operationId }) }, uiMessage('diagnostics.logsCopyId')),
            ) : null,
            h('pre', { className: 'dtv-operation-raw', tabIndex: 0, 'aria-label': uiMessage('diagnostics.logsRawRecord') }, rawText(JSON.stringify(row, null, 2))),
          ),
        )
      })),
      h('details', null,
        h('summary', null, uiMessage('diagnostics.logsMetadata')),
        h('pre', { className: 'dtv-operation-raw', tabIndex: 0, 'aria-label': uiMessage('diagnostics.logsMetadata') }, rawText(JSON.stringify(Object.fromEntries(Object.entries(page).filter(([key]) => key !== 'records')), null, 2))),
      ),
    ) : null,
  )
}
