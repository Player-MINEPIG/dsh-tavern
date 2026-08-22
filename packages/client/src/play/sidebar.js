import {
  createElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  API_V1,
  CLIENT_REFRESH_EVENT,
  CLIENT_UI_SETTINGS_EVENT,
  PLUGIN_ID,
} from '../../../identity.js'
import {
  createLocalizedElement,
  getClientUiSettings,
  rawText,
  uiMessage,
  unwrapText,
} from '../i18n.js'
import {
  createPlaythroughController,
  sourceSessionIdForCharacter,
} from './create.js'
import { PlayIoMenu } from './io-menu.js'
import {
  SessionCharacterBindingCache,
  assessPlaythroughCharacterRelink,
  loadPlaySidebarResources,
  requiresSystemWorkspaceConfirmation,
  loadSessionCharacterBindings,
  playthroughFocusTarget,
  projectPlaySidebar,
  sessionIdsInRpWorkspace,
} from './sidebar-model.js'
import { reorderAtBoundary } from '../../../preset/src/client-state.js'

const h = createLocalizedElement(createElement)

const css = `
.dtv-play-character-drag{width:20px;min-width:20px;align-self:stretch;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:0;font:inherit;font-size:14px;touch-action:none;user-select:none}.dtv-play-character-drag:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-character-drag:active{cursor:grabbing}.dtv-play-character-drag:disabled{cursor:default;opacity:.4}
.dtv-play-section[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtv-play-section[data-dragging=true]>*{opacity:0}
.dtv-play-character-drop{box-sizing:border-box;height:38px;flex:none;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:10px;font-weight:600;pointer-events:none}
.dtv-play-sort{display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:1px 5px 3px;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-play-sort select{min-width:92px;height:26px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;padding:2px 6px}.dtv-play-sort select:disabled{opacity:.55}
.dtv-play-sidebar{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:6px 7px 10px;overflow:auto;zoom:var(--dtv-ui-scale,1);color:var(--dsw-alias-label-primary)}
.dtv-play-section{display:flex;flex-direction:column;gap:2px;border-radius:10px}.dtv-play-section[data-open=true]{padding-bottom:3px}
.dtv-play-group,.dtv-play-row{width:100%;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:7px}.dtv-play-group:hover,.dtv-play-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-row-line{display:flex;align-items:center;gap:2px}.dtv-play-row-line>.dtv-play-row{min-width:0;flex:1}.dtv-play-row-line>.dtv-play-io{flex:none}
.dtv-play-group{min-height:38px;padding:4px 6px;font-size:12px;font-weight:680}.dtv-play-row{min-height:32px;padding:4px 7px 4px 27px;font-size:11px}.dtv-play-row[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));font-weight:650}.dtv-play-row:disabled{cursor:default;opacity:.55}
.dtv-play-group-line{display:flex;align-items:center;gap:3px}.dtv-play-group-line>.dtv-play-group{min-width:0;flex:1}.dtv-play-create{width:30px;height:30px;flex:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-create:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-create:disabled{cursor:default;opacity:.5}
.dtv-play-chevron{width:10px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary)}.dtv-play-title{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dtv-play-count{flex:none;border-radius:9px;padding:1px 6px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-tertiary);font-size:9px}
.dtv-play-avatar{position:relative;width:25px;height:25px;flex:none;border-radius:50%;overflow:hidden;background:var(--dsw-specific-tip);display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:10px}.dtv-play-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dtv-play-subgroup{display:flex;flex-direction:column;gap:1px}.dtv-play-subgroup>.dtv-play-group{min-height:30px;padding-left:25px;font-size:10px;font-weight:620;color:var(--dsw-alias-label-secondary)}
.dtv-play-missing{border-top:1px solid var(--dsw-alias-border-subtle);margin-top:3px;padding-top:3px}.dtv-play-missing-card{margin-left:10px}.dtv-play-relink{width:30px;height:30px;flex:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-state-business-primary);cursor:pointer;font:inherit;font-size:13px}.dtv-play-relink:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-modal select{width:100%;box-sizing:border-box;min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;padding:6px 8px}.dtv-play-modal .dtv-play-relink-warning{padding:9px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning,#d9822b) 45%,transparent);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-warning,#d9822b) 10%,transparent);color:var(--dsw-alias-state-warning,#c86f16);font-size:11px}
.dtv-play-empty,.dtv-play-status{margin:0;padding:7px 9px;font-size:10px;line-height:1.45;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.dtv-play-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-rail{height:100%;box-sizing:border-box;padding:7px;display:flex;flex-direction:column;align-items:center;gap:7px;overflow:auto;zoom:var(--dtv-ui-scale,1)}.dtv-play-rail-button{width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:grid;place-items:center}.dtv-play-rail-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-rail-button .dtv-play-avatar{width:30px;height:30px}
.dtv-play-modal-backdrop{position:fixed;inset:0;z-index:40;box-sizing:border-box;padding:20px;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center}.dtv-play-modal{box-sizing:border-box;width:min(420px,100%);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 16px 40px rgba(0,0,0,.28));padding:17px 16px;display:flex;flex-direction:column;gap:14px}.dtv-play-modal p{margin:0;font-size:13px;line-height:1.55;color:var(--dsw-alias-label-primary)}.dtv-play-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.dtv-play-modal-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 11px;font:inherit;font-size:12px}.dtv-play-modal-button[data-primary=true]{border-color:transparent;background:var(--dsw-alias-state-business-primary,#2677d9);color:var(--dsw-alias-button-primary-label,#fff)}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-sidebar"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-sidebar`
  style.textContent = css
  document.head.append(style)
}

function useUiScale() {
  const [scale, setScale] = useState(() => getClientUiSettings().scale)
  useEffect(() => {
    const onSettings = event => {
      const next = Number(event.detail?.scale)
      if (Number.isFinite(next)) setScale(next)
    }
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings)
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings)
  }, [])
  return scale
}

function Avatar({ character }) {
  const fallback = (character.name || character.id).slice(0, 1).toUpperCase()
  return h('span', { className: 'dtv-play-avatar', 'aria-hidden': 'true' },
    rawText(fallback),
    h('img', {
      src: `${API_V1}/characters/${encodeURIComponent(character.id)}/png`,
      alt: '',
      onError: event => { event.currentTarget.hidden = true },
    }),
  )
}

function Rail({ model, scale, expandSidebar }) {
  return h('div', { className: 'dtv-play-rail', style: { '--dtv-ui-scale': scale } },
    ...model.characters.map(character => h('button', {
      key: character.id,
      type: 'button',
      className: 'dtv-play-rail-button',
      title: rawText(character.name),
      'aria-label': rawText(character.name),
      onClick: expandSidebar,
    }, h(Avatar, { character }))),
    h('button', {
      type: 'button',
      className: 'dtv-play-rail-button',
      title: uiMessage('play.sidebar.other'),
      'aria-label': uiMessage('play.sidebar.other'),
      onClick: expandSidebar,
    }, '☰'),
  )
}

function CharacterDropPlaceholder() {
  return h('div', { className: 'dtv-play-character-drop', 'aria-hidden': true }, uiMessage('preset.dropHere'))
}

function characterInsertionBoundary(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-character-index]')
  if (target === null) return null
  const index = Number(target.dataset.characterIndex)
  const bounds = target.getBoundingClientRect()
  return event.clientY < bounds.top + bounds.height / 2 ? index : index + 1
}

function CharacterGroup({ character, index, dragging, reorderDisabled, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, collapsed, unassignedOpen, creating, createDisabled, toggle, toggleUnassigned, createPlaythrough, openPlaythrough, openSession, playClient, beginPlaythroughRelink }) {
  const count = character.playthroughs.length + character.unassigned.length
  return h('section', {
    className: 'dtv-play-section',
    'data-open': !collapsed,
    'data-character-index': index,
    'data-dragging': dragging || undefined,
  },
    h('div', { className: 'dtv-play-group-line' },
    h('button', {
      type: 'button',
      className: 'dtv-play-character-drag',
      disabled: reorderDisabled,
      title: uiMessage('preset.dragOrder'),
      'aria-label': uiMessage('preset.dragNamed', { name: character.name }),
      'aria-pressed': dragging,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    }, '⠿'),
    h('button', {
      type: 'button',
      className: 'dtv-play-group',
      'aria-expanded': !collapsed,
      onClick: toggle,
    },
    h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, collapsed ? '›' : '⌄'),
    h(Avatar, { character }),
    h('span', { className: 'dtv-play-title' }, rawText(character.name)),
    h('span', { className: 'dtv-play-count' }, rawText(String(count))),
    ),
    h('button', {
      type: 'button',
      className: 'dtv-play-create',
      disabled: createDisabled,
      title: uiMessage('play.sidebar.newPlaythrough', { name: character.name }),
      'aria-label': uiMessage('play.sidebar.newPlaythrough', { name: character.name }),
      onClick: () => createPlaythrough(character),
    }, creating ? '…' : '+'),
    ),
    collapsed ? null : character.playthroughs.length === 0 && character.unassigned.length === 0
      ? h('p', { className: 'dtv-play-empty' }, uiMessage('play.sidebar.noPlaythroughs'))
      : null,
    collapsed ? null : character.playthroughs.map(playthrough => h('div', {
      key: playthrough.id,
      className: 'dtv-play-row-line',
    },
    h('button', {
      type: 'button',
      className: 'dtv-play-row',
      'data-active': playthrough.active,
      disabled: playthrough.missing,
      title: playthrough.missing ? uiMessage('play.sidebar.sessionMissing') : rawText(playthrough.title),
      onClick: () => openPlaythrough(playthrough),
    },
    h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, '◆'),
    h('span', { className: 'dtv-play-title' }, rawText(playthrough.title)),
    ),
    h(PlayIoMenu, {
      playClient,
      playthrough,
      openSession,
      trigger: '⋯',
      placement: 'sidebar',
      onRelink: () => beginPlaythroughRelink(playthrough, character),
    }),
    )),
    collapsed || character.unassigned.length === 0 ? null : h('div', { className: 'dtv-play-subgroup' },
      h('button', {
        type: 'button',
        className: 'dtv-play-group',
        'aria-expanded': unassignedOpen,
        onClick: toggleUnassigned,
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, unassignedOpen ? '⌄' : '›'),
      h('span', { className: 'dtv-play-title' }, uiMessage('play.sidebar.unassigned')),
      h('span', { className: 'dtv-play-count' }, rawText(String(character.unassigned.length))),
      ),
      unassignedOpen ? character.unassigned.map(session => h('button', {
        key: session.id,
        type: 'button',
        className: 'dtv-play-row',
        'data-active': session.active,
        onClick: () => openSession(session.id),
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, '•'),
      h('span', { className: 'dtv-play-title' }, rawText(session.title)),
      )) : null,
    ),
  )
}

function MissingCharacterGroup({ character, collapsed, toggle, beginRelink, beginPlaythroughRelink, openPlaythrough, openSession, playClient, relinkDisabled }) {
  return h('section', { className: 'dtv-play-section dtv-play-missing-card', 'data-open': !collapsed },
    h('div', { className: 'dtv-play-group-line' },
      h('button', {
        type: 'button',
        className: 'dtv-play-group',
        'aria-expanded': !collapsed,
        onClick: toggle,
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, collapsed ? '›' : '⌄'),
      h('span', { className: 'dtv-play-avatar', 'aria-hidden': 'true' }, '?'),
      h('span', { className: 'dtv-play-title' }, rawText(character.name)),
      h('span', { className: 'dtv-play-count' }, rawText(String(character.playthroughs.length))),
      ),
      h('button', {
        type: 'button',
        className: 'dtv-play-relink',
        disabled: relinkDisabled,
        title: uiMessage('play.sidebar.relinkCharacter'),
        'aria-label': uiMessage('play.sidebar.relinkCharacterNamed', { name: character.name }),
        onClick: () => beginRelink(character),
      }, '↻'),
    ),
    collapsed ? null : character.playthroughs.map(playthrough => h('div', {
      key: playthrough.id,
      className: 'dtv-play-row-line',
    },
    h('button', {
      type: 'button',
      className: 'dtv-play-row',
      'data-active': playthrough.active,
      disabled: playthrough.missing,
      title: playthrough.missing ? uiMessage('play.sidebar.sessionMissing') : rawText(playthrough.title),
      onClick: () => openPlaythrough(playthrough),
    },
    h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, '◆'),
    h('span', { className: 'dtv-play-title' }, rawText(playthrough.title)),
    ),
    h(PlayIoMenu, {
      playClient,
      playthrough,
      openSession,
      trigger: '⋯',
      placement: 'sidebar',
      onRelink: () => beginPlaythroughRelink(playthrough, character),
    }),
    )),
  )
}

export function PlayWorkspaceBrowser({
  wide = true,
  expandSidebar,
  useSessions,
  useWorkspaces,
  playClient,
  playthroughController,
  openSession,
  switchToNative,
  getActivePlaythroughId,
  subscribeActivePlaythroughId,
}) {
  installStyles()
  const scale = useUiScale()
  const sessionIds = useSessions(state => state.ids)
  const sessions = useSessions(state => state.byId)
  const currentId = useSessions(state => state.current ?? null)
  const workspaceItems = useWorkspaces(state => state.items)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const cache = useRef(null)
  if (cache.current === null) cache.current = new SessionCharacterBindingCache()
  const automaticRelinks = useRef(new Set())
  const creator = useRef(null)
  if (creator.current?.client !== playClient || creator.current?.provided !== playthroughController) {
    creator.current = {
      client: playClient,
      provided: playthroughController,
      controller: playthroughController ?? createPlaythroughController(playClient),
    }
  }
  const [creatingCharacterId, setCreatingCharacterId] = useState(null)
  const [revision, setRevision] = useState(0)
  const [resources, setResources] = useState(null)
  const [sessionCharacters, setSessionCharacters] = useState({})
  const [status, setStatus] = useState(null)
  const [collapsedCharacters, setCollapsedCharacters] = useState(() => new Set())
  const [expandedUnassigned, setExpandedUnassigned] = useState(() => new Set())
  const [otherOpen, setOtherOpen] = useState(false)
  const [ordinaryPromptOpen, setOrdinaryPromptOpen] = useState(false)
  const [missingOpen, setMissingOpen] = useState(true)
  const [collapsedMissingCharacters, setCollapsedMissingCharacters] = useState(() => new Set())
  const [relinkRequest, setRelinkRequest] = useState(null)
  const [relinkTargetId, setRelinkTargetId] = useState('')
  const [relinkBusy, setRelinkBusy] = useState(false)
  const [activePlaythroughId, setActivePlaythroughId] = useState(
    () => getActivePlaythroughId?.() ?? null,
  )

  const [characterDragFrom, setCharacterDragFrom] = useState(null)
  const [characterDropIndex, setCharacterDropIndex] = useState(null)
  const [reorderingCharacters, setReorderingCharacters] = useState(false)

  useEffect(() => {
    if (typeof subscribeActivePlaythroughId !== 'function') return undefined
    setActivePlaythroughId(getActivePlaythroughId?.() ?? null)
    return subscribeActivePlaythroughId(setActivePlaythroughId)
  }, [getActivePlaythroughId, subscribeActivePlaythroughId])

  useEffect(() => {
    const refresh = () => {
      cache.current.clear()
      setRevision(value => value + 1)
    }
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    let active = true
    setStatus(null)
    loadPlaySidebarResources(playClient).then(next => {
      if (active) setResources(next)
    }).catch(reason => {
      if (!active) return
      setResources(null)
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    })
    return () => { active = false }
  }, [playClient, revision])

  const rpIds = resources === null ? [] : [...sessionIdsInRpWorkspace({
    workspace: resources.workspace,
    workspaceItems,
    sessions,
  })]
  const rpKey = rpIds.join('\0')

  useEffect(() => {
    let active = true
    if (resources === null) {
      setSessionCharacters({})
      return () => { active = false }
    }
    loadSessionCharacterBindings(playClient, rpIds, { cache: cache.current }).then(next => {
      if (active) setSessionCharacters(next)
    })
    return () => { active = false }
  }, [playClient, resources, rpKey, revision])

  const model = projectPlaySidebar({
    workspace: resources?.workspace,
    workspaceItems,
    characters: resources?.characters,
    characterSorting: resources?.characterSorting,
    missingCharacters: resources?.missingCharacters,
    catalog: resources?.catalog,
    timelines: resources?.timelines,
    sessions,
    sessionIds,
    archivedSessionIds,
    currentId,
    activePlaythroughId,
    sessionCharacters,
  })
  const automaticRelinkKey = [
    ...model.characters.map(item => `${item.id}:${item.name}:${item.sha256 ?? ''}`),
    '|',
    ...model.missingCharacters.map(item => `${item.id}:${item.name}:${item.sha256 ?? ''}`),
  ].join('\0')

  useEffect(() => {
    if (resources === null || model.missingCharacters.length === 0 || model.characters.length === 0) return undefined
    let active = true
    const normalizedName = value => String(value ?? '').trim().toLocaleLowerCase('zh-CN')
    const recoveries = []
    for (const missing of model.missingCharacters) {
      let candidates = typeof missing.sha256 === 'string'
        ? model.characters.filter(character => character.sha256 === missing.sha256)
        : []
      if (candidates.length !== 1) {
        const name = normalizedName(missing.name)
        const sameMissing = model.missingCharacters.filter(item => normalizedName(item.name) === name)
        candidates = sameMissing.length === 1
          ? model.characters.filter(character => normalizedName(character.name) === name)
          : []
      }
      if (candidates.length !== 1) continue
      const key = `${missing.id}\0${candidates[0].id}`
      if (automaticRelinks.current.has(key)) continue
      automaticRelinks.current.add(key)
      recoveries.push({ missing, character: candidates[0] })
    }
    if (recoveries.length === 0) return undefined
    void (async () => {
      let changed = false
      for (const recovery of recoveries) {
        if (!active) return
        try {
          await playClient.relinkCharacter(recovery.missing.id, recovery.character.id)
          changed = true
        } catch (reason) {
          if (active) setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
        }
      }
      if (active && changed) {
        cache.current.clear()
        window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      }
    })()
    return () => { active = false }
  }, [automaticRelinkKey, playClient])

  const bindWorkspace = async workspace => {
    if (requiresSystemWorkspaceConfirmation(workspace.path)
      && !window.confirm(unwrapText(uiMessage('play.sidebar.systemWorkspaceConfirm', { path: workspace.path })))) return
    setStatus(null)
    try {
      await playClient.putWorkspace(workspace.path)
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    }
  }

  const createPlaythrough = async character => {
    if (creatingCharacterId !== null) return
    setCreatingCharacterId(character.id)
    setStatus(null)
    try {
      const result = await creator.current.controller.create({
        character,
        selectionFromSessionId: sourceSessionIdForCharacter(character),
      })
      openSession(result.sessionId, result.playthrough)
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    } finally {
      setCreatingCharacterId(null)
    }
  }

  const openPlaythrough = async playthrough => {
    setStatus(null)
    try {
      const focus = await playClient.getFocus(playthrough)
      const target = playthroughFocusTarget({ focus, playthrough, rpSessionIds: rpIds })
      if (target === null) {
        setStatus({ key: 'play.sidebar.sessionMissing' })
        return
      }
      openSession(target, playthrough)
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    }
  }

  const returnToNative = async () => {
    setStatus(null)
    try {
      if (typeof switchToNative !== 'function') throw new Error('native mode switch is unavailable')
      await switchToNative()
      setOrdinaryPromptOpen(false)
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    }
  }

  const moveCharacter = async (from, boundary) => {
    if (resources === null || reorderingCharacters || resources.characterSorting?.mode !== 'custom') return
    const reordered = reorderAtBoundary(model.characters, from, boundary)
    const storedIds = new Set(resources.characters.map(character => character.id))
    const characterIds = reordered.map(character => character.id).filter(id => storedIds.has(id))
    if (characterIds.every((id, index) => resources.characters[index]?.id === id)) return

    const byId = new Map(resources.characters.map(character => [character.id, character]))
    setResources(current => current === null ? null : {
      ...current,
      characters: characterIds.map(id => byId.get(id)).filter(Boolean),
    })
    setReorderingCharacters(true)
    setStatus(null)
    try {
      if (typeof playClient.putCharacterOrder !== 'function') throw new Error('character order API is unavailable')
      const response = await playClient.putCharacterOrder('custom', characterIds)
      if (Array.isArray(response?.characters)) {
        setResources(current => current === null ? null : {
          ...current,
          characters: response.characters,
          characterSorting: response.sorting ?? current.characterSorting,
        })
      }
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
      setRevision(value => value + 1)
    } finally {
      setReorderingCharacters(false)
    }
  }

  const changeCharacterSortMode = async event => {
    const mode = event.currentTarget.value
    if (resources === null || reorderingCharacters || mode === resources.characterSorting?.mode) return
    setReorderingCharacters(true)
    setStatus(null)
    try {
      const response = await playClient.putCharacterOrder(mode)
      setResources(current => current === null ? null : {
        ...current,
        characters: Array.isArray(response?.characters) ? response.characters : current.characters,
        characterSorting: response?.sorting ?? { mode },
      })
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
      setRevision(value => value + 1)
    } finally {
      setReorderingCharacters(false)
    }
  }

  const beginRelink = character => {
    setRelinkRequest({ kind: 'character', character })
    setRelinkTargetId(resources?.characters[0]?.id ?? '')
  }

  const beginPlaythroughRelink = (playthrough, character) => {
    const target = resources?.characters.find(item => item.id !== character.id)
    setRelinkRequest({ kind: 'playthrough', playthrough, character })
    setRelinkTargetId(target?.id ?? '')
  }

  const commitRelink = async () => {
    if (relinkRequest === null || relinkTargetId === '' || relinkBusy) return
    setRelinkBusy(true)
    setStatus(null)
    try {
      if (relinkRequest.kind === 'playthrough') {
        if (typeof playClient.relinkPlaythroughCharacter !== 'function') throw new Error('playthrough character relink API is unavailable')
        await playClient.relinkPlaythroughCharacter(relinkRequest.playthrough.id, relinkTargetId)
      } else {
        if (typeof playClient.relinkCharacter !== 'function') throw new Error('character relink API is unavailable')
        await playClient.relinkCharacter(relinkRequest.character.id, relinkTargetId)
      }
      setRelinkRequest(null)
      cache.current.clear()
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
    } finally {
      setRelinkBusy(false)
    }
  }

  if (wide === false) return h(Rail, { model, scale, expandSidebar })

  const toggleSet = (setter, id) => setter(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return h('div', { className: 'dtv-play-sidebar', style: { '--dtv-ui-scale': scale } },
    resources === null && status === null ? h('p', { className: 'dtv-play-status' }, uiMessage('play.sidebar.loading')) : null,
    resources?.workspace?.selected === false ? h('section', { className: 'dtv-play-section', 'data-open': true },
      h('p', { className: 'dtv-play-status' }, uiMessage('play.sidebar.workspaceMissing')),
      ...workspaceItems.map(workspace => {
        const label = uiMessage('play.sidebar.selectWorkspace', { name: workspace.title })
        return h('button', {
          key: workspace.workspaceId,
          type: 'button',
          className: 'dtv-play-row',
          title: label,
          'aria-label': label,
          onClick: () => bindWorkspace(workspace),
        },
        h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, '◇'),
        h('span', { className: 'dtv-play-title' }, rawText(workspace.title)),
        )
      }),
    ) : null,
    status === null ? null : h('p', { className: 'dtv-play-status', 'data-error': true }, status.key ? uiMessage(status.key) : rawText(status.message)),
    (resources?.diagnostics.length ?? 0) === 0 ? null : h('p', { className: 'dtv-play-status', 'data-error': true }, uiMessage('play.sidebar.timelineErrors', { count: resources.diagnostics.length })),
    ...(resources?.diagnostics ?? []).map(diagnostic => h('p', {
      key: diagnostic.playthroughId,
      className: 'dtv-play-status',
      'data-error': true,
    }, rawText(`${diagnostic.path}: ${diagnostic.message}`))),
    resources === null ? null : h('label', { className: 'dtv-play-sort' },
      h('span', null, uiMessage('play.sidebar.sort')),
      h('select', {
        value: resources.characterSorting?.mode ?? 'updated',
        disabled: reorderingCharacters,
        onChange: changeCharacterSortMode,
      },
      h('option', { value: 'updated' }, uiMessage('play.sidebar.sortUpdated')),
      h('option', { value: 'name' }, uiMessage('play.sidebar.sortName')),
      h('option', { value: 'custom' }, uiMessage('play.sidebar.sortCustom')),
      ),
    ),
    resources !== null && model.characters.length === 0 ? h('p', { className: 'dtv-play-empty' }, uiMessage('play.sidebar.noCharacters')) : null,
    ...model.characters.flatMap((character, index) => [
      characterDragFrom !== null && characterDropIndex === index
        ? h(CharacterDropPlaceholder, { key: `drop-${index}` })
        : null,
      h(CharacterGroup, {
        key: character.id,
        character,
        index,
        dragging: characterDragFrom === index,
        reorderDisabled: reorderingCharacters
          || resources?.characterSorting?.mode !== 'custom'
          || model.characters.length < 2
          || !resources?.characters.some(item => item.id === character.id),
        onPointerDown: (event) => {
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          setCharacterDragFrom(index)
          setCharacterDropIndex(index + 1)
        },
        onPointerMove: (event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          const boundary = characterInsertionBoundary(event)
          if (boundary !== null) setCharacterDropIndex(boundary)
        },
        onPointerUp: (event) => {
          event.preventDefault()
          const boundary = characterInsertionBoundary(event) ?? characterDropIndex ?? index + 1
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          setCharacterDragFrom(null)
          setCharacterDropIndex(null)
          void moveCharacter(index, boundary)
        },
        onPointerCancel: () => {
          setCharacterDragFrom(null)
          setCharacterDropIndex(null)
        },
        collapsed: collapsedCharacters.has(character.id),
        unassignedOpen: expandedUnassigned.has(character.id),
        creating: creatingCharacterId === character.id,
        createDisabled: !model.workspaceReady || creatingCharacterId !== null,
        createPlaythrough,
        playClient,
        toggle: () => toggleSet(setCollapsedCharacters, character.id),
        toggleUnassigned: () => toggleSet(setExpandedUnassigned, character.id),
        openPlaythrough,
        openSession,
        beginPlaythroughRelink,
      }),
    ]),
    characterDragFrom !== null && characterDropIndex === model.characters.length
      ? h(CharacterDropPlaceholder, { key: 'drop-end' })
      : null,
    model.missingCharacters.length === 0 ? null : h('section', { className: 'dtv-play-section dtv-play-missing', 'data-open': missingOpen },
      h('button', {
        type: 'button',
        className: 'dtv-play-group',
        'aria-expanded': missingOpen,
        onClick: () => setMissingOpen(value => !value),
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, missingOpen ? '⌄' : '›'),
      h('span', { className: 'dtv-play-title' }, uiMessage('play.sidebar.missingCharacters')),
      h('span', { className: 'dtv-play-count' }, rawText(String(model.missingCharacters.length))),
      ),
      missingOpen ? model.missingCharacters.map(character => h(MissingCharacterGroup, {
        key: character.id,
        character,
        collapsed: collapsedMissingCharacters.has(character.id),
        toggle: () => toggleSet(setCollapsedMissingCharacters, character.id),
        beginRelink,
        beginPlaythroughRelink,
        relinkDisabled: (resources?.characters.length ?? 0) === 0 || relinkBusy,
        openPlaythrough,
        openSession,
        playClient,
      })) : null,
    ),
    h('section', { className: 'dtv-play-section', 'data-open': otherOpen },
      h('div', { className: 'dtv-play-group-line' },
      h('button', {
        type: 'button',
        className: 'dtv-play-group',
        'aria-expanded': otherOpen,
        onClick: () => setOtherOpen(value => !value),
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, otherOpen ? '⌄' : '›'),
      h('span', { className: 'dtv-play-title' }, uiMessage('play.sidebar.other')),
      h('span', { className: 'dtv-play-count' }, rawText(String(model.otherSessions.length))),
      ),
      h('button', {
        type: 'button',
        className: 'dtv-play-create',
        title: uiMessage('play.sidebar.createOrdinary'),
        'aria-label': uiMessage('play.sidebar.createOrdinary'),
        onClick: () => setOrdinaryPromptOpen(true),
      }, '+'),
      ),
      otherOpen && model.otherSessions.length === 0 ? h('p', { className: 'dtv-play-empty' }, uiMessage('play.sidebar.otherEmpty')) : null,
      otherOpen ? model.otherSessions.map(session => h('button', {
        key: session.id,
        type: 'button',
        className: 'dtv-play-row',
        'data-active': session.active,
        'data-kind': session.kind,
        onClick: () => openSession(session.id),
      },
      h('span', { className: 'dtv-play-chevron', 'aria-hidden': 'true' }, '•'),
      h('span', { className: 'dtv-play-title' }, rawText(session.title)),
      )) : null,
    ),
    ordinaryPromptOpen ? h('div', {
      className: 'dtv-play-modal-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'dtv-play-ordinary-prompt',
    }, h('div', { className: 'dtv-play-modal' },
      h('p', { id: 'dtv-play-ordinary-prompt' }, uiMessage('play.sidebar.ordinaryPrompt')),
      h('div', { className: 'dtv-play-modal-actions' },
        h('button', {
          type: 'button',
          className: 'dtv-play-modal-button',
          onClick: () => setOrdinaryPromptOpen(false),
        }, uiMessage('play.sidebar.ordinaryClose')),
        h('button', {
          type: 'button',
          className: 'dtv-play-modal-button',
          'data-primary': true,
          onClick: returnToNative,
        }, uiMessage('play.sidebar.returnNative')),
      ),
    )) : null,
    relinkRequest === null ? null : h('div', {
      className: 'dtv-play-modal-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'dtv-play-relink-prompt',
    }, h('div', { className: 'dtv-play-modal' },
      h('p', { id: 'dtv-play-relink-prompt' }, relinkRequest.kind === 'playthrough'
        ? uiMessage('play.sidebar.relinkPlaythroughPrompt', { name: relinkRequest.playthrough.title })
        : uiMessage('play.sidebar.relinkPrompt', { name: relinkRequest.character.name })),
      h('select', {
        value: relinkTargetId,
        disabled: relinkBusy,
        onChange: event => setRelinkTargetId(event.currentTarget.value),
      }, ...(resources?.characters ?? [])
        .filter(character => relinkRequest.kind !== 'playthrough' || character.id !== relinkRequest.character.id)
        .map(character => h('option', { key: character.id, value: character.id }, rawText(character.name)))),
      relinkRequest.kind !== 'playthrough' || assessPlaythroughCharacterRelink({
        playthrough: relinkRequest.playthrough,
        target: resources?.characters.find(character => character.id === relinkTargetId),
        characters: resources?.characters,
        missingCharacters: resources?.missingCharacters,
      }).automatic ? null : h('p', { className: 'dtv-play-relink-warning' }, uiMessage('play.sidebar.relinkMismatchWarning')),
      h('div', { className: 'dtv-play-modal-actions' },
        h('button', {
          type: 'button',
          className: 'dtv-play-modal-button',
          disabled: relinkBusy,
          onClick: () => setRelinkRequest(null),
        }, uiMessage('play.sidebar.ordinaryClose')),
        h('button', {
          type: 'button',
          className: 'dtv-play-modal-button',
          'data-primary': true,
          disabled: relinkBusy || relinkTargetId === '',
          onClick: commitRelink,
        }, relinkBusy ? rawText('…') : uiMessage('play.sidebar.relinkConfirm')),
      ),
    )),
  )
}
