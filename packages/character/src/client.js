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
  characterBindingDirty,
  characterEditorDirty,
  characterEditorDraft,
  characterEditorPatch,
  characterGreetingOptions,
  defaultCharacterSelection,
} from './client-state.js'
import { API_V1 as API_ROOT, CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'

const h = createLocalizedElement(createElement)

function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: 'character' } }))
}

const css = `
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:16px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select,.dcc-input,.dcc-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.dcc-select,.dcc-input{height:36px;padding:0 9px}.dcc-textarea{min-height:88px;resize:vertical;padding:8px;line-height:1.5}.dcc-note,.dcc-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container);flex:none}.dcc-card-title{font-size:16px;font-weight:650;margin:0 0 5px}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:13px;font-weight:600}.dcc-detail-body{display:flex;flex-direction:column;gap:8px;margin-top:8px}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:13px;line-height:1.5}.dcc-greetings{display:flex;flex-direction:column;gap:8px}.dcc-greeting-item{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dcc-greeting-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
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

function DiagnosticList({ titleKey, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return h('details', { className: 'dcc-detail' },
    h('summary', null, uiMessage(titleKey, { count: items.length })),
    h('ul', { className: 'dcc-diags' }, ...items.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ''}`)))),
  )
}

function patchDraft(setter, field, value) {
  setter((current) => current === null ? current : { ...current, [field]: value })
}

export function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog, setCatalog] = useState(null)
  const [detail, setDetail] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savedDraft, setSavedDraft] = useState(null)
  const [selection, setSelection] = useState(null)
  const [binding, setBinding] = useState(null)
  const [rp, setRp] = useState({ active: false })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'common.loading' })
  const fileRef = useRef(null)
  const refreshGeneration = useRef(0)
  const dirtyRef = useRef(false)
  const dirty = characterEditorDirty(draft, savedDraft)
  dirtyRef.current = dirty

  const applyCharacter = useCallback((character, currentSelection) => {
    const nextDraft = characterEditorDraft(character)
    setDetail(character)
    setDraft(nextDraft)
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft))
    setBinding(currentSelection?.characterCardId === character?.id
      ? currentSelection
      : character === null ? null : defaultCharacterSelection(character.id))
  }, [])

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
      applyCharacter(null, null)
      return
    }
    const data = await api(`/characters/${encodeURIComponent(id)}`)
    if (generation !== refreshGeneration.current) return
    applyCharacter(data.character, selection)
  }, [applyCharacter, selection])

  const refresh = useCallback(async (preferredId) => {
    const generation = ++refreshGeneration.current
    const list = await api('/characters')
    let currentSelection = null
    let currentRp = { active: false }
    if (sessionId) {
      const selected = await api(`/character-selection?sessionId=${encodeURIComponent(sessionId)}`)
      currentSelection = selected.selection
      const rpData = await api(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`)
      currentRp = rpData.rp ?? { active: false }
    }
    if (generation !== refreshGeneration.current) return
    setCatalog(list)
    setSelection(currentSelection)
    setRp(currentRp)
    const id = preferredId ?? currentSelection?.characterCardId ?? list.characters[0]?.id ?? null
    if (id === null) {
      applyCharacter(null, null)
      return
    }
    const data = await api(`/characters/${encodeURIComponent(id)}`)
    if (generation !== refreshGeneration.current) return
    applyCharacter(data.character, currentSelection)
  }, [applyCharacter, sessionId])

  useEffect(() => {
    run(() => refresh(), 'character.status.loaded')
    return () => { refreshGeneration.current += 1 }
  }, [refresh, run])

  useEffect(() => {
    const onRefresh = event => {
      if (event.detail?.source === 'character') return
      if (dirtyRef.current) {
        setStatus({ error: false, key: 'character.status.skippedRefresh' })
        return
      }
      run(() => refresh(detail?.id), 'character.status.refreshed')
    }
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
  }, [detail?.id, refresh, run])

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
    if (dirty && !window.confirm(unwrapText(uiMessage('character.confirmDiscardForCreate')))) return
    run(async () => {
      const data = await api('/characters', { method: 'POST', body: JSON.stringify({ name: translate('character.defaultName') }) })
      await refresh(data.character.id)
      announceTavernRefresh()
    }, 'character.status.created')
  }, [dirty, refresh, run])

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

  const save = useCallback(() => run(async () => {
    if (detail === null || draft === null) return
    const data = await api(`/characters/${encodeURIComponent(detail.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(characterEditorPatch(draft)),
    })
    const nextDraft = characterEditorDraft(data.character)
    setDetail(data.character)
    setDraft(nextDraft)
    setSavedDraft(structuredClone(nextDraft))
    setCatalog((current) => current === null ? current : {
      ...current,
      characters: current.characters.map((item) => item.id === data.character.id
        ? { ...item, name: data.character.name }
        : item),
    })
    setBinding((current) => {
      if (current === null || current.characterCardId !== data.character.id) return current
      const greetings = characterGreetingOptions(data.character)
      const maxIndex = Math.max(0, greetings.length - 1)
      const greetingIndex = Math.min(current.character?.greetingIndex ?? 0, maxIndex)
      return { ...current, character: { ...current.character, greetingIndex } }
    })
    announceTavernRefresh()
  }, 'character.status.saved'), [detail, draft, run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('character.error.needSession')
    if (dirty) throw uiError('character.error.saveFirst')
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
    const rpData = await api(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`)
    setRp(rpData.rp ?? { active: false })
    announceTavernRefresh()
  }, 'character.status.bound'), [binding, dirty, run, selection, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('character.error.noSessionToUnbind')
    await api('/character-selection', {
      method: 'POST',
      body: JSON.stringify({ sessionId, characterCardId: null }),
    })
    await refresh(detail?.id)
  }, 'character.status.unbound'), [detail?.id, refresh, run, sessionId])

  const toggleRp = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('character.error.needSession')
    const data = await api('/rp-mode', {
      method: 'PUT',
      body: JSON.stringify({ sessionId, active: rp.active !== true }),
    })
    setRp(data.rp ?? { active: rp.active !== true })
    announceTavernRefresh()
  }, 'character.status.rpUpdated'), [rp.active, run, sessionId])

  const remove = useCallback(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiMessage('character.confirmDelete', { name: detail.name })))) return
    await api(`/characters/${encodeURIComponent(detail.id)}`, { method: 'DELETE' })
    await refresh(null)
    announceTavernRefresh()
  }, 'character.status.deleted'), [detail, refresh, run])

  const chooseCharacter = useCallback((id) => {
    if (dirty && !window.confirm(unwrapText(uiMessage('character.confirmDiscardForSwitch')))) return
    run(() => loadDetail(id), 'character.status.detailsLoaded')
  }, [dirty, loadDetail, run])

  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage('character.confirmCloseDirty')))) close()
  }

  const greetings = characterGreetingOptions(draft === null ? detail : { data: draft })
  const greetingIndex = Math.min(binding?.character?.greetingIndex ?? 0, Math.max(0, greetings.length - 1))
  const boundHere = detail !== null && selection?.characterCardId === detail.id
  const bindingDirty = characterBindingDirty(selection, binding)
  const activeName = selection === null
    ? translate('nav.character.empty')
    : catalog?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId
  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('character.title')) })
  const avatarSrc = detail === null ? null : `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/png`

  return h('div', { className: 'dcc-panel' },
    h('div', { className: 'dcc-header' },
      h('div', { className: 'dcc-title' }, uiMessage('character.title')),
      h('button', { className: 'dcc-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: requestClose }, '✕'),
    ),
    h('div', { className: 'dcc-body' },
      h('div', { className: 'dcc-toolbar' },
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: create }, uiMessage('character.create')),
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage('character.import')),
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => {
          if (dirty && !window.confirm(unwrapText(uiMessage('character.confirmDiscardRefresh')))) return
          run(() => refresh(detail?.id), 'character.status.libraryRefreshed')
        } }, uiMessage('common.refresh')),
        h('input', { ref: fileRef, hidden: true, type: 'file', accept: '.json,.png,application/json,image/png', onChange: (event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) importFile(file)
        } }),
      ),
      h(Field, { label: uiMessage('character.browse') }, h('select', {
        className: 'dcc-select',
        value: detail?.id ?? '',
        disabled: busy || catalog === null || catalog.characters.length === 0,
        onChange: (event) => chooseCharacter(event.target.value),
      },
      ...(catalog?.characters.length ? [] : [h('option', { key: 'empty', value: '' }, uiMessage('character.libraryEmpty'))]),
      ...(catalog?.characters ?? []).map((item) => h('option', { key: item.id, value: item.id }, rawText(item.name))))),
      h('p', { className: 'dcc-note' }, uiMessage('character.sessionBinding', {
        session: sessionId || translate('common.none'),
        name: activeName,
      })),
      h('div', { className: 'dcc-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, statusText(status)),
      dirty
        ? h('div', { className: 'dcc-status', 'data-warning': true, role: 'status' }, uiMessage('character.dirty'))
        : detail === null ? null : h('p', { className: 'dcc-note' }, uiMessage('character.savedNote')),
      detail === null || draft === null ? h('p', { className: 'dcc-note' }, catalog === null ? uiMessage('character.loading') : uiMessage('character.emptyHint')) : h('div', { className: 'dcc-card' },
        h('div', { className: 'dcc-card-head' },
          h('img', { className: 'dcc-avatar', src: avatarSrc, alt: uiMessage('character.imageAlt', { name: detail.name }) }),
          h('div', null,
            h('h3', { className: 'dcc-card-title' }, rawText(detail.name)),
            h('p', { className: 'dcc-meta' }, rawText(`${detail.source.format}${detail.source.specVersion ? ` · ${detail.source.specVersion}` : ''} · ${detail.source.container}`)),
            h('p', { className: 'dcc-meta' }, rawText(`${draft.creator || translate('common.unknownAuthor')}${draft.characterVersion ? ` · ${draft.characterVersion}` : ''}`)),
          ),
        ),
        h(Field, { label: uiMessage('common.name') }, h('input', {
          className: 'dcc-input',
          value: draft.name,
          maxLength: 200,
          onChange: (event) => patchDraft(setDraft, 'name', event.target.value),
        })),
        h(Field, { label: uiMessage('character.field.nickname') }, h('input', {
          className: 'dcc-input',
          value: draft.nickname,
          onChange: (event) => patchDraft(setDraft, 'nickname', event.target.value),
        })),
        h(Field, { label: uiMessage('character.field.creator') }, h('input', {
          className: 'dcc-input',
          value: draft.creator,
          onChange: (event) => patchDraft(setDraft, 'creator', event.target.value),
        })),
        h(Field, { label: uiMessage('character.field.characterVersion') }, h('input', {
          className: 'dcc-input',
          value: draft.characterVersion,
          onChange: (event) => patchDraft(setDraft, 'characterVersion', event.target.value),
        })),
        h(Field, { label: uiMessage('character.field.tags') }, h('input', {
          className: 'dcc-input',
          value: draft.tagsText,
          placeholder: uiMessage('character.tagsPlaceholder'),
          onChange: (event) => patchDraft(setDraft, 'tagsText', event.target.value),
        })),
        h(Field, { label: uiMessage('character.greeting') }, h('select', {
          className: 'dcc-select',
          value: greetingIndex,
          onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, greetingIndex: Number(event.target.value) } })),
        }, ...greetings.map((item) => h('option', { key: item.index, value: item.index }, uiMessage(item.labelKey, item.labelValues))))),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterSystemPrompt: event.target.checked } })) }), h('span', null, uiMessage('character.preferSystem'))),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterPostHistory: event.target.checked } })) }), h('span', null, uiMessage('character.preferPostHistory'))),
        boundHere
          ? (bindingDirty
            ? h('div', { className: 'dcc-status', 'data-warning': true, role: 'status' }, uiMessage('character.bindingUnsaved'))
            : h('p', { className: 'dcc-note' }, uiMessage('character.bindingApplied')))
          : null,
        h('div', { className: 'dcc-actions' },
          h('button', { className: 'dcc-button dcc-primary', type: 'button', disabled: busy || !dirty, onClick: save }, dirty ? uiMessage('character.saveResource') : uiMessage('character.resourceSaved')),
          h('button', { className: 'dcc-button dcc-primary', type: 'button', disabled: busy || !sessionId || dirty || (boundHere && !bindingDirty), onClick: bind }, dirty ? uiMessage('character.saveFirst') : boundHere ? (bindingDirty ? uiMessage('character.bindUpdate') : uiMessage('character.bindingAppliedButton')) : uiMessage('character.bind')),
        ),
        h('button', { className: 'dcc-button', type: 'button', disabled: busy || !sessionId || selection === null, onClick: unbind }, uiMessage('character.unbind')),
        h('label', { className: 'dcc-check' },
          h('input', {
            type: 'checkbox',
            checked: rp.active === true,
            disabled: busy || !sessionId,
            onChange: toggleRp,
          }),
          h('span', null, uiMessage('character.rpMode')),
        ),
        h('p', { className: 'dcc-note' }, uiMessage('character.rpMode.help')),
        h('p', { className: 'dcc-note' }, uiMessage('character.moduleNote')),
        h('details', { className: 'dcc-detail', open: true },
          h('summary', null, uiMessage('character.field.firstMessage')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', {
            className: 'dcc-textarea',
            value: draft.firstMessage,
            onChange: (event) => patchDraft(setDraft, 'firstMessage', event.target.value),
          })),
        ),
        h('details', { className: 'dcc-detail', open: true },
          h('summary', null, uiMessage('character.alternateGreetings')),
          h('div', { className: 'dcc-detail-body' },
            h('div', { className: 'dcc-greetings' },
              ...draft.alternateGreetings.map((text, index) => h('div', { className: 'dcc-greeting-item', key: `alt-${index}` },
                h('div', { className: 'dcc-greeting-head' },
                  h('span', { className: 'dcc-label' }, uiMessage('character.greeting.alternate', { index: index + 1 })),
                  h('button', {
                    className: 'dcc-button dcc-danger',
                    type: 'button',
                    disabled: busy,
                    onClick: () => setDraft((current) => current === null ? current : {
                      ...current,
                      alternateGreetings: current.alternateGreetings.filter((_item, itemIndex) => itemIndex !== index),
                    }),
                  }, uiMessage('common.delete')),
                ),
                h('textarea', {
                  className: 'dcc-textarea',
                  value: text,
                  onChange: (event) => setDraft((current) => {
                    if (current === null) return current
                    const alternateGreetings = [...current.alternateGreetings]
                    alternateGreetings[index] = event.target.value
                    return { ...current, alternateGreetings }
                  }),
                }),
              )),
            ),
            h('button', {
              className: 'dcc-button',
              type: 'button',
              disabled: busy,
              onClick: () => setDraft((current) => current === null ? current : {
                ...current,
                alternateGreetings: [...current.alternateGreetings, ''],
              }),
            }, uiMessage('character.addGreeting')),
          ),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.creatorNotes')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.creatorNotes, onChange: (event) => patchDraft(setDraft, 'creatorNotes', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.description')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.description, onChange: (event) => patchDraft(setDraft, 'description', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.personality')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.personality, onChange: (event) => patchDraft(setDraft, 'personality', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.scenario')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.scenario, onChange: (event) => patchDraft(setDraft, 'scenario', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.messageExamples')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.messageExample, onChange: (event) => patchDraft(setDraft, 'messageExample', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.systemPrompt')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.systemPrompt, onChange: (event) => patchDraft(setDraft, 'systemPrompt', event.target.value) })),
        ),
        h('details', { className: 'dcc-detail' },
          h('summary', null, uiMessage('character.field.postHistory')),
          h('div', { className: 'dcc-detail-body' }, h('textarea', { className: 'dcc-textarea', value: draft.postHistoryInstructions, onChange: (event) => patchDraft(setDraft, 'postHistoryInstructions', event.target.value) })),
        ),
        detail.data.characterBook !== null ? h('div', { className: 'dcc-status' }, uiMessage('character.embeddedBook', { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translate('common.unknown') })) : null,
        h(DiagnosticList, { titleKey: 'character.warnings', items: detail.compatibility.warnings }),
        h(DiagnosticList, { titleKey: 'character.unsupported', items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h('div', { className: 'dcc-status' }, uiMessage('character.unknownMacros', { names: detail.compatibility.unknownMacroNames.join(', ') })) : null,
        h('div', { className: 'dcc-actions' },
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/json`, download: '' }, uiMessage('common.exportJson')),
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/png`, download: '' }, uiMessage('character.exportPng')),
        ),
        h('div', { className: 'dcc-footer' }, h('button', { className: 'dcc-button dcc-danger', type: 'button', disabled: busy, onClick: remove }, uiMessage('character.delete'))),
      ),
    ),
  )
}

export function installCharacterStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-character"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-character`
  style.textContent = css
  document.head.append(style)
}
