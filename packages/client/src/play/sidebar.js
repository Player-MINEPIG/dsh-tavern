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
  loadPlaySidebarResources,
  requiresSystemWorkspaceConfirmation,
  loadSessionCharacterBindings,
  projectPlaySidebar,
  sessionIdsInRpWorkspace,
} from './sidebar-model.js'

const h = createLocalizedElement(createElement)

const css = `
.dtv-play-sidebar{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:6px 7px 10px;overflow:auto;zoom:var(--dtv-ui-scale,1);color:var(--dsw-alias-label-primary)}
.dtv-play-section{display:flex;flex-direction:column;gap:2px;border-radius:10px}.dtv-play-section[data-open=true]{padding-bottom:3px}
.dtv-play-group,.dtv-play-row{width:100%;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:7px}.dtv-play-group:hover,.dtv-play-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-row-line{display:flex;align-items:center;gap:2px}.dtv-play-row-line>.dtv-play-row{min-width:0;flex:1}.dtv-play-row-line>.dtv-play-io{flex:none}
.dtv-play-group{min-height:38px;padding:4px 6px;font-size:12px;font-weight:680}.dtv-play-row{min-height:32px;padding:4px 7px 4px 27px;font-size:11px}.dtv-play-row[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));font-weight:650}.dtv-play-row:disabled{cursor:default;opacity:.55}
.dtv-play-group-line{display:flex;align-items:center;gap:3px}.dtv-play-group-line>.dtv-play-group{min-width:0;flex:1}.dtv-play-create{width:30px;height:30px;flex:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-create:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-create:disabled{cursor:default;opacity:.5}
.dtv-play-chevron{width:10px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary)}.dtv-play-title{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dtv-play-count{flex:none;border-radius:9px;padding:1px 6px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-tertiary);font-size:9px}
.dtv-play-avatar{position:relative;width:25px;height:25px;flex:none;border-radius:50%;overflow:hidden;background:var(--dsw-specific-tip);display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:10px}.dtv-play-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dtv-play-subgroup{display:flex;flex-direction:column;gap:1px}.dtv-play-subgroup>.dtv-play-group{min-height:30px;padding-left:25px;font-size:10px;font-weight:620;color:var(--dsw-alias-label-secondary)}
.dtv-play-empty,.dtv-play-status{margin:0;padding:7px 9px;font-size:10px;line-height:1.45;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.dtv-play-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-rail{height:100%;box-sizing:border-box;padding:7px;display:flex;flex-direction:column;align-items:center;gap:7px;overflow:auto;zoom:var(--dtv-ui-scale,1)}.dtv-play-rail-button{width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:grid;place-items:center}.dtv-play-rail-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-rail-button .dtv-play-avatar{width:30px;height:30px}
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

function CharacterGroup({ character, collapsed, unassignedOpen, creating, createDisabled, toggle, toggleUnassigned, createPlaythrough, openPlaythrough, openSession, playClient }) {
  const count = character.playthroughs.length + character.unassigned.length
  return h('section', { className: 'dtv-play-section', 'data-open': !collapsed },
    h('div', { className: 'dtv-play-group-line' },
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
    h(PlayIoMenu, { playClient, playthrough, openSession, trigger: '⋯', placement: 'sidebar' }),
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

export function PlayWorkspaceBrowser({
  wide = true,
  expandSidebar,
  useSessions,
  useWorkspaces,
  playClient,
  openSession,
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
  const creator = useRef(null)
  if (creator.current?.client !== playClient) {
    creator.current = { client: playClient, controller: createPlaythroughController(playClient) }
  }
  const [creatingCharacterId, setCreatingCharacterId] = useState(null)
  const [revision, setRevision] = useState(0)
  const [resources, setResources] = useState(null)
  const [sessionCharacters, setSessionCharacters] = useState({})
  const [status, setStatus] = useState(null)
  const [collapsedCharacters, setCollapsedCharacters] = useState(() => new Set())
  const [expandedUnassigned, setExpandedUnassigned] = useState(() => new Set())
  const [otherOpen, setOtherOpen] = useState(false)

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
    catalog: resources?.catalog,
    timelines: resources?.timelines,
    sessions,
    sessionIds,
    archivedSessionIds,
    currentId,
    sessionCharacters,
  })

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
      openSession(result.sessionId)
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
      const target = typeof focus.sessionId === 'string' ? focus.sessionId : playthrough.rootSessionId
      if (typeof target !== 'string' || !playthrough.sessionIds.includes(target)) {
        setStatus({ key: 'play.sidebar.sessionMissing' })
        return
      }
      openSession(target)
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) })
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
    resources !== null && model.characters.length === 0 ? h('p', { className: 'dtv-play-empty' }, uiMessage('play.sidebar.noCharacters')) : null,
    ...model.characters.map(character => h(CharacterGroup, {
      key: character.id,
      character,
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
    })),
    h('section', { className: 'dtv-play-section', 'data-open': otherOpen },
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
  )
}
