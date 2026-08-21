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
  uiMessage,
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
  createConfiguredPlaythroughWorkflow,
  workspaceTargetId,
} from '../../session-template/src/client-state.js'
import {
  TAVERN_MENU_ITEMS,
  clampLauncherAnchor,
  launcherPlacement,
  launcherResourceStatuses,
} from './state.js'
import { createChromeClickController } from './play/chrome.js'
import { installPlaySlotOccupancy } from './play/occupancy.js'
import { createLivePlayClient } from './play/live.js'
import { sessionHasConversationHistory } from './play/chat-model.js'
import { RegexPanel } from './play/regex-panel.js'
import { projectRpWorkspaceSetting, workspaceSelectionRequest } from './play/workspace-setting.js'
import { requiresSystemWorkspaceConfirmation } from './play/sidebar-model.js'
import { createChromeModeServiceCore } from './play/chrome-service.js'
import { startChromeModeTransport } from './play/chrome-transport.js'
import { createPlaythroughController } from './play/create.js'
import { API_V1 as API_ROOT, CHROME_SERVICE_NAME, CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../identity.js'

const h = createLocalizedElement(createElement)

const css = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true] .dtv-menu{overflow-y:auto}
.dtv-launcher[data-open=true]{width:300px;height:376px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
@property --dtv-orb-a{syntax:"<color>";inherits:true;initial-value:#f7fbff}@property --dtv-orb-b{syntax:"<color>";inherits:true;initial-value:#18569d}@property --dtv-orb-ring{syntax:"<color>";inherits:true;initial-value:#174e8a}
.dtv-ball{--dtv-orb-a:#f7fbff;--dtv-orb-b:#18569d;--dtv-orb-ring:#174e8a;pointer-events:auto;touch-action:none;user-select:none;position:relative;isolation:isolate;overflow:hidden;width:44px;height:44px;flex:none;border:2px solid #fff;border-radius:50%;background:transparent;box-shadow:0 0 0 2px var(--dtv-orb-ring),0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28);color:#fff;font-size:13px;letter-spacing:-.5px;font-weight:850;text-shadow:0 1px 2px #000;cursor:grab;transition:filter .15s ease,transform .18s ease,box-shadow .18s ease,--dtv-orb-a .32s ease,--dtv-orb-b .32s ease,--dtv-orb-ring .32s ease}.dtv-ball-face{position:absolute;inset:0;border-radius:inherit;background:conic-gradient(from 225deg,var(--dtv-orb-a) 0 50%,var(--dtv-orb-b) 50% 100%);z-index:-1}.dtv-ball-face[data-animate=true]{animation:dtv-orb-switch .48s cubic-bezier(.3,.7,.2,1)}.dtv-ball-label{position:relative;z-index:1}.dtv-ball:hover{filter:brightness(1.1);box-shadow:0 0 0 2px #2675c9,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-layer[data-chrome=play] .dtv-ball{--dtv-orb-a:#090909;--dtv-orb-b:#b31319;--dtv-orb-ring:#a50f16}.dtv-layer[data-chrome=play] .dtv-ball:hover{box-shadow:0 0 0 2px #d5222b,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82) rotate(-8deg)}
@keyframes dtv-orb-switch{to{transform:rotate(1turn)}}@media (prefers-reduced-motion:reduce){.dtv-ball{transition:filter .15s ease,transform .18s ease,box-shadow .18s ease}.dtv-ball-face[data-animate=true]{animation:none}}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-6px);transition:opacity .12s ease,transform .18s ease,visibility 0s linear .18s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:.22s,.16s,.22s}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{flex:none;padding:5px 8px 7px;font-size:11px;line-height:1.35;font-weight:650;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtv-menu-item{min-height:43px;border:0;border-radius:9px;padding:5px 8px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-binding-dot{width:8px;height:8px;border-radius:50%;background:#d33239;box-shadow:0 0 0 1px rgba(98,0,4,.38)}.dtv-menu-item[data-bound=true] .dtv-binding-dot{background:#44d17a;box-shadow:0 0 5px #31c66b,0 0 10px rgba(49,198,107,.75)}.dtv-item-copy{min-width:0;display:flex;flex-direction:column;gap:1px}.dtv-item-label{font-size:11px;font-weight:700;line-height:1.2}.dtv-item-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.25;color:var(--dsw-alias-label-tertiary)}.dtv-item-count{border-radius:10px;padding:2px 6px;background:var(--dsw-specific-tip);font-size:9px;color:var(--dsw-alias-label-secondary)}.dtv-item-planned{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item[data-show-binding=false] .dtv-binding-dot{visibility:hidden}
.dtv-panel{position:absolute;z-index:1;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-primary{background:var(--dsw-alias-state-business-primary,#2677d9);border-color:transparent;color:var(--dsw-alias-button-primary-label,#fff)}.dtv-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-state-business-primary,#2677d9)}.dtv-template-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.dtv-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-specific-tip);padding:9px;display:flex;flex-direction:column;gap:6px}.dtv-preview-title{font-size:12px;font-weight:700}.dtv-preview-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.45}.dtv-preview-label{color:var(--dsw-alias-label-tertiary)}.dtv-preview-value{overflow-wrap:anywhere}.dtv-preview-options{margin-left:120px;display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.dtv-preview-list{margin:0;padding-left:18px}.dtv-preview-row[data-missing=true] .dtv-preview-value,.dtv-preview-list>[data-missing=true]{color:var(--dsw-alias-state-error)}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-policy{min-height:96px}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
.dtv-layer>.dtv-launcher,.dtv-layer>.dtv-panel,.dtv-layer>.dcc-panel,.dtv-layer>.dwb-panel,.dtv-layer>.dtu-panel{zoom:var(--dtv-ui-scale,1)}.dtv-setting-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dtv-modal-backdrop{position:absolute;inset:0;z-index:20;pointer-events:auto;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:24px}
.dtv-regex-panel .dtv-body{flex:1 1 auto;overscroll-behavior:contain}.dtv-regex-section{gap:8px}.dtv-regex-section-title{display:flex;align-items:center;gap:8px}.dtv-regex-section-title .dtv-item-count{margin-left:auto}.dtv-regex-rule{transition:border-color .12s,box-shadow .12s}.dtv-regex-rule[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtv-regex-rule[data-dragging=true]>*{opacity:0}.dtv-regex-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:12px;font-weight:600;pointer-events:none}.dtv-regex-drag{flex:none;border:0;background:transparent;cursor:grab;color:var(--dsw-alias-label-tertiary);padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtv-regex-drag:active{cursor:grabbing}.dtv-regex-drag:disabled{cursor:default;opacity:.5}.dtv-regex-rule .dtv-input:disabled,.dtv-regex-rule .dtv-select:disabled,.dtv-regex-rule .dtv-textarea:disabled{pointer-events:none}.dtv-regex-expression{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);min-height:72px}.dtv-regex-footer{position:sticky;bottom:-12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 0 12px;background:var(--dsw-alias-bg-base)}
.dtv-modal{width:min(420px,100%);border-radius:12px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,0 16px 40px rgba(0,0,0,.28));padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.dtv-modal-body{margin:0;font-size:13px;line-height:1.55}.dtv-modal .dtv-button{align-self:flex-end;min-width:88px}
`

const LAUNCHER_STORAGE_KEY = `${PLUGIN_ID}:launcher-position:v1`

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

async function rpAlertRequest(sessionId, { method = 'GET', id } = {}) {
  const params = new URLSearchParams({ sessionId })
  if (id !== undefined) params.set('id', String(id))
  const mutating = method !== 'GET' && method !== 'HEAD'
  const response = await fetch(`${API_ROOT}/rp-alert?${params}`, {
    method,
    headers: mutating ? { 'Content-Type': 'application/json' } : undefined,
    body: mutating ? '{}' : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`)
  return data
}

async function rpPolicyRequest(method = 'GET', body) {
  const response = await fetch(`${API_ROOT}/rp-policy`, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`)
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

function PanelHeader({ title, titleKey, close }) {
  const titleText = titleKey ? uiMessage(titleKey) : title
  const closeLabel = uiMessage('panel.close', { title: unwrapText(titleText) })
  return h('div', { className: 'dtv-header' },
    h('div', { className: 'dtv-title' }, titleText),
    h('button', { className: 'dtv-close', type: 'button', title: closeLabel, 'aria-label': closeLabel, onClick: close }, '✕'),
  )
}

function Field({ label, children }) {
  return h('label', { className: 'dtv-field' }, h('span', { className: 'dtv-label' }, label), children)
}

function SettingsPanel({
  settings,
  status,
  busy,
  close,
  update,
  reset,
  policyDraft,
  policyBusy,
  policyLoaded,
  onPolicyDraft,
  savePolicy,
  resetPolicy,
  workspaceSetting,
  workspaceBusy,
  selectWorkspace,
}) {
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
      h('label', { className: 'dtv-check' },
        h('input', {
          type: 'checkbox',
          checked: settings.rpFollowCharacter !== false,
          disabled: busy,
          onChange: event => update({ ...settings, rpFollowCharacter: event.target.checked }),
        }),
        h('span', null, translate('settings.rpFollow')),
      ),
      h('p', { className: 'dtv-note' }, translate('settings.rpFollow.help')),
      h(Field, { label: translate('settings.rpWorkspace') }, h('select', {
        className: 'dtv-select',
        value: workspaceSetting?.selectedPath ?? '',
        disabled: busy || workspaceBusy || workspaceSetting === null,
        onChange: event => selectWorkspace(event.target.value),
      },
      workspaceSetting?.current === null && workspaceSetting.available.length > 0
        ? h('option', { value: '', disabled: true }, translate('settings.rpWorkspace.unselected'))
        : null,
      workspaceSetting?.current?.unavailable === true
        ? h('option', { value: workspaceSetting.current.path, disabled: true }, translate('settings.rpWorkspace.unavailable', { path: workspaceSetting.current.path }))
        : null,
      workspaceSetting?.available?.length > 0
        ? workspaceSetting.available.map(item => h('option', { key: item.id, value: item.path }, rawText(item.title)))
        : h('option', { value: '', disabled: true }, translate('settings.rpWorkspace.none')))),
      h('p', { className: 'dtv-note' }, translate('settings.rpWorkspace.help')),
      h(Field, { label: translate('settings.rpPolicy') }, h('textarea', {
        className: 'dtv-textarea dtv-policy',
        value: policyDraft,
        placeholder: translate('settings.rpPolicy.placeholder'),
        disabled: busy || policyBusy || policyLoaded !== true,
        onChange: event => onPolicyDraft(event.target.value),
      })),
      h('p', { className: 'dtv-note' }, translate('settings.rpPolicy.help')),
      h('div', { className: 'dtv-actions' },
        h('button', {
          className: 'dtv-button dtv-primary',
          type: 'button',
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: savePolicy,
        }, translate('settings.rpPolicy.save')),
        h('button', {
          className: 'dtv-button',
          type: 'button',
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: resetPolicy,
        }, translate('settings.rpPolicy.reset')),
      ),
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

const LOGIC_KEYS = Object.freeze({
  and_any: 'world.logic.andAny',
  and_all: 'world.logic.andAll',
  not_any: 'world.logic.notAny',
  not_all: 'world.logic.notAll',
})

function triggerSummary(entry) {
  if (entry.enabled !== true) return uiMessage('world.entry.disabled')
  if (entry.constant === true) return uiMessage('world.entry.constant')
  const keys = Array.isArray(entry.keys) ? entry.keys.filter(Boolean) : []
  if (keys.length === 0) return uiMessage('world.entry.noPrimaryKeys')
  const separator = translate('common.listSeparator')
  const secondary = Array.isArray(entry.secondary_keys) ? entry.secondary_keys.filter(Boolean) : []
  const logic = entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any'
  return entry.selective === true && secondary.length > 0
    ? uiMessage('world.entry.triggerWithSecondary', {
      keys: keys.join(separator),
      logic: translate(LOGIC_KEYS[logic] ?? 'world.logic.andAny'),
      secondary: secondary.join(separator),
    })
    : uiMessage('world.entry.trigger', { keys: keys.join(separator) })
}

function WorldInfoEntryEditor({ entry, index, update, remove }) {
  const patch = change => update(index, change)
  const position = entryPosition(entry)
  return h('details', { className: 'dtv-entry', 'data-enabled': entry.enabled === true },
    h('summary', null,
      h('span', { className: 'dtv-entry-dot', 'aria-hidden': 'true' }),
      h('span', { className: 'dtv-entry-name' }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiMessage('world.entry.fallback', { id: String(entry.id ?? index + 1) })),
      h('span', { className: 'dtv-entry-state' }, triggerSummary(entry)),
    ),
    h('div', { className: 'dtv-entry-body' },
      h('div', { className: 'dtv-checks' },
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.enabled === true, onChange: event => patch({ enabled: event.target.checked }) }), uiMessage('common.enable')),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.constant === true, onChange: event => patch({ constant: event.target.checked }) }), uiMessage('world.entry.constant')),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: entry.selective === true, onChange: event => patch({ selective: event.target.checked }) }), uiMessage('world.entry.useSecondary')),
      ),
      h(Field, { label: uiMessage('world.entry.nameNote') }, h('input', { className: 'dtv-input', value: entry.comment ?? entry.name ?? '', onChange: event => patch({ comment: event.target.value }) })),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { label: uiMessage('world.entry.primaryKeysLines') }, h('textarea', { className: 'dtv-textarea', value: keyLines(entry.keys), onChange: event => patch({ keys: parseKeyLines(event.target.value) }) })),
        h(Field, { label: uiMessage('world.entry.secondaryKeysLines') }, h('textarea', { className: 'dtv-textarea', value: keyLines(entry.secondary_keys), disabled: entry.selective !== true, onChange: event => patch({ secondary_keys: parseKeyLines(event.target.value) }) })),
      ),
      entry.selective === true ? h(Field, { label: uiMessage('world.entry.secondaryLogic') }, h('select', {
        className: 'dtv-select',
        value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 'and_any',
        onChange: event => patch({ selectiveLogic: event.target.value, extensions: { ...(entry.extensions ?? {}), selectiveLogic: event.target.value } }),
      },
      h('option', { value: 'and_any' }, uiMessage('world.logic.andAny')),
      h('option', { value: 'and_all' }, uiMessage('world.logic.andAll')),
      h('option', { value: 'not_any' }, uiMessage('world.logic.notAny')),
      h('option', { value: 'not_all' }, uiMessage('world.logic.notAll')))) : null,
      h(Field, { label: uiMessage('world.entry.content') }, h('textarea', { className: 'dtv-textarea', value: entry.content ?? '', onChange: event => patch({ content: event.target.value }) })),
      h('div', { className: 'dtv-entry-grid' },
        h(Field, { label: uiMessage('world.entry.insertionPosition') }, h('select', {
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
        h('option', { value: 0 }, uiMessage('world.position.beforeCharacter')),
        h('option', { value: 1 }, uiMessage('world.position.afterCharacter')),
        h('option', { value: 2 }, uiMessage('world.position.beforeAuthor')),
        h('option', { value: 3 }, uiMessage('world.position.afterAuthor')),
        h('option', { value: 4 }, uiMessage('world.position.atDepth')),
        h('option', { value: 5 }, uiMessage('world.position.beforeExamples')),
        h('option', { value: 6 }, uiMessage('world.position.afterExamples')),
        h('option', { value: 7 }, uiMessage('world.position.outlet')))),
        h(Field, { label: uiMessage('world.entry.sortWeight') }, h('input', { className: 'dtv-input', type: 'number', value: entry.insertion_order ?? 100, onChange: event => patch({ insertion_order: Number(event.target.value) }) })),
      ),
      h('div', { className: 'dtv-checks' },
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: event => patch({ case_sensitive: event.target.checked, extensions: { ...(entry.extensions ?? {}), case_sensitive: event.target.checked } }) }), uiMessage('world.entry.caseSensitive')),
        h('label', { className: 'dtv-check' }, h('input', { type: 'checkbox', checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: event => patch({ match_whole_words: event.target.checked, extensions: { ...(entry.extensions ?? {}), match_whole_words: event.target.checked } }) }), uiMessage('world.entry.wholeWord')),
      ),
      h('div', { className: 'dtv-entry-actions' }, h('button', { className: 'dtv-button dtv-danger', type: 'button', onClick: () => remove(index) }, uiMessage('world.entry.delete'))),
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
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => {
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
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
        comment: translate('world.entry.untitled', { id }),
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
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return h('div', { className: 'dtv-panel' },
    h(PanelHeader, { titleKey: 'world.lorebookTitle', close }),
    h('div', { className: 'dtv-body' },
      h('div', { className: 'dtv-book-toolbar' },
        h('button', { className: 'dtv-button', type: 'button', disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage('world.confirmReloadInfo')))) refresh()
        } }, uiMessage('common.reload')),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy || draft === null, onClick: addEntry }, uiMessage('world.addEntry')),
        h('button', { className: 'dtv-button', type: 'button', disabled: busy || !dirty, onClick: save }, dirty ? uiMessage('common.saveChanges') : uiMessage('common.saved')),
      ),
      h('p', { className: 'dtv-note' }, uiMessage('world.infoIntro', { session: sessionId || translate('common.none') })),
      h('div', { className: 'dtv-status', 'data-error': error !== '' || undefined, role: 'status' }, error ? rawText(error) : snapshot === null ? uiMessage('world.infoReading') : dirty ? uiMessage('world.infoDirty') : uiMessage('world.infoLoaded', { count: entries.length })),
      draft === null
        ? h('p', { className: 'dtv-note' }, uiMessage('world.infoEmpty'))
        : h('div', { className: 'dtv-resource' },
          h('div', { className: 'dtv-resource-title' }, draft.name || resources[0]?.name ? rawText(draft.name || resources[0]?.name) : uiMessage('world.embeddedInfoTitle')),
          h('div', { className: 'dtv-resource-meta' }, uiMessage('world.infoMeta', { count: entries.length })),
          ...entries.map((entry, index) => h(WorldInfoEntryEditor, { key: `${entry.id ?? 'entry'}-${index}`, entry, index, update: updateEntry, remove: removeEntry })),
        ),
      selectedStandalone.length > 0 ? h('div', { className: 'dtv-status' }, uiMessage('world.infoPendingIds', { count: selectedStandalone.length })) : null,
      diagnostics.length > 0 ? h('div', { className: 'dtv-resource' },
        h('div', { className: 'dtv-resource-title' }, uiMessage('world.diagnostics', { count: diagnostics.length })),
        h('ul', { className: 'dtv-list' }, ...diagnostics.map((item, index) => h('li', { key: `${item.code}-${index}` }, rawText(item.message)))),
      ) : null,
      h('p', { className: 'dtv-note' }, uiMessage('world.infoSaveNote')),
    ),
  )
}

function RpHighRiskDialog({ onDismiss }) {
  return h('div', {
    className: 'dtv-modal-backdrop',
    role: 'alertdialog',
    'aria-modal': 'true',
    'aria-labelledby': 'dtv-rp-block-body',
  },
    h('div', { className: 'dtv-modal' },
      h('p', { id: 'dtv-rp-block-body', className: 'dtv-modal-body' }, translate('rp.block.body')),
      h('button', { className: 'dtv-button dtv-primary', type: 'button', onClick: onDismiss }, translate('rp.block.dismiss')),
    ),
  )
}

function TavernShell({ useSessions, useWorkspaces, createCleanSession, createConfiguredPlaythrough, playClient, playSlots, chromeService }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [surface, setSurface] = useState(null)
  const [anchor, setAnchor] = useState(initialLauncherAnchor)
  const [chromeMode, setChromeMode] = useState(() => chromeService.getMode())
  const [chromeAnimation, setChromeAnimation] = useState(0)
  const [chromeError, setChromeError] = useState('')
  const [activeSnapshot, setActiveSnapshot] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [uiSettings, setUiSettings] = useState(getClientUiSettings)
  const [settingsStatus, setSettingsStatus] = useState({ text: translate('settings.saved'), error: false })
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [rpPolicyDraft, setRpPolicyDraft] = useState('')
  const [rpPolicyLoaded, setRpPolicyLoaded] = useState(false)
  const [rpPolicyBusy, setRpPolicyBusy] = useState(false)
  const [rpWorkspaceSetting, setRpWorkspaceSetting] = useState(null)
  const [rpWorkspaceBusy, setRpWorkspaceBusy] = useState(false)
  const rpWorkspaceBusyRef = useRef(false)
  const [rpAlert, setRpAlert] = useState(null)
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const chromeController = useRef(null)
  const statusGeneration = useRef(0)
  const rpAlertRef = useRef(null)
  const dismissedRpAlerts = useRef(new Set())
  const sessionId = useSessions(state => state.current)
  const sessionBlank = useSessions(state => state.current === undefined || state.current === null ? true : state.byId?.[state.current]?.blank === true)
  const workspaceId = useWorkspaces(state => workspaceTargetId(state, sessionId))
  const workspaceItems = useWorkspaces(state => state.items)
  const hasConversationHistory = useCallback(async targetSessionId => {
    const messages = await playClient.getMessages(targetSessionId)
    return sessionHasConversationHistory(messages)
  }, [playClient])
  const close = () => setSurface(null)
  if (rpAlert === null || dismissedRpAlerts.current.has(rpAlert.id)) rpAlertRef.current = null
  else rpAlertRef.current = rpAlert

  useEffect(() => {
    const commitChrome = snapshot => {
      setChromeMode(snapshot.mode)
      playSlots.setMode(snapshot.mode)
      if (snapshot.mode !== 'play') setSurface(current => current === 'regex' ? null : current)
    }
    const unsubscribe = chromeService.subscribe(snapshot => {
      commitChrome(snapshot)
      setChromeError('')
    })
    const controller = createChromeClickController({
      getMode: () => chromeService.getMode(),
      persistMode: mode => chromeService.setMode(mode),
      openMenu: () => setMenuOpen(value => !value),
      closeMenu: () => setMenuOpen(false),
      setMode: () => {},
      setError: reason => setChromeError(reason instanceof Error ? reason.message : reason == null ? '' : String(reason)),
    })
    chromeController.current = controller
    return () => {
      controller.dispose()
      if (chromeController.current === controller) chromeController.current = null
      unsubscribe()
    }
  }, [chromeService, playSlots])

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

  useEffect(() => {
    if (surface !== 'settings') return undefined
    let active = true
    setRpPolicyLoaded(false)
    rpPolicyRequest().then(next => {
      if (!active) return
      setRpPolicyDraft(typeof next.section === 'string' ? next.section : '')
      setRpPolicyLoaded(true)
    }).catch(reason => {
      if (!active) return
      setSettingsStatus({ text: translate('settings.loadError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    })
    return () => { active = false }
  }, [surface])

  useEffect(() => {
    if (surface !== 'settings') return undefined
    let active = true
    setRpWorkspaceSetting(null)
    playClient.getWorkspace().then(workspace => {
      if (active) setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace, items: workspaceItems }))
    }).catch(reason => {
      if (active) setSettingsStatus({ text: translate('settings.loadError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    })
    return () => { active = false }
  }, [playClient, surface, workspaceItems])

  const selectRpWorkspace = async path => {
    if (rpWorkspaceBusyRef.current) return
    const request = workspaceSelectionRequest(path, { setting: rpWorkspaceSetting })
    if (!request.changed) return
    const item = rpWorkspaceSetting?.available?.find(candidate => candidate.path === path)
    if (item === undefined) return
    if (requiresSystemWorkspaceConfirmation(path)
      && !window.confirm(unwrapText(uiMessage('play.sidebar.systemWorkspaceConfirm', { path })))) return
    rpWorkspaceBusyRef.current = true
    setRpWorkspaceBusy(true)
    setSettingsStatus({ text: translate('settings.saving'), error: false })
    try {
      const written = await playClient.putWorkspace(path)
      setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace: written, items: workspaceItems }))
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      try {
        const current = await playClient.getWorkspace()
        setRpWorkspaceSetting(projectRpWorkspaceSetting({ workspace: current, items: workspaceItems }))
        setSettingsStatus({ text: translate('settings.saved'), error: false })
      } catch (reason) {
        setSettingsStatus({ text: translate('settings.rpWorkspace.verifyError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
      }
    } catch (reason) {
      setSettingsStatus({ text: translate('settings.saveError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    } finally {
      rpWorkspaceBusyRef.current = false
      setRpWorkspaceBusy(false)
    }
  }

  const persistRpPolicy = async () => {
    setRpPolicyBusy(true)
    setSettingsStatus({ text: translate('settings.saving'), error: false })
    try {
      const saved = await rpPolicyRequest('PUT', { section: rpPolicyDraft })
      setRpPolicyDraft(saved.section)
      setRpPolicyLoaded(true)
      setSettingsStatus({ text: translate('settings.rpPolicy.saved'), error: false })
    } catch (reason) {
      setSettingsStatus({ text: translate('settings.saveError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    } finally {
      setRpPolicyBusy(false)
    }
  }

  const resetRpPolicy = async () => {
    setRpPolicyBusy(true)
    setSettingsStatus({ text: translate('settings.saving'), error: false })
    try {
      const saved = await rpPolicyRequest('DELETE')
      setRpPolicyDraft(saved.section)
      setRpPolicyLoaded(true)
      setSettingsStatus({ text: translate('settings.rpPolicy.saved'), error: false })
    } catch (reason) {
      setSettingsStatus({ text: translate('settings.saveError', { message: reason instanceof Error ? reason.message : String(reason) }), error: true })
    } finally {
      setRpPolicyBusy(false)
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
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh)
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
    if (typeof sessionId !== 'string' || sessionId === '') {
      dismissedRpAlerts.current = new Set()
      rpAlertRef.current = null
      setRpAlert(null)
      return undefined
    }
    let active = true
    const poll = async () => {
      try {
        const data = await rpAlertRequest(sessionId)
        if (!active || data?.alert == null) return
        if (dismissedRpAlerts.current.has(data.alert.id)) return
        if (rpAlertRef.current?.id === data.alert.id) return
        setRpAlert(data.alert)
      } catch {
        // Polling must not surface as a settings or launcher error.
      }
    }
    poll()
    const timer = window.setInterval(poll, 800)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [sessionId])

  const dismissRpAlert = async () => {
    const alert = rpAlertRef.current ?? rpAlert
    if (alert?.id != null) dismissedRpAlerts.current.add(alert.id)
    rpAlertRef.current = null
    setRpAlert(null)
    if (typeof sessionId !== 'string' || sessionId === '' || alert?.id == null) return
    try {
      await rpAlertRequest(sessionId, { method: 'DELETE', id: alert.id })
    } catch {
      // Closing the dialog still stops the current overlay even if ack fails.
    }
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      if (rpAlert !== null) dismissRpAlert()
      else if (menuOpen) setMenuOpen(false)
      else if (surface !== null) setSurface(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, rpAlert, surface])

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

  const consumeSuppressedClick = () => {
    if (!suppressClick.current) return false
    suppressClick.current = false
    return true
  }

  const clickLauncher = () => chromeController.current?.click({
    suppressed: consumeSuppressedClick(),
  })
  const contextSwitchLauncher = event => {
    event.preventDefault()
    const switching = chromeController.current?.switchMode({ suppressed: consumeSuppressedClick() })
    Promise.resolve(switching).then(changed => {
      if (changed) setChromeAnimation(value => value + 1)
    })
  }
  const switchChrome = () => chromeController.current?.switchMode()

  const open = id => {
    setMenuOpen(false)
    setSurface(id)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
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
    panel = h(CharacterPanel, { sessionId, sessionBlank, hasConversationHistory, close })
  } else if (surface === 'regex' && chromeMode === 'play') {
    panel = h(RegexPanel, { client: playClient, activeSnapshot, close })
  } else if (surface === 'world-info') {
    panel = h(WorldBookPanel, { sessionId, close })
  } else if (surface === 'user') {
    panel = h(UserPanel, { sessionId, sessionBlank, close })
  } else if (surface === 'session-template') {
    panel = h(SessionTemplatePanel, {
      sessionId,
      workspaceId,
      chromeMode,
      createCleanSession,
      createConfiguredPlaythrough,
      close,
    })
  } else if (surface === 'settings') {
    panel = h(SettingsPanel, {
      settings: uiSettings,
      status: settingsStatus,
      busy: settingsBusy,
      close,
      update: persistSettings,
      reset: resetSettings,
      policyDraft: rpPolicyDraft,
      policyBusy: rpPolicyBusy,
      policyLoaded: rpPolicyLoaded,
      onPolicyDraft: setRpPolicyDraft,
      savePolicy: persistRpPolicy,
      resetPolicy: resetRpPolicy,
      workspaceSetting: rpWorkspaceSetting,
      workspaceBusy: rpWorkspaceBusy,
      selectWorkspace: selectRpWorkspace,
    })
  }

  const placement = launcherPlacement(anchor, viewport(), menuOpen, uiSettings.scale)
  const statuses = launcherResourceStatuses(activeSnapshot)
  const chromeSwitchLabel = chromeMode === 'play'
    ? uiMessage('chrome.switchToNative')
    : uiMessage('chrome.switchToPlay')
  const chromeStatusLabel = chromeMode === 'play' ? uiMessage('chrome.currentPlay') : uiMessage('chrome.currentNative')

  return h('div', { className: 'dtv-layer', lang: uiSettings.locale, 'data-chrome': chromeMode, 'data-surface-open': surface !== null, style: { '--dtv-ui-scale': uiSettings.scale } },
    panel,
    rpAlert === null ? null : h(RpHighRiskDialog, { onDismiss: dismissRpAlert }),
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
          title: uiMessage('nav.launcher'),
          'aria-label': uiMessage('nav.launcher'),
          'aria-expanded': menuOpen,
          onPointerDown: startDrag,
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClick: clickLauncher,
          onContextMenu: contextSwitchLauncher,
        },
        h('span', { key: chromeAnimation, className: 'dtv-ball-face', 'data-animate': chromeAnimation > 0, 'aria-hidden': 'true' }),
        h('span', { className: 'dtv-ball-label' }, 'DT'))),
      h('div', { className: 'dtv-menu', role: 'menu' },
        h('div', { className: 'dtv-menu-title', 'aria-live': 'polite' }, chromeError === '' && statusError === '' ? uiMessage('nav.menuTitle', { session: sessionId || translate('nav.session.none') }) : uiMessage('nav.syncFailed', { message: chromeError || statusError })),
        h('button', {
          className: 'dtv-menu-item',
          type: 'button',
          role: 'menuitem',
          title: chromeSwitchLabel,
          'aria-label': chromeSwitchLabel,
          'data-show-binding': false,
          onClick: switchChrome,
        },
        h('span', { 'aria-hidden': 'true' }, '↔'),
        h('span', { className: 'dtv-item-copy' },
          h('span', { className: 'dtv-item-label' }, chromeSwitchLabel),
          h('span', { className: 'dtv-item-status' }, chromeStatusLabel),
        ),
        h('span', { className: 'dtv-item-planned' }, chromeMode === 'play' ? 'ST' : 'DSH'),
        ),
        ...TAVERN_MENU_ITEMS.filter(item => !item.playOnly || chromeMode === 'play').map(item => {
          const status = statuses[item.id] ?? { bound: false, count: 0, titleKey: item.emptyTitleKey }
          const itemLabel = unwrapText(uiMessage(item.labelKey))
          const statusTitle = status.bound ? status.title : unwrapText(uiMessage(status.titleKey ?? item.emptyTitleKey))
          const stateLabel = item.binding === false ? '' : unwrapText(uiMessage(status.bound ? 'common.bound' : 'common.unbound'))
          const titleText = stateLabel
            ? uiMessage('nav.itemTitleBound', { label: itemLabel, title: statusTitle, state: stateLabel })
            : uiMessage('nav.itemTitle', { label: itemLabel, title: statusTitle })
          const ariaText = stateLabel
            ? uiMessage('nav.itemAriaBound', { label: itemLabel, title: statusTitle, state: stateLabel })
            : uiMessage('nav.itemAria', { label: itemLabel, title: statusTitle })
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
            h('span', { className: 'dtv-item-label' }, uiMessage(item.labelKey)),
            h('span', { className: 'dtv-item-status' }, status.bound ? rawText(status.title) : uiMessage(status.titleKey ?? item.emptyTitleKey)),
          ),
          status.count > 1
            ? h('span', { className: 'dtv-item-count', 'aria-label': uiMessage('nav.bookCount', { count: status.count }) }, uiMessage('nav.bookCount', { count: status.count }))
            : item.available ? null : h('span', { className: 'dtv-item-planned' }, uiMessage('common.planned')),
          )
        }),
      ),
    ),
  )
}

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-shell"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-shell`
  style.textContent = css
  document.head.append(style)
}

export const name = PLUGIN_ID
export const inject = ['slots', 'layout', 'sessions', 'workspaces']
export { PanelHeader }

export function apply(ctx) {
  installPresetStyles()
  installCharacterStyles()
  installWorldBookStyles()
  installUserStyles()
  installTavernTraceStyles()
  installStyles()
  registerTavernTraceView(ctx)
  const playClient = createLivePlayClient()
  const playthroughController = createPlaythroughController(playClient)
  const chrome = createChromeModeServiceCore({
    read: () => playClient.getChrome(),
    write: mode => playClient.putChrome(mode),
  })
  ctx.provide(CHROME_SERVICE_NAME, chrome.face)
  ctx.effect(() => {
    const stopTransport = startChromeModeTransport({
      face: chrome.face,
      internal: chrome.internal,
      eventsUrl: playClient.chromeEventsUrl,
    })
    return () => {
      stopTransport()
      chrome.internal.dispose()
    }
  }, 'dsh-tavern: chrome mode service transport')
  const playSlots = installPlaySlotOccupancy(ctx, playClient, { playthroughController })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: `${PLUGIN_ID}-launcher`,
    order: 80,
    inject: () => ({
      playClient,
      chromeService: chrome.face,
      playSlots,
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
        refresh: () => window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT)),
      }),
      createConfiguredPlaythrough: ({ source }) => createConfiguredPlaythroughWorkflow({
        source,
        preview: selectedSource => sessionConfigurationRequest('/session-configurations/preview', { source: selectedSource }),
        applySelection: (targetSessionId, selectedSource) => sessionConfigurationRequest('/session-configurations/apply', {
          targetSessionId,
          source: selectedSource,
        }),
        playthroughController,
        openSession: id => ctx.sessions.open(id),
        refresh: () => window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT)),
      }),
    }),
  }, TavernShell))
}
