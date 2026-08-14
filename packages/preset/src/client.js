import {
  createElement as h,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const API_ROOT = '/dsh-tavern/api'

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
.dtt-title{font-size:14px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:11px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:12px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}.dtt-input,.dtt-select{height:34px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.45}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:12px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:11px;line-height:1.4;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:12px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:10px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:28px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
.dtt-open-button{height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font-size:11px;cursor:pointer;padding:0 9px}.dtt-open-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
`

async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
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

function PromptEditor({ prompt, index, total, onPatch, onMove, onDelete }) {
  return h('details', { className: 'dtt-prompt' },
    h('summary', { className: 'dtt-prompt-summary' },
      h('input', {
        type: 'checkbox',
        checked: prompt.enabled === true,
        disabled: prompt.marker === true,
        title: prompt.marker === true ? 'ST marker 不会作为独立提示词注入' : '启用提示词',
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked }),
      }),
      h('span', { className: 'dtt-prompt-name' }, prompt.name || prompt.identifier),
      h('span', { className: 'dtt-role' }, prompt.marker ? 'marker' : prompt.role),
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
        h('button', { className: 'dtt-button', type: 'button', disabled: index === 0, onClick: () => onMove(-1) }, '上移'),
        h('button', { className: 'dtt-button', type: 'button', disabled: index === total - 1, onClick: () => onMove(1) }, '下移'),
        h('button', { className: 'dtt-button dtt-danger', type: 'button', onClick: onDelete }, '删除'),
      ),
    ),
  )
}

function PresetSidebar({ closePanel }) {
  const [catalog, setCatalog] = useState({ presets: [], selectedId: null, storageDir: '' })
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: '加载中…', error: false })
  const [advanced, setAdvanced] = useState(false)
  const fileRef = useRef(null)

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

  const loadPreset = useCallback(async (id) => {
    if (id === null) {
      setDraft(null)
      return
    }
    const data = await api(`/presets/${encodeURIComponent(id)}`)
    setDraft(data.preset)
  }, [])

  const refresh = useCallback(async (preferredId) => {
    const data = await api('/presets')
    setCatalog(data)
    const id = preferredId ?? data.selectedId
    await loadPreset(id ?? null)
  }, [loadPreset])

  useEffect(() => {
    run(() => refresh(), '预设已加载')
  }, [refresh, run])

  const choose = useCallback((id) => run(async () => {
    await api('/select', { method: 'POST', body: body({ id: id || null }) })
    await refresh(id || null)
  }, id ? '预设已选择；下一条消息将携带此 preset' : '已停用 preset'), [refresh, run])

  const createPreset = useCallback(() => run(async () => {
    const created = await api('/presets', { method: 'POST', body: body({ name: '新预设' }) })
    await api('/select', { method: 'POST', body: body({ id: created.preset.id }) })
    await refresh(created.preset.id)
  }, '已创建并选择新预设'), [refresh, run])

  const importFile = useCallback((file) => run(async () => {
    const content = await file.text()
    const imported = await api('/import', {
      method: 'POST',
      body: body({ name: file.name.replace(/\.json$/i, ''), content }),
    })
    await api('/select', { method: 'POST', body: body({ id: imported.preset.id }) })
    await refresh(imported.preset.id)
    if (fileRef.current !== null) fileRef.current.value = ''
  }, 'ST 预设已导入并选择'), [refresh, run])

  const save = useCallback(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: 'PUT',
      body: body({ name: draft.name, sampling: draft.sampling, prompts: draft.prompts }),
    })
    setDraft(result.preset)
    await refresh(result.preset.id)
  }, '预设配置已保存'), [draft, refresh, run])

  const remove = useCallback(() => run(async () => {
    if (!window.confirm(`删除预设“${draft.name}”？`)) return
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
    await refresh(null)
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
  const movePrompt = (index, delta) => setDraft((current) => {
    const prompts = [...current.prompts]
    const target = index + delta
    if (target < 0 || target >= prompts.length) return current
    ;[prompts[index], prompts[target]] = [prompts[target], prompts[index]]
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
      name: '新提示词',
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
      h('div', { className: 'dtt-title' }, 'Tavern 预设', catalog.selectedId ? h('span', { className: 'dtt-active' }, '● 已启用') : null),
      h('button', { className: 'dtt-icon', type: 'button', title: '关闭右侧栏', onClick: closePanel }, '✕'),
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
      h(Field, { label: '当前选择' }, h('select', {
        className: 'dtt-select',
        value: catalog.selectedId ?? '',
        disabled: busy,
        onChange: (event) => choose(event.target.value),
      },
      h('option', { value: '' }, '不使用预设'),
      ...catalog.presets.map((preset) => h('option', { key: preset.id, value: preset.id }, `${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`)))),
      h('p', { className: 'dtt-note' }, `存储目录：${catalog.storageDir || '加载中…'}`),
      h('div', { className: 'dtt-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, status.text),
      draft === null ? h('p', { className: 'dtt-note' }, '请选择或创建预设以开始配置。') : h('div', { className: 'dtt-section' },
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
        h('button', { className: 'dtt-button', type: 'button', onClick: () => setAdvanced((value) => !value) }, advanced ? '收起 ST 兼容参数' : '展开 ST 兼容参数'),
        advanced ? h('div', { className: 'dtt-grid' }, ...ST_NUMBER_FIELDS.map(([key, label]) => h(NumberField, {
          key,
          label,
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value),
        }))) : null,
        advanced ? h('p', { className: 'dtt-note' }, '这些字段会被完整保存；dsh 0.1.0 当前请求协议未暴露的参数不会强行下发给适配器。') : null,
        h('div', { className: 'dtt-section' },
          h('div', { className: 'dtt-section-title' },
            h('span', null, `提示词 (${draft.prompts.length})`),
            h('button', { className: 'dtt-button', type: 'button', onClick: addPrompt }, '＋ 添加'),
          ),
          h('div', { className: 'dtt-prompts' }, ...draft.prompts.map((prompt, index) => h(PromptEditor, {
            key: `${prompt.identifier}-${index}`,
            prompt,
            index,
            total: draft.prompts.length,
            onPatch: (patch) => patchPrompt(index, patch),
            onMove: (delta) => movePrompt(index, delta),
            onDelete: () => deletePrompt(index),
          }))),
        ),
        h('div', { className: 'dtt-footer' },
          h('button', { className: 'dtt-button dtt-button-primary', type: 'button', disabled: busy, onClick: save }, busy ? '处理中…' : '保存并应用'),
          h('button', { className: 'dtt-button dtt-danger', type: 'button', disabled: busy, onClick: remove }, '删除'),
        ),
      ),
    ),
  )
}

function PresetHeaderButton({ openPanel }) {
  return h('button', { className: 'dtt-open-button', type: 'button', onClick: openPanel, title: '打开 Tavern 预设侧边栏' }, '预设')
}

function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern'
  style.textContent = css
  document.head.append(style)
}

export const name = 'dsh-tavern'
export const inject = ['slots', 'layout']

export function apply(ctx) {
  installStyles()
  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    priority: -10,
    inject: () => ({ closePanel: () => ctx.layout.closeDetails() }),
  }, PresetSidebar))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'dsh-tavern-preset',
    order: 80,
    inject: () => ({ openPanel: () => ctx.layout.openDetails() }),
  }, PresetHeaderButton))

  let attempts = 0
  const openDefault = () => {
    attempts += 1
    try {
      ctx.layout.openDetails()
    } catch {
      if (attempts < 20) window.setTimeout(openDefault, 100)
    }
  }
  const timer = window.setTimeout(openDefault, 0)
  ctx.effect(() => () => window.clearTimeout(timer), 'dsh-tavern: default right panel')
}

