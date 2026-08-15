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

function DiagnosticList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return h('details', { className: 'dcc-detail' },
    h('summary', null, uiText`${translateVisibleText(title)} (${items.length})`),
    h('ul', { className: 'dcc-diags' }, ...items.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ''}`)))),
  )
}

export function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog, setCatalog] = useState(null)
  const [detail, setDetail] = useState(null)
  const [selection, setSelection] = useState(null)
  const [binding, setBinding] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ text: '加载中…', error: false })
  const fileRef = useRef(null)
  const refreshGeneration = useRef(0)

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
    run(() => refresh(), '角色库已加载')
    return () => { refreshGeneration.current += 1 }
  }, [refresh, run])

  useEffect(() => {
    const onRefresh = event => {
      if (event.detail?.source === 'character') return
      run(() => refresh(detail?.id), '角色状态已刷新')
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
  }, '角色卡已导入；尚未绑定到会话'), [refresh, run])

  const bind = useCallback(() => run(async () => {
    if (!sessionId) throw new Error('请先创建或打开一个会话再绑定角色')
    if (selection?.characterCardId !== binding?.characterCardId
      && sessionBlank === false
      && !window.confirm(translateVisibleText('当前会话已有历史。更换角色只影响后续请求，不会重写已有消息；继续吗？'))) return
    const data = await api('/character-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...binding }),
    })
    setSelection(data.selection)
    setBinding(data.selection)
    announceTavernRefresh()
  }, '角色选择已保存；实际对话加载由 Tavern loader 统一处理'), [binding, run, selection, sessionBlank, sessionId])

  const unbind = useCallback(() => run(async () => {
    if (!sessionId) throw new Error('当前没有可解绑的会话')
    await api('/character-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, characterCardId: null }),
    })
    setSelection(null)
    if (detail !== null) setBinding(defaultCharacterSelection(detail.id))
    announceTavernRefresh()
  }, '当前会话已解除角色绑定'), [detail, run, sessionId])

  const remove = useCallback(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiText`删除角色卡“${detail.name}”？原始导入文件也会被删除。`))) return
    await api(`/characters/${encodeURIComponent(detail.id)}`, { method: 'DELETE' })
    await refresh(null)
    announceTavernRefresh()
  }, '角色卡已删除，相关会话绑定已清除'), [detail, refresh, run])

  const greetings = characterGreetingOptions(detail)
  const activeName = selection === null
    ? translateVisibleText('未绑定角色')
    : catalog?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId

  return h('div', { className: 'dcc-panel' },
    h('div', { className: 'dcc-header' },
      h('div', { className: 'dcc-title' }, 'Tavern 角色卡'),
      h('button', { className: 'dcc-close', type: 'button', title: '关闭角色卡面板', 'aria-label': '关闭角色卡侧边栏', onClick: close }, '✕'),
    ),
    h('div', { className: 'dcc-body' },
      h('div', { className: 'dcc-toolbar' },
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => fileRef.current?.click() }, '导入 JSON / PNG'),
        h('button', { className: 'dcc-button', type: 'button', disabled: busy, onClick: () => run(() => refresh(detail?.id), '角色库已刷新') }, '刷新'),
        h('input', { ref: fileRef, hidden: true, type: 'file', accept: '.json,.png,application/json,image/png', onChange: (event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) importFile(file)
        } }),
      ),
      h(Field, { label: '浏览角色库' }, h('select', {
        className: 'dcc-select',
        value: detail?.id ?? '',
        disabled: busy || catalog === null || catalog.characters.length === 0,
        onChange: (event) => run(() => loadDetail(event.target.value), '角色详情已加载'),
      },
      ...(catalog?.characters.length ? [] : [h('option', { key: 'empty', value: '' }, '角色库为空')]),
      ...(catalog?.characters ?? []).map((item) => h('option', { key: item.id, value: item.id }, uiText`${item.name} · ${item.sourceFormat}`)))),
      h('p', { className: 'dcc-note' }, uiText`当前会话：${sessionId || translateVisibleText('无')}；绑定：${activeName}`),
      h('div', { className: 'dcc-status', 'data-error': status.error || undefined, role: 'status', 'aria-live': 'polite' }, status.error ? rawText(status.text) : status.text),
      detail === null ? h('p', { className: 'dcc-note' }, catalog === null ? '正在加载角色库…' : '导入一张合成或自有授权的 SillyTavern 角色卡以查看详情。') : h('div', { className: 'dcc-card' },
        h('div', { className: 'dcc-card-head' },
          detail.source.container === 'png' ? h('img', { className: 'dcc-avatar', src: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/artifact`, alt: uiText`${detail.name} 角色卡图片` }) : null,
          h('div', null,
            h('h3', { className: 'dcc-card-title' }, rawText(detail.name)),
            h('p', { className: 'dcc-meta' }, rawText(`${detail.source.format}${detail.source.specVersion ? ` · ${detail.source.specVersion}` : ''} · ${detail.source.container}`)),
            h('p', { className: 'dcc-meta' }, rawText(`${detail.data.creator || translateVisibleText('未知作者')}${detail.data.characterVersion ? ` · ${detail.data.characterVersion}` : ''}`)),
            h('div', { className: 'dcc-tags' }, ...detail.data.tags.map((tag, index) => h('span', { className: 'dcc-tag', key: `${tag}-${index}` }, rawText(tag)))),
          ),
        ),
        h(Field, { label: '开场参考' }, h('select', {
          className: 'dcc-select',
          value: binding?.character?.greetingIndex ?? 0,
          onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, greetingIndex: Number(event.target.value) } })),
        }, ...greetings.map((item) => h('option', { key: item.index, value: item.index }, item.label)))),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterSystemPrompt: event.target.checked } })) }), h('span', null, '允许 loader 优先采用卡内 system_prompt')),
        h('label', { className: 'dcc-check' }, h('input', { type: 'checkbox', checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterPostHistory: event.target.checked } })) }), h('span', null, '允许 loader 采用 post_history_instructions（实际位置由 loader 决定）')),
        h('div', { className: 'dcc-actions' },
          h('button', { className: 'dcc-button dcc-primary', type: 'button', disabled: busy || !sessionId, onClick: bind }, selection?.characterCardId === detail.id ? '更新会话绑定' : '绑定到当前会话'),
          h('button', { className: 'dcc-button', type: 'button', disabled: busy || !sessionId || selection === null, onClick: unbind }, '解除绑定'),
        ),
        h('p', { className: 'dcc-note' }, '角色卡模块负责保存标准化资源和会话选择；实际 system profile 与内嵌世界信息匹配由 Tavern loader 在每次请求时统一处理，不会伪造 assistant 历史。'),
        h(TextDetail, { label: 'Creator notes', value: detail.data.creatorNotes }),
        h(TextDetail, { label: 'Description', value: detail.data.description }),
        h(TextDetail, { label: 'Personality', value: detail.data.personality }),
        h(TextDetail, { label: 'Scenario', value: detail.data.scenario }),
        h(TextDetail, { label: '当前开场参考内容', value: greetings[binding?.character?.greetingIndex ?? 0]?.text }),
        h(TextDetail, { label: 'Message examples', value: detail.data.messageExample }),
        h(TextDetail, { label: 'System prompt（由 loader 按绑定设置处理）', value: detail.data.systemPrompt }),
        h(TextDetail, { label: 'Post-history instructions（由 loader 近似放置）', value: detail.data.postHistoryInstructions }),
        detail.data.characterBook !== null ? h('div', { className: 'dcc-status' }, uiMessage('character.embeddedBook', { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translateVisibleText('未知') })) : null,
        h(DiagnosticList, { title: '兼容警告', items: detail.compatibility.warnings }),
        h(DiagnosticList, { title: '需要 loader/其他模块处理', items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h('div', { className: 'dcc-status' }, uiText`未知宏：${detail.compatibility.unknownMacroNames.join(', ')}`) : null,
        h('div', { className: 'dcc-actions' },
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/artifact`, download: '' }, '导出原件'),
          h('a', { className: 'dcc-button', href: `${API_ROOT}/characters/${encodeURIComponent(detail.id)}/json`, download: '' }, '导出 JSON'),
        ),
        h('div', { className: 'dcc-footer' }, h('button', { className: 'dcc-button dcc-danger', type: 'button', disabled: busy, onClick: remove }, '删除角色卡')),
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
