import { createElement, useState, useSyncExternalStore } from 'react'
import { createLocalizedElement, rawText, uiMessage } from '../i18n.js'
import { playthroughDisplayTitle } from './title.js'
import { workspaceDiagnosticReport } from './diagnostics-state.js'

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
  if (issue.code === 'PLAY_SESSION_NOT_FOUND') return ['diagnostics.sessionMissing', 'play.sidebar.missingSessionHistory']
  if (issue.code === 'PLAY_PATH_NOT_FOUND') return ['diagnostics.fileMissing', 'diagnostics.restoreFile']
  return [issue.kind === 'workspace' ? 'diagnostics.workspaceFailed' : 'diagnostics.timelineFailed', 'diagnostics.retryHint']
}

export function WorkspaceDiagnosticsPanel({ controller, playthroughId = null, showAll, close }) {
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
