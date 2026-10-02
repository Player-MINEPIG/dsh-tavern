import { createElement as h, useEffect, useRef, useState } from 'react'
import { tavernFetch } from '../client/src/api-fetch.js'
import { getClientUiSettings } from '../client/src/i18n.js'
import { API_V1, API_V3, CLIENT_REFRESH_EVENT } from '../identity.js'
import { BUILTINS, moveRule } from './model.js'

const labels = {
  retry: ['重试', 'Retry'],
  actual: ['查看最近实际请求', 'View latest actual request'], noActual: ['暂无新版装配请求记录', 'No request assembly record yet'], actualNotice: ['以下是轨迹保存的实际请求，修改当前预设不会改变它。', 'This is the recorded request. Editing the preset does not change it.'],
  title: ['提示词装配', 'Prompt assembly'], intro: ['安排内容如何进入每次模型请求。预览当前资产、宏引用和实际顺序。', 'Arrange each model request. Preview assets, macro references and message order.'],
  import: ['导入', 'Import'], export: ['导出', 'Export'], create: ['创建', 'Create'], copy: ['另存为', 'Save as'], save: ['保存规则', 'Save rules'], remove: ['删除', 'Delete'], select: ['选择装配预设', 'Assembly preset'], name: ['名称', 'Name'], apply: ['应用到当前会话', 'Apply to this session'], applied: ['当前应用', 'Applied'], legacy: ['当前 Tavern 行为', 'Current Tavern behavior'], reset: ['恢复默认装配', 'Restore default assembly'], preview: ['根据当前配置预览', 'Preview current configuration'], rules: ['通用规则', 'Rules'], expanded: ['展开预览', 'Expanded preview'], add: ['添加自定义内容', 'Add custom content'], source: ['来源', 'Source'], stability: ['稳定性', 'Stability'], lifetime: ['保留方式', 'Retention'], request: ['仅本次请求', 'This request only'], snapshot: ['追加快照并保留', 'Append and retain snapshots'], native: ['原生历史', 'Native history'], preserve: ['保留原始角色', 'Preserve original role'], depth: ['历史深度（留空使用列表位置）', 'History depth (blank uses list position)'], asset: ['资产修改时变化', 'Changes with asset'], conversation: ['随对话变化', 'Changes with conversation'], evaluation: ['每次求值可能变化', 'May change on evaluation'], assembly: ['由官方装配决定', 'Determined by core assembly'], saved: ['已保存；应用后影响后续请求', 'Saved; apply to affect future requests'], appliedStatus: ['已应用到当前会话', 'Applied to this session'], unavailable: ['宿主尚未支持请求装配协议。可以编辑和预览；应用前需安装核心扩展。', 'Editing and preview are available. Applying requires the request assembly core extension.'], previewScope: ['预览使用当前资产与可读取历史，不含待发送输入；随机宏使用固定样例。实际请求以轨迹中的冻结结果为准。', 'Preview uses current assets and available history, without pending input. Random macros use a fixed sample. Recorded requests contain the frozen result.'], noSession: ['请先打开会话', 'Open a session first'], loading: ['加载中…', 'Loading…'], close: ['关闭', 'Close'], up: ['上移', 'Move up'], down: ['下移', 'Move down'], text: ['内容', 'Content'], role: ['消息角色', 'Message role'], placement: ['放置策略', 'Placement'], st: ['遵循 ST marker 与深度', 'ST markers and depth'], modules: ['按模块列表顺序', 'Module order'], removed: ['卸载后不再生成；已记录正文仍可读', 'Plugin required to generate; recorded content remains readable'], nativeSource: ['DSH 原生提供，不依赖 Tavern', 'Provided by DSH, independent of Tavern'], recorded: ['发送时保存到请求轨迹', 'Recorded in request trace when sent'], locked: ['位置由引用或深度规则决定', 'Position owned by a reference or depth rule'], empty: ['请生成预览', 'Generate a preview'], dirty: ['有未保存修改', 'Unsaved changes'], discard: ['放弃尚未保存的修改？', 'Discard unsaved changes?'], confirmDelete: ['删除这份装配预设？', 'Delete this preset?'], diagnostics: ['装配诊断', 'Assembly diagnostics'], tools: ['工具定义使用独立请求字段，不参与消息拖拽。', 'Tool definitions are a separate request field, not draggable messages.'], result: ['请求消息', 'Request messages'], audit: ['记录轨迹不代表进入后续上下文', 'Trace retention does not imply future model context'],
  'native-system': ['官方基础指令', 'Native instructions'], preset: ['预设正文', 'Preset content'], character: ['角色设定', 'Character'], persona: ['用户设定', 'User persona'], worldbook: ['世界书', 'World books'], history: ['原生历史', 'Native history'], input: ['本步输入', 'Current input'], phi: ['PHI · 后置指令', 'Post-history instructions'], custom: ['自定义内容', 'Custom content'],
}
const colors = { 'native-system': '#75849b', history: '#75849b', input: '#75849b', preset: '#5484d6', character: '#ae73cf', persona: '#c99249', worldbook: '#4b9f86', phi: '#ca7784', custom: '#7b79c6' }
const isNative = kind => ['native-system', 'history', 'input'].includes(kind)
async function request(path = '', method = 'GET', body) {
  const res = await tavernFetch(`${API_V1}/assembly-presets${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await res.json(); if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`); return data
}
export const assemblyCss = `
.dtv-assembly-screen{position:fixed;inset:16px;z-index:10010;pointer-events:auto;display:flex;flex-direction:column;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-text-primary,#24252b);border:1px solid var(--dsw-alias-border-l1,#e8e8ec);border-radius:18px;box-shadow:0 18px 65px #0003;font:14px/1.55 system-ui;overflow:hidden}.dtv-assembly-screen *{box-sizing:border-box}
.dta-head{display:flex;justify-content:space-between;align-items:start;padding:20px 28px;border-bottom:1px solid var(--dsw-alias-border-l1,#eee)}.dta-head h2{margin:0;font-size:22px}.dta-head p{margin:5px 0 0;opacity:.7}.dta-body{overflow:auto;padding:22px 28px 50px;flex:1}.dta-content{max-width:1200px;margin:auto}.dta-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.dtv-assembly-screen button,.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]),.dtv-assembly-screen textarea{font:inherit;color:inherit;background:var(--dsw-alias-bg-l1,#fafafa);border:1px solid var(--dsw-alias-border-l1,#dedfe5);border-radius:9px;padding:8px 12px;min-width:0}.dtv-assembly-screen button{cursor:pointer}.dtv-assembly-screen button:disabled{opacity:.45;cursor:default}.dtv-assembly-screen :focus-visible{outline:2px solid #4386dc;outline-offset:2px}.dtv-assembly-screen .primary{background:#347cd2;color:white;border-color:#347cd2}.dta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.dta-grid label{display:flex;flex-direction:column;gap:5px}.dta-notice{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-l1,#f4f6fa);margin:12px 0;overflow-wrap:anywhere}.dta-notice[data-error=true]{color:#be4747}.dta-tabs{display:flex;gap:8px;margin:24px 0 14px}.dta-tabs button[aria-pressed=true]{border-color:#4386dc;color:#4386dc}
.dta-row{border:1px solid var(--dsw-alias-border-l1,#e9e9ed);border-left:5px solid var(--assembly-color);border-radius:14px;margin:10px 0;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dta-row[data-dragover=true]{outline:2px solid #4386dc}.dta-summary{display:flex;align-items:center;gap:14px;padding:15px 17px;min-height:69px}.dta-summary input{width:20px;height:20px;accent-color:#2484ed}.dta-handle{cursor:grab;color:#858993;font-size:22px;line-height:1}.dta-name{flex:1;font-size:17px;min-width:0;overflow-wrap:anywhere;cursor:pointer}.dta-badge{font-size:12px;color:#858993;text-transform:uppercase}.dta-detail{padding:4px 20px 20px;border-top:1px solid var(--dsw-alias-border-l1,#eee)}.dta-properties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.dta-detail textarea{width:100%;min-height:130px;resize:vertical}.dtv-assembly-screen pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;max-height:360px;overflow:auto}.dta-child{margin:10px 0;padding:10px 14px;border-left:3px solid #ae73cf;background:var(--dsw-alias-bg-l1,#f7f7fa);border-radius:6px}.dtv-assembly-screen small{display:block;opacity:.7;overflow-wrap:anywhere}
@media(max-width:700px){.dtv-assembly-screen{inset:5px;border-radius:12px}.dta-head,.dta-body{padding:15px}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-summary{gap:8px;padding:12px 10px}.dta-name{font-size:15px}.dta-badge{max-width:95px;text-align:right}}
`
export function AssemblyPanel(props) {
  // A session change disposes all pending editor state, including async closures.
  return h(AssemblyPanelContent, { ...props, key: props.sessionId ?? 'no-session' })
}
function AssemblyPanelContent({ sessionId, close, registerBeforeLeave }) {
  const locale = getClientUiSettings().locale === 'zh-CN' ? 0 : 1, t = key => labels[key]?.[locale] ?? key
  const [items, setItems] = useState([]), [draft, setDraft] = useState(null), [selection, setSelection] = useState(null), [capable, setCapable] = useState(false)
  const [status, setStatus] = useState(''), [error, setError] = useState(false), [busy, setBusy] = useState(false), [tab, setTab] = useState('rules'), [preview, setPreview] = useState(null), [dirty, setDirty] = useState(false), [expanded, setExpanded] = useState({})
  const file = useRef(), dialog = useRef(), drag = useRef(null), generation = useRef(0), mounted = useRef(true)
  const [reload, setReload] = useState(0)
  const api = async (...args) => { const result = await request(...args); if (!mounted.current) throw new DOMException('Panel closed', 'AbortError'); return result }
  const run = async fn => { setBusy(true); setError(false); try { await fn() } catch (e) { if (mounted.current) { setError(true); setStatus(e.message) } } finally { if (mounted.current) setBusy(false) } }
  useEffect(() => { mounted.current = true; const gen = ++generation.current; run(async () => { const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`); if (gen !== generation.current || !mounted.current) return; setItems(data.presets); setSelection(data.selection); setCapable(data.capability); setDraft(data.presets.find(p => p.id === data.selection?.id) ?? data.presets[0]); setPreview(null); setDirty(false); setStatus('') }); return () => { mounted.current = false; generation.current++ } }, [sessionId, reload])
  const discard = () => !busy && (!dirty || window.confirm(t('discard')))
  useEffect(() => registerBeforeLeave?.(discard), [dirty, busy, registerBeforeLeave])
  const edit = patch => { if (busy) return; setDraft(d => ({ ...d, ...patch })); setDirty(true); setPreview(null) }
  const editRule = (id, patch) => edit({ rules: draft.rules.map(r => r.id === id ? { ...r, ...patch } : r) })
  const reorder = (id, target) => edit({ rules: moveRule(draft.rules, id, target) })
  const toggle = id => setExpanded(old => ({ ...old, [id]: !old[id] }))
  async function save(asCopy = false) {
    const creates = asCopy || draft.builtin || !draft.id
    const data = await api(creates ? '' : `/${encodeURIComponent(draft.id)}`, creates ? 'POST' : 'PUT', draft)
    setDraft(data.preset); setItems(list => [...list.filter(p => p.id !== data.preset.id), data.preset]); setDirty(false); setStatus(t('saved')); return data.preset
  }
  function download() { const blob = new Blob([JSON.stringify({ ...draft, id: undefined, builtin: undefined }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${draft.name.replace(/[\\/:*?"<>|]/g, '_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0) }
  const button = (label, onClick, disabled = false, cls) => h('button', { type: 'button', onClick, disabled: busy || disabled, className: cls }, t(label))
  const select = (value, values, onChange, disabled = false) => h('select', { value, disabled, onChange: e => onChange(e.target.value) }, ...values.map(v => h('option', { key: v, value: v }, t(v))))
  const sourceInfo = kind => t(isNative(kind) ? 'nativeSource' : 'removed')
  async function actualRequest() {
    const response = await tavernFetch(`${API_V3}/sessions/${encodeURIComponent(sessionId)}/assemblies`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const list = await response.json()
    for (const item of [...(list.records ?? [])].reverse().slice(0, 20)) {
      const res = await tavernFetch(`${API_V3}/sessions/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(item.id)}`)
      if (!res.ok) continue
      const record = (await res.json()).record?.requestAssembly
      if (!mounted.current) return
      if (record?.metadata?.assembly) { setPreview({ ...record.metadata.assembly, messages: record.messages, actual: true }); setTab('expanded'); return }
    }
    setStatus(t('noActual'))
  }
  const safeClose = () => { if (registerBeforeLeave || discard()) close() }
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector('button')?.focus()
    const trap = e => {
      if (e.key !== 'Tab') return
      const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length)
      if (!items.length) return
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus() }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus() }
    }
    const element = dialog.current; element.addEventListener('keydown', trap)
    return () => { element.removeEventListener('keydown', trap); previous?.focus?.() }
  }, [])
  useEffect(() => { const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  useEffect(() => { if (registerBeforeLeave) return; const handler = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); safeClose() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [dirty, busy, registerBeforeLeave])
  function ruleRow(rule, index) {
    return h('article', { key: rule.id, className: 'dta-row', style: { '--assembly-color': colors[rule.kind] }, onDragOver: e => { e.preventDefault(); e.currentTarget.dataset.dragover = 'true' }, onDragLeave: e => { delete e.currentTarget.dataset.dragover }, onDrop: e => { e.preventDefault(); delete e.currentTarget.dataset.dragover; if (drag.current) reorder(drag.current, rule.id); drag.current = null } },
        h('div', { className: 'dta-summary' }, h('span', { draggable: !busy, className: 'dta-handle', onDragStart: e => { drag.current = rule.id; e.dataTransfer.setData('text/plain', rule.id) }, onDragEnd: () => { drag.current = null }, 'aria-hidden': true }, '⠿'),
        h('input', { type: 'checkbox', checked: rule.enabled, disabled: isNative(rule.kind), 'aria-label': t(rule.kind), onChange: e => editRule(rule.id, { enabled: e.target.checked }) }),
        h('span', { className: 'dta-name', role: 'button', tabIndex: 0, 'aria-expanded': !!expanded[rule.id], onClick: () => toggle(rule.id), onKeyDown: e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(rule.id) } } }, rule.name || t(rule.kind)), h('span', { className: 'dta-badge' }, rule.role === 'preserve' ? 'AUTO' : rule.role),
        h('button', { title: t('up'), 'aria-label': t('up'), disabled: index === 0, onClick: () => reorder(rule.id, draft.rules[index - 1].id) }, '↑'), h('button', { title: t('down'), 'aria-label': t('down'), disabled: index === draft.rules.length - 1, onClick: () => reorder(rule.id, draft.rules[index + 1].id) }, '↓')),
      expanded[rule.id] && h('div', { className: 'dta-detail' },
        h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, rule.kind), h('small', null, sourceInfo(rule.kind))), h('div', null, t('stability'), h('small', null, t(['history', 'input', 'worldbook'].includes(rule.kind) ? 'conversation' : rule.kind === 'native-system' ? 'assembly' : 'asset'))), h('label', null, t('lifetime'), select(rule.lifetime, ['request', 'snapshot'], v => editRule(rule.id, { lifetime: v }), isNative(rule.kind) || rule.kind === 'preset'))),
        h('div', { className: 'dta-grid' }, h('label', null, t('role'), select(rule.role, ['preserve', 'system', 'user', 'assistant'], v => editRule(rule.id, { role: v }), isNative(rule.kind))), !isNative(rule.kind) && h('label', null, t('depth'), h('input', { type: 'number', min: 0, max: 10000, value: rule.depth ?? '', onChange: e => editRule(rule.id, { depth: e.target.value === '' ? null : Number(e.target.value) }) }))),
        rule.kind === 'custom' && h('div', null, h('label', null, t('name'), h('input', { value: rule.name ?? '', onChange: e => editRule(rule.id, { name: e.target.value }) })), h('label', null, t('text'), h('textarea', { value: rule.text, onChange: e => editRule(rule.id, { text: e.target.value }) })), button('remove', () => edit({ rules: draft.rules.filter(r => r.id !== rule.id) }))), h('small', null, t('audit'))))
  }
  function nodeRow(node) {
    const owner = node.ruleId ?? draft.rules.find(r => r.kind === node.module)?.id
    const movable = !busy && !node.locked && !preview?.actual && Boolean(owner)
    return h('article', { key: node.id, className: 'dta-row', style: { '--assembly-color': colors[node.module] ?? '#888' }, draggable: movable,
      onDragStart: e => { if (movable) { drag.current = owner; e.dataTransfer.setData('text/plain', owner) } },
      onDragOver: e => { if (movable) e.preventDefault() },
      onDrop: e => { e.preventDefault(); if (!movable || !drag.current) return; const next = { ...draft, rules: moveRule(draft.rules, drag.current, owner) }; drag.current = null; edit(next); run(async () => { const data = await api('/preview', 'POST', { sessionId, preset: next }); setPreview(data.preview) }) },
    },
      h('div', { className: 'dta-summary', role: 'button', tabIndex: 0, onClick: () => toggle(node.id), onKeyDown: e => { if (e.key === 'Enter') toggle(node.id) }, 'aria-expanded': !!expanded[node.id] }, h('span', { title: node.lockReason ?? '' }, node.locked ? '🔒' : '◇'), h('span', { className: 'dta-name' }, node.name), h('span', { className: 'dta-badge' }, node.role)),
      expanded[node.id] && h('div', { className: 'dta-detail' }, h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, `${node.source.plugin} / ${node.source.resourceId ?? ''} / ${node.source.field}`), h('small', null, sourceInfo(node.module))), h('div', null, t('stability'), h('small', null, t(node.stability))), h('div', null, t('lifetime'), h('small', null, t(node.lifetime)), h('small', null, t('recorded')))), node.locked && h('small', null, `${t('locked')}: ${node.lockReason}`), ...(node.children ?? []).map(child => h('div', { key: child.id, className: 'dta-child' }, `🔒 ${child.name}`, h('small', null, child.lockReason), h('small', null, [child.source?.plugin, child.source?.resourceId, child.source?.field, child.source?.sourceKind].filter(Boolean).join(' / ')), h('pre', null, child.text))), h('pre', null, node.text)))
  }
  return h('section', { ref: dialog, className: 'dtv-assembly-screen', role: 'dialog', 'aria-modal': true, 'aria-label': t('title') }, h('style', null, assemblyCss),
    h('header', { className: 'dta-head' }, h('div', null, h('h2', null, t('title')), h('p', null, t('intro'))), h('button', { onClick: safeClose, 'aria-label': t('close') }, '×')),
    h('div', { className: 'dta-body' }, h('fieldset', { className: 'dta-content', disabled: busy, style: { border: 0, padding: 0, minWidth: 0 } },
      h('div', { className: 'dta-toolbar' }, h('input', { type: 'file', accept: '.json,application/json', hidden: true, ref: file, onChange: e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => { if (f.size > 2 * 1024 * 1024) throw new Error('2 MiB limit'); if (!discard()) return; const data = await api('', 'POST', JSON.parse(await f.text())); setDraft(data.preset); setItems(i => [...i, data.preset]); setDirty(false); setPreview(null) }) } }), button('import', () => file.current.click()), button('export', download, !draft), button('create', () => { if (discard()) { setDraft({ ...structuredClone(BUILTINS[1]), id: undefined, name: t('title') }); setDirty(true); setPreview(null) } })),
      status && h('div', { role: error ? 'alert' : 'status', className: 'dta-notice', 'data-error': error }, status),
      !draft ? h('div', null, !error && h('p', null, t('loading')), error && button('retry', () => setReload(n => n + 1))) : h('div', null,
        h('div', { className: 'dta-grid' }, h('label', null, t('select'), h('select', { value: draft.id ?? '', disabled: busy, onChange: e => { if (discard()) { setDraft(items.find(p => p.id === e.target.value)); setDirty(false); setPreview(null) } } }, !draft.id && h('option', { value: '' }, draft.name), ...items.map(p => h('option', { key: p.id, value: p.id }, p.name)))), h('label', null, t('name'), h('input', { value: draft.name, onChange: e => edit({ name: e.target.value }) }))),
        h('div', { className: 'dta-toolbar' }, button('save', () => run(() => save())), button('copy', () => run(() => save(true))), button('remove', () => run(async () => { if (!window.confirm(t('confirmDelete'))) return; await api(`/${draft.id}`, 'DELETE'); setItems(i => i.filter(p => p.id !== draft.id)); setDraft(items[0]); setDirty(false); setPreview(null) }), !draft.id || draft.builtin), dirty && h('span', null, t('dirty'))),
        h('div', { className: 'dta-notice' }, `${t('applied')}: ${selection?.name ?? t('legacy')}`, !capable && h('small', null, t('unavailable'))),
        h('div', { className: 'dta-toolbar' }, button('apply', () => run(async () => { const preset = dirty || !draft.id ? await save() : draft; const data = await api('/selection', 'PUT', { sessionId, id: preset.id }); setSelection(data.selection); setStatus(t('appliedStatus')); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT)) }), !sessionId || !capable, 'primary'), button('reset', () => run(async () => { const data = await api('/selection', 'PUT', { sessionId, id: null }); setSelection(data.selection); setStatus(t('appliedStatus')); window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT)) }), !sessionId || !selection), button('preview', () => run(async () => { const data = await api('/preview', 'POST', { sessionId, preset: draft }); setPreview(data.preview); setTab('expanded') }))),
        button('actual', () => run(actualRequest), !sessionId),
        !sessionId && h('small', null, t('noSession')),
        h('div', { className: 'dta-tabs' }, ...['rules', 'expanded'].map(key => h('button', { key, 'aria-pressed': tab === key, onClick: () => setTab(key) }, t(key)))),
        tab === 'rules' ? h('div', null, h('label', { className: 'dta-toolbar' }, t('placement'), select(draft.placement, ['modules', 'st'], placement => edit({ placement }))), ...draft.rules.map(ruleRow), button('add', () => edit({ rules: [...draft.rules, { id: `custom-${Date.now()}`, kind: 'custom', enabled: true, role: 'system', lifetime: 'request', depth: null, text: '', name: '' }] })))
          : h('div', null, h('div', { className: 'dta-notice' }, t(preview?.actual ? 'actualNotice' : 'previewScope')), !preview ? h('p', null, t('empty')) : h('div', null, ...preview.nodes.map(nodeRow), h('details', null, h('summary', null, `${t('result')} (${preview.messages.length})`), ...preview.messages.map((m, i) => h('div', { key: `${m.id}:${i}`, className: 'dta-child' }, `${i + 1} · ${m.role}`, h('pre', null, (m.content ?? []).map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('\n'))))), preview.diagnostics.length > 0 && h('details', null, h('summary', null, t('diagnostics')), h('pre', null, JSON.stringify(preview.diagnostics, null, 2))))), h('small', { style: { marginTop: 20 } }, t('tools'))))))
}
