import { createElement, useEffect, useRef, useState } from 'react'
import { createLocalizedElement, rawText, translate, uiMessage } from '../../client/src/i18n.js'
import { editVariable, mvuRequest, roundEvents, roundSnapshot, rowsAt, versionTurn } from './mvu-data.js'

const h = createLocalizedElement(createElement)
const PAGE_SIZE = 20
const valueText = value => JSON.stringify(value, null, 2)
const sourceLabel = source => source?.turn === 0 ? translate('trace.mvu.opening') : Number.isSafeInteger(source?.turn)
  ? translate('trace.mvu.turn', { turn: source.turn }) : translate('trace.mvu.notRecorded')
const eventName = event => translate(`trace.mvu.event.${event.on ?? (event.detail === 'dsh-request-observed' ? 'request' : 'unknown')}`)
function eventStatus(event) {
  if (event.phases.includes('failed') || event.version?.error) return 'failed'
  if (event.phases.includes('skipped')) return 'skipped'
  if (event.phases.includes('applied')) return 'applied'
  if (event.phases.includes('completed')) return 'completed'
  if (event.phases.includes('triggered')) return 'triggered'
  return event.phases.length ? 'started' : 'unknown'
}
function CellValue({ present, known = true, value }) {
  return known ? present ? h('pre', { className: 'dtmvu-value' }, rawText(valueText(value))) : uiMessage('trace.mvu.absent') : uiMessage('trace.mvu.notRecorded')
}
export function MvuEventsTable({ events }) {
  return events.length ? h('div', { className: 'dtmvu-scroll' },
    h('table', { className: 'dtmvu-table', 'aria-label': translate('trace.mvu.events') },
      h('thead', null, h('tr', null, ...['trigger', 'result', 'changes', 'reason'].map(key => h('th', { key, scope: 'col' }, uiMessage(`trace.mvu.${key}`))))),
      h('tbody', null, ...events.map(event => h('tr', { key: event.key ?? event.eventId },
        h('td', null, rawText(eventName(event)), h('div', { className: 'dttrace-meta' }, rawText(sourceLabel(event))),
          event.cause ? h('div', { className: 'dttrace-meta' }, rawText(event.cause)) : null,
          h('details', null, h('summary', null, uiMessage('trace.mvu.eventId')), rawText(event.eventId))),
        h('td', { 'data-result': eventStatus(event) }, uiMessage(`trace.mvu.status.${eventStatus(event)}`),
          event.revision !== undefined ? h('div', { className: 'dttrace-meta' }, rawText(`r${event.revision}`)) : null),
        h('td', null, event.changes.length ? h('details', null,
          h('summary', null, uiMessage('trace.mvu.changeCount', { count: event.changes.length })),
          h('table', { className: 'dtmvu-table' },
            h('thead', null, h('tr', null, ...['path', 'before', 'after'].map(key => h('th', { key, scope: 'col' }, uiMessage(`trace.mvu.${key}`))))),
            h('tbody', null, ...event.changes.map(change => h('tr', { key: change.path },
              h('td', null, rawText(change.path)), h('td', null, h(CellValue, { known: change.beforeKnown, present: change.beforePresent, value: change.before })),
              h('td', null, h(CellValue, { present: change.afterPresent, value: change.after }))))))) : uiMessage(event.version ? event.comparisonAvailable ? 'trace.mvu.noChange' : 'trace.mvu.noBefore' : 'trace.mvu.noStateChange'),
          event.version?.variables?.update_diagnostics?.length ? h('details', null,
            h('summary', null, uiMessage('trace.mvu.diagnostics')),
            h('ul', null, ...event.version.variables.update_diagnostics.map((item, index) => h('li', { key: index }, rawText(item.code))))) : null),
        h('td', null, event.reason ? rawText(event.reason) : uiMessage('common.none')),
      ))))) : h('p', { className: 'dttrace-note' }, uiMessage('trace.mvu.noEvents'))
}

export function MvuVariablesTable({ rows, editable, editing, saving, onEdit, onText, onSave, onCancel }) {
  return h('div', { className: 'dtmvu-scroll' }, h('table', { className: 'dtmvu-table dtmvu-variables', 'aria-label': translate('trace.mvu.variables') },
    h('colgroup', null, ...['path', 'value', 'type', 'updated', 'edit'].map(key => h('col', { key, className: `dtmvu-col-${key}` }))),
    h('thead', null, h('tr', null, ...['path', 'value', 'type', 'lastUpdate', 'edit'].map(key => h('th', { key, scope: 'col' }, uiMessage(`trace.mvu.${key}`))))),
    h('tbody', null, rows.length ? rows.map(row => h('tr', { key: row.path },
      h('td', null, rawText(row.path)),
      h('td', null, editing?.path === row.path ? h('textarea', { className: 'dtmvu-input', 'aria-label': translate('trace.mvu.jsonValue', { path: row.path }), value: editing.text, autoFocus: true, disabled: saving, onChange: event => onText(event.target.value) }) : h('pre', { className: 'dtmvu-value' }, rawText(valueText(row.value)))),
      h('td', null, rawText(row.type)), h('td', null, rawText(sourceLabel(row.updated))),
      h('td', { className: 'dtmvu-row-actions' }, editing?.path === row.path ? h('div', { className: 'dtmvu-actions' },
        h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !editable, onClick: onSave }, uiMessage('trace.mvu.save')),
        h('button', { type: 'button', className: 'dttrace-button', disabled: saving, onClick: onCancel }, uiMessage('common.cancel'))) : editable ?
        h('button', { type: 'button', className: 'dttrace-button', 'aria-label': translate('trace.mvu.editValue', { path: row.path }), disabled: saving || !!editing, onClick: () => onEdit(row) }, uiMessage('trace.mvu.edit')) : uiMessage('trace.mvu.readOnly')),
    )) : h('tr', null, h('td', { colSpan: 5, className: 'dtmvu-empty' }, uiMessage('trace.mvu.noMatches'))))))
}

function ResourceVariables({ item, scope, turn, latest, running, refresh }) {
  const { record, versions, facts } = item
  const round = roundSnapshot(versions, turn)
  const currentAvailable = latest && !record.legacy && !record.sourceError && record.capabilities?.edit !== false
  const [selectedKey, setSelectedKey] = useState(() => currentAvailable ? 'current' : '')
  const [current, setCurrent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const lifetime = useRef(null)
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    return () => controller.abort()
  }, [scope.sessionId, record.id])
  const currentMode = selectedKey === 'current'
  const selected = selectedKey && !currentMode ? versions.find(version => version.key === selectedKey) : round
  const content = currentMode ? current?.content : selected?.variables
  const rows = content ? rowsAt(content, versions, currentMode ? versions.find(version => version.revision === current.revision) ?? {key:null} : selected) : []
  const filtered = rows.filter(row => row.path.toLowerCase().includes(query.toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), shownPage = Math.min(page, pages - 1)
  const editable = currentMode && !!current && currentAvailable && !running
  const currentRevision = current?.currentRevision ?? current?.revision
  const staleCurrent = currentMode && !!current && record.revision > currentRevision
  const readCurrent = async () => {
    const signal = lifetime.current.signal
    setSaving(true); setCurrent(null); setError(''); setNotice('')
    try {
      const result = await mvuRequest('resource', { scope, id: record.id, signal })
      if (!signal.aborted) { setCurrent(result.record); setEditing(null); setPage(0) }
    } catch (e) { if (!signal.aborted) setError(e.code ?? e.message) }
    finally { if (!signal.aborted) setSaving(false) }
  }
  useEffect(() => {
    if (currentMode) readCurrent()
  }, [selectedKey, scope.sessionId, record.id])
  useEffect(() => {
    // Polling may observe a newer source revision. Refresh only an idle current
    // view; a draft must keep its original value, revision and operation ID.
    if (currentAvailable && staleCurrent && !editing && !saving && !running) readCurrent()
  }, [currentAvailable, staleCurrent, !!editing, saving, running])
  const save = async () => {
    if (!editable) return
    const signal = lifetime.current.signal
    setSaving(true); setError(''); setNotice('')
    try {
      const content = editVariable(current.content, editing.parts, editing.text)
      const result = await mvuRequest('update', { signal, body: { id: record.id, scope, content, expectedRevision: current.currentRevision ?? current.revision, operationId: editing.operationId } })
      if (!signal.aborted) {
        // Display the source's validated/transformed result, not the local draft.
        setCurrent({ ...current, content: result.content, revision: result.revision, currentRevision: result.revision })
        setEditing(null); setNotice(translate('trace.mvu.saved', { revision: result.revision })); refresh()
      }
    } catch (e) {
      if (!signal.aborted) setError(e.code === 'REVISION_CONFLICT' ? translate('trace.mvu.conflict') : `${e.code ?? 'MVU_EDIT'}: ${e.message}`)
    } finally { if (!signal.aborted) setSaving(false) }
  }
  const choose = key => { setSelectedKey(key); setCurrent(null); setEditing(null); setError(''); setNotice(''); setPage(0) }
  return h('div', { className: 'dtmvu-resource dttrace-card' },
    h('div', { className: 'dtmvu-heading' },
      h('div', { className: 'dtmvu-identity' }, h('strong', null, rawText(record.name)), h('div', { className: 'dttrace-meta' }, rawText(record.id)),
        h('div', { className: 'dttrace-meta', 'data-management-mode': record.managementMode }, uiMessage(`trace.mvu.management.${record.managementMode ?? 'unknown'}`))),
      h('label', { className: 'dtmvu-source' }, uiMessage('trace.mvu.snapshot'), h('select', { className: 'dtmvu-select', value: selectedKey, disabled: saving || !!editing, onChange: event => choose(event.target.value) },
        currentAvailable || currentMode ? h('option', { value: 'current' }, uiMessage('trace.mvu.current')) : null,
        h('option', { value: '' }, uiMessage('trace.mvu.roundSnapshot')),
        ...versions.filter(version => versionTurn(version) === turn || turn === 1 && versionTurn(version) === 0).map(version => h('option', { key: version.key, value: version.key }, rawText(`r${version.revision} · ${sourceLabel({turn:versionTurn(version)})} · ${version.source.inherited ? translate('trace.mvu.event.inherited_snapshot') : version.source.manual ? translate(version.source.card ? 'trace.mvu.event.card_variable_update' : 'trace.mvu.event.manual_update') : translate('trace.mvu.event.assistant_message_committed')}`)))))),
    h('p', { className: 'dttrace-note' }, uiMessage(currentMode ? 'trace.mvu.currentNotice' : 'trace.mvu.historicalNotice'),
      content ? rawText(` · r${current?.revision ?? selected.revision}`) : null),
    h('details', { className: 'dtmvu-help dttrace-note' }, h('summary', null, uiMessage('trace.mvu.snapshotHelp')), h('p', null, uiMessage('trace.mvu.snapshotHelpText'))),
    record.sourceError ? h('p', { className: 'dttrace-status', 'data-error': true }, rawText(record.sourceError)) : null,
    current && (!latest || running) ? h('p', { className: 'dttrace-status' }, uiMessage('trace.mvu.editingStopped')) : null,
    staleCurrent && editing ? h('p', { role: 'status', className: 'dttrace-status' }, uiMessage('trace.mvu.currentChanged', { revision: record.revision, draftRevision: currentRevision })) : null,
    error ? h('p', { role: 'alert', className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
    notice ? h('p', { role: 'status', className: 'dttrace-status' }, rawText(notice)) : null,
    content ? h('div', null,
      h('div', { className: 'dtmvu-toolbar' },
        h('label', { className: 'dtmvu-filter' }, uiMessage('trace.mvu.filter'), h('input', { className: 'dtmvu-input', value: query, disabled: saving || !!editing, onChange: event => { setQuery(event.target.value); setPage(0) } })),
        currentMode ? h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !!editing, onClick: readCurrent }, uiMessage('common.refresh')) : null),
      h(MvuVariablesTable, { rows: filtered.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE), editable, editing, saving,
        onEdit: row => { setEditing({ ...row, text: valueText(row.value), operationId: crypto.randomUUID() }); setError(''); setNotice('') },
        onText: text => setEditing(draft => ({ ...draft, text, operationId: crypto.randomUUID() })), onSave: save, onCancel: () => setEditing(null) }),
      h('div', { className: 'dtmvu-pagination' },
        h('span', { className: 'dttrace-meta', role: 'status' }, uiMessage('trace.mvu.pageInfo', { page: shownPage + 1, pages, count: filtered.length, pageSize: PAGE_SIZE })),
        h('div', { className: 'dtmvu-actions' },
          h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !!editing || shownPage === 0, onClick: () => setPage(shownPage - 1) }, uiMessage('trace.mvu.previous')),
          h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !!editing || shownPage + 1 >= pages, onClick: () => setPage(shownPage + 1) }, uiMessage('trace.mvu.next'))))) :
      h('div', { className: 'dtmvu-actions' },
        h('p', { className: 'dttrace-note' }, uiMessage(currentMode ? saving ? 'trace.reading' : 'trace.mvu.currentUnavailable' : 'trace.mvu.noSnapshot')),
        currentMode && !saving ? h('button', { type: 'button', className: 'dttrace-button', onClick: readCurrent }, uiMessage('common.refresh')) : null),
    h('div', { className: 'dttrace-section-title' }, uiMessage('trace.mvu.events')),
    h(MvuEventsTable, { events: roundEvents(versions, facts.records, turn) }),
    h('p', { className: 'dttrace-note' }, uiMessage('trace.mvu.retention', { count: facts.maxRecords })),
    facts.unavailable ? h('p', { className: 'dttrace-status', 'data-error': true }, uiMessage('trace.mvu.factsUnavailable')) : null,
  )
}

export function MvuRoundSection({ sessionId, turn, latest, running, lastVisibleSeq }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [version, setVersion] = useState(0)
  const [opened, setOpened] = useState(true)
  const cache = useRef(new Map())
  const refresh = () => setVersion(value => value + 1)
  useEffect(() => {
    if (!opened) return
    const controller = new AbortController(), signal = controller.signal, scope = { authority: 'local', sessionId }
    let timer
    const load = async () => {
      try {
        const { records } = await mvuRequest('resources', { scope, signal })
        const items = await Promise.all(records.map(async record => {
          const key = `${sessionId}:${record.id}:${record.revision}`
          let history = cache.current.get(key)
          if (!history) { history = await mvuRequest('history', { scope, id: record.id, signal }); cache.current.set(key, history); if (cache.current.size > 32) cache.current.delete(cache.current.keys().next().value) }
          return { record, versions: history.versions, facts: await mvuRequest('facts', { scope, id: record.id, signal }) }
        }))
        if (!signal.aborted) { setData({ sessionId, items }); setError('') }
      } catch (e) { if (!signal.aborted) setError(`${e.code ?? 'MVU_READ'}: ${e.message}`) }
      if (!signal.aborted && latest) timer = setTimeout(load, 3000)
    }
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [sessionId, turn, latest, running, lastVisibleSeq, version, opened])
  const items = data?.sessionId === sessionId ? data.items : null
  return h('details', { className: 'dttrace-disclosure', open: opened, onToggle: event => setOpened(event.currentTarget.open), 'data-mvu-turn': turn },
    h('summary', null, uiMessage('trace.mvu.title')),
    opened ? h('div', { className: 'dttrace-disclosure-body' },
      error ? h('p', { role: 'alert', className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
      !items && !error ? h('p', null, uiMessage('trace.reading')) : null,
      items?.length === 0 ? h('p', { className: 'dttrace-note' }, uiMessage('trace.mvu.noResource')) : null,
      ...(items ?? []).map(item => h(ResourceVariables, { key: `${sessionId}:${turn}:${item.record.id}`, item, scope: { authority: 'local', sessionId }, turn, latest, running, refresh }))) : null,
  )
}

export const mvuStyles = `
.dtmvu-resource{display:flex;flex-direction:column;gap:10px;min-width:0;padding:10px}
.dtmvu-heading{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px}.dtmvu-identity{flex:1 1 200px;min-width:0}.dtmvu-identity strong{font-size:13px;font-weight:650;overflow-wrap:anywhere}.dtmvu-identity .dttrace-meta{font-size:11px}
.dtmvu-source,.dtmvu-filter{display:flex;align-items:center;gap:8px;font-size:12px;min-width:0}.dtmvu-source{flex-wrap:wrap;max-width:100%}.dtmvu-source select{max-width:340px;min-width:0}.dtmvu-toolbar,.dtmvu-pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.dtmvu-toolbar{margin-bottom:8px}.dtmvu-filter{flex:1}.dtmvu-filter input{width:280px;min-width:0}.dtmvu-pagination{margin-top:8px}.dtmvu-pagination .dttrace-meta{margin:0}
.dtmvu-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px}.dtmvu-resource .dttrace-button{font-size:12px;padding:5px 9px;white-space:nowrap}.dtmvu-resource .dttrace-button:disabled{opacity:.5;cursor:default}.dtmvu-resource .dttrace-button:focus-visible,.dtmvu-input:focus-visible,.dtmvu-select:focus-visible{outline:2px solid var(--dsw-alias-brand,#4d6bfe);outline-offset:2px}
.dtmvu-scroll{max-width:100%;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}.dtmvu-table{width:100%;min-width:660px;border-collapse:collapse;font-size:12px;line-height:1.5;text-align:left}.dtmvu-table th,.dtmvu-table td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;overflow-wrap:anywhere}.dtmvu-table th{font-weight:650;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-tip));color:var(--dsw-alias-label-secondary);text-align:left}.dtmvu-table tbody>tr:last-child>td{border-bottom:0}.dtmvu-table tbody>tr:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtmvu-table td:first-child{min-width:110px;max-width:280px}
.dtmvu-variables{table-layout:fixed;min-width:720px}.dtmvu-col-path{width:28%}.dtmvu-col-type{width:72px}.dtmvu-col-updated{width:100px}.dtmvu-col-edit{width:122px}.dtmvu-row-actions{white-space:nowrap}.dtmvu-row-actions .dtmvu-actions{flex-wrap:nowrap}.dtmvu-empty{color:var(--dsw-alias-label-tertiary);text-align:center;padding:20px!important}
.dtmvu-value{white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto;margin:0;font:12px/1.5 var(--dsw-font-family-mono,monospace)}.dtmvu-input,.dtmvu-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;padding:6px 8px;max-width:100%}.dtmvu-table textarea{display:block;width:100%;min-height:88px;resize:vertical;font:12px/1.5 var(--dsw-font-family-mono,monospace)}.dtmvu-table td[data-result=failed]{color:var(--dsw-alias-state-error)}.dtmvu-help>summary{cursor:pointer}.dtmvu-help>p{margin:6px 0 0}
@media(max-width:760px){.dtmvu-source{width:100%}.dtmvu-source select{flex:1;max-width:100%}.dtmvu-filter input{flex:1;width:100%}}
`
