import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
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
const POSITIONS = [
  ['before_character_definition', 'world.position.beforeCharacter'],
  ['after_character_definition', 'world.position.afterCharacter'],
  ['before_author_note', 'world.position.beforeAuthor'],
  ['after_author_note', 'world.position.afterAuthor'],
  ['at_depth', 'world.position.atDepth'],
  ['before_example_messages', 'world.position.beforeExamples'],
  ['after_example_messages', 'world.position.afterExamples'],
  ['outlet', 'world.position.outlet'],
]

const css = `
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:16px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:12px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px 8px}.dwb-input,.dwb-select{height:36px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.5}.dwb-note,.dwb-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:13px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-status[data-warning=true]{color:var(--dsw-alias-state-warning,#b46b00)}.dwb-section-title{font-size:15px;font-weight:700;margin:5px 0 0}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:14px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.45}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:13px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.dwb-source-section{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;padding:10px;background:color-mix(in srgb,var(--dsw-specific-tip) 35%,transparent);display:flex;flex-direction:column;gap:9px}.dwb-source-section>.dwb-section-title{margin:0}.dwb-source-section>.dwb-resource{background:var(--dsw-alias-bg-base)}.dwb-source-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px}.dwb-source-book{padding-left:2px}.dwb-source-book-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dwb-source-book-name{min-width:0;font-size:13px;font-weight:620;overflow-wrap:anywhere}.dwb-source-badge{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip)}.dwb-user-bindings{grid-template-columns:1fr}.dwb-user-binding-row{display:flex;align-items:center;gap:7px}.dwb-user-binding-row>.dwb-check{align-items:center;flex:1;min-width:0}.dwb-user-binding-row .dwb-source-badge{margin-left:auto}.dwb-inline-edit{min-height:30px;padding:4px 8px;flex:none}
`

function errorMessage(data, status) {
  if (typeof data?.error?.message === 'string') return data.error.message
  if (typeof data?.error === 'string') return data.error
  return `HTTP ${status}`
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
  return h('label', { className: 'dwb-field' }, h('span', { className: 'dwb-label' }, label), children)
}

export function parseKeywords(value) {
  return value.split(/[,，]/u).map(item => item.trim()).filter(Boolean)
}

function sameKeywords(left, right) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

export function reconcileKeywordEditorText(current, keywords) {
  const normalized = Array.isArray(keywords)
    ? keywords.filter(value => typeof value === 'string' && value !== '')
    : []
  return sameKeywords(parseKeywords(current), normalized)
    ? current
    : normalized.join(', ')
}

function KeywordInput({ keywords, onChange }) {
  const [text, setText] = useState(() => Array.isArray(keywords) ? keywords.join(', ') : '')
  useEffect(() => {
    setText(current => reconcileKeywordEditorText(current, keywords))
  }, [keywords])
  return h('input', {
    className: 'dwb-input',
    value: text,
    onChange: event => {
      const next = event.target.value
      setText(next)
      onChange(parseKeywords(next))
    },
  })
}

function embeddedPosition(entry) {
  const value = entry?.extensions?.position
  if (Number.isInteger(value) && value >= 0 && value <= 7) return value
  return entry?.position === 'before_char' ? 0 : 1
}

function EmbeddedEntryEditor({ entry, index, update, remove }) {
  const patch = value => update(index, value)
  const secondaryKeys = Array.isArray(entry.secondary_keys) ? entry.secondary_keys : []
  const position = embeddedPosition(entry)
  return h('details', { className: 'dwb-entry', 'data-enabled': entry.enabled === true },
    h('summary', null,
      h('span', { className: 'dwb-dot' }),
      h('span', { className: 'dwb-entry-name' }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiMessage('world.entry.fallback', { id: entry.id ?? index })),
      h('span', { className: 'dwb-entry-state' }, entry.constant ? uiMessage('world.entry.constant') : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(', ')) : uiMessage('world.entry.noKeywords')),
    ),
    h('div', { className: 'dwb-entry-body' },
      h(Field, { label: uiMessage('world.entry.title') }, h('input', { className: 'dwb-input', value: entry.comment ?? entry.name ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h(Field, { label: uiMessage('world.entry.primaryKeys') }, h(KeywordInput, { keywords: entry.keys, onChange: keys => patch({ keys }) })),
      h(Field, { label: uiMessage('world.entry.secondaryKeys') }, h(KeywordInput, { keywords: secondaryKeys, onChange: keys => patch({ secondary_keys: keys, selective: keys.length > 0 }) })),
      secondaryKeys.length > 0 ? h(Field, { label: uiMessage('world.entry.secondaryLogicShort') }, h('select', {
        className: 'dwb-select',
        value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any',
        onChange: event => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...(entry.extensions ?? {}), selectiveLogic: event.target.value } }),
      },
      h('option', { value: 'and_any' }, uiMessage('world.logic.andAny')),
      h('option', { value: 'and_all' }, uiMessage('world.logic.andAll')),
      h('option', { value: 'not_any' }, uiMessage('world.logic.notAny')),
      h('option', { value: 'not_all' }, uiMessage('world.logic.notAll')))) : null,
      h(Field, { label: uiMessage('world.entry.body') }, h('textarea', { className: 'dwb-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dwb-grid' },
        h(Field, { label: uiMessage('world.entry.position') }, h('select', { className: 'dwb-select', value: position, onChange: event => { const value = Number(event.target.value); patch({ position: value === 0 ? 'before_char' : value === 1 ? 'after_char' : entry.position, extensions: { ...(entry.extensions ?? {}), position: value } }) } }, ...POSITIONS.map(([_value, key], value) => h('option', { key: value, value }, uiMessage(key))))),
        h(Field, { label: uiMessage('world.entry.order') }, h('input', { className: 'dwb-input', type: 'number', value: entry.insertion_order ?? 100, onChange: event => patch({ insertion_order: Number(event.target.value) }) })),
        h(Field, { label: uiMessage('world.entry.probability') }, h('input', { className: 'dwb-input', type: 'number', min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: event => patch({ probability: Number(event.target.value), extensions: { ...(entry.extensions ?? {}), probability: Number(event.target.value), useProbability: true } }) })),
      ),
      h('div', { className: 'dwb-checks' },
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), uiMessage('common.enable')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), uiMessage('world.entry.constant')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: event => patch({ case_sensitive: event.target.checked, extensions: { ...(entry.extensions ?? {}), case_sensitive: event.target.checked } }) }), uiMessage('world.entry.caseSensitive')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: event => patch({ match_whole_words: event.target.checked, extensions: { ...(entry.extensions ?? {}), match_whole_words: event.target.checked } }) }), uiMessage('world.entry.wholeWord')),
      ),
      h('div', { className: 'dwb-actions' }, h('button', { className: 'dwb-button dwb-danger', type: 'button', onClick: () => remove(index) }, uiMessage('world.entry.delete'))),
    ),
  )
}

function nextUid(entries) {
  const numeric = entries.map(entry => entry.uid).filter(Number.isSafeInteger)
  return numeric.length === 0 ? 0 : Math.max(...numeric) + 1
}

export function createWorldBookEntry(entries = []) {
  const uid = nextUid(entries)
  return {
    uid,
    keys: [],
    secondaryKeys: [],
    comment: translate('world.entry.untitled', { id: uid }),
    content: '',
    enabled: true,
    constant: false,
    selective: false,
    insertionOrder: 100,
    position: 'after_character_definition',
    probability: 100,
    useProbability: true,
    caseSensitive: false,
    matchWholeWords: false,
  }
}

export function deriveUserWorldBookSource(active, catalog) {
  const user = active?.resources?.user ?? null
  const selection = active?.worldBookSelection ?? {}
  const userBoundIds = Array.isArray(selection.userBoundIds) ? selection.userBoundIds : []
  const duplicateIds = new Set(Array.isArray(selection.duplicateIds) ? selection.duplicateIds : [])
  const known = new Map([
    ...(Array.isArray(catalog?.worldBooks) ? catalog.worldBooks : []),
    ...(Array.isArray(active?.resources?.worldBooks) ? active.resources.worldBooks : []),
  ].map(item => [item.id, item]))
  return {
    user,
    books: userBoundIds.map(id => ({
      id,
      name: known.get(id)?.name ?? id,
      duplicate: duplicateIds.has(id),
    })),
  }
}

function EntryEditor({ entry, index, update, remove }) {
  const patch = value => update(index, value)
  const secondary = Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : []
  return h('details', { className: 'dwb-entry', 'data-enabled': entry.enabled === true },
    h('summary', null,
      h('span', { className: 'dwb-dot' }),
      h('span', { className: 'dwb-entry-name' }, entry.comment ? rawText(entry.comment) : uiMessage('world.entry.fallback', { id: entry.uid ?? index })),
      h('span', { className: 'dwb-entry-state' }, entry.constant ? uiMessage('world.entry.constant') : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(', ')) : uiMessage('world.entry.noKeywords')),
    ),
    h('div', { className: 'dwb-entry-body' },
      h(Field, { label: uiMessage('world.entry.title') }, h('input', { className: 'dwb-input', value: entry.comment ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h(Field, { label: uiMessage('world.entry.primaryKeys') }, h(KeywordInput, { keywords: entry.keys, onChange: keys => patch({ keys }) })),
      h(Field, { label: uiMessage('world.entry.secondaryKeys') }, h(KeywordInput, { keywords: secondary, onChange: keys => patch({ secondaryKeys: keys, selective: keys.length > 0 }) })),
      secondary.length > 0 ? h(Field, { label: uiMessage('world.entry.secondaryLogicShort') }, h('select', { className: 'dwb-select', value: entry.selectiveLogic ?? 'and_any', onChange: event => patch({ selectiveLogic: event.target.value, selective: true }) },
        h('option', { value: 'and_any' }, uiMessage('world.logic.andAny')),
        h('option', { value: 'and_all' }, uiMessage('world.logic.andAll')),
        h('option', { value: 'not_any' }, uiMessage('world.logic.notAny')),
        h('option', { value: 'not_all' }, uiMessage('world.logic.notAll')))) : null,
      h(Field, { label: uiMessage('world.entry.body') }, h('textarea', { className: 'dwb-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dwb-grid' },
        h(Field, { label: uiMessage('world.entry.position') }, h('select', { className: 'dwb-select', value: entry.position, onChange: event => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, key]) => h('option', { key: value, value }, uiMessage(key))))),
        h(Field, { label: uiMessage('world.entry.order') }, h('input', { className: 'dwb-input', type: 'number', value: entry.insertionOrder ?? 100, onChange: event => patch({ insertionOrder: Number(event.target.value) }) })),
        h(Field, { label: uiMessage('world.entry.probability') }, h('input', { className: 'dwb-input', type: 'number', min: 0, max: 100, value: entry.probability ?? 100, onChange: event => patch({ probability: Number(event.target.value), useProbability: true }) })),
      ),
      h('div', { className: 'dwb-checks' },
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), uiMessage('common.enable')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), uiMessage('world.entry.constant')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.caseSensitive === true, onChange: event => patch({ caseSensitive: event.target.checked }) }), uiMessage('world.entry.caseSensitive')),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.matchWholeWords === true, onChange: event => patch({ matchWholeWords: event.target.checked }) }), uiMessage('world.entry.wholeWord')),
      ),
      h('div', { className: 'dwb-actions' }, h('button', { className: 'dwb-button dwb-danger', type: 'button', onClick: () => remove(index) }, uiMessage('world.entry.delete'))),
    ),
  )
}

export function WorldBookPanel({ sessionId, close }) {
  const [catalog, setCatalog] = useState(null)
  const [document, setDocument] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selection, setSelection] = useState([])
  const [appliedSelection, setAppliedSelection] = useState([])
  const [userSelection, setUserSelection] = useState([])
  const [appliedUserSelection, setAppliedUserSelection] = useState([])
  const [active, setActive] = useState(null)
  const [embeddedCharacterId, setEmbeddedCharacterId] = useState(null)
  const [embeddedDraft, setEmbeddedDraft] = useState(null)
  const [embeddedDirty, setEmbeddedDirty] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'common.loading' })
  const fileRef = useRef(null)
  const standaloneEditorRef = useRef(null)
  const generation = useRef(0)

  const run = useCallback(async (operation, success, values) => {
    setBusy(true)
    try {
      const value = await operation()
      setStatus({ error: false, key: success, values })
      return value
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
    const currentGeneration = ++generation.current
    const list = await api('/world-books')
    const selected = sessionId
      ? await api(`/world-book-selection?sessionId=${encodeURIComponent(sessionId)}`)
      : { selection: { worldBookIds: [] } }
    const activeView = await api(`/active${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`)
    const characterId = activeView.resources?.characterCard?.id ?? null
    let embeddedBook = null
    if (characterId !== null) {
      const character = await api(`/characters/${encodeURIComponent(characterId)}`)
      embeddedBook = character.character?.data?.characterBook ?? null
    }
    if (currentGeneration !== generation.current) return
    const ids = selected.selection?.worldBookIds ?? []
    const resolvedUserIds = activeView.resources?.user === null || activeView.resources?.user === undefined
      ? []
      : activeView.worldBookSelection?.userBoundIds ?? []
    const userIds = Array.isArray(resolvedUserIds) ? resolvedUserIds : []
    setCatalog(list)
    setSelection(ids)
    setAppliedSelection(ids)
    setUserSelection(userIds)
    setAppliedUserSelection(userIds)
    setActive(activeView)
    setEmbeddedCharacterId(characterId)
    setEmbeddedDraft(embeddedBook === null ? null : structuredClone(embeddedBook))
    setEmbeddedDirty(false)
    const id = preferredId ?? document?.id ?? ids[0] ?? list.worldBooks[0]?.id ?? null
    if (id === null || !list.worldBooks.some(item => item.id === id)) {
      setDocument(null)
      setDraft(null)
      setDirty(false)
      return
    }
    const detail = await api(`/world-books/${encodeURIComponent(id)}`)
    if (currentGeneration !== generation.current) return
    setDocument(detail.worldBook)
    setDraft(structuredClone(detail.worldBook.book))
    setDirty(false)
  }, [document?.id, sessionId])

  useEffect(() => {
    run(() => refresh(), 'world.status.loaded')
    const onRefresh = () => run(() => refresh(), 'world.status.refreshed')
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => {
      generation.current += 1
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    }
  }, [refresh, run])

  const load = id => run(async () => {
    const detail = await api(`/world-books/${encodeURIComponent(id)}`)
    setDocument(detail.worldBook)
    setDraft(structuredClone(detail.worldBook.book))
    setDirty(false)
  }, 'world.status.detailsLoaded')

  const editUserBook = async id => {
    await load(id)
    requestAnimationFrame(() => standaloneEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const create = () => run(async () => {
    const data = await api('/world-books', { method: 'POST', body: JSON.stringify({ name: translate('world.defaultName') }) })
    await refresh(data.worldBook.id)
  }, 'world.status.created')

  const importFile = file => run(async () => {
    const response = await fetch(`${API_ROOT}/world-books/import?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: file,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status))
    if (fileRef.current !== null) fileRef.current.value = ''
    await refresh(data.worldBook.id)
  }, 'world.status.imported')

  const save = () => run(async () => {
    const data = await api(`/world-books/${encodeURIComponent(document.id)}`, { method: 'PATCH', body: JSON.stringify({ book: draft }) })
    setDocument(data.worldBook)
    setDraft(structuredClone(data.worldBook.book))
    setDirty(false)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, 'world.status.saved')

  const saveSelection = () => run(async () => {
    if (!sessionId) throw uiError('world.error.needSession')
    const data = await api('/world-book-selection', { method: 'POST', body: JSON.stringify({ sessionId, worldBookIds: selection }) })
    setSelection(data.selection.worldBookIds)
    setAppliedSelection(data.selection.worldBookIds)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, 'world.status.bindingSaved')

  const saveUserSelection = () => run(async () => {
    const userId = active?.resources?.user?.id
    if (!userId) throw uiError('world.user.error.noUser')
    const data = await api(`/users/${encodeURIComponent(userId)}/world-books`, {
      method: 'PUT',
      body: JSON.stringify({ worldBookIds: userSelection }),
    })
    const ids = data.binding.worldBookIds
    setUserSelection(ids)
    setAppliedUserSelection(ids)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, 'world.user.saveSuccess')

  const remove = () => run(async () => {
    if (document === null || !window.confirm(unwrapText(uiMessage('world.confirmDelete', { name: document.name })))) return
    await api(`/world-books/${encodeURIComponent(document.id)}`, { method: 'DELETE' })
    setDocument(null)
    setDraft(null)
    await refresh(null)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, 'world.status.deleted')

  const saveEmbedded = () => run(async () => {
    const data = await api(`/characters/${encodeURIComponent(embeddedCharacterId)}/world-book`, {
      method: 'PATCH',
      body: JSON.stringify({ characterBook: embeddedDraft }),
    })
    setEmbeddedDraft(structuredClone(data.character.data.characterBook))
    setEmbeddedDirty(false)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  }, 'world.status.embeddedSaved')

  const updateEntry = (index, patch) => {
    setDraft(current => {
      const next = structuredClone(current)
      next.entries[index] = { ...next.entries[index], ...patch }
      return next
    })
    setDirty(true)
  }
  const entries = draft?.entries ?? []
  const embeddedEntries = embeddedDraft?.entries ?? []
  const embedded = active?.resources?.worldBooks?.filter(item => item.kind === 'embedded-character-book') ?? []
  const diagnostics = active?.diagnostics?.filter(item => String(item.code ?? '').includes('WORLD_BOOK')) ?? []
  const selectionDirty = selection.length !== appliedSelection.length || selection.some((id, index) => id !== appliedSelection[index])
  const userSelectionDirty = userSelection.length !== appliedUserSelection.length || userSelection.some((id, index) => id !== appliedUserSelection[index])
  const userSource = deriveUserWorldBookSource(active, catalog)
  const catalogBooks = Array.isArray(catalog?.worldBooks) ? catalog.worldBooks : []
  const catalogById = new Map(catalogBooks.map(book => [book.id, book]))
  const userCatalog = [
    ...userSelection.map(id => catalogById.get(id)).filter(Boolean),
    ...catalogBooks.filter(book => !userSelection.includes(book.id)),
  ]
  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('world.title')) })

  return h('div', { className: 'dwb-panel' },
    h('div', { className: 'dwb-header' }, h('div', { className: 'dwb-title' }, uiMessage('world.title')), h('button', { className: 'dwb-close', type: 'button', onClick: close, title: closeLabel, 'aria-label': closeLabel }, '✕')),
    h('div', { className: 'dwb-body' },
      h('div', { className: 'dwb-toolbar' },
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage('world.importJson')),
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: create }, uiMessage('world.create')),
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: () => { if (!dirty || window.confirm(unwrapText(uiMessage('world.confirmDiscardChanges')))) run(() => refresh(), 'world.status.refreshed') } }, uiMessage('common.refresh')),
        h('input', { ref: fileRef, hidden: true, type: 'file', accept: '.json,application/json', onChange: event => { const file = event.target.files?.[0]; if (file !== undefined) importFile(file) } }),
      ),
      h('p', { className: 'dwb-note' }, uiMessage('world.currentSession', { session: sessionId || translate('common.none') })),
      h('div', { className: 'dwb-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, statusText(status)),
      h('section', { className: 'dwb-source-section', 'data-source': 'standalone' },
      h('h2', { className: 'dwb-section-title' }, uiMessage('world.standalone')),
      h('div', { className: 'dwb-resource' },
        h('div', { className: 'dwb-resource-title' }, uiMessage('world.sessionBinding')),
        catalog?.worldBooks.length ? h('div', { className: 'dwb-bindings' }, ...catalog.worldBooks.map(item => h('label', { className: 'dwb-check', key: item.id },
          h('input', { type: 'checkbox', checked: selection.includes(item.id), onChange: event => setSelection(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id)) }),
          uiMessage('world.catalogItem', { name: item.name, count: item.entryCount }),
        ))) : h('p', { className: 'dwb-note' }, uiMessage('world.libraryEmpty')),
        selectionDirty ? h('div', { className: 'dwb-status', 'data-warning': true }, uiMessage('world.bindingUnsaved')) : h('p', { className: 'dwb-note' }, uiMessage('world.bindingApplied')),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !sessionId || !selectionDirty, onClick: saveSelection }, selectionDirty ? uiMessage('world.applyBinding') : uiMessage('world.bindingAppliedButton')),
          h('button', { className: 'dwb-button', type: 'button', disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, uiMessage('world.clearPending')),
        ),
      ),
      h(Field, { label: uiMessage('world.browse') }, h('select', { className: 'dwb-select', value: document?.id ?? '', disabled: busy || !catalog?.worldBooks.length, onChange: event => { if (!dirty || window.confirm(unwrapText(uiMessage('world.confirmDiscardChanges')))) load(event.target.value) } },
        ...(catalog?.worldBooks.length ? [] : [h('option', { key: 'empty', value: '' }, uiMessage('world.catalogEmpty'))]),
        ...(catalog?.worldBooks ?? []).map(item => h('option', { key: item.id, value: item.id }, rawText(item.name))))),
      draft === null ? null : h('div', { className: 'dwb-resource', ref: standaloneEditorRef },
        h(Field, { label: uiMessage('world.bookName') }, h('input', { className: 'dwb-input', value: draft.name ?? '', onChange: event => { setDraft(current => ({ ...current, name: event.target.value })); setDirty(true) } })),
        h('p', { className: 'dwb-meta' }, uiMessage('world.documentMeta', { count: entries.length })),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button', type: 'button', onClick: () => { setDraft(current => ({ ...current, entries: [...current.entries, createWorldBookEntry(current.entries)] })); setDirty(true) } }, uiMessage('world.addEntry')),
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !dirty, onClick: save }, dirty ? uiMessage('common.saveChanges') : uiMessage('common.saved')),
          h('a', { className: 'dwb-button', href: `${API_ROOT}/world-books/${encodeURIComponent(document.id)}/json`, download: '' }, uiMessage('common.exportJson')),
          h('button', { className: 'dwb-button dwb-danger', type: 'button', disabled: busy, onClick: remove }, uiMessage('world.deleteStandalone')),
        ),
        ...entries.map((entry, index) => h(EntryEditor, { key: `${String(document.id)}-${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: itemIndex => { if (window.confirm(unwrapText(uiMessage('world.confirmDeleteEntry')))) { setDraft(current => ({ ...current, entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) })); setDirty(true) } } })),
      ),
      ),
      h('section', { className: 'dwb-source-section', 'data-source': 'user' },
      h('h2', { className: 'dwb-section-title' }, uiMessage('world.user.title')),
      userSource.user === null
        ? h('p', { className: 'dwb-note' }, uiMessage('world.user.none'))
        : h('div', { className: 'dwb-resource' },
          h('div', { className: 'dwb-resource-title' }, uiMessage('world.user.current', { name: userSource.user.name || userSource.user.id })),
          userCatalog.length
            ? h('div', { className: 'dwb-bindings dwb-user-bindings' }, ...userCatalog.map(book => {
              const checked = userSelection.includes(book.id)
              const wasApplied = appliedUserSelection.includes(book.id)
              const badge = checked && !wasApplied
                ? uiMessage('world.user.pendingAdd')
                : !checked && wasApplied
                  ? uiMessage('world.user.pendingRemove')
                  : checked && selection.includes(book.id)
                    ? uiMessage('world.user.duplicate')
                    : checked
                      ? uiMessage('world.user.appended')
                      : null
              return h('div', { className: 'dwb-user-binding-row', key: book.id },
                h('label', { className: 'dwb-check' },
                  h('input', {
                    type: 'checkbox',
                    checked,
                    onChange: event => setUserSelection(current => event.target.checked
                      ? [...current, book.id]
                      : current.filter(id => id !== book.id)),
                  }),
                  h('span', { className: 'dwb-source-book-name' }, rawText(book.name)),
                  badge === null ? null : h('span', { className: 'dwb-source-badge' }, badge),
                ),
                checked || wasApplied
                  ? h('button', { className: 'dwb-button dwb-inline-edit', type: 'button', disabled: busy, onClick: () => editUserBook(book.id) }, uiMessage('world.user.editContent'))
                  : null,
              )
            }))
            : h('p', { className: 'dwb-note' }, uiMessage('world.user.libraryEmpty')),
          userSelectionDirty
            ? h('div', { className: 'dwb-status', 'data-warning': true }, uiMessage('world.user.unsaved'))
            : h('p', { className: 'dwb-note' }, userSource.books.length === 0 ? uiMessage('world.user.empty') : uiMessage('world.user.saved')),
          h('div', { className: 'dwb-actions' },
            h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !userSelectionDirty, onClick: saveUserSelection }, userSelectionDirty ? uiMessage('world.user.save') : uiMessage('world.user.saveApplied')),
            h('button', { className: 'dwb-button', type: 'button', disabled: busy || userSelection.length === 0, onClick: () => setUserSelection([]) }, uiMessage('world.user.clear')),
          ),
          h('p', { className: 'dwb-note' }, uiMessage('world.user.order')),
          h('p', { className: 'dwb-note' }, uiMessage('world.user.editHint')),
        ),
      ),
      h('section', { className: 'dwb-source-section', 'data-source': 'character' },
      h('h2', { className: 'dwb-section-title' }, uiMessage('world.characterBound')),
      embeddedDraft !== null ? h('div', { className: 'dwb-resource' },
        h('div', { className: 'dwb-resource-title' }, embeddedDraft.name || embedded[0]?.name ? rawText(embeddedDraft.name || embedded[0]?.name) : uiMessage('world.embeddedTitle')),
        h('p', { className: 'dwb-note' }, uiMessage('world.embeddedMeta', { count: embeddedEntries.length })),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button', type: 'button', onClick: () => { const ids = embeddedEntries.map(entry => Number(entry.id)).filter(Number.isSafeInteger); const id = ids.length === 0 ? 0 : Math.max(...ids) + 1; setEmbeddedDraft(current => ({ ...structuredClone(current), entries: [...current.entries, { id, keys: [], secondary_keys: [], comment: translate('world.entry.untitled', { id }), content: '', enabled: true, constant: false, selective: false, insertion_order: 100, position: 'after_char', extensions: { position: 1, probability: 100, useProbability: true } }] })); setEmbeddedDirty(true) } }, uiMessage('world.addEmbeddedEntry')),
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? uiMessage('world.saveEmbedded') : uiMessage('world.embeddedSaved')),
        ),
        ...embeddedEntries.map((entry, index) => h(EmbeddedEntryEditor, { key: `${String(embeddedCharacterId)}-${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => { setEmbeddedDraft(current => { const next = structuredClone(current); next.entries[itemIndex] = { ...next.entries[itemIndex], ...value }; return next }); setEmbeddedDirty(true) }, remove: itemIndex => { if (window.confirm(unwrapText(uiMessage('world.confirmDeleteEmbeddedEntry')))) { setEmbeddedDraft(current => ({ ...structuredClone(current), entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) })); setEmbeddedDirty(true) } } })),
      ) : h('p', { className: 'dwb-note' }, uiMessage('world.embeddedEmpty')),
      ),
      diagnostics.length > 0 ? h('details', { className: 'dwb-resource' }, h('summary', { className: 'dwb-resource-title' }, uiMessage('world.diagnostics', { count: diagnostics.length })), h('ul', { className: 'dwb-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(item.message))))) : null,
      h('p', { className: 'dwb-note' }, uiMessage('world.matcherNote')),
    ),
  )
}

export function installWorldBookStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-world-book"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-world-book`
  style.textContent = css
  document.head.append(style)
}
