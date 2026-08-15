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
import {
  characterGreetingOptions,
  defaultCharacterSelection,
} from './client-state.js'

const h = createLocalizedElement(createElement)

const API_ROOT = '/dsh-tavern/api'

function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent('dsh-tavern:refresh', { detail: { source: 'character' } }))
}

const css = `
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:16px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar,.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select{box-sizing:border-box;width:100%;height:36px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.dcc-note,.dcc-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container)}.dcc-card-title{font-size:16px;font-weight:650;margin:0 0 5px}.dcc-tags{display:flex;gap:5px;flex-wrap:wrap}.dcc-tag{font-size:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;color:var(--dsw-alias-label-secondary)}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:13px;font-weight:600}.dcc-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.5;margin:8px 0 0;max-height:260px;overflow:auto}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:13px;line-height:1.5}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`

function errorMessage(data, status) {
  if (typeof data?.error === 'string') return data.error
  if (typeof data?.error?.message === 'string') return data.error.message
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
  return h('label', { className: 'dcc-field' }, h('span', { className: 'dcc-label' }, label), children)
}

function TextDetail({ label, value }) {
  if (typeof value !== 'string' || value === '') return null
  return h('details', { className: 'dcc-detail' },
    h('summary', null, label),
    h('p', { className: 'dcc-text' }, rawText(value)),
  )
}

function DiagnosticList({ titleKey, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return h('details', { className: 'dcc-detail' },
    h('summary', null, uiMessage(titleKey, { count: items.length })),
    h('ul', { className: 'dcc-diags' }, ...items.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ''}`)))),
  )
}

export function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog, setCatalog] = useState(null)
  const [detail, setDetail] = useState(null)
  const [selection, setSelection] = useState(null)
  const [binding, setBinding] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'common.loading' })
  const fileRef = useRef(null)
  const refreshGeneration = useRef(0)

  const run = useCallback(async (operation, successKey) => {
    setBusy(true)
    try {
      const result = await operation()
      setStatus({ error: false, key: successKey })
      return result
    } catch (error) {
      setStatus(error?.uiKey
        ? { error: true, key: error.uiKey, values: error.uiValues }
        : { error: true, text: error instanceof Error ? error.message : String(error) })
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const loadDetail = useCallback(async (id) => {
    const generation = ++refreshGeneration.current
    if (id === null || id === undefined || id === '') {
      setDetail(null)
      setBinding(null)
      return
    }
    const data = await api(`/characters/${encodeURIComponent(id)}`)
    if (generation !== refreshGeneration.current) return
    setDetail(data.character)
    setBinding(selection?.characterCardId === id ? selection : defaultCharacterSelection(id))
  }, [selection])

  const refresh = useCallback(async (preferredId) => {
    const generation = ++refreshGeneration.current
    const list = await api('/characters')
    let currentSelection = null
    if (sessionId) {
      const selected = await api(`/character-selection?sessionId=${encodeURIComponent(sessionId)}`)
      currentSelection = selected.selection
    }
    if (generation !== refreshGeneration.current) return
    setCatalog(list)
    setSelection(currentSelection)
    const id = preferredId ?? currentSelection?.characterCardId ?? list.characters[0]?.id ?? null
    if (id === null) {
      setDetail(null)
      setBinding(null)
      return
    }
    const data = await api(`/characters/${encodeURIComponent(id)}`)
    if (generation !== refreshGeneration.current) return
    setDetail(data.character)
    setBinding(currentSelection?.characterCardId === id ? currentSelection : defaultCharacterSelection(id))
  }, [sessionId])

  useEffect(() => {
    run(() => refresh(), 'character.status.loaded')
    return () => { refreshGeneration.current += 1 }
  }, [refresh, run])

  useEffect(() => {
    const onRefresh = event => {
      if (event.detail?.source === 'character') return
      run(() => refresh(detail?.id), 'character.status.refreshed')
    }
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => window.removeEventListener('dsh-tavern:refresh', onRefresh)
  }, [detail?.id, refresh, run])

  const importFile = useCallback((file) => run(async () => {
    const response = await fetch(`${API_ROOT}/characters/import?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status))
    await refresh(data.character.id)
    announceTavernRefresh()
    if (fileRef.current !== null) fileRef.current.value = ''
  }, 'character.status.imported'), [refresh, run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('character.error.needSession')
    if (selection?.characterCardId !== binding?.characterCardId
      && sessionBlank === false
      && !window.confirm(unwrapText(uiMessage('character.confirmHistoricalSwitch')))) return
    const data = await api('/character-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...binding }),
    })
    setSelection(data.selection)
    setBinding(data.selection)
    announceTavernRefresh()
  }, 'character.status.bound'), [binding, run, selection, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('character.error.noSessionToUnbind')
    await api('/character-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, characterCardId: null }),
    })
    setSelection(null)
    if (detail !== null) setBinding(defaultCharacterSelection(detail.id))
    announceTavernRefresh()
  }, 'character.status.unbound'), [detail, run, sessionId])

  const remove = useCallback(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiMessage('character.confirmDelete', { name: detail.name })))) return
    await api(`/characters/${encodeURIComponent(detail.id)}`, { method: 'DELETE' })
    await refresh(null)
    announceTavernRefresh()
  }, 'character.status.deleted'), [detail, refresh, run])

  const greetings = characterGreetingOptions(detail)
  const activeName = selection === null
    ? translate('nav.character.empty')
    : catalog?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId
  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('character.title')) })

  return h('div', { className: 'dcc-panel' },
    h('div', { className: 'dcc-header' },
      h('div', { className: 'dcc-title' }, uiMessage('character.title')),
      h('button', { className: 'dcc-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: close }, '✕'),
    ),
    h('div', { className: 'dcc-body' },
      h('div', { className: 'dcc-toolbar' },
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage('character.import')),
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => run(() => refresh(detail?.id), 'character.status.libraryRefreshed') }, uiMessage('common.refresh')),
        h('input', { ref: fileRef, hidden: true, type: 'file', accept: '.json,.png,application/json,image/png', onChange: (event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) importFile(file)
        } }),
      ),
      h(Field, { label: uiMessage('character.browse') }, h('select', {
        className: 'dcc-select',
        value: detail?.id ?? '',
        disabled: busy || catalog === null || catalog.characters.length === 0,
        onChange: (event) => run(() => loadDetail(event.target.value), 'character.status.detailsLoaded'),
      },
      ...(catalog?.characters.length ? [] : [h('option', { key: 'empty', value: '' }, uiMessage('character.libraryEmpty'))]),
      ...(catalog?.characters ?? []).map((item) => h('option', { key: item.id, value: item.id }, rawText(`${item.name} · ${item.sourceFormat}`))))),
      h('p', { className: 'dcc-note' }, uiMessage('character.sessionBinding', {
        session: sessionId || translate('common.none'),
        name: activeName,
      })),
      h('div', { className: 'dcc-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, statusText(status)),
      detail === null ? h('p', { className: 'dcc-note' }, catalog === null ? uiMessage('character.loading') : uiMessage('character.emptyHint')) : h('div', { className: 'dcc-card' },
        h('div', { className: 'dcc-card-head' },
          detail.source.container === 'png' ? h('img', { className: 'dcc-avatar', src: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/artifact`, alt: uiMessage('character.imageAlt', { name: detail.name }) }) : null,
          h('div', null,
            h('h3', { className: 'dcc-card-title' }, rawText(detail.name)),
            h('p', { className: 'dcc-meta' }, rawText(`${detail.source.format}${detail.source.specVersion ? ` · ${detail.source.specVersion}` : ''} · ${detail.source.container}`)),
            h('p', { className: 'dcc-meta' }, rawText(`${detail.data.creator || translate('common.unknownAuthor')}${detail.data.characterVersion ? ` · ${detail.data.characterVersion}` : ''}`)),
            h('div', { className: 'dcc-tags' }, ...detail.data.tags.map((tag, index) => h('span', { className: 'dcc-tag', key: `${tag}-${index}` }, rawText(tag)))),
          ),
        ),
        h(Field, { label: uiMessage('character.greeting') }, h('select', {
          className: 'dcc-select',
          value: binding?.character?.greetingIndex ?? 0,
          onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, greetingIndex: Number(event.target.value) } })),
        }, ...greetings.map((item) => h('option', { key: item.index, value: item.index }, uiMessage(item.labelKey, item.labelValues))))),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterSystemPrompt: event.target.checked } })) }), h('span', null, uiMessage('character.preferSystem'))),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterPostHistory: event.target.checked } })) }), h('span', null, uiMessage('character.preferPostHistory'))),
        h('div', { className: 'dcc-actions' },
          h('button', { className: 'dcc-button dcc-primary', type: 'button', disabled: busy || !sessionId, onClick: bind }, selection?.characterCardId === detail.id ? uiMessage('character.bindUpdate') : uiMessage('character.bind')),
          h('button', { className: 'dcc-button', type: 'button', disabled: busy || !sessionId || selection === null, onClick: unbind }, uiMessage('character.unbind')),
        ),
        h('p', { className: 'dcc-note' }, uiMessage('character.moduleNote')),
        h(TextDetail, { label: uiMessage('character.field.creatorNotes'), value: detail.data.creatorNotes }),
        h(TextDetail, { label: uiMessage('character.field.description'), value: detail.data.description }),
        h(TextDetail, { label: uiMessage('character.field.personality'), value: detail.data.personality }),
        h(TextDetail, { label: uiMessage('character.field.scenario'), value: detail.data.scenario }),
        h(TextDetail, { label: uiMessage('character.field.greetingContent'), value: greetings[binding?.character?.greetingIndex ?? 0]?.text }),
        h(TextDetail, { label: uiMessage('character.field.messageExamples'), value: detail.data.messageExample }),
        h(TextDetail, { label: uiMessage('character.field.systemPrompt'), value: detail.data.systemPrompt }),
        h(TextDetail, { label: uiMessage('character.field.postHistory'), value: detail.data.postHistoryInstructions }),
        detail.data.characterBook !== null ? h('div', { className: 'dcc-status' }, uiMessage('character.embeddedBook', { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translate('common.unknown') })) : null,
        h(DiagnosticList, { titleKey: 'character.warnings', items: detail.compatibility.warnings }),
        h(DiagnosticList, { titleKey: 'character.unsupported', items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h('div', { className: 'dcc-status' }, uiMessage('character.unknownMacros', { names: detail.compatibility.unknownMacroNames.join(', ') })) : null,
        h('div', { className: 'dcc-actions' },
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/artifact`, download: '' }, uiMessage('character.exportOriginal')),
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/json`, download: '' }, uiMessage('common.exportJson')),
        ),
        h('div', { className: 'dcc-footer' }, h('button', { className: 'dcc-button dcc-danger', type: 'button', disabled: busy, onClick: remove }, uiMessage('character.delete'))),
      ),
    ),
  )
}

export function installCharacterStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-character"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern-character'
  style.textContent = css
  document.head.append(style)
}
