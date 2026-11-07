import { createElement as h, useEffect, useRef, useState } from 'react'
import { API_V1, CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'
import { characterEditorDirty, characterEditorDraft, characterEditorPatch } from '../../character/src/client-state.js'
import { tavernFetch } from './api-fetch.js'
import { resourceApi } from './resource-api.js'
import { PersonalityMood } from './personality-mood.js'
import { PersonalityEvolution } from './personality-evolution.js'
import { translate } from './i18n.js'

const library = '/personalities'
const resourcePath = id => `${library}/${encodeURIComponent(id)}`
const textFields = [
  ['name', 'common.name'], ['description', 'character.field.description'],
  ['personality', 'character.field.personality'], ['messageExample', 'character.field.messageExamples'],
]
const optionalFields = [
  ['nickname', 'character.field.nickname'], ['scenario', 'character.field.scenario'],
  ['systemPrompt', 'personality.systemPrompt'], ['postHistoryInstructions', 'personality.postHistory'],
  ['firstMessage', 'character.field.firstMessage'], ['creatorNotes', 'character.field.creatorNotes'],
]

export function usePersonalitySelection(sessionId, visible, menuOpen = false) {
  const [selection, setSelection] = useState(null)
  useEffect(() => {
    if (!visible || !sessionId) return
    let latest = 0, timer
    const controller = new AbortController()
    const refresh = async () => {
      clearTimeout(timer)
      if (globalThis.document?.hidden) return
      const request = ++latest
      try {
        const result = await resourceApi(`/personality-selection?sessionId=${encodeURIComponent(sessionId)}`, { signal: controller.signal })
        if (request !== latest || controller.signal.aborted) return
        setSelection({ ...result, sessionId })
        if (result.personalityId) timer = setTimeout(refresh, 5000)
      } catch (failure) {
        if (request !== latest || controller.signal.aborted) return
        setSelection({ sessionId, error: failure.message })
        timer = setTimeout(refresh, 15000)
      }
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
    }
  }, [sessionId, visible, menuOpen])
  return selection?.sessionId === sessionId ? selection : null
}

export function PersonalityUpdateNotice({ selection, onOpen }) {
  const [seen, setSeen] = useState({})
  const notice = selection?.notice
  if (!notice) return null
  const key = `${PLUGIN_ID}:personality-notice:${notice.personalityId}`
  let last = seen[key] ?? 0
  try { last = Math.max(last, Number(window.localStorage.getItem(key)) || 0) } catch { /* optional storage */ }
  if (notice.revision <= last) return null
  const dismiss = () => {
    setSeen(current => ({ ...current, [key]: notice.revision }))
    try { window.localStorage.setItem(key, String(notice.revision)) } catch { /* acknowledged in memory */ }
  }
  return h('div', { className: 'dtv-personality-notice', role: 'status' },
    h('button', { type: 'button', className: 'dtv-button', onClick: () => { if (onOpen(notice)) dismiss() } },
      translate('personality.notice', { name: selection.personality?.name || notice.personalityId })),
    h('button', { type: 'button', className: 'dtv-close', onClick: dismiss, 'aria-label': translate('personality.dismiss') }, '✕'))
}

function button(label, onClick, disabled, primary = false) {
  return h('button', { type: 'button', className: 'dcc-button' + (primary ? ' dcc-primary' : ''), disabled, onClick }, translate(label))
}

export function PersonalityPanel({ sessionId, selection, workspaceId, workspaces = [], openPersonalitySession, noticeTarget, close, registerBeforeLeave }) {
  const [items, setItems] = useState([])
  const [detail, setDetail] = useState(null)
  const [draft, setDraft] = useState(null)
  const [page, setPage] = useState(noticeTarget ? 'evolution' : 'card')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [characters, setCharacters] = useState(null)
  const [copyId, setCopyId] = useState('')
  const [workspaceChoice, setWorkspaceChoice] = useState('')
  const targetWorkspace = workspaceChoice || workspaceId || ''
  const mayOpenSession = !sessionId && typeof openPersonalitySession === 'function' && Boolean(targetWorkspace)
  const [notice, setNotice] = useState('')
  const file = useRef(null)
  const mounted = useRef(false)
  const lock = useRef(false)
  const dirty = characterEditorDirty(draft, characterEditorDraft(detail))
  const selectedId = selection?.personalityId

  const show = next => { setDetail(next); setDraft(characterEditorDraft(next)) }
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    const options = { signal: controller.signal }
    async function initialize() {
      try {
        const list = await resourceApi(library, options)
        // The initial browse target follows the active session if it has a card.
        const initial = sessionId ? await resourceApi(`/personality-selection?sessionId=${encodeURIComponent(sessionId)}`, options) : null
        const id = noticeTarget?.personalityId ?? initial?.personalityId ?? list.personalities[0]?.id
        const loaded = id ? await resourceApi(resourcePath(id), options) : null
        if (controller.signal.aborted) return
        setItems(list.personalities)
        show(loaded?.personality ?? null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message)
      } finally {
        if (!controller.signal.aborted) setBusy(false)
      }
    }
    initialize()
    return () => { mounted.current = false; controller.abort() }
  }, []) // Shell keys this library view to its target session.

  useEffect(() => registerBeforeLeave?.(() => !lock.current && (!dirty || window.confirm(translate('personality.discard')))), [registerBeforeLeave, dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const run = async (operation, message) => {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await operation()
      if (mounted.current && message) setNotice(translate(message))
    } catch (failure) {
      if (mounted.current) setError(failure.message)
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const acceptCard = (next, notify = true) => {
    if (mounted.current) {
      show(next)
      setItems(current => current.some(item => item.id === next.id)
        ? current.map(item => item.id === next.id ? { ...item, name: next.name } : item)
        : [...current, { id: next.id, name: next.name }])
    }
    if (notify) window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }
  const canLeaveCard = () => !dirty || window.confirm(translate('personality.discard'))
  const browse = id => {
    if (canLeaveCard()) run(async () => { const result = await resourceApi(resourcePath(id)); if (mounted.current) show(result.personality) })
  }
  const create = () => {
    if (canLeaveCard()) run(async () => acceptCard((await resourceApi(library, { method: 'POST', body: JSON.stringify({ name: translate('personality.defaultName') }) })).personality))
  }
  const importFile = async (input, filename) => {
    const imported = await resourceApi(`${library}/import?filename=${encodeURIComponent(filename)}`, {
      method: 'POST', headers: { 'Content-Type': input.type || 'application/octet-stream' }, body: input,
    })
    acceptCard(imported.personality)
  }
  const copyCharacter = () => {
    if (canLeaveCard()) run(async () => {
      const response = await tavernFetch(`${API_V1}/characters/${encodeURIComponent(copyId)}/png`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await importFile(await response.blob(), `${characters.find(item => item.id === copyId).name}.png`)
    }, 'personality.copied')
  }
  const save = () => run(async () => {
    const before = characterEditorPatch(characterEditorDraft(detail))
    const patch = Object.fromEntries(Object.entries(characterEditorPatch(draft)).filter(([field, value]) => JSON.stringify(value) !== JSON.stringify(before[field])))
    acceptCard((await resourceApi(resourcePath(detail.id), { method: 'PATCH', body: JSON.stringify(patch) })).personality)
  }, 'common.saved')
  const bind = personalityId => run(async () => {
    const apply = target => {
      if (!mounted.current) throw new Error(translate('personality.bindingChanged'))
      return resourceApi('/personality-selection', { method: 'POST', body: JSON.stringify({ sessionId: target, personalityId }) })
    }
    if (sessionId) await apply(sessionId)
    else await openPersonalitySession(targetWorkspace, apply)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, personalityId ? 'personality.applied' : 'personality.off')
  const remove = () => {
    if (!window.confirm(translate('personality.confirmDelete', { name: detail.name }))) return
    run(async () => {
      await resourceApi(resourcePath(detail.id), { method: 'DELETE' })
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      const remaining = items.filter(item => item.id !== detail.id)
      if (mounted.current) { setItems(remaining); show(null) }
      if (remaining.length) {
        const result = await resourceApi(resourcePath(remaining[0].id))
        if (mounted.current) show(result.personality)
      }
    }, 'personality.deleted')
  }
  const field = ([key, label]) => h('label', { key, className: 'dcc-field' },
    h('span', { className: 'dcc-label' }, translate(label)),
    h(key === 'name' || key === 'nickname' ? 'input' : 'textarea', {
      className: key === 'name' || key === 'nickname' ? 'dcc-input' : 'dcc-textarea',
      disabled: busy, value: draft[key], onChange: event => setDraft({ ...draft, [key]: event.target.value }),
    }))
  const selectionReady = Boolean(selection && !selection.error)
  const activeName = selection?.personality?.name ?? items.find(item => item.id === selectedId)?.name ?? selectedId
  return h('section', { className: 'dcc-panel dtv-personality-panel', 'aria-label': translate('nav.personality') },
    h('header', { className: 'dcc-header' }, h('div', { className: 'dcc-title' }, translate('nav.personality')),
      h('button', { className: 'dcc-close', type: 'button', onClick: close, 'aria-label': translate('panel.close', { title: translate('nav.personality') }) }, '✕')),
    h('div', { className: 'dcc-body' },
      h('p', { className: 'dcc-meta' }, !sessionId ? translate('personality.noSession') : translate('personality.current', { name: activeName || translate(selectionReady ? 'common.none' : selection?.error ? 'common.unavailable' : 'common.loading') })),
      h('div', { className: 'dcc-actions' }, button('character.import', () => file.current.click(), busy), button('personality.create', create, busy)),
      h('input', { ref: file, hidden: true, type: 'file', accept: '.json,.png,application/json,image/png', onChange: event => {
        const input = event.target.files?.[0]; event.target.value = ''
        if (input && canLeaveCard()) run(() => importFile(input, input.name), 'personality.imported')
      } }),
      h('details', { className: 'dcc-detail', onToggle: event => {
        if (!event.currentTarget.open || characters !== null) return
        resourceApi('/characters').then(list => {
          if (mounted.current) { setCharacters(list.characters); setCopyId(list.characters[0]?.id ?? '') }
        }, failure => { if (mounted.current) setError(failure.message) })
      } }, h('summary', null, translate('personality.copySection')),
        h('div', { className: 'dcc-detail-body' },
          h('select', { className: 'dcc-select', 'aria-label': translate('nav.character'), value: copyId, disabled: busy || !characters?.length, onChange: event => setCopyId(event.target.value) },
            (characters ?? []).map(item => h('option', { key: item.id, value: item.id }, item.name))),
          characters?.length === 0 && h('p', { className: 'dcc-meta' }, translate('character.libraryEmpty')),
          button('personality.copy', copyCharacter, busy || !copyId))),
      h('label', { className: 'dcc-field' }, h('span', { className: 'dcc-label' }, translate('personality.library')),
        h('select', { className: 'dcc-select', value: detail?.id ?? '', disabled: busy || !items.length, onChange: event => browse(event.target.value) },
          !items.length && h('option', { value: '' }, translate('personality.empty')),
          items.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
      !sessionId && openPersonalitySession && h('label', { className: 'dcc-field' },
        translate('personality.workspace'),
        h('select', { className: 'dcc-select', value: targetWorkspace, disabled: busy, onChange: event => setWorkspaceChoice(event.target.value) },
          h('option', { value: '' }, translate('personality.chooseWorkspace')),
          workspaces.map(item => h('option', { key: item.workspaceId, value: item.workspaceId }, item.title || item.cwd || item.workspaceId)))),
      h('div', { className: 'dcc-actions' },
        button(mayOpenSession ? 'personality.bindNew' : 'personality.bind', () => bind(detail.id), busy || dirty || !detail || (!mayOpenSession && (!sessionId || !selectionReady)) || detail.id === selectedId, true),
        button('personality.unbind', () => bind(null), busy || !sessionId || !selectedId || !selectionReady)),
      (error || selection?.error) && h('div', { className: 'dcc-status', role: 'alert', 'data-error': true }, error || selection.error),
      notice && h('div', { className: 'dcc-status', role: 'status' }, notice),
      detail && h('nav', { className: 'dtv-personality-tabs', 'aria-label': translate('nav.personality') },
        ...['card', 'evolution', 'mood'].map(id => h('button', { key: id, type: 'button', className: 'dcc-button',
          'aria-current': page === id ? 'page' : undefined,
          disabled: busy || (id === 'mood' && (!sessionId || selectedId !== detail.id)),
          onClick: () => setPage(id),
        }, translate('personality.tab.' + id)))),
      detail && page === 'evolution' && h(PersonalityEvolution, { key: detail.id, personalityId: detail.id,
        observedRevision: selectedId === detail.id ? selection?.notice?.revision : null,
        focusRevision: noticeTarget?.personalityId === detail.id ? noticeTarget.revision : null }),
      detail && page === 'mood' && (sessionId && selectedId === detail.id
        ? h(PersonalityMood, { key: `${sessionId}/${detail.id}`, sessionId, personalityId: detail.id })
        : h('p', { className: 'dcc-note' }, translate('personality.moodNeedsSelection'))),
      draft && page === 'card' && h('div', { className: 'dcc-card' }, textFields.map(field),
        h('details', { className: 'dcc-detail' }, h('summary', null, translate('personality.additional')), h('div', { className: 'dcc-detail-body' }, optionalFields.map(field))),
        h('div', { className: 'dcc-actions' }, ...[['json', 'common.exportJson'], ['png', 'character.exportPng']].map(([type, label]) =>
          h('a', { key: type, className: 'dcc-button', 'data-disabled': busy || dirty, href: busy || dirty ? undefined : `${API_V1}${resourcePath(detail.id)}/${type}`, download: '' }, translate(label)))),
        h('div', { className: 'dcc-footer' }, button('common.saveChanges', save, busy || !dirty, true), button('personality.delete', remove, busy)))))
}
