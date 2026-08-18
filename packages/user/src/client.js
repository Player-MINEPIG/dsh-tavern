import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { sameOrderedIds, userPanelDirty, userResourceDirty } from './client-state.js'
import {
  createLocalizedElement,
  rawText,
  statusText,
  translate,
  uiError,
  uiMessage,
  unwrapText,
} from '../../client/src/i18n.js'
import { API_V1 as API_ROOT, CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'

const h = createLocalizedElement(createElement)

const css = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:16px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 9px}.dtu-input,.dtu-select{height:36px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-bindings{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px}.dtu-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4}.dtu-section-title{font-size:14px;margin:4px 0 0}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`

function errorMessage(data, status) {
  return data?.error?.message ?? data?.error ?? `HTTP ${status}`
}

async function api(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase()
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(method === 'GET' || method === 'HEAD' ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status))
  return data
}

function Field({ label, children }) {
  return h('label', { className: 'dtu-field' }, h('span', { className: 'dtu-label' }, label), children)
}

function notifyRefresh() {
  window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
}

export function UserPanel({ sessionId, sessionBlank, close }) {
  const [users, setUsers] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savedDraft, setSavedDraft] = useState(null)
  const [worldBooks, setWorldBooks] = useState(null)
  const [worldBookIds, setWorldBookIds] = useState([])
  const [appliedWorldBookIds, setAppliedWorldBookIds] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'common.loading' })
  const generation = useRef(0)
  const draftId = useRef(null)
  const dirtyRef = useRef(false)
  draftId.current = draft?.id ?? null
  const dirty = userPanelDirty(draft, savedDraft, worldBookIds, appliedWorldBookIds)
  dirtyRef.current = dirty
  const resourceDirty = userResourceDirty(draft, savedDraft)
  const bindingDirty = !sameOrderedIds(worldBookIds, appliedWorldBookIds)

  const run = useCallback(async (operation, success, values) => {
    setBusy(true)
    try {
      const result = await operation()
      setStatus({ error: false, key: success, values })
      return result
    } catch (error) {
      setStatus({
        error: true,
        key: error.uiKey,
        values: error.uiValues,
        text: error instanceof Error ? error.message : String(error),
      })
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const refresh = useCallback(async preferredId => {
    const current = ++generation.current
    const [catalog, worldBookCatalog, binding] = await Promise.all([
      api('/users'),
      api('/world-books'),
      sessionId
        ? api(`/user-selection?sessionId=${encodeURIComponent(sessionId)}`)
        : Promise.resolve({ selection: null }),
    ])
    const availableIds = new Set(catalog.users.map(user => user.id))
    const preferred = availableIds.has(preferredId)
      ? preferredId
      : availableIds.has(binding.selection?.userId) ? binding.selection.userId : null
    const id = preferred ?? catalog.users[0]?.id ?? null
    const relation = id === null
      ? { binding: { worldBookIds: [] } }
      : await api(`/users/${encodeURIComponent(id)}/world-books`)
    if (current !== generation.current) return
    setUsers(catalog.users)
    setWorldBooks(worldBookCatalog.worldBooks)
    setSelectedUserId(binding.selection?.userId ?? null)
    const nextDraft = id === null ? null : structuredClone(catalog.users.find(user => user.id === id) ?? null)
    const ids = relation.binding?.worldBookIds ?? []
    setDraft(nextDraft)
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft))
    setWorldBookIds(ids)
    setAppliedWorldBookIds(ids)
  }, [sessionId])

  useEffect(() => {
    run(() => refresh(), 'user.status.loaded')
    const onRefresh = () => {
      if (dirtyRef.current) {
        setStatus({ error: false, key: 'user.status.skippedRefresh' })
        return
      }
      run(() => refresh(draftId.current), 'user.status.refreshed')
    }
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => {
      generation.current += 1
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    }
  }, [refresh, run])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const create = useCallback(() => {
    if (dirty && !window.confirm(unwrapText(uiMessage('user.confirmDiscardForCreate')))) return
    run(async () => {
      const data = await api('/users', { method: 'POST', body: JSON.stringify({ name: translate('user.defaultName'), description: '' }) })
      draftId.current = data.user.id
      await refresh(data.user.id)
      notifyRefresh()
    }, 'user.status.created')
  }, [dirty, refresh, run])

  const save = useCallback(() => run(async () => {
    if (draft === null) return
    const data = await api(`/users/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: draft.name, description: draft.description }),
    })
    draftId.current = data.user.id
    setDraft(data.user)
    setSavedDraft(structuredClone(data.user))
    setUsers(current => current?.map(user => user.id === data.user.id ? data.user : user) ?? current)
    notifyRefresh()
  }, 'user.status.saved'), [draft, run])

  const saveWorldBooks = useCallback(() => run(async () => {
    if (draft === null) return
    const data = await api(`/users/${encodeURIComponent(draft.id)}/world-books`, {
      method: 'PUT',
      body: JSON.stringify({ worldBookIds }),
    })
    const ids = data.binding.worldBookIds
    setWorldBookIds(ids)
    setAppliedWorldBookIds(ids)
    notifyRefresh()
  }, 'user.status.worldBooksSaved'), [draft, run, worldBookIds])

  const chooseUser = useCallback(id => {
    if (dirty && !window.confirm(unwrapText(uiMessage('user.confirmDiscardForSwitch')))) return
    run(() => refresh(id), 'user.status.userLoaded')
  }, [dirty, refresh, run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId || draft === null) throw uiError('user.error.needSession')
    if (selectedUserId !== draft.id && sessionBlank === false
      && !window.confirm(unwrapText(uiMessage('user.confirmHistoricalSwitch')))) return
    const data = await api('/user-selection', {
      method: 'POST',
      body: JSON.stringify({ sessionId, userId: draft.id }),
    })
    setSelectedUserId(data.selection.userId)
    notifyRefresh()
  }, 'user.status.bound'), [draft, run, selectedUserId, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('user.error.noSessionToUnbind')
    await api('/user-selection', { method: 'POST', body: JSON.stringify({ sessionId, userId: null }) })
    setSelectedUserId(null)
    notifyRefresh()
  }, 'user.status.unbound'), [run, sessionId])

  const remove = useCallback(() => run(async () => {
    if (draft === null || !window.confirm(unwrapText(uiMessage('user.confirmDelete', { name: draft.name })))) return
    await api(`/users/${encodeURIComponent(draft.id)}`, { method: 'DELETE', body: '{}' })
    draftId.current = null
    await refresh(null)
    notifyRefresh()
  }, 'user.status.deleted'), [draft, refresh, run])

  const activeName = selectedUserId === null
    ? translate('nav.user.empty')
    : users?.find(user => user.id === selectedUserId)?.name ?? selectedUserId
  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage('user.confirmCloseDirty')))) close()
  }
  const dirtyParts = [
    resourceDirty ? translate('user.dirty.name') : '',
    bindingDirty ? translate('user.dirty.binding') : '',
  ].filter(Boolean)
  const dirtyText = uiMessage('user.dirty', { parts: dirtyParts.join(translate('common.listSeparator')) })
  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('user.title')) })

  return h('div', { className: 'dtu-panel' },
    h('div', { className: 'dtu-header' },
      h('div', { className: 'dtu-title' }, uiMessage('user.title')),
      h('button', { className: 'dtu-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: requestClose }, '✕'),
    ),
    h('div', { className: 'dtu-body' },
      h('div', { className: 'dtu-toolbar' },
        h('button', { className: 'dtu-button', type: 'button', disabled: busy, onClick: create }, uiMessage('user.create')),
        h('button', { className: 'dtu-button', type: 'button', disabled: busy, onClick: () => { if (!dirty || window.confirm(unwrapText(uiMessage('user.confirmDiscardRefresh')))) run(() => refresh(draft?.id), 'user.status.refreshed') } }, uiMessage('common.refresh')),
      ),
      h(Field, { label: uiMessage('user.browse') }, h('select', {
        className: 'dtu-select',
        value: draft?.id ?? '',
        disabled: busy || users === null || users.length === 0,
        onChange: event => chooseUser(event.target.value),
      },
      ...(users?.length ? [] : [h('option', { key: 'empty', value: '' }, uiMessage('user.libraryEmpty'))]),
      ...(users ?? []).map(user => h('option', { key: user.id, value: user.id }, rawText(user.name))))),
      h('p', { className: 'dtu-note' }, uiMessage('user.sessionBinding', { session: sessionId || translate('common.none'), name: activeName })),
      h('div', { className: 'dtu-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, statusText(status)),
      dirty
        ? h('div', { className: 'dtu-status', 'data-warning': true, role: 'status' }, dirtyText)
        : h('p', { className: 'dtu-note' }, uiMessage('user.savedNote')),
      draft === null
        ? h('p', { className: 'dtu-note' }, users === null ? uiMessage('user.loading') : uiMessage('user.emptyHint'))
        : h('div', { className: 'dtu-editor' },
          h(Field, { label: uiMessage('user.name', { macro: '{{user}}' }) }, h('input', { className: 'dtu-input', value: draft.name, maxLength: 200, onChange: event => setDraft(current => ({ ...current, name: event.target.value })) })),
          h(Field, { label: uiMessage('user.description') }, h('textarea', { className: 'dtu-textarea', value: draft.description, maxLength: 100000, onChange: event => setDraft(current => ({ ...current, description: event.target.value })) })),
          h('div', { className: 'dtu-actions' },
            h('button', { className: 'dtu-button dtu-primary', type: 'button', disabled: busy || !resourceDirty, onClick: save }, resourceDirty ? uiMessage('user.saveResource') : uiMessage('user.resourceSaved')),
            h('button', { className: 'dtu-button dtu-primary', type: 'button', disabled: busy || !sessionId || dirty, onClick: bind }, dirty ? uiMessage('user.saveFirst') : selectedUserId === draft.id ? uiMessage('user.refreshBinding') : uiMessage('user.bind')),
          ),
          h('h2', { className: 'dtu-section-title' }, uiMessage('user.worldBooksTitle')),
          h('p', { className: 'dtu-note' }, uiMessage('user.worldBooksHint')),
          worldBooks?.length
            ? h('div', { className: 'dtu-bindings' }, ...worldBooks.map(book => h('label', { className: 'dtu-check', key: book.id },
              h('input', {
                type: 'checkbox',
                checked: worldBookIds.includes(book.id),
                onChange: event => setWorldBookIds(current => event.target.checked
                  ? [...current, book.id]
                  : current.filter(id => id !== book.id)),
              }),
              h('span', null, uiMessage('world.catalogItem', { name: book.name, count: book.entryCount })),
            )))
            : h('p', { className: 'dtu-note' }, worldBooks === null ? uiMessage('user.worldBooksLoading') : uiMessage('user.worldBooksEmpty')),
          h('div', { className: 'dtu-actions' },
            h('button', { className: 'dtu-button dtu-primary', type: 'button', disabled: busy || !bindingDirty, onClick: saveWorldBooks }, bindingDirty ? uiMessage('user.saveWorldBooks') : uiMessage('user.worldBooksSaved')),
            h('button', { className: 'dtu-button', type: 'button', disabled: busy || worldBookIds.length === 0, onClick: () => setWorldBookIds([]) }, uiMessage('user.clearPending')),
          ),
          h('button', { className: 'dtu-button', type: 'button', disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, uiMessage('user.unbind')),
          h('p', { className: 'dtu-note' }, uiMessage('user.identityNote')),
          h('div', { className: 'dtu-footer' }, h('button', { className: 'dtu-button dtu-danger', type: 'button', disabled: busy, onClick: remove }, uiMessage('user.delete'))),
        ),
    ),
  )
}

export function installUserStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-user"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-user`
  style.textContent = css
  document.head.append(style)
}
