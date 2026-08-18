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
import { reorderAtBoundary } from './client-state.js'
import { API_V1 as API_ROOT, CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'

const h = createLocalizedElement(createElement)

function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: 'preset' } }))
}

const ST_NUMBER_FIELDS = [
  ['top_p', 'preset.sampling.topP'],
  ['top_k', 'preset.sampling.topK'],
  ['top_a', 'preset.sampling.topA'],
  ['min_p', 'preset.sampling.minP'],
  ['frequency_penalty', 'preset.sampling.frequencyPenalty'],
  ['presence_penalty', 'preset.sampling.presencePenalty'],
  ['repetition_penalty', 'preset.sampling.repetitionPenalty'],
  ['seed', 'preset.sampling.seed'],
]

const css = `
.dtt-root{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dtt-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dtt-title{font-size:16px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:13px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar,.dtt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:13px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}.dtt-input,.dtt-select{height:36px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.5}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:14px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtt-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;transition:border-color .12s,box-shadow .12s}.dtt-prompt[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtt-prompt[data-dragging=true]>*{opacity:0}.dtt-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:12px;font-weight:600;pointer-events:none}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:13px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-drag{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtt-drag:active{cursor:grabbing}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:12px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:30px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
`

async function api(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase()
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(method === 'GET' || method === 'HEAD' ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}

function body(value) {
  return JSON.stringify(value)
}

function Field({ label, children }) {
  return h('label', { className: 'dtt-field' },
    h('span', { className: 'dtt-label' }, label),
    children,
  )
}

function NumberField({ label, value, onChange, min, step = 'any' }) {
  return h(Field, { label }, h('input', {
    className: 'dtt-input',
    type: 'number',
    value: value ?? '',
    min,
    step,
    onChange: (event) => onChange(event.target.value === '' ? undefined : Number(event.target.value)),
  }))
}

function PromptEditor({ prompt, index, dragging, onPatch, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDelete }) {
  return h('details', {
    className: 'dtt-prompt',
    'data-prompt-index': index,
    'data-dragging': dragging || undefined,
  },
    h('summary', { className: 'dtt-prompt-summary' },
      h('button', {
        className: 'dtt-drag',
        type: 'button',
        title: uiMessage('preset.dragOrder'),
        'aria-label': uiMessage('preset.dragNamed', { name: prompt.name || prompt.identifier }),
        'aria-pressed': dragging,
        onClick: (event) => {
          event.preventDefault()
          event.stopPropagation()
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
      }, '⠿'),
      h('input', {
        type: 'checkbox',
        checked: prompt.enabled === true,
        disabled: prompt.marker === true,
        title: prompt.marker === true ? uiMessage('preset.markerHint') : uiMessage('preset.enablePrompt'),
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked }),
      }),
      h('span', { className: 'dtt-prompt-name' }, rawText(prompt.name || prompt.identifier)),
      h('span', { className: 'dtt-role' }, rawText(prompt.marker ? 'marker' : prompt.role)),
    ),
    h('div', { className: 'dtt-prompt-body' },
      h(Field, { label: uiMessage('common.name') }, h('input', {
        className: 'dtt-input',
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value }),
      })),
      h(Field, { label: uiMessage('common.role') }, h('select', {
        className: 'dtt-select',
        value: prompt.role,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ role: event.target.value }),
      },
      h('option', { value: 'system' }, uiMessage('preset.role.system')),
      h('option', { value: 'user' }, uiMessage('preset.role.user')),
      h('option', { value: 'assistant' }, uiMessage('preset.role.assistant')))),
      h(Field, { label: uiMessage('common.content') }, h('textarea', {
        className: 'dtt-textarea',
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value }),
      })),
      h('div', { className: 'dtt-row-actions' },
        h('button', { className: 'dtt-button dtt-danger', type: 'button', onClick: onDelete }, uiMessage('common.delete')),
      ),
    ),
  )
}

function DropPlaceholder() {
  return h('div', {
    className: 'dtt-drop-placeholder',
    'aria-hidden': true,
  }, uiMessage('preset.dropHere'))
}

function insertionBoundary(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-prompt-index]')
  if (target === null) return null
  const index = Number(target.dataset.promptIndex)
  const bounds = target.getBoundingClientRect()
  return event.clientY < bounds.top + bounds.height / 2 ? index : index + 1
}

export function PresetSidebar({ closePanel, openPanel, sessionId, sessionBlank, autoOpen = true }) {
  const [catalog, setCatalog] = useState(null)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ error: false, key: 'common.loading' })
  const [advanced, setAdvanced] = useState(false)
  const [dragFrom, setDragFrom] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const fileRef = useRef(null)
  const refreshGeneration = useRef(0)

  useEffect(() => {
    if (!autoOpen) return undefined
    // The host restores its blank-session layout just after slot mount. Re-assert
    // the requested default across that short bootstrap window.
    const timers = [0, 200, 800].map((delay) => window.setTimeout(openPanel, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [autoOpen])

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

  const refresh = useCallback(async (preferredId) => {
    const generation = ++refreshGeneration.current
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
    const data = await api(`/presets${query}`)
    const id = preferredId === undefined
      ? data.selectedId ?? data.presets[0]?.id ?? null
      : preferredId
    const detail = id === null || id === undefined
      ? null
      : (await api(`/presets/${encodeURIComponent(id)}`)).preset
    if (generation !== refreshGeneration.current) return false
    setCatalog(data)
    setDraft(detail)
    return true
  }, [sessionId])

  useEffect(() => {
    refreshGeneration.current += 1
    setCatalog(null)
    setDraft(null)
    setStatus({ error: false, key: 'preset.status.syncing' })
    run(() => refresh(), 'preset.status.loaded')
    return () => { refreshGeneration.current += 1 }
  }, [refresh, run, sessionId])

  useEffect(() => {
    const onRefresh = event => {
      if (event.detail?.source === 'preset') return
      run(() => refresh(), 'preset.status.refreshed')
    }
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
  }, [refresh, run])

  const browse = useCallback((id) => run(async () => {
    const detail = await api(`/presets/${encodeURIComponent(id)}`)
    setDraft(detail.preset)
  }, 'preset.status.detailsLoaded'), [run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('preset.error.needSession')
    if (draft === null) throw uiError('preset.error.needPreset')
    if (catalog?.selectedId !== draft.id
      && catalog?.selectedId !== null
      && sessionBlank === false
      && !window.confirm(unwrapText(uiMessage('preset.confirmHistoricalSwitch')))) return
    await api('/select', { method: 'POST', body: body({ id: draft.id, sessionId }) })
    await refresh(draft.id)
    announceTavernRefresh()
  }, 'preset.status.bound'), [catalog?.selectedId, draft, refresh, run, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw uiError('preset.error.noSessionToUnbind')
    await api('/select', { method: 'POST', body: body({ id: null, sessionId }) })
    await refresh(draft?.id)
    announceTavernRefresh()
  }, 'preset.status.unbound'), [draft?.id, refresh, run, sessionId])

  const createPreset = useCallback(() => run(async () => {
    const created = await api('/presets', { method: 'POST', body: body({ name: translate('preset.defaultName') }) })
    await refresh(created.preset.id)
    announceTavernRefresh()
  }, 'preset.status.created'), [refresh, run])

  const importFile = useCallback((file) => run(async () => {
    const content = await file.text()
    const imported = await api('/import', {
      method: 'POST',
      body: body({ name: file.name.replace(/\.json$/i, ''), content }),
    })
    await refresh(imported.preset.id)
    announceTavernRefresh()
    if (fileRef.current !== null) fileRef.current.value = ''
  }, 'preset.status.imported'), [refresh, run])

  const save = useCallback(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: 'PUT',
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts }),
    })
    setDraft(result.preset)
    await refresh(result.preset.id)
    announceTavernRefresh()
  }, 'preset.status.saved'), [draft, refresh, run])

  const remove = useCallback(() => run(async () => {
    if (!window.confirm(unwrapText(uiMessage('preset.confirmDelete', { name: draft.name })))) return
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
    await refresh()
    announceTavernRefresh()
  }, 'preset.status.deleted'), [draft, refresh, run])

  const patchSampling = (patch) => setDraft((current) => ({
    ...current,
    sampling: { ...current.sampling, ...patch },
  }))
  const patchSt = (key, value) => patchSampling({
    st: { ...draft.sampling.st, [key]: value },
  })
  const patchPrompt = (index, patch) => setDraft((current) => ({
    ...current,
    prompts: current.prompts.map((prompt, at) => at === index ? { ...prompt, ...patch } : prompt),
  }))
  const movePrompt = (from, boundary) => setDraft((current) => {
    const prompts = reorderAtBoundary(current.prompts, from, boundary)
    if (prompts === current.prompts) return current
    return { ...current, prompts }
  })
  const deletePrompt = (index) => setDraft((current) => ({
    ...current,
    prompts: current.prompts.filter((_prompt, at) => at !== index),
  }))
  const addPrompt = () => setDraft((current) => ({
    ...current,
    prompts: [...current.prompts, {
      identifier: `prompt-${Date.now().toString(36)}`,
      name: translate('preset.defaultPromptName'),
      role: 'system',
      content: '',
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {},
    }],
  }))

  const closeLabel = uiMessage('panel.close', { title: unwrapText(uiMessage('preset.title')) })

  return h('div', { className: 'dtt-root' },
    h('div', { className: 'dtt-header' },
      h('div', { className: 'dtt-title' }, uiMessage('preset.title'), catalog?.selectedId ? h('span', { className: 'dtt-active' }, uiMessage('preset.active')) : null),
      h('button', { className: 'dtt-icon', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: closePanel }, '✕'),
    ),
    h('div', { className: 'dtt-body' },
      h('div', { className: 'dtt-toolbar' },
        h('button', { className: 'dtt-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage('preset.importStJson')),
        h('button', { className: 'dtt-button', type: 'button', disabled: busy, onClick: createPreset }, uiMessage('preset.create')),
        h('input', {
          ref: fileRef,
          hidden: true,
          type: 'file',
          accept: '.json,application/json',
          onChange: (event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) importFile(file)
          },
        }),
      ),
      h(Field, { label: uiMessage('preset.browse') }, h('select', {
        className: 'dtt-select',
        value: draft?.id ?? '',
        disabled: busy || catalog === null || catalog.presets.length === 0,
        onChange: (event) => browse(event.target.value),
      },
      ...(catalog?.presets.length ? [] : [h('option', { key: 'empty', value: '' }, uiMessage('preset.libraryEmpty'))]),
      ...(catalog?.presets ?? []).map((preset) => h('option', { key: preset.id, value: preset.id }, rawText(`${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`))))),
      catalog === null
        ? null
        : catalog.selectedId === null
          ? h('p', { className: 'dtt-note' }, uiMessage('preset.unboundNote'))
          : h('p', { className: 'dtt-note' }, uiMessage('preset.currentSessionBound', { name: catalog.presets.find(item => item.id === catalog.selectedId)?.name ?? catalog.selectedId })),
      draft !== null && draft.id !== catalog?.selectedId
        ? h('div', { className: 'dtt-status', 'data-warning': true }, uiMessage('preset.browsingUnbound', { name: draft.name }))
        : null,
      h('div', { className: 'dtt-actions' },
        h('button', { className: 'dtt-button dtt-button-primary', type: 'button', disabled: busy || !sessionId || draft === null, onClick: bind }, catalog?.selectedId === draft?.id ? uiMessage('preset.bindUpdate') : uiMessage('preset.bind')),
        h('button', { className: 'dtt-button', type: 'button', disabled: busy || !sessionId || catalog?.selectedId == null, onClick: unbind }, uiMessage('preset.unbind')),
      ),
      h('div', { className: 'dtt-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, statusText(status)),
      draft === null ? h('p', { className: 'dtt-note' }, catalog === null ? uiMessage('preset.loading') : uiMessage('preset.emptyHint')) : h('div', { className: 'dtt-section' },
        h('div', { className: 'dtt-section-title' }, uiMessage('preset.basicSettings')),
        h(Field, { label: uiMessage('preset.name') }, h('input', {
          className: 'dtt-input',
          value: draft.name,
          onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })),
        })),
        h('div', { className: 'dtt-grid' },
          h(NumberField, { label: uiMessage('preset.temperature'), value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          h(NumberField, { label: uiMessage('preset.maxTokens'), value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 }),
        ),
        h(Field, { label: uiMessage('preset.reasoningEffort') }, h('select', {
          className: 'dtt-select',
          value: draft.sampling.reasoningEffort ?? '',
          onChange: (event) => patchSampling({ reasoningEffort: event.target.value || undefined }),
        },
        h('option', { value: '' }, uiMessage('preset.modelDefault')),
        h('option', { value: 'low' }, uiMessage('preset.effort.low')),
        h('option', { value: 'medium' }, uiMessage('preset.effort.medium')),
        h('option', { value: 'high' }, uiMessage('preset.effort.high')),
        h('option', { value: 'xhigh' }, uiMessage('preset.effort.xhigh')))),
        h('button', { className: 'dtt-button', type: 'button', onClick: () => setAdvanced((value) => !value) }, advanced ? uiMessage('preset.advancedHide') : uiMessage('preset.advancedShow')),
        advanced ? h('div', { className: 'dtt-grid' }, ...ST_NUMBER_FIELDS.map(([key, messageKey]) => h(NumberField, {
          key,
          label: uiMessage(messageKey),
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value),
        }))) : null,
        advanced ? h('p', { className: 'dtt-note' }, uiMessage('preset.advancedNote')) : null,
        advanced ? h(Field, { label: uiMessage('preset.systemPrompt') }, h('select', {
          className: 'dtt-select',
          value: draft.systemPromptMode === 'replace' ? 'replace' : 'append',
          onChange: (event) => setDraft((current) => ({ ...current, systemPromptMode: event.target.value })),
        },
        h('option', { value: 'append' }, uiMessage('preset.systemAppend')),
        h('option', { value: 'replace' }, uiMessage('preset.systemReplace')))) : null,
        advanced && draft.systemPromptMode === 'replace' ? h('p', { className: 'dtt-status', 'data-error': true }, uiMessage('preset.replaceWarning')) : null,
        h('div', { className: 'dtt-section' },
          h('div', { className: 'dtt-section-title' },
            h('span', null, uiMessage('preset.prompts', { count: draft.prompts.length })),
            h('button', { className: 'dtt-button', type: 'button', onClick: addPrompt }, uiMessage('preset.addPrompt')),
          ),
          h('div', { className: 'dtt-prompts' },
            ...draft.prompts.flatMap((prompt, index) => [
              dragFrom !== null && dropIndex === index
                ? h(DropPlaceholder, { key: `drop-${index}` })
                : null,
              h(PromptEditor, {
                key: `${prompt.identifier}-${index}`,
                prompt,
                index,
                dragging: dragFrom === index,
                onPatch: (patch) => patchPrompt(index, patch),
                onPointerDown: (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setDragFrom(index)
                  setDropIndex(index + 1)
                },
                onPointerMove: (event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                  const boundary = insertionBoundary(event)
                  if (boundary !== null) setDropIndex(boundary)
                },
                onPointerUp: (event) => {
                  event.preventDefault()
                  const boundary = insertionBoundary(event) ?? dropIndex ?? index + 1
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                  movePrompt(index, boundary)
                  setDragFrom(null)
                  setDropIndex(null)
                },
                onPointerCancel: () => {
                  setDragFrom(null)
                  setDropIndex(null)
                },
                onDelete: () => deletePrompt(index),
              }),
            ]),
            dragFrom !== null && dropIndex === draft.prompts.length
              ? h(DropPlaceholder, { key: 'drop-end' })
              : null,
          ),
        ),
        h('div', { className: 'dtt-footer' },
          h('button', { className: 'dtt-button dtt-button-primary', type: 'button', disabled: busy, onClick: save }, busy ? uiMessage('common.working') : uiMessage('common.saveChanges')),
          h('button', { className: 'dtt-button dtt-danger', type: 'button', disabled: busy, onClick: remove }, uiMessage('common.delete')),
        ),
      ),
    ),
  )
}

export function installPresetStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = PLUGIN_ID
  style.textContent = css
  document.head.append(style)
}
