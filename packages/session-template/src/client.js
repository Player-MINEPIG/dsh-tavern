import {
  createElement as h,
  useCallback,
  useEffect,
  useState,
} from 'react'

const API_ROOT = '/dsh-tavern/api'

async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: options.body === undefined
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`)
    error.diagnostics = data?.error?.diagnostics ?? []
    throw error
  }
  return data
}

function sourceLabel(template) {
  const selection = template?.selection ?? {}
  const labels = []
  if (selection.presetId) labels.push('预设')
  if (selection.characterCardId) labels.push('角色卡')
  if (selection.userId) labels.push('用户')
  if (Array.isArray(selection.worldBookIds) && selection.worldBookIds.length > 0) labels.push(`${selection.worldBookIds.length} 本世界书`)
  return labels.length === 0 ? '空 Tavern 配置' : labels.join('、')
}

export function SessionTemplatePanel({ sessionId, workspaceId, createCleanSession, close }) {
  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('新配置模板')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const selected = templates.find(item => item.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    const data = await api('/session-templates')
    setTemplates(data.templates)
    setSelectedId(data.selectedId)
    const active = data.templates.find(item => item.id === data.selectedId)
    if (active !== undefined) setName(active.name)
  }, [])

  useEffect(() => {
    refresh().catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
    const onRefresh = () => refresh().catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => window.removeEventListener('dsh-tavern:refresh', onRefresh)
  }, [refresh])

  const run = useCallback(async (operation, success) => {
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      setStatus(typeof success === 'function' ? success(result) : success)
      await refresh()
      window.dispatchEvent(new Event('dsh-tavern:refresh'))
      return result
    } catch (reason) {
      const diagnostics = Array.isArray(reason?.diagnostics) ? reason.diagnostics : []
      setError(diagnostics[0]?.message ?? (reason instanceof Error ? reason.message : String(reason)))
      return null
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const select = event => run(async () => {
    const id = event.target.value || null
    const data = await api('/session-templates/select', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
    setSelectedId(data.selectedId)
    if (data.template !== null) setName(data.template.name)
  }, '模板选择已更新')

  const create = () => run(async () => {
    if (!sessionId) throw new Error('请先打开一个会话，再保存当前 Tavern 设置')
    return api('/session-templates', {
      method: 'POST',
      body: JSON.stringify({ name, sourceSessionId: sessionId }),
    })
  }, result => `已创建模板：${result.template.name}`)

  const rename = () => run(async () => {
    if (selectedId === null) throw new Error('请先选择一个模板')
    return api(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }, result => `已重命名模板：${result.template.name}`)

  const update = () => run(async () => {
    if (!sessionId || selectedId === null) throw new Error('请先打开会话并选择模板')
    return api(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, sourceSessionId: sessionId }),
    })
  }, result => `已用当前设置更新模板：${result.template.name}`)

  const remove = () => {
    if (selectedId === null || !window.confirm(`删除配置模板“${selected?.name ?? selectedId}”？这不会删除任何 DSH 会话。`)) return
    run(() => api(`/session-templates/${encodeURIComponent(selectedId)}`, { method: 'DELETE', body: JSON.stringify({}) }), '模板已删除')
  }

  const start = mode => run(async () => {
    if (mode === 'current' && !sessionId) throw new Error('请先打开一个来源会话')
    if (workspaceId === null) throw new Error('当前会话不属于 DSH 工作区；请先把会话加入工作区')
    const source = mode === 'current'
      ? { mode: 'current', sessionId }
      : { mode: 'template', templateId: selectedId }
    if (mode === 'template' && selectedId === null) throw new Error('请先选择一个模板')
    return createCleanSession({ workspaceId, source })
  }, id => `已切换到干净会话：${id}`)

  const diagnostics = Array.isArray(selected?.diagnostics) ? selected.diagnostics : []

  return h('div', { className: 'dtv-panel' },
    h('div', { className: 'dtv-header' },
      h('div', { className: 'dtv-title' }, '新会话与配置模板'),
      h('button', { className: 'dtv-close', type: 'button', title: '关闭新会话侧边栏', 'aria-label': '关闭新会话侧边栏', onClick: close }, '✕'),
    ),
    h('div', { className: 'dtv-body' },
      h('button', {
        className: 'dtv-button dtv-primary',
        type: 'button',
        disabled: busy || !sessionId || workspaceId === null,
        onClick: () => start('current'),
      }, '维持当前 Tavern 设置新开对话'),
      h('p', { className: 'dtv-note' }, '只继承 preset、角色卡与 greeting/开关、用户和独立世界书选择。DSH 历史、Tavern Trace、Inbox、运行中 turn/step 和其他运行态不会复制。'),
      workspaceId === null
        ? h('div', { className: 'dtv-status', 'data-error': true }, '没有可用的 DSH 目标工作区。请先在 DSH 侧栏中加入或打开工作区。')
        : null,
      h('div', { className: 'dtv-resource' },
        h('div', { className: 'dtv-resource-title' }, `配置模板（${templates.length}）`),
        h('label', { className: 'dtv-field' },
          h('span', { className: 'dtv-label' }, '已选择模板'),
          h('select', { className: 'dtv-select', value: selectedId ?? '', disabled: busy, onChange: select },
            h('option', { value: '' }, '未选择模板'),
            ...templates.map(template => h('option', { key: template.id, value: template.id }, template.name)),
          ),
        ),
        h('label', { className: 'dtv-field' },
          h('span', { className: 'dtv-label' }, '模板名称'),
          h('input', { className: 'dtv-input', value: name, maxLength: 120, disabled: busy, onChange: event => setName(event.target.value) }),
        ),
        h('div', { className: 'dtv-template-actions' },
          h('button', { className: 'dtv-button', type: 'button', disabled: busy || !sessionId, onClick: create }, '由当前设置创建'),
          h('button', { className: 'dtv-button', type: 'button', disabled: busy || selectedId === null, onClick: rename }, '仅保存名称'),
          h('button', { className: 'dtv-button', type: 'button', disabled: busy || !sessionId || selectedId === null, onClick: update }, '用当前设置更新'),
          h('button', { className: 'dtv-button dtv-danger', type: 'button', disabled: busy || selectedId === null, onClick: remove }, '删除模板'),
        ),
        selected === null ? null : h('div', { className: 'dtv-resource-meta' }, `保存内容：${sourceLabel(selected)}`),
        diagnostics.length === 0 ? null : h('div', { className: 'dtv-status', 'data-error': true },
          h('div', null, '该模板暂不可用于创建：'),
          h('ul', { className: 'dtv-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, item.message))),
        ),
        h('button', {
          className: 'dtv-button dtv-primary',
          type: 'button',
          disabled: busy || selectedId === null || diagnostics.length > 0 || workspaceId === null,
          onClick: () => start('template'),
        }, '根据所选模板新开干净对话'),
      ),
      h('div', { className: 'dtv-status', 'data-error': error !== '' || undefined, role: 'status' }, error || status || '模板与新会话操作已就绪。'),
      h('p', { className: 'dtv-note' }, 'DSH 可能复用同工作区中已有的真实 blank session；这是其公开 New Session 语义。插件会在导航前原子替换该 blank session 的 Tavern 选择。'),
    ),
  )
}
