import {
  createElement as h,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const API_ROOT = '/dsh-tavern/api'

const css = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:16px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 9px}.dtu-input,.dtu-select{height:36px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
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
  window.dispatchEvent(new Event('dsh-tavern:refresh'))
}

export function UserPanel({ sessionId, sessionBlank, close }) {
  const [users, setUsers] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: '加载中…', error: false })
  const generation = useRef(0)
  const draftId = useRef(null)
  draftId.current = draft?.id ?? null

  const run = useCallback(async (operation, success) => {
    setBusy(true)
    try {
      const result = await operation()
      setStatus({ text: success, error: false })
      return result
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true })
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const refresh = useCallback(async preferredId => {
    const current = ++generation.current
    const catalog = await api('/users')
    const binding = sessionId
      ? await api(`/user-selection?sessionId=${encodeURIComponent(sessionId)}`)
      : { selection: null }
    if (current !== generation.current) return
    setUsers(catalog.users)
    setSelectedUserId(binding.selection?.userId ?? null)
    const id = preferredId ?? binding.selection?.userId ?? catalog.users[0]?.id ?? null
    setDraft(id === null ? null : structuredClone(catalog.users.find(user => user.id === id) ?? null))
  }, [sessionId])

  useEffect(() => {
    run(() => refresh(), '用户资源已加载')
    const onRefresh = () => run(() => refresh(draftId.current), '用户资源已刷新')
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => {
      generation.current += 1
      window.removeEventListener('dsh-tavern:refresh', onRefresh)
    }
  }, [refresh, run])

  const create = useCallback(() => run(async () => {
    const data = await api('/users', { method: 'POST', body: JSON.stringify({ name: '新用户', description: '' }) })
    draftId.current = data.user.id
    await refresh(data.user.id)
    notifyRefresh()
  }, '用户资源已创建；保存名字和描述后再绑定'), [refresh, run])

  const save = useCallback(() => run(async () => {
    if (draft === null) return
    const data = await api(`/users/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: draft.name, description: draft.description }),
    })
    draftId.current = data.user.id
    setDraft(data.user)
    setUsers(current => current?.map(user => user.id === data.user.id ? data.user : user) ?? current)
    notifyRefresh()
  }, '名字和描述已保存；已绑定会话的下一次请求会立即使用新内容'), [draft, run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId || draft === null) throw new Error('请先创建或打开一个会话并选择用户资源')
    if (selectedUserId !== draft.id && sessionBlank === false
      && !window.confirm('当前会话已有历史。切换用户只影响后续请求，不会重写已有消息；继续吗？')) return
    const data = await api('/user-selection', {
      method: 'POST',
      body: JSON.stringify({ sessionId, userId: draft.id }),
    })
    setSelectedUserId(data.selection.userId)
    notifyRefresh()
  }, '用户已绑定；当前会话的下一次请求会使用该名字和描述'), [draft, run, selectedUserId, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw new Error('当前没有可解绑的会话')
    await api('/user-selection', { method: 'POST', body: JSON.stringify({ sessionId, userId: null }) })
    setSelectedUserId(null)
    notifyRefresh()
  }, '当前会话已解除用户绑定'), [run, sessionId])

  const remove = useCallback(() => run(async () => {
    if (draft === null || !window.confirm(`删除用户“${draft.name}”？所有会话中的对应绑定都会清除。`)) return
    await api(`/users/${encodeURIComponent(draft.id)}`, { method: 'DELETE', body: '{}' })
    draftId.current = null
    await refresh(null)
    notifyRefresh()
  }, '用户已删除，相关会话绑定已清除'), [draft, refresh, run])

  const activeName = selectedUserId === null
    ? '未绑定用户'
    : users?.find(user => user.id === selectedUserId)?.name ?? selectedUserId

  return h('div', { className: 'dtu-panel' },
    h('div', { className: 'dtu-header' },
      h('div', { className: 'dtu-title' }, 'Tavern 用户'),
      h('button', { className: 'dtu-close', type: 'button', title: '关闭用户面板', 'aria-label': '关闭用户侧边栏', onClick: close }, '✕'),
    ),
    h('div', { className: 'dtu-body' },
      h('div', { className: 'dtu-toolbar' },
        h('button', { className: 'dtu-button', type: 'button', disabled: busy, onClick: create }, '新建用户'),
        h('button', { className: 'dtu-button', type: 'button', disabled: busy, onClick: () => run(() => refresh(draft?.id), '用户资源已刷新') }, '刷新'),
      ),
      h(Field, { label: '浏览用户资源' }, h('select', {
        className: 'dtu-select',
        value: draft?.id ?? '',
        disabled: busy || users === null || users.length === 0,
        onChange: event => setDraft(structuredClone(users.find(user => user.id === event.target.value) ?? null)),
      },
      ...(users?.length ? [] : [h('option', { key: 'empty', value: '' }, '用户资源库为空')]),
      ...(users ?? []).map(user => h('option', { key: user.id, value: user.id }, user.name)))),
      h('p', { className: 'dtu-note' }, `当前会话：${sessionId || '无'}；绑定：${activeName}`),
      h('div', { className: 'dtu-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, status.text),
      draft === null
        ? h('p', { className: 'dtu-note' }, users === null ? '正在加载用户资源…' : '创建一个只含名字和描述的用户资源。')
        : h('div', { className: 'dtu-editor' },
          h(Field, { label: '名字（用于 {{user}} 宏）' }, h('input', { className: 'dtu-input', value: draft.name, maxLength: 200, onChange: event => setDraft(current => ({ ...current, name: event.target.value })) })),
          h(Field, { label: '描述（进入 personaDescription marker；缺 marker 时由 loader 稳定降级）' }, h('textarea', { className: 'dtu-textarea', value: draft.description, maxLength: 100000, onChange: event => setDraft(current => ({ ...current, description: event.target.value })) })),
          h('div', { className: 'dtu-actions' },
            h('button', { className: 'dtu-button dtu-primary', type: 'button', disabled: busy, onClick: save }, '保存资源'),
            h('button', { className: 'dtu-button', type: 'button', disabled: busy || !sessionId, onClick: bind }, selectedUserId === draft.id ? '刷新会话绑定' : '绑定到当前会话'),
          ),
          h('button', { className: 'dtu-button', type: 'button', disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, '解除当前会话绑定'),
          h('p', { className: 'dtu-note' }, '用户资源不包含头像，也不会覆盖 DSH Agent 身份。loader 只在统一 Tavern profile 中解析名字宏并放置一次描述。'),
          h('div', { className: 'dtu-footer' }, h('button', { className: 'dtu-button dtu-danger', type: 'button', disabled: busy, onClick: remove }, '删除用户')),
        ),
    ),
  )
}

export function installUserStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-user"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern-user'
  style.textContent = css
  document.head.append(style)
}
