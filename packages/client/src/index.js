import {
  createElement as h,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { PresetSidebar, installPresetStyles } from '../../preset/src/client.js'
import { CharacterPanel, installCharacterStyles } from '../../character/src/client.js'
import { TAVERN_MENU_ITEMS } from './state.js'

const API_ROOT = '/dsh-tavern/api'

const css = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;top:14px;right:16px;pointer-events:auto;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.dtv-ball{width:44px;height:44px;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;background:var(--dsw-alias-state-business-primary);box-shadow:var(--ds-shadow-2,0 5px 18px rgba(0,0,0,.22));color:#fff;font-size:17px;font-weight:750;cursor:pointer}.dtv-ball:hover{filter:brightness(1.06)}
.dtv-menu{width:176px;padding:7px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 10px 28px rgba(0,0,0,.22));display:flex;flex-direction:column;gap:4px}
.dtv-menu-title{padding:5px 8px 7px;font-size:11px;font-weight:650;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item{height:36px;border:0;border-radius:8px;padding:0 10px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-available=false]::after{content:'规划中';font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dtv-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:5px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}
`

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

function PanelHeader({ title, close }) {
  return h('div', { className: 'dtv-header' },
    h('div', { className: 'dtv-title' }, title),
    h('button', { className: 'dtv-close', type: 'button', title: `关闭${title}侧边栏`, 'aria-label': `关闭${title}侧边栏`, onClick: close }, '✕'),
  )
}

function WorldInfoPanel({ sessionId, close }) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await activeView(sessionId))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [sessionId])

  useEffect(() => {
    refresh()
    const onRefresh = () => refresh()
    window.addEventListener('dsh-tavern:refresh', onRefresh)
    return () => window.removeEventListener('dsh-tavern:refresh', onRefresh)
  }, [refresh])

  const resources = snapshot?.resources?.worldBooks ?? []
  const selectedStandalone = snapshot?.selection?.worldBookIds ?? []
  const diagnostics = (snapshot?.diagnostics ?? []).filter(item => String(item?.code ?? '').includes('WORLD_BOOK'))

  return h('div', { className: 'dtv-panel' },
    h(PanelHeader, { title: '世界信息（Lorebook）', close }),
    h('div', { className: 'dtv-body' },
      h('div', { className: 'dtv-actions' },
        h('button', { className: 'dtv-button', type: 'button', onClick: refresh }, '刷新运行状态'),
        h('button', { className: 'dtv-button', type: 'button', disabled: true, title: '独立世界信息库将在下一阶段接入' }, '导入（规划中）'),
      ),
      h('p', { className: 'dtv-note' }, `当前会话：${sessionId || '无'}。SillyTavern 的正式功能名是 World Info，Lorebook 是官方认可的常用别名。`),
      h('div', { className: 'dtv-status', 'data-error': error !== '' || undefined, role: 'status' }, error || (snapshot === null ? '正在读取 loader 状态…' : `已连接 ${resources.length} 个世界信息来源。`)),
      resources.length === 0
        ? h('p', { className: 'dtv-note' }, '当前会话没有可用世界信息。绑定含 character_book 的角色卡后，其内嵌条目会自动由 loader 匹配；解绑角色会同时移除该来源。')
        : resources.map(resource => h('div', { className: 'dtv-resource', key: resource.id },
          h('div', { className: 'dtv-resource-title' }, resource.name || '未命名世界信息'),
          h('div', { className: 'dtv-resource-meta' }, `${resource.kind === 'embedded-character-book' ? '角色卡内嵌' : '独立来源'} · ${resource.entryCount ?? 0} 条 · 格式 ${resource.format || 'unknown'}`),
          h('div', { className: 'dtv-resource-meta' }, `本次无会话历史预览激活 ${resource.activeEntryIds?.length ?? 0} 条；实际请求按当时的 durable history 重新匹配。`),
        )),
      selectedStandalone.length > 0 ? h('div', { className: 'dtv-status' }, `已选择 ${selectedStandalone.length} 个独立世界信息 ID，但独立资源库/API 尚未接入，本阶段不会加载这些 ID。`) : null,
      diagnostics.length > 0 ? h('div', { className: 'dtv-resource' },
        h('div', { className: 'dtv-resource-title' }, `运行诊断（${diagnostics.length}）`),
        h('ul', { className: 'dtv-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, item.message))),
      ) : null,
      h('p', { className: 'dtv-note' }, '当前公开 DSH seam 只能扫描已经进入 Session 的 durable user/assistant 历史；刚提交的同轮用户输入可能到下一轮才触发关键词条目。最终发送内容以该轮 request/header 为准。'),
    ),
  )
}

function UserPanel({ close }) {
  return h('div', { className: 'dtv-panel' },
    h(PanelHeader, { title: 'Tavern 用户', close }),
    h('div', { className: 'dtv-body' },
      h('div', { className: 'dtv-status' }, '用户/persona 兼容仍在规划中。此入口先固定统一导航位置，不会向 agent 注入占位文本。'),
      h('p', { className: 'dtv-note' }, '后续应由独立格式 adapter 管理 persona 数据，再由统一 loader 决定它与 DSH agent persona、角色卡和预设的覆盖关系。'),
    ),
  )
}

function TavernShell({ useSessions }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [surface, setSurface] = useState(null)
  const sessionId = useSessions(state => state.current)
  const sessionBlank = useSessions(state => state.current === undefined || state.current === null ? true : state.byId?.[state.current]?.blank === true)
  const close = () => setSurface(null)

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
      autoOpen: false,
    }))
  } else if (surface === 'character') {
    panel = h(CharacterPanel, { sessionId, sessionBlank, close })
  } else if (surface === 'world-info') {
    panel = h(WorldInfoPanel, { sessionId, close })
  } else if (surface === 'user') {
    panel = h(UserPanel, { close })
  }

  return h('div', { className: 'dtv-layer' },
    panel,
    surface === null ? h('div', { className: 'dtv-launcher' },
      h('button', {
        className: 'dtv-ball',
        type: 'button',
        title: '打开 Tavern 资源菜单',
        'aria-label': '打开 Tavern 资源菜单',
        'aria-expanded': menuOpen,
        onClick: () => setMenuOpen(value => !value),
      }, 'T'),
      menuOpen ? h('div', { className: 'dtv-menu', role: 'menu' },
        h('div', { className: 'dtv-menu-title' }, 'dsh-tavern'),
        ...TAVERN_MENU_ITEMS.map(item => h('button', {
          className: 'dtv-menu-item',
          type: 'button',
          role: 'menuitem',
          key: item.id,
          'data-available': item.available,
          onClick: () => open(item.id),
        }, item.label)),
      ) : null,
    ) : null,
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
export const inject = ['slots', 'layout']

export function apply(ctx) {
  installPresetStyles()
  installCharacterStyles()
  installStyles()
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-tavern-launcher',
    order: 80,
    inject: () => ({}),
  }, TavernShell))
}
