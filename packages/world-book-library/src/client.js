import {
  createElement as h,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const API_ROOT = '/dsh-tavern/api'
const POSITIONS = [
  ['before_character_definition', '角色定义之前'],
  ['after_character_definition', '角色定义之后'],
  ['before_author_note', '作者注释之前（近似）'],
  ['after_author_note', '作者注释之后（近似）'],
  ['at_depth', '指定深度（近似）'],
  ['before_example_messages', '示例消息之前（近似）'],
  ['after_example_messages', '示例消息之后（近似）'],
  ['outlet', 'Outlet（当前不注入）'],
]

const css = `
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:16px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:12px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px 8px}.dwb-input,.dwb-select{height:36px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.5}.dwb-note,.dwb-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:13px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-status[data-warning=true]{color:var(--dsw-alias-state-warning,#b46b00)}.dwb-section-title{font-size:15px;font-weight:700;margin:5px 0 0}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:14px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.45}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:13px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
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
      h('span', { className: 'dwb-entry-name' }, entry.comment || entry.name || `条目 ${entry.id ?? index}`),
      h('span', { className: 'dwb-entry-state' }, entry.constant ? '常驻' : (entry.keys ?? []).join(', ') || '无关键词'),
    ),
    h('div', { className: 'dwb-entry-body' },
      h(Field, { label: '条目标题' }, h('input', { className: 'dwb-input', value: entry.comment ?? entry.name ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h(Field, { label: '主关键词（支持中文、英文逗号分隔）' }, h('input', { className: 'dwb-input', value: (entry.keys ?? []).join(', '), onChange: event => patch({ keys: parseKeywords(event.target.value) }) })),
      h(Field, { label: '附加关键词（支持中文、英文逗号分隔）' }, h('input', { className: 'dwb-input', value: secondaryKeys.join(', '), onChange: event => { const keys = parseKeywords(event.target.value); patch({ secondary_keys: keys, selective: keys.length > 0 }) } })),
      secondaryKeys.length > 0 ? h(Field, { label: 'Secondary logic' }, h('select', {
        className: 'dwb-select',
        value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any',
        onChange: event => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...(entry.extensions ?? {}), selectiveLogic: event.target.value } }),
      },
      h('option', { value: 'and_any' }, 'AND ANY：命中任一'),
      h('option', { value: 'and_all' }, 'AND ALL：命中全部'),
      h('option', { value: 'not_any' }, 'NOT ANY：不能命中任一'),
      h('option', { value: 'not_all' }, 'NOT ALL：不能全部命中'))) : null,
      h(Field, { label: '正文' }, h('textarea', { className: 'dwb-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dwb-grid' },
        h(Field, { label: '位置' }, h('select', { className: 'dwb-select', value: position, onChange: event => { const value = Number(event.target.value); patch({ position: value === 0 ? 'before_char' : value === 1 ? 'after_char' : entry.position, extensions: { ...(entry.extensions ?? {}), position: value } }) } }, ...POSITIONS.map(([_value, label], value) => h('option', { key: value, value }, label)))),
        h(Field, { label: '顺序（高值优先）' }, h('input', { className: 'dwb-input', type: 'number', value: entry.insertion_order ?? 100, onChange: event => patch({ insertion_order: Number(event.target.value) }) })),
        h(Field, { label: '概率（0–100）' }, h('input', { className: 'dwb-input', type: 'number', min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: event => patch({ probability: Number(event.target.value), extensions: { ...(entry.extensions ?? {}), probability: Number(event.target.value), useProbability: true } }) })),
      ),
      h('div', { className: 'dwb-checks' },
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), '启用'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), '常驻'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: event => patch({ case_sensitive: event.target.checked, extensions: { ...(entry.extensions ?? {}), case_sensitive: event.target.checked } }) }), '区分大小写'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: event => patch({ match_whole_words: event.target.checked, extensions: { ...(entry.extensions ?? {}), match_whole_words: event.target.checked } }) }), '全词匹配'),
      ),
      h('div', { className: 'dwb-actions' }, h('button', { className: 'dwb-button dwb-danger', type: 'button', onClick: () => remove(index) }, '删除条目')),
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
    comment: `新条目 ${uid}`,
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

function EntryEditor({ entry, index, update, remove }) {
  const patch = value => update(index, value)
  const secondary = Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : []
  return h('details', { className: 'dwb-entry', 'data-enabled': entry.enabled === true },
    h('summary', null,
      h('span', { className: 'dwb-dot' }),
      h('span', { className: 'dwb-entry-name' }, entry.comment || `条目 ${entry.uid ?? index}`),
      h('span', { className: 'dwb-entry-state' }, entry.constant ? '常驻' : (entry.keys ?? []).join(', ') || '无关键词'),
    ),
    h('div', { className: 'dwb-entry-body' },
      h(Field, { label: '条目标题' }, h('input', { className: 'dwb-input', value: entry.comment ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h(Field, { label: '主关键词（支持中文、英文逗号分隔）' }, h('input', { className: 'dwb-input', value: (entry.keys ?? []).join(', '), onChange: event => patch({ keys: parseKeywords(event.target.value) }) })),
      h(Field, { label: '附加关键词（支持中文、英文逗号分隔）' }, h('input', { className: 'dwb-input', value: secondary.join(', '), onChange: event => { const keys = parseKeywords(event.target.value); patch({ secondaryKeys: keys, selective: keys.length > 0 }) } })),
      secondary.length > 0 ? h(Field, { label: 'Secondary logic' }, h('select', { className: 'dwb-select', value: entry.selectiveLogic ?? 'and_any', onChange: event => patch({ selectiveLogic: event.target.value, selective: true }) },
        h('option', { value: 'and_any' }, 'AND ANY：命中任一'),
        h('option', { value: 'and_all' }, 'AND ALL：命中全部'),
        h('option', { value: 'not_any' }, 'NOT ANY：不能命中任一'),
        h('option', { value: 'not_all' }, 'NOT ALL：不能全部命中'))) : null,
      h(Field, { label: '正文' }, h('textarea', { className: 'dwb-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dwb-grid' },
        h(Field, { label: '位置' }, h('select', { className: 'dwb-select', value: entry.position, onChange: event => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, label]) => h('option', { key: value, value }, label)))),
        h(Field, { label: '顺序（高值优先）' }, h('input', { className: 'dwb-input', type: 'number', value: entry.insertionOrder ?? 100, onChange: event => patch({ insertionOrder: Number(event.target.value) }) })),
        h(Field, { label: '概率（0–100）' }, h('input', { className: 'dwb-input', type: 'number', min: 0, max: 100, value: entry.probability ?? 100, onChange: event => patch({ probability: Number(event.target.value), useProbability: true }) })),
      ),
      h('div', { className: 'dwb-checks' },
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), '启用'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), '常驻'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.caseSensitive === true, onChange: event => patch({ caseSensitive: event.target.checked }) }), '区分大小写'),
        h('label', { className: 'dwb-check' }, h('input', { type: 'checkbox', checked: entry.matchWholeWords === true, onChange: event => patch({ matchWholeWords: event.target.checked }) }), '全词匹配'),
      ),
      h('div', { className: 'dwb-actions' }, h('button', { className: 'dwb-button dwb-danger', type: 'button', onClick: () => remove(index) }, '删除条目')),
    ),
  )
}

export function WorldBookPanel({ sessionId, close }) {
  const [catalog, setCatalog] = useState(null)
  const [document, setDocument] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selection, setSelection] = useState([])
  const [appliedSelection, setAppliedSelection] = useState([])
  const [active, setActive] = useState(null)
  const [embeddedCharacterId, setEmbeddedCharacterId] = useState(null)
  const [embeddedDraft, setEmbeddedDraft] = useState(null)
  const [embeddedDirty, setEmbeddedDirty] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: '加载中…', error: false })
  const fileRef = useRef(null)
  const generation = useRef(0)

  const run = useCallback(async (operation, success) => {
    setBusy(true)
    try {
      const value = await operation()
      setStatus({ text: success, error: false })
      return value
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true })
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
    setCatalog(list)
    setSelection(ids)
    setAppliedSelection(ids)
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
    run(() => refresh(), '世界书资源库已加载')
    const onRefresh = () => run(() => refresh(), '世界书资源库已刷新')
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => {
      generation.current += 1
      window.removeEventListener('dsh-tavern:refresh', onRefresh)
    }
  }, [refresh, run])

  const load = id => run(async () => {
    const detail = await api(`/world-books/${encodeURIComponent(id)}`)
    setDocument(detail.worldBook)
    setDraft(structuredClone(detail.worldBook.book))
    setDirty(false)
  }, '世界书详情已加载')

  const create = () => run(async () => {
    const data = await api('/world-books', { method: 'POST', body: JSON.stringify({ name: 'Untitled World Book' }) })
    await refresh(data.worldBook.id)
  }, '已创建独立世界书；尚未绑定当前会话')

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
  }, '世界书已导入；尚未绑定当前会话')

  const save = () => run(async () => {
    const data = await api(`/world-books/${encodeURIComponent(document.id)}`, { method: 'PATCH', body: JSON.stringify({ book: draft }) })
    setDocument(data.worldBook)
    setDraft(structuredClone(data.worldBook.book))
    setDirty(false)
    window.dispatchEvent(new Event('dsh-tavern:refresh'))
  }, '世界书修改已持久化，后续请求将使用新内容')

  const saveSelection = () => run(async () => {
    if (!sessionId) throw new Error('请先创建或打开一个会话再绑定世界书')
    const data = await api('/world-book-selection', { method: 'POST', body: JSON.stringify({ sessionId, worldBookIds: selection }) })
    setSelection(data.selection.worldBookIds)
    setAppliedSelection(data.selection.worldBookIds)
    window.dispatchEvent(new Event('dsh-tavern:refresh'))
  }, '当前会话的世界书绑定已保存')

  const remove = () => run(async () => {
    if (document === null || !window.confirm(`删除独立世界书“${document.name}”？角色卡内嵌世界书不会受到影响。`)) return
    await api(`/world-books/${encodeURIComponent(document.id)}`, { method: 'DELETE' })
    setDocument(null)
    setDraft(null)
    await refresh(null)
    window.dispatchEvent(new Event('dsh-tavern:refresh'))
  }, '独立世界书已删除，相关会话绑定已清理')

  const saveEmbedded = () => run(async () => {
    const data = await api(`/characters/${encodeURIComponent(embeddedCharacterId)}/world-book`, {
      method: 'PATCH',
      body: JSON.stringify({ characterBook: embeddedDraft }),
    })
    setEmbeddedDraft(structuredClone(data.character.data.characterBook))
    setEmbeddedDirty(false)
    window.dispatchEvent(new Event('dsh-tavern:refresh'))
  }, '角色卡内嵌世界书已保存，后续请求将使用新内容')

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

  return h('div', { className: 'dwb-panel' },
    h('div', { className: 'dwb-header' }, h('div', { className: 'dwb-title' }, '世界信息（World Book）'), h('button', { className: 'dwb-close', type: 'button', onClick: close, 'aria-label': '关闭世界书侧边栏' }, '✕')),
    h('div', { className: 'dwb-body' },
      h('div', { className: 'dwb-toolbar' },
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, '导入 JSON'),
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: create }, '新建世界书'),
        h('button', { className: 'dwb-button', type: 'button', disabled: busy, onClick: () => { if (!dirty || window.confirm('放弃尚未保存的修改？')) run(() => refresh(), '世界书资源库已刷新') } }, '刷新'),
        h('input', { ref: fileRef, hidden: true, type: 'file', accept: '.json,application/json', onChange: event => { const file = event.target.files?.[0]; if (file !== undefined) importFile(file) } }),
      ),
      h('p', { className: 'dwb-note' }, `当前会话：${sessionId || '无'}。可绑定零本、一本或多本独立世界书；绑定顺序保持稳定。`),
      h('div', { className: 'dwb-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, status.text),
      h('h2', { className: 'dwb-section-title' }, '独立世界书'),
      h('div', { className: 'dwb-resource' },
        h('div', { className: 'dwb-resource-title' }, '当前会话绑定'),
        catalog?.worldBooks.length ? h('div', { className: 'dwb-bindings' }, ...catalog.worldBooks.map(item => h('label', { className: 'dwb-check', key: item.id },
          h('input', { type: 'checkbox', checked: selection.includes(item.id), onChange: event => setSelection(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id)) }),
          `${item.name}（${item.entryCount} 条）`,
        ))) : h('p', { className: 'dwb-note' }, '独立世界书资源库为空。'),
        selectionDirty ? h('div', { className: 'dwb-status', 'data-warning': true }, '绑定有未保存修改，当前勾选尚未应用到会话。') : h('p', { className: 'dwb-note' }, '面板显示的绑定已应用到当前会话。'),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !sessionId || !selectionDirty, onClick: saveSelection }, selectionDirty ? '应用会话绑定（未保存）' : '当前绑定已应用'),
          h('button', { className: 'dwb-button', type: 'button', disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, '清空待应用选择'),
        ),
      ),
      h(Field, { label: '浏览独立世界书' }, h('select', { className: 'dwb-select', value: document?.id ?? '', disabled: busy || !catalog?.worldBooks.length, onChange: event => { if (!dirty || window.confirm('放弃尚未保存的修改？')) load(event.target.value) } },
        ...(catalog?.worldBooks.length ? [] : [h('option', { key: 'empty', value: '' }, '资源库为空')]),
        ...(catalog?.worldBooks ?? []).map(item => h('option', { key: item.id, value: item.id }, item.name)))),
      draft === null ? null : h('div', { className: 'dwb-resource' },
        h(Field, { label: '世界书名称' }, h('input', { className: 'dwb-input', value: draft.name ?? '', onChange: event => { setDraft(current => ({ ...current, name: event.target.value })); setDirty(true) } })),
        h('p', { className: 'dwb-meta' }, `${entries.length} 条 · 未知字段在保存和导出时稳定保留`),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button', type: 'button', onClick: () => { setDraft(current => ({ ...current, entries: [...current.entries, createWorldBookEntry(current.entries)] })); setDirty(true) } }, '新增条目'),
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !dirty, onClick: save }, dirty ? '保存修改' : '已保存'),
          h('a', { className: 'dwb-button', href: `${API_ROOT}/world-books/${encodeURIComponent(document.id)}/json`, download: '' }, '导出 JSON'),
          h('button', { className: 'dwb-button dwb-danger', type: 'button', disabled: busy, onClick: remove }, '删除独立书'),
        ),
        ...entries.map((entry, index) => h(EntryEditor, { key: `${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: itemIndex => { if (window.confirm('删除这个世界书条目？保存后生效。')) { setDraft(current => ({ ...current, entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) })); setDirty(true) } } })),
      ),
      embeddedDraft !== null ? h('h2', { className: 'dwb-section-title' }, '角色卡绑定的世界书') : null,
      embeddedDraft !== null ? h('div', { className: 'dwb-resource' },
        h('div', { className: 'dwb-resource-title' }, embeddedDraft.name || embedded[0]?.name || '角色卡内嵌世界书'),
        h('p', { className: 'dwb-note' }, `${embeddedEntries.length} 条。它与独立书共用 matcher/loader；删除独立书不会修改或解绑角色卡内嵌书。`),
        h('div', { className: 'dwb-actions' },
          h('button', { className: 'dwb-button', type: 'button', onClick: () => { const ids = embeddedEntries.map(entry => Number(entry.id)).filter(Number.isSafeInteger); const id = ids.length === 0 ? 0 : Math.max(...ids) + 1; setEmbeddedDraft(current => ({ ...structuredClone(current), entries: [...current.entries, { id, keys: [], secondary_keys: [], comment: `新条目 ${id}`, content: '', enabled: true, constant: false, selective: false, insertion_order: 100, position: 'after_char', extensions: { position: 1, probability: 100, useProbability: true } }] })); setEmbeddedDirty(true) } }, '新增内嵌条目'),
          h('button', { className: 'dwb-button dwb-primary', type: 'button', disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? '保存内嵌书' : '内嵌书已保存'),
        ),
        ...embeddedEntries.map((entry, index) => h(EmbeddedEntryEditor, { key: `${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => { setEmbeddedDraft(current => { const next = structuredClone(current); next.entries[itemIndex] = { ...next.entries[itemIndex], ...value }; return next }); setEmbeddedDirty(true) }, remove: itemIndex => { if (window.confirm('删除这个角色卡内嵌世界书条目？保存后生效。')) { setEmbeddedDraft(current => ({ ...structuredClone(current), entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) })); setEmbeddedDirty(true) } } })),
      ) : null,
      diagnostics.length > 0 ? h('details', { className: 'dwb-resource' }, h('summary', { className: 'dwb-resource-title' }, `运行诊断（${diagnostics.length}）`), h('ul', { className: 'dwb-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, item.message)))) : null,
      h('p', { className: 'dwb-note' }, '实际激活、排序、概率和预算由共享 matcher 确定；最终注入仍由 Tavern loader 统一完成。当前扫描基于已持久化的会话历史，刚提交的同轮用户输入可能到下一轮才触发。'),
    ),
  )
}

export function installWorldBookStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-world-book"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern-world-book'
  style.textContent = css
  document.head.append(style)
}
