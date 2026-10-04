import { createElement, useEffect, useRef, useState } from 'react'
import { createLocalizedElement, rawText, translate, uiMessage } from '../../client/src/i18n.js'
import { editVariable, mvuRequest, roundEvents, roundSnapshot, rowsAt, versionTurn } from './mvu-data.js'

const h = createLocalizedElement(createElement)
const PAGE_SIZE = 50
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
  return h('div', { className: 'dtmvu-scroll' }, h('table', { className: 'dtmvu-table', 'aria-label': translate('trace.mvu.variables') },
    h('thead', null, h('tr', null, ...['path', 'value', 'type', 'lastUpdate', 'edit'].map(key => h('th', { key, scope: 'col' }, uiMessage(`trace.mvu.${key}`))))),
    h('tbody', null, ...rows.map(row => h('tr', { key: row.path },
      h('td', null, rawText(row.path)),
      h('td', null, editing?.path === row.path ? h('textarea', { className: 'dtmvu-input', 'aria-label': translate('trace.mvu.jsonValue', { path: row.path }), value: editing.text, disabled: saving, onChange: event => onText(event.target.value) }) : h('pre', { className: 'dtmvu-value' }, rawText(valueText(row.value)))),
      h('td', null, rawText(row.type)), h('td', null, rawText(sourceLabel(row.updated))),
      h('td', null, editing?.path === row.path ? h('div', { className: 'dtmvu-actions' },
        h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !editable, onClick: onSave }, uiMessage('trace.mvu.save')),
        h('button', { type: 'button', className: 'dttrace-button', disabled: saving, onClick: onCancel }, uiMessage('common.cancel'))) : editable ?
        h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !!editing, onClick: () => onEdit(row) }, uiMessage('trace.mvu.edit')) : uiMessage('trace.mvu.readOnly')),
    )))))
}

function ResourceVariables({ item, scope, turn, latest, running, refresh }) {
  const { record, versions, facts } = item
  const round = roundSnapshot(versions, turn)
  const [selectedKey, setSelectedKey] = useState('')
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
  const selected = selectedKey ? versions.find(version => version.key === selectedKey) : round
  const content = current?.content ?? selected?.variables
  const rows = content ? rowsAt(content, versions, current ? versions.find(version => version.revision === current.revision) ?? {key:null} : selected) : []
  const filtered = rows.filter(row => row.path.toLowerCase().includes(query.toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), shownPage = Math.min(page, pages - 1)
  const editable = !!current && latest && !running && !record.legacy && !record.sourceError && record.capabilities?.edit !== false
  const enterCurrent = async () => {
    const signal = lifetime.current.signal
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await mvuRequest('resource', { scope, id: record.id, signal })
      if (!signal.aborted) { setCurrent(result.record); setEditing(null); setPage(0) }
    } catch (e) { if (!signal.aborted) setError(e.code ?? e.message) }
    finally { if (!signal.aborted) setSaving(false) }
  }
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
  return h('div', { className: 'dtmvu-resource' },
    h('div', { className: 'dtmvu-actions' }, h('strong', null, rawText(record.name)),
      h('span', { className: 'dttrace-meta' }, rawText(record.id)),
      h('label', null, uiMessage('trace.mvu.snapshot'), ' ', h('select', { className: 'dtmvu-select', value: current ? 'current' : selectedKey, disabled: saving || !!editing, onChange: event => choose(event.target.value) },
        h('option', { value: '' }, uiMessage('trace.mvu.roundSnapshot')),
        current ? h('option', { value: 'current' }, uiMessage('trace.mvu.current')) : null,
        ...versions.filter(version => versionTurn(version) === turn || turn === 1 && versionTurn(version) === 0).map(version => h('option', { key: version.key, value: version.key }, rawText(`r${version.revision} · ${sourceLabel({turn:versionTurn(version)})} · ${version.source.inherited ? translate('trace.mvu.event.inherited_snapshot') : version.source.manual ? translate(version.source.card ? 'trace.mvu.event.card_variable_update' : 'trace.mvu.event.manual_update') : translate('trace.mvu.event.assistant_message_committed')}`))))),
      latest && !running && !record.legacy && !record.sourceError && record.capabilities?.edit !== false ? h('button', { type: 'button', className: 'dttrace-button', disabled: saving || !!editing, onClick: enterCurrent }, uiMessage('trace.mvu.editCurrent')) : null),
    h('p', { className: 'dttrace-note' }, uiMessage(current ? 'trace.mvu.currentNotice' : 'trace.mvu.historicalNotice'),
      content ? rawText(` · r${current?.revision ?? selected.revision}`) : null),
    record.sourceError ? h('p', { className: 'dttrace-status', 'data-error': true }, rawText(record.sourceError)) : null,
    current && (!latest || running) ? h('p', { className: 'dttrace-status' }, uiMessage('trace.mvu.editingStopped')) : null,
    error ? h('p', { role: 'alert', className: 'dttrace-status', 'data-error': true }, rawText(error)) : null,
    notice ? h('p', { role: 'status', className: 'dttrace-status' }, rawText(notice)) : null,
    content ? h('div', null,
      h('label', { className: 'dtmvu-actions' }, uiMessage('trace.mvu.filter'), h('input', { className: 'dtmvu-input', value: query, onChange: event => { setQuery(event.target.value); setPage(0) } })),
      h(MvuVariablesTable, { rows: filtered.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE), editable, editing, saving,
        onEdit: row => { setEditing({ ...row, text: valueText(row.value), operationId: crypto.randomUUID() }); setError(''); setNotice('') },
        onText: text => setEditing(draft => ({ ...draft, text, operationId: crypto.randomUUID() })), onSave: save, onCancel: () => setEditing(null) }),
      h('div', { className: 'dtmvu-actions' },
        h('button', { type: 'button', className: 'dttrace-button', disabled: shownPage === 0, onClick: () => setPage(shownPage - 1) }, uiMessage('trace.mvu.previous')),
        rawText(`${shownPage + 1} / ${pages} · ${filtered.length}`),
        h('button', { type: 'button', className: 'dttrace-button', disabled: shownPage + 1 >= pages, onClick: () => setPage(shownPage + 1) }, uiMessage('trace.mvu.next')))) :
      h('p', { className: 'dttrace-note' }, uiMessage('trace.mvu.noSnapshot')),
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
.dtmvu-resource{display:flex;flex-direction:column;gap:9px;min-width:0;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dtmvu-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px}.dtmvu-actions strong{overflow-wrap:anywhere}.dtmvu-actions label{max-width:100%}
.dtmvu-scroll{max-width:100%;overflow:auto}.dtmvu-table{width:100%;min-width:660px;border-collapse:collapse;font-size:12px;line-height:1.5;text-align:left}.dtmvu-table th,.dtmvu-table td{padding:7px 9px;border:1px solid var(--dsw-alias-border-l1);vertical-align:top;overflow-wrap:anywhere}.dtmvu-table th{font-weight:650;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-tip))}.dtmvu-table td:first-child{min-width:110px;max-width:280px}.dtmvu-value{white-space:pre-wrap;overflow-wrap:anywhere;min-width:100px;max-width:480px;max-height:160px;overflow:auto;margin:0;font-size:12px}.dtmvu-input,.dtmvu-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;padding:6px;max-width:100%}.dtmvu-table textarea{min-width:180px;min-height:80px;resize:vertical}.dtmvu-table td[data-result=failed]{color:var(--dsw-alias-state-error)}
`
