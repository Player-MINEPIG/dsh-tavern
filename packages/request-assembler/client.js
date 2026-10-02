import { createElement as h, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tavernFetch } from '../client/src/api-fetch.js'
import { getClientUiSettings } from '../client/src/i18n.js'
import { API_V1, API_V3, CLIENT_REFRESH_EVENT } from '../identity.js'
import { BUILTINS } from './model.js'
import { reorderAtBoundary } from '../preset/src/client-state.js'

const labels = {
  'harness:identity': ['DSH 身份指令', 'DSH identity'], 'deployment:persona-prefix': ['部署前置指令', 'Deployment prefix'], 'deployment:persona-suffix': ['部署后置指令', 'Deployment suffix'], 'rp:policy': ['Tavern 角色扮演规则', 'Tavern roleplay policy'],
  main: ['主提示词', 'Main prompt'], jailbreak: ['后置指令', 'Post-history instructions'], charDescription: ['角色描述', 'Character description'], charPersonality: ['角色性格', 'Character personality'], dialogueExamples: ['对话示例', 'Dialogue examples'], personaDescription: ['用户设定', 'User persona'],
  retry: ['重试', 'Retry'], cancel: ['取消', 'Cancel'], confirm: ['确认', 'Confirm'],
  disable: ['关闭策略，使用 DSH 默认', 'Disable; use DSH default'],
  phiHelp: ['角色卡的「后置指令」和预设的「Post-History Instructions / jailbreak」在各自编辑器中修改。下面可追加此策略专用的 PHI。', 'Edit character post-history instructions or preset Post-History Instructions / jailbreak in their editors. Add strategy-specific PHI below.'],
  'additional-phi': ['策略追加的后置指令', 'Additional strategy instructions'],
  description: ['角色描述', 'Character description'], personality: ['角色性格', 'Character personality'], scenario: ['场景', 'Scenario'], examples: ['对话示例', 'Dialogue examples'], system: ['系统指令', 'System instructions'], user: ['用户', 'User'], assistant: ['助手', 'Assistant'], tool: ['工具结果', 'Tool result'], greeting: ['开场白参考', 'Greeting reference'], depth_prompt: ['角色深度提示', 'Character depth prompt'],
  defaultHint: ['默认：ST 兼容。内置策略不能改名或删除；修改规则后保存为副本。', 'Default: ST compatible. Built-ins cannot be renamed or deleted; save rule changes as a copy.'],
  dropHere: ['松开以移动：', 'Drop to move: '],

  actual: ['查看最近实际请求', 'View latest actual request'], noActual: ['暂无新版装配请求记录', 'No request assembly record yet'], actualNotice: ['以下是轨迹保存的实际请求，修改当前预设不会改变它。', 'This is the recorded request. Editing the preset does not change it.'],
  addSource: ['添加来自于', 'Add custom content from'], chooseSource: ['选择来源…', 'Choose source…'], customSuffix: ['的自定义内容', ''], sourceHelp: ['可在这里填写自定义文本和宏。自动读取 MVU、记忆等动态数据的来源，需要相应插件通过来源 API 注册；选择来源不会改变其所属插件。', 'Write custom text and macros here. Sources that retrieve MVU or memory data must be registered by their plugin through the source API; selection does not change source ownership.'], missingSource: ['来源插件未安装或未注册；本次请求跳过此模块。', 'Source unavailable; this module is omitted from the request.'], title: ['提示词装配策略', 'Prompt assembly strategy'], intro: ['安排内容如何进入每次模型请求。预览当前资产、宏引用和实际顺序。', 'Arrange each model request. Preview assets, macro references and message order.'],
  import: ['导入', 'Import'], export: ['导出', 'Export'], create: ['创建', 'Create'], copy: ['另存为', 'Save as'], save: ['保存规则', 'Save rules'], remove: ['删除', 'Delete'], select: ['选择装配策略', 'Assembly strategy'], name: ['名称', 'Name'], apply: ['应用到当前会话', 'Apply to this session'], applied: ['当前应用', 'Applied'], legacy: ['DSH 默认策略', 'DSH default strategy'], reset: ['应用默认装配策略', 'Apply default strategy'], preview: ['根据当前配置预览', 'Preview current configuration'], rules: ['通用规则', 'Rules'], expanded: ['展开预览', 'Expanded preview'], add: ['添加', 'Add'], source: ['来源', 'Source'], stability: ['稳定性', 'Stability'], lifetime: ['保留方式', 'Retention'], request: ['每次重新装配', 'Rebuild each request'], snapshot: ['累积快照供后续请求使用', 'Retain snapshots for later requests'], retained: ['已保存的快照', 'Saved snapshot'], nativeRetention: ['由 DSH 保存与提供', 'Saved and supplied by DSH'], native: ['原生历史', 'Native history'], preserve: ['保留原始角色', 'Preserve original role'], depth: ['历史深度（留空使用列表位置）', 'History depth (blank uses list position)'], asset: ['资产修改时变化', 'Changes with asset'], conversation: ['随对话变化', 'Changes with conversation'], evaluation: ['每次求值可能变化', 'May change on evaluation'], assembly: ['由官方装配决定', 'Determined by core assembly'], saved: ['已保存；应用后影响后续请求', 'Saved; apply to affect future requests'], appliedStatus: ['已应用到当前会话', 'Applied to this session'], unavailable: ['宿主尚未支持请求装配协议。可以编辑和预览；应用前需安装核心扩展。', 'Editing and preview are available. Applying requires the request assembly core extension.'], previewScope: ['预览使用当前资产与可读取历史，不含待发送输入；随机宏使用固定样例。实际请求以轨迹中的冻结结果为准。', 'Preview uses current assets and available history, without pending input. Random macros use a fixed sample. Recorded requests contain the frozen result.'], noSession: ['请先打开会话', 'Open a session first'], loading: ['加载中…', 'Loading…'], close: ['关闭', 'Close'], up: ['上移', 'Move up'], down: ['下移', 'Move down'], text: ['内容', 'Content'], role: ['消息角色', 'Message role'], placement: ['放置策略', 'Placement'], st: ['遵循预设插槽与深度', 'Preset slots and depth'], stHelp: ['预设插槽（ST marker）是预设列表中的独立条目，例如角色描述、世界书、聊天历史。宏则写在正文内，如 {{description}}。两者都可引用内容，但插槽决定列表位置，宏在正文位置展开。', 'ST markers are standalone preset slots, such as character description, world books and chat history. Macros such as {{description}} expand inside text. Both reference content, but slots occupy list positions while macros expand at their authored text position.'], previewDepth: ['历史深度', 'History depth'], listPosition: ['按列表位置', 'List position'], emptyRequest: ['装配结果为空。请启用或填写至少一条内容。', 'The assembled request is empty. Enable or fill at least one item.'], systemOnly: ['当前只有系统指令。DeepSeek 等接口还要求非空的对话消息；仅使用自定义内容时，请将至少一条的角色设为「用户」。', 'Only system instructions remain. APIs such as DeepSeek also require a nonempty conversation message. When using only custom content, set at least one item to User.'], modules: ['按模块列表顺序', 'Module order'], removed: ['卸载后不再生成；已记录正文仍可读', 'Plugin required to generate; recorded content remains readable'], nativeSource: ['DSH 原生提供，不依赖 Tavern', 'Provided by DSH, independent of Tavern'], recorded: ['发送时保存到请求轨迹', 'Recorded in request trace when sent'], locked: ['位置由引用或深度规则决定', 'Position owned by a reference or depth rule'], empty: ['请生成预览', 'Generate a preview'], dirty: ['有未保存修改', 'Unsaved changes'], discard: ['放弃尚未保存的修改？', 'Discard unsaved changes?'], confirmDelete: ['删除这份装配策略？', 'Delete this preset?'], diagnostics: ['装配诊断', 'Assembly diagnostics'], tools: ['工具定义使用独立请求字段，不参与消息拖拽。', 'Tool definitions are a separate request field, not draggable messages.'], result: ['请求消息', 'Request messages'], audit: ['每次重新装配：轨迹保留实际请求，但下次重新求值，不累积旧副本。累积快照：内容变化时保留新副本，并带入后续请求。原生用户消息、回复和工具结果仍由 DSH 保存，是否发送由原生历史与本步输入控制。', 'Rebuild each request: the trace records the actual request, while later requests evaluate fresh content without accumulating copies. Retain snapshots: changed content adds a copy reused by later requests. DSH still saves native user messages, replies and tool results; history and current-input rules control whether they are sent.'],
  'native-system': ['官方基础指令', 'Native instructions'], preset: ['预设正文', 'Preset content'], character: ['角色设定', 'Character'], persona: ['用户设定', 'User persona'], worldbook: ['世界书', 'World books'], history: ['原生历史', 'Native history'], input: ['本步输入', 'Current input'], phi: ['PHI · 后置指令', 'Post-history instructions'], custom: ['自定义内容', 'Custom content'],
}
export function sourceColor(plugin) {
  if (!plugin) return '#999999'
  if (plugin === 'DSH') return '#8192ad'
  if (plugin === 'pmp-dsh-tavern' || plugin?.startsWith('pmp-dsh-tavern/')) return '#6495ed'
  let hash = 0; for (const c of plugin ?? 'unknown') hash = (hash * 31 + c.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 60% 62%)`
}
async function request(path = '', method = 'GET', body) {
  const res = await tavernFetch(`${API_V1}/assembly-presets${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await res.json(); if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`); return data
}
export const assemblyCss = `
.dta-stage{position:absolute;top:var(--dta-content-top,84px);bottom:0;left:var(--dta-content-left,0px);width:var(--dta-center-width,100%);z-index:1;pointer-events:none;background:#0005;padding:8px;box-sizing:border-box;display:flex;justify-content:center}
.dtv-assembly-screen{--dta-border:color-mix(in srgb,var(--dsw-alias-label-primary,#24252b) 32%,var(--dsw-alias-bg-base,#fff));position:relative;width:min(var(--dsh-composer-card-max-width,780px),100%);pointer-events:auto;display:flex;flex-direction:column;box-sizing:border-box;container-type:inline-size;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#24252b);border:1px solid var(--dta-border);border-radius:18px;box-shadow:0 18px 65px #0003;font:14px/1.55 system-ui;overflow:hidden}.dtv-assembly-screen *{box-sizing:border-box}
.dta-confirm-shade{position:absolute;inset:0;z-index:4;background:#0006;display:grid;place-items:center;padding:20px}.dta-confirm{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dta-border);border-radius:14px;padding:24px;max-width:100%;width:360px;box-shadow:0 10px 40px #0004}.dta-confirm p{margin:0 0 20px}.dta-confirm .dta-toolbar{justify-content:flex-end;margin:0}
.dta-head{display:flex;justify-content:space-between;align-items:start;padding:20px 28px;border-bottom:1px solid var(--dta-border)}.dta-head{width:100%;max-width:calc(var(--dsh-composer-card-max-width,780px) + 56px);margin:auto}.dta-head h2{margin:0;font-size:22px}.dta-head p{margin:5px 0 0;opacity:.7}.dta-body{overflow:auto;padding:22px 28px 50px;flex:1}.dta-content{max-width:var(--dsh-composer-card-max-width,780px);margin:auto}.dta-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.dtv-assembly-screen button,.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]),.dtv-assembly-screen textarea{font:inherit;color:inherit;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));border:1px solid var(--dta-border);border-radius:9px;padding:8px 12px;min-width:0}.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]){height:40px;line-height:22px;width:100%}.dtv-assembly-screen .dta-toolbar select{width:auto;max-width:100%}.dtv-assembly-screen button{cursor:pointer}.dtv-assembly-screen button:disabled{opacity:.45;cursor:default}.dtv-assembly-screen :focus-visible{outline:2px solid #4386dc;outline-offset:2px}.dtv-assembly-screen .primary{background:#347cd2;color:white;border-color:#347cd2}.dta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.dta-grid label{display:flex;flex-direction:column;gap:5px}.dta-notice{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));margin:12px 0;overflow-wrap:anywhere}.dta-notice[data-error=true]{color:#be4747}.dta-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 14px}.dtv-assembly-screen .dta-tabs button[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe);color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dta-row{border:1px solid var(--dta-border);border-left:5px solid var(--assembly-color);border-radius:14px;margin:10px 0;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dta-row[data-dragover=true]{outline:2px solid #4386dc}.dta-summary{display:flex;align-items:center;gap:14px;padding:15px 17px;min-height:69px}.dta-summary input{width:20px;height:20px;accent-color:#2484ed}.dta-handle{cursor:grab;color:var(--dsw-alias-label-tertiary,#858993);font-size:22px;line-height:1}.dta-name{flex:1;font-size:17px;min-width:0;overflow-wrap:anywhere;cursor:pointer}.dta-summary-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;flex:0 0 318px;margin:0;font-size:12px;line-height:1.5}.dta-summary-meta dt{color:var(--dsw-alias-label-tertiary,#858993);font-size:11px}.dta-summary-meta dd{margin:3px 0 0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dta-detail{padding:4px 20px 20px;border-top:1px solid var(--dta-border)}.dta-properties>*,.dta-summary-meta>div{min-width:0}.dta-properties>*+*,.dta-summary-meta>div+div{border-left:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding-left:14px}.dta-properties label,.dta-fields label{display:flex;flex-direction:column;gap:8px}.dta-fields{display:flex;flex-direction:column;gap:16px;margin:16px 0}.dta-fields .dta-field-name{max-width:320px}.dta-preview-depth{margin:12px 0}.dta-properties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.dta-detail textarea{width:100%;min-height:130px;resize:vertical}.dtv-assembly-screen pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;max-height:360px;overflow:auto}.dta-child{margin:10px 0;padding:10px 14px;border-left:3px solid #ae73cf;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));border-radius:6px}.dtv-assembly-screen small{display:block;opacity:.7;overflow-wrap:anywhere}
.dta-row[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dta-row[data-dragging=true]>*{opacity:0}.dta-drop-placeholder{min-height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);pointer-events:none}.dtv-assembly-screen .dta-handle{touch-action:none;user-select:none;background:transparent;border:0;padding:2px}.dta-origin{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}.dta-legend{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.dta-legend span{border-left:4px solid var(--assembly-color);padding-left:6px;font-size:12px}
@container(max-width:600px){.dta-summary-meta{display:none}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}.dta-head,.dta-body{padding:15px}.dta-summary{gap:8px;padding:12px 10px}.dta-fields .dta-field-name{max-width:100%}}
@media(max-width:700px){.dtv-assembly-screen{border-radius:12px}.dta-head,.dta-body{padding:15px}.dta-head{padding-right:64px}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-summary{gap:8px;padding:12px 10px}.dta-name{font-size:15px}.dta-summary-meta{display:none}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}}
`
export function AssemblyPanel(props) {
  // A session change disposes all pending editor state, including async closures.
  return h(AssemblyPanelContent, { ...props, key: props.sessionId ?? 'no-session' })
}
function AssemblyPanelContent({ sessionId, close, registerBeforeLeave, chromeMode }) {
  const locale = getClientUiSettings().locale === 'zh-CN' ? 0 : 1, t = key => labels[key]?.[locale] ?? key
  const [confirmation, setConfirmation] = useState(null)
  const confirmationResolve = useRef(null)
  const confirm = message => new Promise(resolve => { confirmationResolve.current?.(false); confirmationResolve.current = resolve; setConfirmation(message) })
  const answerConfirmation = answer => { const resolve = confirmationResolve.current; confirmationResolve.current = null; setConfirmation(null); resolve?.(answer) }
  useEffect(() => () => confirmationResolve.current?.(false), [])
  useEffect(() => { if (confirmation) dialog.current?.querySelector('.dta-confirm button')?.focus() }, [confirmation])
  const [sources, setSources] = useState([]), [addKind, setAddKind] = useState('custom')
  const [items, setItems] = useState([]), [draft, setDraft] = useState(null), [selection, setSelection] = useState(null), [capable, setCapable] = useState(false)
  const [status, setStatus] = useState(''), [error, setError] = useState(false), [busy, setBusy] = useState(false), [tab, setTab] = useState('rules'), [preview, setPreview] = useState(null), [dirty, setDirty] = useState(false), [expanded, setExpanded] = useState({})
  const file = useRef(), stage = useRef(), dialog = useRef(), generation = useRef(0), mounted = useRef(true)
  // Dim only the conversation body; shell navigation and side editors stay interactive.
  useLayoutEffect(() => {
    const panel = dialog.current
    let frame = panel?.parentElement
    while (frame && getComputedStyle(frame).display !== 'grid') frame = frame.parentElement
    if (!frame) return
    const measure = () => {
      const columns = getComputedStyle(frame).gridTemplateColumns.split(' ').map(parseFloat)
      if (columns.length !== 3 || columns.some(n => !Number.isFinite(n))) return
      stage.current.style.setProperty('--dta-content-left', `${columns[0]}px`)
      const header = [...frame.querySelectorAll('header')].find(el => !panel.contains(el) && el.querySelector('[role=tablist]'))
      const top = header ? header.getBoundingClientRect().bottom - frame.getBoundingClientRect().top : 76
      stage.current.style.setProperty('--dta-content-top', `${top}px`)
      stage.current.style.setProperty('--dta-center-width', `${columns[1]}px`)
      const composer = frame.querySelector('[data-composer-input]')
      const composerWidth = composer && getComputedStyle(composer).getPropertyValue('--dsh-composer-card-max-width').trim()
      if (composerWidth) stage.current.style.setProperty('--dsh-composer-card-max-width', composerWidth)
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(frame)
    for (const child of frame.children) resize.observe(child)
    for (const header of frame.querySelectorAll('header')) if (!panel.contains(header)) resize.observe(header)
    const changes = new MutationObserver(measure)
    changes.observe(frame, { attributes: true, attributeFilter: ['style', 'data-sidebar-collapsed', 'data-rightbar-collapsed'] })
    return () => { resize.disconnect(); changes.disconnect() }
  }, [])
  const [reload, setReload] = useState(0), [dragFrom, setDragFrom] = useState(null), [dropIndex, setDropIndex] = useState(null)
  const api = async (...args) => { const result = await request(...args); if (!mounted.current) throw new DOMException('Panel closed', 'AbortError'); return result }
  const run = async fn => { setBusy(true); setError(false); try { await fn() } catch (e) { if (mounted.current) { setError(true); setStatus(e.message) } } finally { if (mounted.current) setBusy(false) } }
  useEffect(() => { mounted.current = true; const gen = ++generation.current; run(async () => { const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`); if (gen !== generation.current || !mounted.current) return; setItems(data.presets); setSelection(data.selection); setCapable(data.capability); setSources(data.sources ?? []); setDraft(data.presets.find(p => p.id === data.selection?.id) ?? data.presets[0]); setPreview(null); setDirty(false); setStatus('') }); return () => { mounted.current = false; generation.current++ } }, [sessionId, reload])
  useEffect(() => { const refresh = () => run(async () => { const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`); setSelection(data.selection); setCapable(data.capability); setSources(data.sources ?? []) }); window.addEventListener(CLIENT_REFRESH_EVENT, refresh); return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh) }, [sessionId, chromeMode])
  useEffect(() => { let active = true; request(`?sessionId=${encodeURIComponent(sessionId ?? '')}`).then(data => { if (active) setSelection(data.selection) }).catch(() => {}); return () => { active = false } }, [chromeMode, sessionId])
  const discard = () => !busy && (!dirty || confirm(t('discard')))
  useEffect(() => registerBeforeLeave?.(discard), [dirty, busy, registerBeforeLeave])
  const edit = patch => { if (busy) return; setDraft(d => ({ ...d, ...patch })); setDirty(true); setPreview(null) }
  const editRule = (id, patch) => edit({ rules: draft.rules.map(r => r.id === id ? { ...r, ...patch } : r) })
  const toggle = id => setExpanded(old => ({ ...old, [id]: !old[id] }))
  async function save(asCopy = false) {
    const creates = asCopy || draft.builtin || !draft.id
    const data = await api(creates ? '' : `/${encodeURIComponent(draft.id)}`, creates ? 'POST' : 'PUT', draft)
    setDraft(data.preset); setItems(list => [...list.filter(p => p.id !== data.preset.id), data.preset]); setDirty(false); setStatus(t('saved')); return data.preset
  }
  function download() { const blob = new Blob([JSON.stringify({ ...draft, id: undefined, builtin: undefined }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${draft.name.replace(/[\\/:*?"<>|]/g, '_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0) }
  const button = (label, onClick, disabled = false, cls, pressed) => h('button', { type: 'button', onClick, disabled: busy || disabled, className: cls, 'aria-pressed': pressed }, t(label))
  const select = (value, values, onChange, disabled = false) => h('select', { value, disabled, onChange: e => onChange(e.target.value) }, ...values.map(v => h('option', { key: v, value: v }, t(v))))
  const nodeName = node => {
    if (labels[node.name]) return t(node.name)
    const standard = { 'Main Prompt': 'main', 'Post-History Instructions': 'jailbreak', 'Character Description': 'charDescription', 'Character Personality': 'charPersonality', 'Persona Description': 'personaDescription', 'Chat History': 'history', 'World Info (before)': 'worldbook', 'World Info (after)': 'worldbook' }
    if (standard[node.name]) return t(standard[node.name])
    if (node.name?.startsWith('preset:') || node.name?.startsWith('worldbook:')) return labels[node.source?.field] ? t(node.source.field) : `${t(node.name.startsWith('preset:') ? 'preset' : 'worldbook')} · ${Math.max(0, preview?.nodes?.indexOf(node) ?? -1) + 1}`
    return node.name
  }
  const originName = plugin => plugin === 'DSH' ? 'DSH' : plugin === 'pmp-dsh-tavern' || plugin?.startsWith('pmp-dsh-tavern/') ? 'DSH Tavern' : plugin ?? (locale === 0 ? '来源未知' : 'Unknown source')
  const sourceDescriptor = kind => sources.find(s => s.id === kind)
  const sourcePlugin = kind => sourceDescriptor(kind)?.pluginId ?? null
  const sourceName = kind => labels[kind] ? t(kind) : sourceDescriptor(kind)?.name ?? kind
  const sourceInfo = kind => sourceDescriptor(kind)?.generationRequiresPlugin === false ? t('nativeSource') : t('removed')
  async function actualRequest() {
    const response = await tavernFetch(`${API_V3}/sessions/${encodeURIComponent(sessionId)}/assemblies`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const list = await response.json()
    for (const item of [...(list.records ?? [])].reverse().slice(0, 20)) {
      const res = await tavernFetch(`${API_V3}/sessions/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(item.id)}`)
      if (!res.ok) continue
      const record = (await res.json()).record?.requestAssembly
      if (!mounted.current) return
      if (record?.messages) {
        const result = record.metadata?.assembly ?? { diagnostics: [], nodes: record.messages.map((m, index) => ({ id: m.id ?? `actual-${index}`, module: m.role === 'system' ? 'native-system' : 'history', name: m.role === 'system' ? 'native-system' : m.role, role: m.role, source: { plugin: m.source?.plugin ?? 'DSH', field: m.source?.kind }, stability: 'snapshot', lifetime: 'native', locked: true, text: (m.content ?? []).map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('\n') })) }
        setPreview({ ...result, messages: record.messages, actual: true }); setTab('expanded'); setStatus(record.metadata?.assembly ? '' : t('legacy')); return
      }
    }
    setStatus(t('noActual'))
  }
  const safeClose = async () => { if (registerBeforeLeave || await discard()) close() }
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector('button')?.focus()
    return () => { previous?.focus?.() }
  }, [])
  useEffect(() => { const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  useEffect(() => { if (registerBeforeLeave) return; const handler = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); safeClose() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [dirty, busy, registerBeforeLeave])
  const displayRows = tab === 'rules' ? draft?.rules ?? [] : preview?.nodes ?? []
  function dragHandle(row, index, movable = true) {
    const reset = () => { setDragFrom(null); setDropIndex(null) }
    const boundary = event => {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-assembly-index]')
      if (!target) return null
      const rect = target.getBoundingClientRect(), at = Number(target.dataset.assemblyIndex)
      return event.clientY < rect.top + rect.height / 2 ? at : at + 1
    }
    return h('button', { type: 'button', className: 'dta-handle', disabled: busy || !movable, 'aria-label': `${t('placement')}: ${row.name || t(row.kind)}`, 'aria-pressed': dragFrom === index,
      onPointerDown: e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDragFrom(index); setDropIndex(index + 1) },
      onPointerMove: e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const next = boundary(e); if (next !== null) setDropIndex(next) } },
      onPointerUp: e => { e.preventDefault(); if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; e.currentTarget.releasePointerCapture(e.pointerId); const at = boundary(e) ?? dropIndex ?? index + 1; reset();
        const rules = reorderAtBoundary(draft.rules, index, at)
        edit({ rules })
      }, onPointerCancel: reset }, movable ? '⠿' : '🔒')
  }
  const placeholder = index => dragFrom !== null && dropIndex === index ? h('div', { key: `drop-${index}`, className: 'dta-drop-placeholder' }, t('dropHere'), displayRows[dragFrom]?.name || t(displayRows[dragFrom]?.kind)) : null
  const ruleStability = rule => sourceDescriptor(rule.kind)?.stability ?? 'conversation'
  const summaryMetadata = (stability, lifetime, role) => h('dl', { className: 'dta-summary-meta' },
    ...[['stability', stability], ['lifetime', lifetime], ['role', role]].map(([label, value]) =>
      h('div', { key: label }, h('dt', null, t(label)), h('dd', null, t(label === 'stability' && value === 'snapshot' ? 'retained' : value)))))
  function ruleRow(rule, index) {
    return h('article', { key: rule.id, className: 'dta-row', 'data-assembly-index': index, 'data-dragging': dragFrom === index, style: { '--assembly-color': sourceColor(sourcePlugin(rule.kind)) } },
        h('div', { className: 'dta-summary' }, dragHandle(rule, index),
        h('input', { type: 'checkbox', checked: rule.enabled, disabled: busy, 'aria-label': sourceName(rule.kind), onChange: e => editRule(rule.id, { enabled: e.target.checked }) }),
        h('span', { className: 'dta-name', role: 'button', tabIndex: 0, 'aria-expanded': !!expanded[rule.id], onClick: () => toggle(rule.id), onKeyDown: e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(rule.id) } } }, rule.name || sourceName(rule.kind), h('small', { className: 'dta-origin' }, originName(sourcePlugin(rule.kind)))), summaryMetadata(ruleStability(rule), ['native-system', 'history', 'input'].includes(rule.kind) ? 'nativeRetention' : rule.lifetime, rule.role)),
      expanded[rule.id] && h('div', { className: 'dta-detail' },
        h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, originName(sourcePlugin(rule.kind))), h('small', null, sourceInfo(rule.kind))), h('div', null, t('stability'), h('small', null, t(ruleStability(rule)))), h('label', null, t('lifetime'), ['native-system', 'history', 'input'].includes(rule.kind) ? h('small', null, t('nativeRetention')) : select(rule.lifetime, sourceDescriptor(rule.kind)?.lifetimes ?? ['request', 'snapshot'], v => editRule(rule.id, { lifetime: v }), sourceDescriptor(rule.kind)?.lifetimes.length === 1))),
        h('div', { className: 'dta-grid' }, h('label', null, t('role'), select(rule.role, sourceDescriptor(rule.kind)?.roles ?? ['preserve', 'system', 'user', 'assistant'], v => editRule(rule.id, { role: v }), sourceDescriptor(rule.kind)?.roles.length === 1)), sourceDescriptor(rule.kind)?.depth !== false && h('label', null, t('depth'), h('input', { type: 'number', min: 0, max: 10000, value: rule.depth ?? '', onChange: e => editRule(rule.id, { depth: e.target.value === '' ? null : Number(e.target.value) }) }))),
        rule.kind === 'phi' && h('div', { className: 'dta-fields' }, h('p', null, t('phiHelp')), h('label', null, t('additional-phi'), h('textarea', { value: rule.text, onChange: e => editRule(rule.id, { text: e.target.value }) }))),
        (rule.kind === 'custom' || !['native-system', 'history', 'input', 'preset', 'character', 'persona', 'worldbook', 'phi'].includes(rule.kind)) && h('div', { className: 'dta-fields' }, h('label', { className: 'dta-field-name' }, t('name'), h('input', { value: rule.name ?? '', onChange: e => editRule(rule.id, { name: e.target.value }) })), h('label', null, t('text'), h('textarea', { value: rule.text, onChange: e => editRule(rule.id, { text: e.target.value }) })), button('remove', () => edit({ rules: draft.rules.filter(r => r.id !== rule.id) }))), !sourceDescriptor(rule.kind) && h('small', { role: 'status' }, t('missingSource')), h('small', null, t('audit'))))
  }
  function nodeRow(node, index) {
    return h('article', { key: node.id, className: 'dta-row', style: { '--assembly-color': sourceColor(node.source.plugin) } },
      h('div', { className: 'dta-summary' }, h('span', { className: 'dta-name', role: 'button', tabIndex: 0, onClick: () => toggle(node.id), onKeyDown: e => { if (e.key === 'Enter') toggle(node.id) }, 'aria-expanded': !!expanded[node.id], title: node.name }, nodeName(node), h('small', { className: 'dta-origin' }, `${originName(node.source.plugin)} · ${t('previewDepth')}: ${node.depth == null ? t('listPosition') : node.depth}`)), summaryMetadata(node.stability, node.lifetime === 'native' ? 'nativeRetention' : node.lifetime, node.role)),
      expanded[node.id] && h('div', { className: 'dta-detail' }, h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, `${node.source.plugin} / ${node.source.resourceId ?? ''} / ${node.source.field}`), h('small', null, sourceInfo(node.module))), h('div', null, t('stability'), h('small', null, t(node.stability))), h('div', null, t('lifetime'), h('small', null, t(node.lifetime)), h('small', null, t('recorded')))), h('div', { className: 'dta-preview-depth' }, `${t('previewDepth')}: ${node.depth == null ? t('listPosition') : node.depth}`), node.locked && h('small', null, `${t('locked')}: ${node.lockReason}`), ...(node.children ?? []).map(child => h('div', { key: child.id, className: 'dta-child', style: { borderLeftColor: sourceColor(child.source?.plugin) } }, `🔒 ${nodeName(child)}`, h('small', null, child.lockReason), h('small', null, [originName(child.source?.plugin), child.source?.resourceId, child.source?.field, child.source?.sourceKind].filter(Boolean).join(' / ')), h('pre', null, child.text))), h('pre', null, node.text)))
  }
  return h('div', { ref: stage, className: 'dta-stage' }, h('section', { ref: dialog, className: 'dtv-assembly-screen', role: 'dialog', 'aria-modal': false, 'aria-label': t('title') }, h('style', null, assemblyCss),
    confirmation && h('div', { className: 'dta-confirm-shade' }, h('div', { className: 'dta-confirm', role: 'alertdialog', 'aria-modal': true, 'aria-label': confirmation, onKeyDown: e => { if (e.key === 'Escape') { e.stopPropagation(); answerConfirmation(false) } else if (e.key === 'Tab') { e.preventDefault(); const buttons = [...e.currentTarget.querySelectorAll('button')]; const at = buttons.indexOf(document.activeElement); buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus() } } }, h('p', null, confirmation), h('div', { className: 'dta-toolbar' }, h('button', { type: 'button', onClick: () => answerConfirmation(false) }, t('cancel')), h('button', { type: 'button', className: 'primary', onClick: () => answerConfirmation(true) }, t('confirm'))))),
    h('header', { className: 'dta-head' }, h('div', null, h('h2', null, t('title')), h('p', null, t('intro'))), h('button', { onClick: safeClose, 'aria-label': t('close') }, '×')),
    h('div', { className: 'dta-body' }, h('fieldset', { className: 'dta-content', disabled: busy, style: { border: 0, padding: 0, minWidth: 0 } },
      h('div', { className: 'dta-toolbar' }, h('input', { type: 'file', accept: '.json,application/json', hidden: true, ref: file, onChange: e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => { if (f.size > 2 * 1024 * 1024) throw new Error('2 MiB limit'); if (!await discard()) return; const data = await api('', 'POST', JSON.parse(await f.text())); setDraft(data.preset); setItems(i => [...i, data.preset]); setDirty(false); setPreview(null) }) } }), button('import', () => file.current.click()), button('export', download, !draft), button('create', async () => { if (await discard()) { setDraft({ ...structuredClone(BUILTINS[1]), id: undefined, name: t('title') }); setDirty(true); setPreview(null) } })),
      status && h('div', { role: error ? 'alert' : 'status', className: 'dta-notice', 'data-error': error }, status),
      !draft ? h('div', null, !error && h('p', null, t('loading')), error && button('retry', () => setReload(n => n + 1))) : h('div', null,
        h('div', { className: 'dta-grid' }, h('label', null, t('select'), h('select', { value: draft.id ?? '', disabled: busy, onChange: async e => { const id = e.target.value; if (await discard()) { setDraft(items.find(p => p.id === id)); setDirty(false); setPreview(null) } } }, !draft.id && h('option', { value: '' }, draft.name), ...items.map(p => h('option', { key: p.id, value: p.id }, p.name)))), h('label', null, t('name'), h('input', { value: draft.name, disabled: draft.builtin, onChange: e => edit({ name: e.target.value }) }))),
        h('div', { className: 'dta-toolbar' }, button('save', () => run(() => save())), button('copy', () => run(() => save(true))), button('remove', () => run(async () => { if (!await confirm(t('confirmDelete'))) return; await api(`/${draft.id}`, 'DELETE'); setItems(i => i.filter(p => p.id !== draft.id)); setDraft(items[0]); setDirty(false); setPreview(null) }), !draft.id || draft.builtin), dirty && h('span', null, t('dirty'))),
        h('div', { className: 'dta-notice' }, `${t('applied')}: ${selection?.name ?? t('legacy')}`, !capable && h('small', null, t('unavailable'))),
        h('div', { className: 'dta-toolbar' }, button('apply', () => run(async () => { const preset = dirty || !draft.id ? await save() : draft; const data = await api('/selection', 'PUT', { sessionId, id: preset.id }); setSelection(data.selection); setStatus(t('appliedStatus')); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT)) }), !sessionId || !capable, 'primary'), button('reset', async () => { if (!await discard()) return; run(async () => { const data = await api('/selection', 'PUT', { sessionId, id: 'builtin-st' }); setSelection(data.selection); setDraft(items.find(p => p.id === 'builtin-st')); setDirty(false); setPreview(null); setTab('rules'); setStatus(t('appliedStatus')); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT)) }) }, !sessionId || !capable), button('disable', () => run(async () => { const data = await api('/selection', 'PUT', { sessionId, id: null }); setSelection(data.selection); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT)) }), !sessionId || !selection)),
        h('small', null, t('defaultHint')),
        !sessionId && h('small', null, t('noSession')),
        h('div', { className: 'dta-tabs' }, h('button', { 'aria-pressed': tab === 'rules', onClick: () => setTab('rules') }, t('rules')), button('preview', () => run(async () => { setDragFrom(null); setDropIndex(null); const data = await api('/preview', 'POST', { sessionId, preset: draft }); setPreview(data.preview); setTab('expanded') }), false, undefined, tab === 'expanded' && !preview?.actual), button('actual', () => run(actualRequest), !sessionId, undefined, tab === 'expanded' && !!preview?.actual)),
        h('div', { className: 'dta-legend' }, ...[...new Set(sources.map(s => s.pluginId))].map(plugin => h('span', { key: plugin, style: { '--assembly-color': sourceColor(plugin) } }, originName(plugin)))),
        tab === 'rules' ? h('div', null, h('label', { className: 'dta-toolbar' }, t('placement'), select(draft.placement, ['modules', 'st'], placement => edit({ placement }))), draft.placement === 'st' && h('small', null, t('stHelp')), ...draft.rules.flatMap((row, i) => [placeholder(i), ruleRow(row, i)]), placeholder(draft.rules.length), h('div', { className: 'dta-toolbar' }, h('label', { htmlFor: 'dta-add-source' }, t('addSource')), h('select', { id: 'dta-add-source', value: addKind, onChange: e => setAddKind(e.target.value) }, ...sources.filter(s => s.multiple || !draft.rules.some(r => r.kind === s.id)).map(s => h('option', { key: s.id, value: s.id }, `${originName(s.pluginId)} · ${sourceName(s.id)}`))), h('span', null, t('customSuffix')), button('add', () => { const source = sourceDescriptor(addKind); if (!source || (!source.multiple && draft.rules.some(r => r.kind === source.id))) return; const id = `source-${crypto.randomUUID()}`; edit({ rules: [...draft.rules, { id, kind: source.id, enabled: true, role: source.id === 'custom' ? 'user' : source.roles[0], lifetime: source.lifetimes[0], depth: null, text: '', name: '' }] }); setExpanded(old => ({ ...old, [id]: true })); if (!source.multiple) setAddKind('custom') }, !sourceDescriptor(addKind))), h('small', null, t('sourceHelp')))
          : h('div', null, h('div', { className: 'dta-notice' }, t(preview?.actual ? 'actualNotice' : 'previewScope')), !preview ? h('p', null, t('empty')) : h('div', null, ...preview.diagnostics.filter(d => ['ASSEMBLY_EMPTY', 'ASSEMBLY_SYSTEM_ONLY'].includes(d.code)).map(d => h('div', { key: d.code, className: 'dta-notice', role: 'alert' }, t(d.code === 'ASSEMBLY_EMPTY' ? 'emptyRequest' : 'systemOnly'))), ...preview.nodes.map(nodeRow), h('details', null, h('summary', null, `${t('result')} (${preview.messages.length})`), ...preview.messages.map((m, i) => h('div', { key: `${m.id}:${i}`, className: 'dta-child' }, `${i + 1} · ${m.role}`, h('pre', null, (m.content ?? []).map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('\n'))))), preview.diagnostics.length > 0 && h('details', null, h('summary', null, t('diagnostics')), h('pre', null, JSON.stringify(preview.diagnostics, null, 2))))), h('small', { style: { marginTop: 20 } }, t('tools')))))))
}
