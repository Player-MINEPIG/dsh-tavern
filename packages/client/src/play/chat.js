import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  CLIENT_REFRESH_EVENT,
  PLUGIN_ID,
} from '../../../identity.js'
import {
  createLocalizedElement,
  rawText,
  uiMessage,
  unwrapText,
} from '../i18n.js'
import {
  applyDisplayNameMacros,
  adjacentGreetingIndex,
  latestUserNodeSeq,
  projectGreeting,
  projectLiveTurns,
  projectTimelineQa,
  selectAssistantDisplay,
} from './chat-model.js'
import {
  applyDisplayRegex,
  getRegexDocument,
  resourceRegexRules,
} from './regex.js'
import { RichText } from './rich-text.js'
import { PlayTurnActions } from './turn-actions.js'
import { createTurnReconciler } from './turns.js'
import {
  bindPlaythroughImport,
  loadPlaythroughImportContext,
  unbindPlaythroughImport,
} from './import.js'
import { activeTimelineEntries } from '../../../play/src/timeline-tree.js'
import { consumeSwipeTransition } from './swipe-transition.js'
import { conversationDisplayStyle, useConversationDisplaySettings } from './display-settings.js'

const h = createLocalizedElement(createElement)
const turnReconcilers = new WeakMap()
const chatSnapshots = new WeakMap()
const MAX_CACHED_PLAYTHROUGHS = 32

const css = `
.dtv-play-chat{height:100%;min-height:0;box-sizing:border-box;overflow-x:hidden;overflow-y:auto;padding:22px max(18px,calc((100% - 780px)/2)) 36px;color:var(--dsw-alias-label-primary)}
.dtv-play-chat-stage{display:grid;min-width:0}.dtv-play-chat-frame{grid-area:1/1;min-width:0;will-change:transform,opacity}.dtv-play-chat-frame[data-phase=outgoing]{pointer-events:none}.dtv-play-chat-frame[data-phase=incoming][data-direction=next]{animation:dtv-play-swipe-in-next 180ms ease-out both}.dtv-play-chat-frame[data-phase=outgoing][data-direction=next]{animation:dtv-play-swipe-out-next 180ms ease-out both}.dtv-play-chat-frame[data-phase=incoming][data-direction=previous]{animation:dtv-play-swipe-in-previous 180ms ease-out both}.dtv-play-chat-frame[data-phase=outgoing][data-direction=previous]{animation:dtv-play-swipe-out-previous 180ms ease-out both}@keyframes dtv-play-swipe-in-next{from{transform:translateX(42px);opacity:.2}to{transform:translateX(0);opacity:1}}@keyframes dtv-play-swipe-out-next{from{transform:translateX(0);opacity:1}to{transform:translateX(-42px);opacity:0}}@keyframes dtv-play-swipe-in-previous{from{transform:translateX(-42px);opacity:.2}to{transform:translateX(0);opacity:1}}@keyframes dtv-play-swipe-out-previous{from{transform:translateX(0);opacity:1}to{transform:translateX(42px);opacity:0}}@media (prefers-reduced-motion:reduce){.dtv-play-chat-frame[data-phase]{animation-duration:1ms!important}}
.dtv-play-chat-target{display:flex;min-width:0;flex-direction:column;gap:8px}.dtv-play-chat-suffix{display:grid;min-width:0}.dtv-play-chat-suffix-list{display:flex;min-width:0;flex-direction:column;gap:22px}
.dtv-play-chat-list{display:flex;flex-direction:column;gap:22px}.dtv-play-chat-row{display:flex;flex-direction:column;gap:8px}.dtv-play-chat-role{font-size:11px;font-weight:700;color:var(--dsw-alias-label-tertiary)}
.dtv-play-chat-bubble{max-width:88%;box-sizing:border-box;border-radius:14px;padding:12px 14px;overflow-wrap:anywhere;font-size:calc(14px * var(--dtv-rp-text-scale,1));line-height:1.65}.dtv-play-chat-user{align-self:flex-end;background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-play-chat-assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block))}
.dtv-play-greeting{position:relative;align-self:flex-start;max-width:88%;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:6px}.dtv-play-greeting[data-locked=true]{grid-template-columns:minmax(0,1fr)}.dtv-play-greeting-text{border-radius:14px;padding:13px 15px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));overflow-wrap:anywhere;font-size:calc(14px * var(--dtv-rp-text-scale,1));line-height:1.65}
.dtv-play-greeting-empty{min-height:34px;visibility:hidden}
.dtv-play-greeting-button{width:30px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.dtv-play-greeting-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-greeting-button:disabled{opacity:.4;cursor:default}
.dtv-play-import-controls{align-self:center;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin:0 0 2px}.dtv-play-import-bound{width:100%;margin:0;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:11px}.dtv-play-import-button{min-height:30px;padding:5px 11px;border:1px solid var(--dsw-alias-border-subtle);border-radius:9px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer}.dtv-play-import-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-import-button:disabled{opacity:.45;cursor:default}.dtv-play-import-last{margin:0;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:700}
.dtv-play-chat-status{margin:16px 0;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}.dtv-play-chat-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-chat-running{align-self:flex-start;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dtv-play-rich>:first-child{margin-top:0}.dtv-play-rich>:last-child{margin-bottom:0}.dtv-play-rich p,.dtv-play-rich ul,.dtv-play-rich ol,.dtv-play-rich blockquote,.dtv-play-rich pre,.dtv-play-rich table{margin:0 0 .85em}.dtv-play-rich ul,.dtv-play-rich ol{padding-left:1.5em}.dtv-play-rich blockquote{padding-left:12px;border-left:3px solid var(--dsw-alias-border-secondary,var(--dsw-specific-divider));color:var(--dsw-alias-label-secondary)}.dtv-play-rich pre{max-width:100%;overflow:auto;padding:11px 12px;border-radius:9px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base));white-space:pre}.dtv-play-rich code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:.92em}.dtv-play-rich :not(pre)>code{padding:.12em .35em;border-radius:5px;background:var(--dsw-alias-markdown-code-inline,var(--dsw-alias-bg-base))}.dtv-play-rich table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.dtv-play-rich th,.dtv-play-rich td{padding:6px 9px;border:1px solid var(--dsw-alias-border-l2)}.dtv-play-rich img,.dtv-play-rich video{max-width:100%;height:auto}.dtv-play-rich a{color:var(--dsw-alias-state-business-primary);text-decoration:underline}.dtv-play-rich hr{border:0;border-top:1px solid var(--dsw-alias-border-l2)}
`

export function installPlayChatStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-chat"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-chat`
  style.textContent = css
  document.head.append(style)
}

function adoptedSessionIds(timeline, currentSessionId) {
  const ids = new Set([currentSessionId])
  for (const { variant } of activeTimelineEntries(timeline)) {
    if (typeof variant?.sessionId === 'string' && variant.sessionId !== '') ids.add(variant.sessionId)
  }
  return [...ids]
}

async function loadMessages(client, sessionIds, concurrency = 4) {
  const result = {}
  let cursor = 0
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor]
      cursor += 1
      result[sessionId] = await client.getMessages(sessionId)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker))
  return result
}

function turnReconciler(client) {
  let reconcile = turnReconcilers.get(client)
  if (reconcile === undefined) {
    reconcile = createTurnReconciler(client)
    turnReconcilers.set(client, reconcile)
  }
  return reconcile
}

export async function loadChatState(client, sessionId, playthrough) {
  const reconciled = await turnReconciler(client)(sessionId, playthrough)
  const timeline = reconciled.timeline ?? await client.getTimeline(playthrough)
  const messagesBySession = await loadMessages(client, adoptedSessionIds(timeline, sessionId))
  const selectionResponse = await client.getCharacterSelection(sessionId)
  const characterId = selectionResponse?.selection?.characterCardId
  const characterResponse = typeof characterId === 'string' && characterId !== ''
    ? await client.getCharacter(characterId)
    : null
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === 'function'
      ? getRegexDocument(client)
      : { schemaVersion: 1, rules: [] },
    typeof client.getActive === 'function'
      ? client.getActive(sessionId)
      : null,
  ])
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null,
  }
  const presetResponse = typeof bindings.presetId === 'string'
    && bindings.presetId !== ''
    && typeof client.getPreset === 'function'
    ? await client.getPreset(bindings.presetId)
    : null
  const rules = [
    ...regexDocument.rules,
    ...resourceRegexRules(presetResponse?.preset ?? presetResponse, {
      kind: 'preset',
      resourceId: bindings.presetId,
    }),
    ...resourceRegexRules(characterResponse?.character ?? characterResponse, {
      kind: 'character',
      resourceId: bindings.characterId,
    }),
  ]
  const character = characterResponse?.character
  const characterData = character?.data ?? character
  const macros = {
    user: active?.resources?.user?.name || 'User',
    character: characterData?.nickname || characterData?.name || character?.name || 'Assistant',
  }
  const regexDiagnostics = []
  const renderText = (text, target, context) => {
    const expanded = applyDisplayNameMacros(text, macros)
    const result = applyDisplayRegex(expanded, rules, bindings, target, context)
    regexDiagnostics.push(...result.diagnostics)
    return result.text
  }
  const timelineTurns = projectTimelineQa(timeline, messagesBySession)
  const greeting = projectGreeting({
    openingCharacterId: playthrough?.ext?.pmpDshTavern?.characterId,
    selectionResponse,
    characterResponse,
  })
  const importedContext = await loadPlaythroughImportContext(client, sessionId, playthrough, timeline)
  let importedTurns = []
  if (importedContext.document !== null) {
    const imported = importedContext.document
    importedTurns = [
      ...(typeof imported.greeting === 'string' && imported.greeting !== '' ? [{
        id: 'import-greeting', imported: true, hidden: false, userText: '',
        assistantText: imported.greeting, originalAssistantText: imported.greeting,
      }] : []),
      ...(imported.qa ?? []).map((qa, index) => ({
        id: `import-${index}`, imported: true, hidden: false,
        userText: qa.user,
        assistantText: qa.assistant, originalAssistantText: qa.assistant,
        importLast: index === imported.qa.length - 1,
      })),
    ]
  }
  const rawTurns = [...importedTurns, ...timelineTurns]
  const turns = Array(rawTurns.length)
  let depth = 0
  for (let index = rawTurns.length - 1; index >= 0; index -= 1) {
    const turn = rawTurns[index]
    const hasAssistant = turn.displayOverridden === true
      || (turn.assistantCandidates ?? [turn.assistantText]).some(text => text !== '')
    const assistantDepth = hasAssistant ? depth++ : undefined
    const userDepth = turn.userText === '' ? undefined : depth++
    const assistant = selectAssistantDisplay(
      turn,
      text => renderText(text, 'assistant', { depth: assistantDepth }),
    )
    turns[index] = {
      ...turn,
      userText: renderText(turn.userText, 'user', { depth: userDepth }),
      ...assistant,
    }
  }
  const rootMessages = messagesBySession[sessionId]
  const importMutable = (timeline?.nodes?.length ?? 0) === 0
    && rootMessages?.incompleteTurn !== true
    && !(rootMessages?.messages ?? []).some(message => message?.role === 'user' || message?.role === 'assistant')
    && importedContext.binding?.state !== 'consumed'
  return {
    timeline,
    turns,
    importBinding: importedContext.binding,
    importContext: importedContext.document,
    importMutable,
    greeting: importedTurns.length > 0 ? null : greeting === null ? null : {
      ...greeting,
      // A greeting is card metadata shown before the first durable turn, not an
      // assistant message. Output-only display regex (for example "keep only
      // <正文>") must not erase it merely because the card did not wrap its
      // greeting in the model-output protocol.
      text: applyDisplayNameMacros(greeting.text, macros),
    },
    regexDiagnostics,
    display: { rules, bindings, macros },
  }
}

export function applyTurnDisplayRegex(turn, display, { userDepth, assistantDepth } = {}) {
  const assistant = selectAssistantDisplay(turn, text => applyDisplayRegex(
    applyDisplayNameMacros(text, display.macros),
    display.rules,
    display.bindings,
    'assistant',
    { depth: assistantDepth },
  ).text)
  return {
    ...turn,
    userText: applyDisplayRegex(
      applyDisplayNameMacros(turn.userText, display.macros),
      display.rules,
      display.bindings,
      'user',
      { depth: userDepth },
    ).text,
    ...assistant,
  }
}
function Greeting({ greeting, busy, change, locked = false, footer = null }) {
  const multiple = (greeting?.options?.length ?? 0) > 1
  return h('div', { className: 'dtv-play-chat-row' },
    greeting === null ? null : h('span', { className: 'dtv-play-chat-role' }, rawText(greeting.characterName)),
    greeting === null ? h('div', { className: 'dtv-play-greeting dtv-play-greeting-empty', 'aria-hidden': true }) : h('div', {
      className: 'dtv-play-greeting',
      'data-locked': locked,
    },
      locked ? null : h('button', {
        type: 'button',
        className: 'dtv-play-greeting-button',
        disabled: busy || !multiple,
        title: uiMessage('play.chat.previousGreeting'),
        'aria-label': uiMessage('play.chat.previousGreeting'),
        onClick: () => change('previous'),
      }, '‹'),
      h(RichText, { className: 'dtv-play-greeting-text dtv-play-rich', text: greeting.text }),
      locked ? null : h('button', {
        type: 'button',
        className: 'dtv-play-greeting-button',
        disabled: busy || !multiple,
        title: uiMessage('play.chat.nextGreeting'),
        'aria-label': uiMessage('play.chat.nextGreeting'),
        onClick: () => change('next'),
      }, '›'),
    ),
    footer,
  )
}

export function turnHasDurableQaActions(turn) {
  return turn?.hidden !== true
    && turn?.imported !== true
    && turn?.transient !== true
    && turn?.variant != null
    && Array.isArray(turn?.variants)
}

export function turnHasVisibleRpContent(turn) {
  if (turn?.hidden === true) return false
  return turnHasDurableQaActions(turn)
    || turn?.importLast === true
    || (typeof turn?.userText === 'string' && turn.userText !== '')
    || (Array.isArray(turn?.assistantTexts) && turn.assistantTexts.length > 0)
    || (typeof turn?.assistantText === 'string' && turn.assistantText !== '')
    || turn?.displayOverridden === true
    || turn?.running === true
}

export function greetingSelectionLocked({ turns = [], latestUserSeq = -1, running = false } = {}) {
  return running
    || latestUserSeq >= 0
    || turns.some(turn => turn?.imported !== true)
}

function Turn({ turn, hideUser = false, swipePending = false, ...actionProps }) {
  if (!turnHasVisibleRpContent(turn)) return null
  const durableQa = turnHasDurableQaActions(turn)
  const assistantTexts = swipePending ? [] : Array.isArray(turn.assistantTexts)
    ? turn.assistantTexts
    : turn.assistantText === '' ? [] : [turn.assistantText]
  return h('div', { className: 'dtv-play-chat-row' },
    turn.importLast === true ? h('p', { className: 'dtv-play-import-last' }, uiMessage('play.import.lastQa')) : null,
    hideUser || turn.userText === '' ? null : h(RichText, { className: 'dtv-play-chat-bubble dtv-play-chat-user dtv-play-rich', text: turn.userText }),
    ...assistantTexts.map((text, index) => h(RichText, {
      key: `assistant-${index}`,
      className: 'dtv-play-chat-bubble dtv-play-chat-assistant dtv-play-rich',
      text,
    })),
    (swipePending || turn.running === true) && assistantTexts.length === 0
      ? h('p', { className: 'dtv-play-chat-running' }, uiMessage('play.chat.thinking'))
      : null,
    durableQa ? h(PlayTurnActions, {
      turn,
      ...actionProps,
      running: actionProps.running === true || swipePending,
    }) : null,
  )
}

export function ImportControls({
  playClient,
  playthrough,
  binding,
  locked,
  changed,
  onError,
}) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  if (locked) return null

  const choose = () => {
    if (!busy) input.current?.click()
  }
  const bind = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    setBusy(true)
    onError('')
    try {
      await bindPlaythroughImport(playClient, playthrough, file)
      changed()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  const unbind = async () => {
    if (busy || !window.confirm(unwrapText(uiMessage('play.import.unbindConfirm')))) return
    setBusy(true)
    onError('')
    try {
      await unbindPlaythroughImport(playClient, playthrough)
      changed()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  return h('div', { className: 'dtv-play-import-controls' },
    binding === null ? null : h('p', { className: 'dtv-play-import-bound' }, uiMessage('play.import.bound')),
    h('button', {
      type: 'button', className: 'dtv-play-import-button', disabled: busy, onClick: choose,
    }, binding === null ? uiMessage('play.import.bind') : uiMessage('play.import.replace')),
    binding === null ? null : h('button', {
      type: 'button', className: 'dtv-play-import-button', disabled: busy, onClick: unbind,
    }, uiMessage('play.import.unbind')),
    h('input', {
      ref: input,
      hidden: true,
      type: 'file',
      accept: '.json,.jsonl,application/json,application/x-ndjson',
      onChange: bind,
    }),
  )
}

function playthroughCacheKey(playthrough) {
  return typeof playthrough?.path === 'string' ? playthrough.path : ''
}

function cachedChatSnapshot(client, playthrough) {
  return chatSnapshots.get(client)?.get(playthroughCacheKey(playthrough)) ?? null
}

function rememberChatSnapshot(client, playthrough, snapshot) {
  let cache = chatSnapshots.get(client)
  if (cache === undefined) {
    cache = new Map()
    chatSnapshots.set(client, cache)
  }
  const key = playthroughCacheKey(playthrough)
  cache.delete(key)
  cache.set(key, snapshot)
  while (cache.size > MAX_CACHED_PLAYTHROUGHS) {
    cache.delete(cache.keys().next().value)
  }
}

function ChatFrame({
  snapshot,
  currentSessionId,
  liveNodes,
  partial,
  running,
  playClient,
  playthrough,
  openSession,
  greetingBusy,
  changeGreeting,
  changed,
  onError,
  phase = 'idle',
  direction = null,
  transitionEnded,
  pendingSwipe,
  onSwipePending,
}) {
  const state = snapshot.value
  const current = snapshot.sessionId === currentSessionId
  const interactive = current && phase !== 'outgoing'
  const liveSourceTurns = !current ? [] : projectLiveTurns({
    timeline: state.timeline,
    sessionId: currentSessionId,
    nodes: liveNodes,
    partial,
    running,
  })
  let liveDepth = 0
  const liveTurns = Array(liveSourceTurns.length)
  for (let index = liveSourceTurns.length - 1; index >= 0; index -= 1) {
    const turn = liveSourceTurns[index]
    const assistantDepth = turn.assistantText === '' ? undefined : liveDepth++
    const userDepth = turn.userText === '' ? undefined : liveDepth++
    liveTurns[index] = applyTurnDisplayRegex(turn, state.display, { userDepth, assistantDepth })
  }
  const importLocked = !interactive
    || state.importMutable !== true
    || running
    || latestUserNodeSeq(liveNodes) >= 0
    || liveTurns.length > 0
  const importControls = !interactive ? null : h(ImportControls, {
    playClient,
    playthrough,
    binding: state.importBinding,
    locked: importLocked,
    changed,
    onError,
  })
  const greetingLocked = !interactive || greetingSelectionLocked({
    turns: state.turns,
    latestUserSeq: latestUserNodeSeq(liveNodes),
    running,
  })

  return h('div', {
    className: 'dtv-play-chat-frame',
    'data-phase': phase,
    'data-direction': direction,
    onAnimationEnd: transitionEnded,
  }, h('div', { className: 'dtv-play-chat-list' },
    state.greeting === null && state.importBinding !== null ? null : h(Greeting, {
      greeting: state.greeting,
      busy: greetingBusy,
      change: changeGreeting,
      locked: greetingLocked,
      footer: state.importBinding === null ? importControls : null,
    }),
    ...state.turns.map(turn => h(Turn, {
      key: turn.id,
      turn,
      playthrough,
      playClient,
      openSession,
      running: running || !interactive,
      onChanged: changed,
      onError,
      onSwipePending,
      swipePending: pendingSwipe?.nodeId === turn.id,
    })),
    state.importBinding === null ? null : importControls,
    ...liveTurns.map(turn => h(Turn, { key: turn.id, turn })),
    state.greeting === null && state.turns.length === 0 && liveTurns.length === 0 && !running
      ? h('p', { className: 'dtv-play-chat-status' }, uiMessage('play.chat.empty'))
      : null,
    liveTurns.length === 0 && running && current
      ? h('p', { className: 'dtv-play-chat-running' }, uiMessage('play.chat.thinking'))
      : null,
  ))
}

export function swipeTransitionBoundary(transition) {
  if (transition === null || typeof transition?.nodeId !== 'string') return null
  const incomingIndex = transition.to?.value?.turns?.findIndex(turn => turn.id === transition.nodeId) ?? -1
  const outgoingIndex = transition.from?.value?.turns?.findIndex(turn => turn.id === transition.nodeId) ?? -1
  return incomingIndex < 0 || outgoingIndex < 0 ? null : { incomingIndex, outgoingIndex }
}

function TargetedSwipeTransition({
  transition,
  boundary,
  playClient,
  playthrough,
  openSession,
  greetingBusy,
  changeGreeting,
  changed,
  onError,
  transitionEnded,
}) {
  const incomingState = transition.to.value
  const outgoingState = transition.from.value
  const { incomingIndex, outgoingIndex } = boundary

  const actionProps = {
    playthrough,
    playClient,
    openSession,
    running: true,
    onChanged: changed,
    onError,
  }
  const renderSuffix = (turns, start, phase) => h('div', {
    key: `${phase}:${transition.nodeId}`,
    className: 'dtv-play-chat-frame',
    'data-phase': phase,
    'data-direction': transition.direction,
    onAnimationEnd: phase === 'incoming' ? transitionEnded : undefined,
  }, h('div', { className: 'dtv-play-chat-suffix-list' },
    ...turns.slice(start).map((turn, index) => h(Turn, {
      key: turn.id,
      turn,
      hideUser: index === 0,
      ...actionProps,
    })),
  ))
  const target = incomingState.turns[incomingIndex]

  return h('div', { className: 'dtv-play-chat-list' },
    incomingState.greeting === null && incomingState.importBinding !== null ? null : h(Greeting, {
      greeting: incomingState.greeting,
      busy: greetingBusy,
      change: changeGreeting,
      locked: true,
    }),
    ...incomingState.turns.slice(0, incomingIndex).map(turn => h(Turn, {
      key: turn.id,
      turn,
      ...actionProps,
    })),
    h('div', { className: 'dtv-play-chat-target' },
      target.userText === '' ? null : h(RichText, {
        className: 'dtv-play-chat-bubble dtv-play-chat-user dtv-play-rich',
        text: target.userText,
      }),
      h('div', { className: 'dtv-play-chat-suffix' },
        renderSuffix(outgoingState.turns, outgoingIndex, 'outgoing'),
        renderSuffix(incomingState.turns, incomingIndex, 'incoming'),
      ),
    ),
  )
}

export function MowanChatView({ sessionId, useSession, playClient, playthrough, openSession, chatScroll }) {
  installPlayChatStyles()
  const displaySettings = useConversationDisplaySettings()
  const sessionRevision = useSession(state => `${state.nodes?.length ?? 0}:${state.running === true}:${state.blank === true}`)
  const liveNodes = useSession(state => state.nodes)
  const partial = useSession(state => state.partial)
  const latestUserSeq = latestUserNodeSeq(liveNodes)
  const [revision, setRevision] = useState(0)
  const running = useSession(state => state.running === true)
  const [loadedState, setLoadedState] = useState(() => cachedChatSnapshot(playClient, playthrough))
  const loadedStateRef = useRef(loadedState)
  const transitionIntent = useRef({ sessionId: null, intent: null })
  const [transition, setTransition] = useState(null)
  const state = loadedState?.value ?? null
  const stateIsCurrent = loadedState?.sessionId === sessionId
  const [error, setError] = useState('')
  const [greetingBusy, setGreetingBusy] = useState(false)
  const [pendingSwipe, setPendingSwipe] = useState(null)
  const bottomAnchor = useRef(null)
  const initialScrollSession = useRef(null)
  const userSeqSession = useRef(null)
  const lastUserSeq = useRef(-1)

  const scrollToBottom = () => {
    const local = bottomAnchor.current
    if (local === null) return
    const scrollport = local.closest('[data-conversation-scroll]') ?? local
    scrollport.scrollTop = scrollport.scrollHeight
    chatScroll?.save(null)
  }

  useLayoutEffect(() => {
    if (!stateIsCurrent || initialScrollSession.current === sessionId) return
    initialScrollSession.current = sessionId
    scrollToBottom()
  }, [sessionId, state, stateIsCurrent])

  useLayoutEffect(() => {
    if (userSeqSession.current !== sessionId) {
      userSeqSession.current = sessionId
      lastUserSeq.current = latestUserSeq
      return
    }
    if (latestUserSeq <= lastUserSeq.current) return
    lastUserSeq.current = latestUserSeq
    scrollToBottom()
  }, [latestUserSeq, sessionId])

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (transition === null) return undefined
    const targetSessionId = transition.to.sessionId
    const timer = window.setTimeout(() => {
      setTransition(current => current?.to.sessionId === targetSessionId ? null : current)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [transition])

  useEffect(() => {
    let active = true
    if (transitionIntent.current.sessionId !== sessionId) {
      transitionIntent.current = {
        sessionId,
        intent: consumeSwipeTransition(sessionId),
      }
      setTransition(null)
    }
    setError('')
    loadChatState(playClient, sessionId, playthrough).then(next => {
      if (!active) return
      const incoming = { sessionId, value: next }
      const previous = loadedStateRef.current
      if (previous !== null && previous.sessionId !== sessionId) {
        const intent = transitionIntent.current.sessionId === sessionId
          ? transitionIntent.current.intent
          : null
        setTransition(intent === null ? null : {
          from: previous,
          to: incoming,
          direction: intent.direction,
          nodeId: intent.nodeId,
        })
      }
      loadedStateRef.current = incoming
      rememberChatSnapshot(playClient, playthrough, incoming)
      setPendingSwipe(current => current?.sourceSessionId !== sessionId ? null : current)
      setLoadedState(incoming)
    }).catch(reason => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [playClient, playthrough, revision, sessionId, sessionRevision])

  const changeGreeting = async direction => {
    const greetingLocked = greetingSelectionLocked({
      turns: state?.turns ?? [],
      latestUserSeq,
      running,
    })
    if (!stateIsCurrent || state?.greeting == null || greetingBusy || greetingLocked) return
    const next = adjacentGreetingIndex(state.greeting, direction)
    if (next === null) return
    setGreetingBusy(true)
    setError('')
    try {
      await playClient.putGreetingIndex(sessionId, next)
      setRevision(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setGreetingBusy(false)
    }
  }

  const changed = () => setRevision(value => value + 1)
  const swipePending = (nodeId, active) => {
    setPendingSwipe(active ? { nodeId, sourceSessionId: sessionId } : null)
  }
  const transitionEnded = event => {
    if (event.target !== event.currentTarget) return
    setTransition(current => current?.to.sessionId === loadedState?.sessionId ? null : current)
  }
  const frame = (snapshot, phase) => h(ChatFrame, {
    key: `${phase}:${snapshot.sessionId}`,
    snapshot,
    currentSessionId: sessionId,
    liveNodes,
    partial,
    running,
    playClient,
    playthrough,
    openSession,
    greetingBusy,
    changeGreeting,
    changed,
    onError: setError,
    pendingSwipe,
    onSwipePending: swipePending,
    phase,
    direction: transition?.direction ?? null,
    transitionEnded: phase === 'incoming' ? transitionEnded : undefined,
  })
  const transitionBoundary = swipeTransitionBoundary(transition)

  return h('div', { className: 'dtv-play-chat', style: conversationDisplayStyle(displaySettings) },
    error === '' ? null : h('p', { className: 'dtv-play-chat-status', 'data-error': true }, rawText(error)),
    state === null && error === '' ? h('p', { className: 'dtv-play-chat-status' }, uiMessage('play.chat.loading')) : null,
    loadedState === null ? null : h('div', { className: 'dtv-play-chat-stage' },
      transitionBoundary === null ? frame(loadedState, 'idle') : h(TargetedSwipeTransition, {
        transition,
        boundary: transitionBoundary,
        playClient,
        playthrough,
        openSession,
        greetingBusy,
        changeGreeting,
        changed,
        onError: setError,
        transitionEnded,
      }),
    ),
    h('span', { ref: bottomAnchor, 'aria-hidden': true }),
  )
}
