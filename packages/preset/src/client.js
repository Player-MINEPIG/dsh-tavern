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
  translateVisibleText,
  uiMessage,
  uiText,
  unwrapText,
} from '../../client/src/i18n.js'
import { reorderAtBoundary } from './client-state.js'

const h = createLocalizedElement(createElement)

const API_ROOT = '/dsh-tavern/api'

function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent('dsh-tavern:refresh', { detail: { source: 'preset' } }))
}

const ST_NUMBER_FIELDS = [
  ['top_p', 'Top P'],
  ['top_k', 'Top K'],
  ['top_a', 'Top A'],
  ['min_p', 'Min P'],
  ['frequency_penalty', 'Frequency penalty'],
  ['presence_penalty', 'Presence penalty'],
  ['repetition_penalty', 'Repetition penalty'],
  ['seed', 'Seed'],
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
        title: '拖拽排列顺序',
        'aria-label': uiText`拖拽“${prompt.name || prompt.identifier}”排列顺序`,
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
        title: prompt.marker === true ? 'ST marker 不会作为独立提示词注入' : '启用提示词',
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked }),
      }),
      h('span', { className: 'dtt-prompt-name' }, rawText(prompt.name || prompt.identifier)),
      h('span', { className: 'dtt-role' }, rawText(prompt.marker ? 'marker' : prompt.role)),
    ),
    h('div', { className: 'dtt-prompt-body' },
      h(Field, { label: '名称' }, h('input', {
        className: 'dtt-input',
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value }),
      })),
      h(Field, { label: '角色' }, h('select', {
        className: 'dtt-select',
        value: prompt.role,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ role: event.target.value }),
      },
      h('option', { value: 'system' }, 'System'),
      h('option', { value: 'user' }, 'User'),
      h('option', { value: 'assistant' }, 'Assistant'))),
      h(Field, { label: '内容' }, h('textarea', {
        className: 'dtt-textarea',
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value }),
      })),
      h('div', { className: 'dtt-row-actions' },
        h('button', { className: 'dtt-button dtt-danger', type: 'button', onClick: onDelete }, '删除'),
      ),
    ),
  )
}

function DropPlaceholder() {
  return h('div', {
    className: 'dtt-drop-placeholder',
    'aria-hidden': true,
  }, '松开后放置于此')
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
  const [status, setStatus] = useState({ text: '加载中…', error: false })
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

  const run = useCallback(async (operation, successText) => {
    setBusy(true)
    try {
      const result = await operation()
      setStatus({ text: successText, error: false })
      return result
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true })
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
    setStatus({ text: '正在同步当前会话的预设状态…', error: false })
    run(() => refresh(), '预设已加载')
    return () => { refreshGeneration.current += 1 }
  }, [refresh, run, sessionId])

  useEffect(() => {
    const onRefresh = event => {
      if (event.detail?.source === 'preset') return
      run(() => refresh(), '预设状态已刷新')
    }
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => window.removeEventListener('dsh-tavern:refresh', onRefresh)
  }, [refresh, run])

  const browse = useCallback((id) => run(async () => {
    const detail = await api(`/presets/${encodeURIComponent(id)}`)
    setDraft(detail.preset)
  }, '预设详情已加载；会话绑定尚未改变'), [run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId) throw new Error('请先创建或打开一个会话再绑定预设')
    if (draft === null) throw new Error('请先选择一个预设')
    if (catalog?.selectedId !== draft.id
      && catalog?.selectedId !== null
      && sessionBlank === false
      && !window.confirm(unwrapText(uiMessage('preset.confirmHistoricalSwitch')))) return
    await api('/select', { method: 'POST', body: body({ id: draft.id, sessionId }) })
    await refresh(draft.id)
    announceTavernRefresh()
  }, '预设已绑定；当前会话的下一次请求将使用它'), [catalog?.selectedId, draft, refresh, run, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw new Error('当前没有可解除绑定的会话')
    await api('/select', { method: 'POST', body: body({ id: null, sessionId }) })
    await refresh(draft?.id)
    announceTavernRefresh()
  }, '当前会话已解除预设绑定'), [draft?.id, refresh, run, sessionId])

  const createPreset = useCallback(() => run(async () => {
    const created = await api('/presets', { method: 'POST', body: body({ name: translateVisibleText('新预设') }) })
    await refresh(created.preset.id)
    announceTavernRefresh()
  }, '预设已创建；尚未绑定当前会话'), [refresh, run])

  const importFile = useCallback((file) => run(async () => {
    const content = await file.text()
    const imported = await api('/import', {
      method: 'POST',
      body: body({ name: file.name.replace(/\.json$/i, ''), content }),
    })
    await refresh(imported.preset.id)
    announceTavernRefresh()
    if (fileRef.current !== null) fileRef.current.value = ''
  }, 'ST 预设已导入；尚未绑定当前会话'), [refresh, run])

  const save = useCallback(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: 'PUT',
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts }),
    })
    setDraft(result.preset)
    await refresh(result.preset.id)
    announceTavernRefresh()
  }, '预设配置已保存；已绑定它的会话将在后续请求使用新内容'), [draft, refresh, run])

  const remove = useCallback(() => run(async () => {
    if (!window.confirm(unwrapText(uiMessage('preset.confirmDelete', { name: draft.name })))) return
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
    await refresh()
    announceTavernRefresh()
  }, '预设已删除'), [draft, refresh, run])

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
      name: translateVisibleText('新提示词'),
      role: 'system',
      content: '',
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {},
    }],
  }))

  return h('div', { className: 'dtt-root' },
    h('div', { className: 'dtt-header' },
      h('div', { className: 'dtt-title' }, 'Tavern 预设', catalog?.selectedId ? h('span', { className: 'dtt-active' }, '● 已启用') : null),
      h('button', { className: 'dtt-icon', type: 'button', title: '关闭右侧栏', 'aria-label': '关闭预设侧边栏', onClick: closePanel }, '✕'),
    ),
    h('div', { className: 'dtt-body' },
      h('div', { className: 'dtt-toolbar' },
        h('button', { className: 'dtt-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, '导入 ST JSON'),
        h('button', { className: 'dtt-button', type: 'button', disabled: busy, onClick: createPreset }, '创建预设'),
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
      h(Field, { label: '浏览预设' }, h('select', {
        className: 'dtt-select',
        value: draft?.id ?? '',
        disabled: busy || catalog === null || catalog.presets.length === 0,
        onChange: (event) => browse(event.target.value),
      },
      ...(catalog?.presets.length ? [] : [h('option', { key: 'empty', value: '' }, '预设库为空')]),
      ...(catalog?.presets ?? []).map((preset) => h('option', { key: preset.id, value: preset.id }, uiText`${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`)))),
      catalog === null
        ? null
        : catalog.selectedId === null
          ? h('p', { className: 'dtt-note' }, '当前会话未绑定预设。')
          : h('p', { className: 'dtt-note' }, uiMessage('preset.currentSessionBound', { name: catalog.presets.find(item => item.id === catalog.selectedId)?.name ?? catalog.selectedId })),
      draft !== null && draft.id !== catalog?.selectedId
        ? h('div', { className: 'dtt-status', 'data-warning': true }, uiMessage('preset.browsingUnbound', { name: draft.name }))
        : null,
      h('div', { className: 'dtt-actions' },
        h('button', { className: 'dtt-button dtt-button-primary', type: 'button', disabled: busy || !sessionId || draft === null, onClick: bind }, catalog?.selectedId === draft?.id ? '更新会话绑定' : '绑定到当前会话'),
        h('button', { className: 'dtt-button', type: 'button', disabled: busy || !sessionId || catalog?.selectedId == null, onClick: unbind }, '解除当前会话绑定'),
      ),
      h('div', { className: 'dtt-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, status.error ? rawText(status.text) : status.text),
      draft === null ? h('p', { className: 'dtt-note' }, catalog === null ? '正在加载预设…' : '请选择或创建预设以开始配置。') : h('div', { className: 'dtt-section' },
        h('div', { className: 'dtt-section-title' }, '基本设置'),
        h(Field, { label: '预设名称' }, h('input', {
          className: 'dtt-input',
          value: draft.name,
          onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })),
        })),
        h('div', { className: 'dtt-grid' },
          h(NumberField, { label: 'Temperature', value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          h(NumberField, { label: 'Max tokens', value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 }),
        ),
        h(Field, { label: 'Reasoning effort' }, h('select', {
          className: 'dtt-select',
          value: draft.sampling.reasoningEffort ?? '',
          onChange: (event) => patchSampling({ reasoningEffort: event.target.value || undefined }),
        },
        h('option', { value: '' }, '跟随模型默认'),
        h('option', { value: 'low' }, 'Low'),
        h('option', { value: 'medium' }, 'Medium'),
        h('option', { value: 'high' }, 'High'),
        h('option', { value: 'xhigh' }, 'Extra high'))),
        h('button', { className: 'dtt-button', type: 'button', onClick: () => setAdvanced((value) => !value) }, advanced ? '收起高级设置' : '展开高级设置'),
        advanced ? h('div', { className: 'dtt-grid' }, ...ST_NUMBER_FIELDS.map(([key, label]) => h(NumberField, {
          key,
          label,
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value),
        }))) : null,
        advanced ? h('p', { className: 'dtt-note' }, '这些字段会被完整保存；dsh 0.1.0 当前请求协议未暴露的参数不会强行下发给适配器。') : null,
        advanced ? h(Field, { label: 'DSH 系统提示词' }, h('select', {
          className: 'dtt-select',
          value: draft.systemPromptMode === 'replace' ? 'replace' : 'append',
          onChange: (event) => setDraft((current) => ({ ...current, systemPromptMode: event.target.value })),
        },
        h('option', { value: 'append' }, '保留 DSH 系统提示词，并追加预设（推荐）'),
        h('option', { value: 'replace' }, '仅使用预设，移除 DSH 系统段（高级）'))) : null,
        advanced && draft.systemPromptMode === 'replace' ? h('p', { className: 'dtt-status', 'data-error': true }, '警告：这会移除模型可见的 Harness 身份、Agent persona 和工具说明，可能破坏工具调用或结构化输出；沙箱与审批等执行层安全仍然有效。') : null,
        h('div', { className: 'dtt-section' },
          h('div', { className: 'dtt-section-title' },
            h('span', null, `提示词 (${draft.prompts.length})`),
            h('button', { className: 'dtt-button', type: 'button', onClick: addPrompt }, '＋ 添加'),
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
          h('button', { className: 'dtt-button dtt-button-primary', type: 'button', disabled: busy, onClick: save }, busy ? '处理中…' : '保存修改'),
          h('button', { className: 'dtt-button dtt-danger', type: 'button', disabled: busy, onClick: remove }, '删除'),
        ),
      ),
    ),
  )
}

export function installPresetStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern'
  style.textContent = css
  document.head.append(style)
}
