import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  DEFAULT_UI_SETTINGS,
  UI_LOCALES,
  UI_SCALE_OPTIONS,
  createLocalizedElement,
  getClientUiSettings,
  rawText,
  setClientUiSettings,
  translate,
  translateVisibleText,
  uiMessage,
  uiText,
  unwrapText,
} from './i18n.js'
import { PresetSidebar, installPresetStyles } from '../../preset/src/client.js'
import { CharacterPanel, installCharacterStyles } from '../../character/src/client.js'
import { WorldBookPanel, installWorldBookStyles } from '../../world-book-library/src/client.js'
import { UserPanel, installUserStyles } from '../../user/src/client.js'
import { installTavernTraceStyles, registerTavernTraceView } from '../../tavern-trace/src/client.js'
import { SessionTemplatePanel } from '../../session-template/src/client.js'
import {
  createCleanSessionWorkflow,
  workspaceTargetId,
} from '../../session-template/src/client-state.js'
import {
  TAVERN_MENU_ITEMS,
  clampLauncherAnchor,
  launcherPlacement,
  launcherResourceStatuses,
} from './state.js'

const h = createLocalizedElement(createElement)

const API_ROOT = '/dsh-tavern/api'

const css = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true]{width:300px;height:376px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
.dtv-ball{pointer-events:auto;touch-action:none;user-select:none;width:44px;height:44px;flex:none;border:2px solid #fff;border-radius:50%;background:conic-gradient(from 225deg,#090909 0 56%,#b31319 56% 100%);box-shadow:0 0 0 2px #a50f16,0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28);color:#fff;font-size:13px;letter-spacing:-.5px;font-weight:850;text-shadow:0 1px 2px #000;cursor:grab;transition:filter .15s ease,transform .18s ease,box-shadow .18s ease}.dtv-ball:hover{filter:brightness(1.1);box-shadow:0 0 0 2px #d5222b,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82) rotate(-8deg)}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;transform:translateY(-6px);transition:opacity .13s ease .1s,transform .18s ease .08s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;transform:none}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{padding:5px 8px 7px;font-size:11px;font-weight:650;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtv-menu-item{min-height:43px;border:0;border-radius:9px;padding:5px 8px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-binding-dot{width:8px;height:8px;border-radius:50%;background:#d33239;box-shadow:0 0 0 1px rgba(98,0,4,.38)}.dtv-menu-item[data-bound=true] .dtv-binding-dot{background:#44d17a;box-shadow:0 0 5px #31c66b,0 0 10px rgba(49,198,107,.75)}.dtv-item-copy{min-width:0;display:flex;flex-direction:column;gap:1px}.dtv-item-label{font-size:11px;font-weight:700;line-height:1.2}.dtv-item-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.25;color:var(--dsw-alias-label-tertiary)}.dtv-item-count{border-radius:10px;padding:2px 6px;background:var(--dsw-specific-tip);font-size:9px;color:var(--dsw-alias-label-secondary)}.dtv-item-planned{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item[data-show-binding=false] .dtv-binding-dot{visibility:hidden}
.dtv-panel{position:absolute;z-index:1;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-primary{background:var(--dsw-alias-button-primary-fill,#2677d9);border-color:transparent;color:var(--dsw-alias-button-primary-label,#fff)}.dtv-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-button-primary-fill,#2677d9)}.dtv-template-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.dtv-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-specific-tip);padding:9px;display:flex;flex-direction:column;gap:6px}.dtv-preview-title{font-size:12px;font-weight:700}.dtv-preview-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.45}.dtv-preview-label{color:var(--dsw-alias-label-tertiary)}.dtv-preview-value{overflow-wrap:anywhere}.dtv-preview-options{margin-left:120px;display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.dtv-preview-list{margin:0;padding-left:18px}.dtv-preview-row[data-missing=true] .dtv-preview-value,.dtv-preview-list>[data-missing=true]{color:var(--dsw-alias-state-error)}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
.dtv-layer>.dtv-launcher,.dtv-layer>.dtv-panel,.dtv-layer>.dcc-panel,.dtv-layer>.dwb-panel,.dtv-layer>.dtu-panel{zoom:var(--dtv-ui-scale,1)}.dtv-setting-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
`

const LAUNCHER_STORAGE_KEY = 'dsh-tavern:launcher-position:v1'

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight }
}

function initialLauncherAnchor() {
  try {
    const stored = window.localStorage.getItem(LAUNCHER_STORAGE_KEY)
    if (stored !== null) return clampLauncherAnchor(JSON.parse(stored), viewport())
  } catch {
    // Fall through to the default when stored state is missing or malformed.
  }
  return clampLauncherAnchor({ x: window.innerWidth - 60, y: 14 }, viewport())
}

function persistLauncherAnchor(anchor) {
  try {
    window.localStorage.setItem(LAUNCHER_STORAGE_KEY, JSON.stringify(anchor))
  } catch {
    // A restricted browser storage policy must not disable the launcher.
  }
}

async function activeView(sessionId) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  const response = await fetch(`${API_ROOT}/active${query}`)
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message
    throw new Error(message ?? `HTTP ${response.status}`)
  }
  return data
}

async function sessionConfigurationRequest(path, body) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`)
    error.diagnostics = data?.error?.diagnostics ?? []
    throw error
  }
  return data
}

async function uiSettingsRequest(method = 'GET', body) {
  const response = await fetch(`${API_ROOT}/ui-settings`, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`)
  return data.settings
}

function PanelHeader({ title, close }) {
  return h('div', { className: 'dtv-header' },
    h('div', { className: 'dtv-title' }, title),
    h('button', { className: 'dtv-close', type: 'button', title: uiText`关闭${translateVisibleText(title)}侧边栏`, 'aria-label': uiText`关闭${translateVisibleText(title)}侧边栏`, onClick: close }, '✕'),
  )
}

function Field({ label, children }) {
  return h('label', { className: 'dtv-field' }, h('span', { className: 'dtv-label' }, label), children)
}

function SettingsPanel({ settings, status, busy, close, update, reset }) {
  const percent = Math.round(settings.scale * 100)
  return h('div', { className: 'dtv-panel' },
    h('div', { className: 'dtv-header' },
      h('div', { className: 'dtv-title' }, translate('settings.title')),
      h('button', { className: 'dtv-close', type: 'button', title: translate('settings.close'), 'aria-label': translate('settings.close'), onClick: close }, '✕'),
    ),
    h('div', { className: 'dtv-body' },
      h(Field, { label: translate('settings.language') }, h('select', {
        className: 'dtv-select',
        value: settings.locale,
        disabled: busy,
        onChange: event => update({ ...settings, locale: event.target.value }),
      },
      ...UI_LOCALES.map(locale => h('option', { key: locale.id, value: locale.id }, rawText(locale.nativeName))))),
      h(Field, { label: translate('settings.scale') }, h('select', {
        className: 'dtv-select',
        value: settings.scale,
        disabled: busy,
        onChange: event => update({ ...settings, scale: Number(event.target.value) }),
      }, ...UI_SCALE_OPTIONS.map(scale => h('option', { key: scale, value: scale }, `${Math.round(scale * 100)}%`)))),
      h('div', { className: 'dtv-setting-value' }, translate('settings.currentScale', { scale: percent })),
      h('p', { className: 'dtv-note' }, translate('settings.scale.help')),
      h('div', { className: 'dtv-status', 'data-error': status.error || undefined, role: 'status' }, rawText(status.text)),
      h('div', { className: 'dtv-actions' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: reset }, translate('settings.reset')),
      ),
    ),
  )
}

function keyLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function parseKeyLines(value) {
  return String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

function entryPosition(entry) {
  const value = entry?.extensions?.position
  if (Number.isInteger(value) && value >= 0 && value <= 7) return value
  return entry?.position === 'before_char' ? 0 : 1
}

function triggerSummary(entry) {
  if (entry.enabled !== true) return '已禁用'
  if (entry.constant === true) return '常驻'
  const keys = Array.isArray(entry.keys) ? entry.keys.filter(Boolean) : []
  if (keys.length === 0) return '无主关键词'
  const secondary = Array.isArray(entry.secondary_keys) ? entry.secondary_keys.filter(Boolean) : []
  const logic = entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any'
  return entry.selective === true && secondary.length > 0
    ? uiText`关键词：${keys.join('、')} · ${logic}：${secondary.join('、')}`
    : uiText`关键词：${keys.join('、')}`
}

function WorldInfoEntryEditor({ entry, index, update, remove }) {
  const patch = change => update(index, change)
  const position = entryPosition(entry)
  return h('details', { className: 'dtv-entry', 'data-enabled': entry.enabled === true },
    h('summary', null,
      h('span', { className: 'dtv-entry-dot', 'aria-hidden': 'true' }),
      h('span', { className: 'dtv-entry-name' }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiText`条目 ${String(entry.id ?? index + 1)}`),
      h('span', { className: 'dtv-entry-state' }, triggerSummary(entry)),
    ),
    h('div', { className: 'dtv-entry-body' },
      h('div', { className: 'dtv-checks' },
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), '启用'),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), '常驻'),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.selective === true, onChange: event => patch({ selective: event.target.checked }) }), '使用附加关键词'),
      ),
      h(Field, { label: '条目名称 / 备注' }, h('input', { className: 'dtv-input', value: entry.comment ?? entry.name ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { label: '主关键词（每行一个；任一命中）' }, h('textarea', { className: 'dtv-textarea', value: keyLines(entry.keys), onChange: event => patch({ keys: parseKeyLines(event.target.value) }) })),
        h(Field, { label: '附加关键词（每行一个）' }, h('textarea', { className: 'dtv-textarea', value: keyLines(entry.secondary_keys), disabled: entry.selective !== true, onChange: event => patch({ secondary_keys: parseKeyLines(event.target.value) }) })),
      ),
      entry.selective === true ? h(Field, { label: '附加关键词逻辑' }, h('select', {
        className: 'dtv-select',
        value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any',
        onChange: event => patch({ selectiveLogic: event.target.value, extensions: { ...(entry.extensions ?? {}), selectiveLogic: event.target.value } }),
      },
      h('option', { value: 'and_any' }, 'AND ANY：命中任一'),
      h('option', { value: 'and_all' }, 'AND ALL：命中全部'),
      h('option', { value: 'not_any' }, 'NOT ANY：不能命中任一'),
      h('option', { value: 'not_all' }, 'NOT ALL：不能全部命中'))) : null,
      h(Field, { label: '条目内容（触发后注入 system profile）' }, h('textarea', { className: 'dtv-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { label: '插入位置' }, h('select', {
          className: 'dtv-select',
          value: position,
          onChange: event => {
            const next = Number(event.target.value)
            patch({
              position: next === 0 ? 'before_char' : next === 1 ? 'after_char' : entry.position,
              extensions: { ...(entry.extensions ?? {}), position: next },
            })
          },
        },
        h('option', { value: 0 }, '角色定义之前'),
        h('option', { value: 1 }, '角色定义之后'),
        h('option', { value: 2 }, '作者注释之前（近似）'),
        h('option', { value: 3 }, '作者注释之后（近似）'),
        h('option', { value: 4 }, '指定深度（近似）'),
        h('option', { value: 5 }, '示例消息之前（近似）'),
        h('option', { value: 6 }, '示例消息之后（近似）'),
        h('option', { value: 7 }, 'Outlet（当前不注入）'))),
        h(Field, { label: '排序权重' }, h('input', { className: 'dtv-input', type: 'number', value: entry.insertion_order ?? 100, onChange: event => patch({ insertion_order: Number(event.target.value) }) })),
      ),
      h('div', { className: 'dtv-checks' },
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: event => patch({ case_sensitive: event.target.checked, extensions: { ...(entry.extensions ?? {}), case_sensitive: event.target.checked } }) }), '区分大小写'),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: event => patch({ match_whole_words: event.target.checked, extensions: { ...(entry.extensions ?? {}), match_whole_words: event.target.checked } }) }), '全词匹配'),
      ),
      h('div', { className: 'dtv-entry-actions' }, h('button', { className: 'dtv-button dtv-danger', type: 'button', onClick: () => remove(index) }, '删除条目')),
    ),
  )
}

function WorldInfoPanel({ sessionId, close }) {
  const [snapshot, setSnapshot] = useState(null)
  const [characterId, setCharacterId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await activeView(sessionId)
      const nextCharacterId = next.resources?.characterCard?.id ?? null
      let nextBook = null
      if (nextCharacterId !== null) {
        const response = await fetch(`${API_ROOT}/characters/${encodeURIComponent(nextCharacterId)}`)
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.ok === false) throw new Error(data?.error?.message ?? `HTTP ${response.status}`)
        nextBook = data.character?.data?.characterBook ?? null
      }
      setSnapshot(next)
      setCharacterId(nextCharacterId)
      setDraft(nextBook === null ? null : structuredClone(nextBook))
      setDirty(false)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [sessionId])

  useEffect(() => {
    refresh()
    const onRefresh = () => refresh()
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => {
      window.removeEventListener('dsh-tavern:refresh', onRefresh)
    }
  }, [refresh])

  const resources = snapshot?.resources?.worldBooks ?? []
  const selectedStandalone = snapshot?.selection?.worldBookIds ?? []
  const diagnostics = (snapshot?.diagnostics ?? []).filter(item => String(item?.code ?? '').includes('WORLD_BOOK'))
  const entries = Array.isArray(draft?.entries) ? draft.entries : []

  const updateEntry = (index, patch) => {
    setDraft(current => {
      const next = structuredClone(current)
      next.entries[index] = { ...next.entries[index], ...patch }
      return next
    })
    setDirty(true)
  }

  const addEntry = () => {
    const numericIds = entries.map(entry => Number(entry.id)).filter(Number.isSafeInteger)
    const id = numericIds.length === 0 ? 0 : Math.max(...numericIds) + 1
    setDraft(current => ({
      ...structuredClone(current),
      entries: [...current.entries, {
        id,
        keys: [],
        secondary_keys: [],
        comment: unwrapText(uiText`新条目 ${id}`),
        content: '',
        enabled: true,
        insertion_order: 100,
        constant: false,
        selective: false,
        position: 'after_char',
        extensions: { position: 1, probability: 100 },
      }],
    }))
    setDirty(true)
  }

  const removeEntry = index => {
    if (!window.confirm(unwrapText(uiMessage('world.confirmDeleteInfoEntry')))) return
    setDraft(current => ({ ...structuredClone(current), entries: current.entries.filter((_entry, itemIndex) => itemIndex !== index) }))
    setDirty(true)
  }

  const save = async () => {
    if (characterId === null || draft === null) return
    setBusy(true)
    try {
      const response = await fetch(`${API_ROOT}/characters/${encodeURIComponent(characterId)}/world-book`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterBook: draft }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) throw new Error(data?.error?.message ?? `HTTP ${response.status}`)
      setDraft(structuredClone(data.character.data.characterBook))
      setDirty(false)
      setError('')
      window.dispatchEvent(new Event('dsh-tavern:refresh'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return h('div', { className: 'dtv-panel' },
    h(PanelHeader, { title: '世界信息（Lorebook）', close }),
    h('div', { className: 'dtv-body' },
      h('div', { className: 'dtv-book-toolbar' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage('world.confirmReloadInfo')))) refresh()
        } }, '重新载入'),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy || draft === null, onClick: addEntry }, '新增条目'),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy || !dirty, onClick: save }, dirty ? '保存修改' : '已保存'),
      ),
      h('p', { className: 'dtv-note' }, uiText`当前会话：${sessionId || translateVisibleText('无')}。SillyTavern 的正式功能名是 World Info，Lorebook 是官方认可的常用别名。`),
      h('div', { className: 'dtv-status', 'data-error': error !== '' || undefined, role: 'status' }, error ? rawText(error) : snapshot === null ? '正在读取世界信息…' : dirty ? '有尚未保存的条目修改。' : uiText`已载入 ${entries.length} 个条目。`),
      draft === null
        ? h('p', { className: 'dtv-note' }, '当前会话没有可用世界信息。绑定含 character_book 的角色卡后，其内嵌条目会自动由 loader 匹配；解绑角色会同时移除该来源。')
        : h('div', { className: 'dtv-resource' },
          h('div', { className: 'dtv-resource-title' }, draft.name || resources[0]?.name ? rawText(draft.name || resources[0]?.name) : '角色卡内嵌世界信息'),
          h('div', { className: 'dtv-resource-meta' }, uiText`角色卡内嵌 · ${entries.length} 条。折叠标题直接显示该条目的触发方式；展开后可编辑关键词、逻辑、内容、位置和排序。`),
          ...entries.map((entry, index) => h(WorldInfoEntryEditor, { key: `${entry.id ?? 'entry'}-${index}`, entry, index, update: updateEntry, remove: removeEntry })),
        ),
      selectedStandalone.length > 0 ? h('div', { className: 'dtv-status' }, uiText`已选择 ${selectedStandalone.length} 个独立世界信息 ID，但独立资源库/API 尚未接入，本阶段不会加载这些 ID。`) : null,
      diagnostics.length > 0 ? h('div', { className: 'dtv-resource' },
        h('div', { className: 'dtv-resource-title' }, uiText`运行诊断（${diagnostics.length}）`),
        h('ul', { className: 'dtv-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(item.message)))),
      ) : null,
      h('p', { className: 'dtv-note' }, '保存会更新插件保存的角色卡副本及其 JSON 导出；为避免破坏签名或图片数据，最初导入的 PNG/JSON artifact 仍保持不变。matcher 会在首次请求组装前把本步骤 claimed 输入与 Session 历史组合扫描，不会向历史写入副本。'),
    ),
  )
}

function TavernShell({ useSessions, useWorkspaces, createCleanSession }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [surface, setSurface] = useState(null)
  const [anchor, setAnchor] = useState(initialLauncherAnchor)
  const [activeSnapshot, setActiveSnapshot] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [uiSettings, setUiSettings] = useState(getClientUiSettings)
  const [settingsStatus, setSettingsStatus] = useState({ text: translate('settings.saved'), error: false })
  const [settingsBusy, setSettingsBusy] = useState(false)
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const statusGeneration = useRef(0)
  const sessionId = useSessions(state => state.current)
  const sessionBlank = useSessions(state => state.current === undefined || state.current === null ? true : state.byId?.[state.current]?.blank === true)
  const workspaceId = useWorkspaces(state => workspaceTargetId(state, sessionId))
  const close = () => setSurface(null)

  useEffect(() => {
    let active = true
    uiSettingsRequest().then(next => {
      if (!active) return
      const normalized = setClientUiSettings(next)
      setUiSettings(normalized)
      setSettingsStatus({ text: translate('settings.saved'), error: false })
    }).catch(reason => {
      if (!active) return
      setSettingsStatus({ text: translate('settings.loadError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    })
    return () => { active = false }
  }, [])

  const persistSettings = async next => {
    const previous = uiSettings
    const normalized = setClientUiSettings(next)
    setUiSettings(normalized)
    setSettingsBusy(true)
    setSettingsStatus({ text: translate('settings.saving'), error: false })
    try {
      const saved = setClientUiSettings(await uiSettingsRequest('PUT', normalized))
      setUiSettings(saved)
      setSettingsStatus({ text: translate('settings.saved'), error: false })
    } catch (reason) {
      setClientUiSettings(previous)
      setUiSettings(previous)
      setSettingsStatus({ text: translate('settings.saveError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    } finally {
      setSettingsBusy(false)
    }
  }

  const resetSettings = async () => {
    const previous = uiSettings
    const defaults = setClientUiSettings(DEFAULT_UI_SETTINGS)
    setUiSettings(defaults)
    setSettingsBusy(true)
    setSettingsStatus({ text: translate('settings.saving'), error: false })
    try {
      const saved = setClientUiSettings(await uiSettingsRequest('DELETE'))
      setUiSettings(saved)
      setSettingsStatus({ text: translate('settings.saved'), error: false })
    } catch (reason) {
      setClientUiSettings(previous)
      setUiSettings(previous)
      setSettingsStatus({ text: translate('settings.saveError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    } finally {
      setSettingsBusy(false)
    }
  }

  const refreshStatus = useCallback(async () => {
    const generation = ++statusGeneration.current
    try {
      const next = await activeView(sessionId)
      if (generation !== statusGeneration.current) return
      setActiveSnapshot(next)
      setStatusError('')
    } catch (reason) {
      if (generation !== statusGeneration.current) return
      setStatusError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [sessionId])

  useEffect(() => {
    statusGeneration.current += 1
    setActiveSnapshot(null)
    setStatusError('')
    refreshStatus()
    return () => { statusGeneration.current += 1 }
  }, [refreshStatus, sessionId])

  useEffect(() => {
    const onRefresh = () => refreshStatus()
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => window.removeEventListener('dsh-tavern:refresh', onRefresh)
  }, [refreshStatus])

  useEffect(() => {
    const onResize = () => setAnchor(current => {
      const next = clampLauncherAnchor(current, viewport(), uiSettings.scale)
      persistLauncherAnchor(next)
      return next
    })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [uiSettings.scale])

  useEffect(() => {
    setAnchor(current => {
      const next = clampLauncherAnchor(current, viewport(), uiSettings.scale)
      persistLauncherAnchor(next)
      return next
    })
  }, [uiSettings.scale])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      if (menuOpen) setMenuOpen(false)
      else if (surface !== null) setSurface(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, surface])

  const startDrag = event => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: anchor,
      latest: anchor,
      moved: false,
    }
  }

  const moveDrag = event => {
    if (drag.current?.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.current.startX
    const dy = event.clientY - drag.current.startY
    if (Math.hypot(dx, dy) >= 4) drag.current.moved = true
    if (!drag.current.moved) return
    const next = clampLauncherAnchor({
      x: drag.current.origin.x + dx,
      y: drag.current.origin.y + dy,
    }, viewport(), uiSettings.scale)
    drag.current.latest = next
    setAnchor(next)
  }

  const endDrag = event => {
    if (drag.current?.pointerId !== event.pointerId) return
    if (drag.current.moved) {
      suppressClick.current = true
      persistLauncherAnchor(drag.current.latest)
    }
    drag.current = null
  }

  const toggleMenu = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setMenuOpen(value => !value)
  }

  const open = id => {
    setMenuOpen(false)
    setSurface(id)
    window.dispatchEvent(new Event('dsh-tavern:refresh'))
  }

  let panel = null
  if (surface === 'preset') {
    panel = h('div', { className: 'dtv-panel' }, h(PresetSidebar, {
      closePanel: close,
      openPanel: () => {},
      sessionId,
      sessionBlank,
      autoOpen: false,
    }))
  } else if (surface === 'character') {
    panel = h(CharacterPanel, { sessionId, sessionBlank, close })
  } else if (surface === 'world-info') {
    panel = h(WorldBookPanel, { sessionId, close })
  } else if (surface === 'user') {
    panel = h(UserPanel, { sessionId, sessionBlank, close })
  } else if (surface === 'session-template') {
    panel = h(SessionTemplatePanel, { sessionId, workspaceId, createCleanSession, close })
  } else if (surface === 'settings') {
    panel = h(SettingsPanel, {
      settings: uiSettings,
      status: settingsStatus,
      busy: settingsBusy,
      close,
      update: persistSettings,
      reset: resetSettings,
    })
  }

  const placement = launcherPlacement(anchor, viewport(), menuOpen, uiSettings.scale)
  const statuses = launcherResourceStatuses(activeSnapshot)

  return h('div', { className: 'dtv-layer', lang: uiSettings.locale, 'data-surface-open': surface !== null, style: { '--dtv-ui-scale': uiSettings.scale } },
    panel,
    h('div', {
      className: 'dtv-launcher',
      'data-open': menuOpen,
      'data-side': placement.side,
      'data-vertical': placement.vertical,
      style: { left: placement.left / uiSettings.scale, top: placement.top / uiSettings.scale },
    },
      h('div', { className: 'dtv-ball-row' }, h('button', {
          className: 'dtv-ball',
          type: 'button',
          title: '拖动可移动；点击展开 Tavern 资源面板',
          'aria-label': '拖动可移动；点击展开 Tavern 资源面板',
          'aria-expanded': menuOpen,
          onPointerDown: startDrag,
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClick: toggleMenu,
        }, 'DT')),
      menuOpen ? h('div', { className: 'dtv-menu', role: 'menu' },
        h('div', { className: 'dtv-menu-title', 'aria-live': 'polite' }, statusError === '' ? uiText`Tavern · ${sessionId || translateVisibleText('无会话')}` : uiText`状态同步失败：${statusError}`),
        ...TAVERN_MENU_ITEMS.map(item => {
          const status = statuses[item.id] ?? { bound: false, count: 0, title: item.emptyTitle }
          const itemLabel = translateVisibleText(item.label)
          const statusTitle = status.bound ? status.title : translateVisibleText(status.title)
          const stateLabel = item.binding === false ? '' : translateVisibleText(status.bound ? '已绑定' : '未绑定')
          const titleText = stateLabel
            ? uiText`${itemLabel}：${statusTitle}（${stateLabel}）`
            : uiText`${itemLabel}：${statusTitle}`
          const ariaText = stateLabel
            ? uiText`${itemLabel}，${statusTitle}，${stateLabel}`
            : uiText`${itemLabel}，${statusTitle}`
          return h('button', {
            className: 'dtv-menu-item',
            type: 'button',
            role: 'menuitem',
            key: item.id,
            title: titleText,
            'data-available': item.available,
            'data-active': surface === item.id,
            'data-bound': item.binding === false ? undefined : status.bound,
            'data-show-binding': item.binding !== false && item.showBinding !== false,
            'aria-current': surface === item.id ? 'page' : undefined,
            'aria-label': ariaText,
            onClick: () => open(item.id),
          },
          item.binding === false ? h('span', { 'aria-hidden': 'true' }) : h('span', { className: 'dtv-binding-dot', 'aria-hidden': 'true' }),
          h('span', { className: 'dtv-item-copy' },
            h('span', { className: 'dtv-item-label' }, item.label),
            h('span', { className: 'dtv-item-status' }, status.bound ? rawText(status.title) : status.title),
          ),
          status.count > 1
            ? h('span', { className: 'dtv-item-count', 'aria-label': uiText`${status.count} 本` }, uiText`${status.count} 本`)
            : item.available ? null : h('span', { className: 'dtv-item-planned' }, '规划中'),
          )
        }),
      ) : null,
    ),
  )
}

function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-shell"]') !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-tavern-shell'
  style.textContent = css
  document.head.append(style)
}

export const name = 'dsh-tavern'
export const inject = ['slots', 'layout', 'sessions', 'workspaces']

export function apply(ctx) {
  installPresetStyles()
  installCharacterStyles()
  installWorldBookStyles()
  installUserStyles()
  installTavernTraceStyles()
  installStyles()
  registerTavernTraceView(ctx)
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-tavern-launcher',
    order: 80,
    inject: () => ({
      createCleanSession: ({ workspaceId, source }) => createCleanSessionWorkflow({
        workspaceId,
        source,
        preview: selectedSource => sessionConfigurationRequest('/session-configurations/preview', { source: selectedSource }),
        connectWorkspace: id => ctx.workspaces.connectWorkspace(id),
        applySelection: (targetSessionId, selectedSource) => sessionConfigurationRequest('/session-configurations/apply', {
          targetSessionId,
          source: selectedSource,
        }),
        openSession: id => ctx.sessions.open(id),
        refresh: () => window.dispatchEvent(new Event('dsh-tavern:refresh')),
      }),
    }),
  }, TavernShell))
}
