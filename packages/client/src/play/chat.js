import {
  createElement,
  useEffect,
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
} from '../i18n.js'
import {
  adjacentGreetingIndex,
  projectGreeting,
  projectTimelineQa,
} from './chat-model.js'
import {
  applyDisplayRegex,
  getRegexDocument,
} from './regex.js'
import { PlayTurnActions } from './turn-actions.js'
import { createTurnReconciler } from './turns.js'

const h = createLocalizedElement(createElement)
const turnReconcilers = new WeakMap()

const css = `
.dtv-play-chat{height:100%;min-height:0;box-sizing:border-box;overflow:auto;padding:22px max(18px,calc((100% - 780px)/2)) 36px;color:var(--dsw-alias-label-primary)}
.dtv-play-chat-list{display:flex;flex-direction:column;gap:22px}.dtv-play-chat-row{display:flex;flex-direction:column;gap:8px}.dtv-play-chat-role{font-size:11px;font-weight:700;color:var(--dsw-alias-label-tertiary)}
.dtv-play-chat-bubble{max-width:88%;box-sizing:border-box;border-radius:14px;padding:12px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}.dtv-play-chat-user{align-self:flex-end;background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-play-chat-assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block))}
.dtv-play-greeting{position:relative;align-self:flex-start;max-width:88%;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:6px}.dtv-play-greeting-text{border-radius:14px;padding:13px 15px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}
.dtv-play-greeting-button{width:30px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.dtv-play-greeting-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-greeting-button:disabled{opacity:.4;cursor:default}
.dtv-play-chat-status{margin:16px 0;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}.dtv-play-chat-status[data-error=true]{color:var(--dsw-alias-state-error)}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-chat"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-chat`
  style.textContent = css
  document.head.append(style)
}

function adoptedSessionIds(timeline, currentSessionId) {
  const ids = new Set([currentSessionId])
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find(item => item.id === node.adoptedVariantId)
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
  const regexDiagnostics = []
  const renderText = (text, target) => {
    const result = applyDisplayRegex(text, regexDocument.rules, bindings, target)
    regexDiagnostics.push(...result.diagnostics)
    return result.text
  }
  const turns = projectTimelineQa(timeline, messagesBySession).map(turn => ({
    ...turn,
    userText: renderText(turn.userText, 'user'),
    assistantText: renderText(turn.assistantText, 'assistant'),
  }))
  const greeting = projectGreeting({
    timeline,
    messages: messagesBySession[sessionId]?.messages ?? [],
    selectionResponse,
    characterResponse,
  })
  const importContextPath = playthrough?.ext?.pmpDshTavern?.importContextPath
  let importedTurns = []
  if (typeof importContextPath === 'string' && importContextPath !== '') {
    const imported = JSON.parse((await client.getFile(importContextPath)).content)
    importedTurns = [
      ...(typeof imported.greeting === 'string' && imported.greeting !== '' ? [{
        id: 'import-greeting', imported: true, hidden: false, userText: '',
        assistantText: renderText(imported.greeting, 'assistant'), originalAssistantText: imported.greeting,
      }] : []),
      ...(imported.qa ?? []).map((qa, index) => ({
        id: `import-${index}`, imported: true, hidden: false,
        userText: renderText(qa.user, 'user'),
        assistantText: renderText(qa.assistant, 'assistant'), originalAssistantText: qa.assistant,
      })),
    ]
  }
  return {
    timeline,
    turns: [...importedTurns, ...turns],
    greeting: importedTurns.length > 0 ? null : greeting === null ? null : { ...greeting, text: renderText(greeting.text, 'assistant') },
    regexDiagnostics,
  }
}

function Greeting({ greeting, busy, change }) {
  const multiple = greeting.options.length > 1
  return h('div', { className: 'dtv-play-chat-row' },
    h('span', { className: 'dtv-play-chat-role' }, rawText(greeting.characterName)),
    h('div', { className: 'dtv-play-greeting' },
      h('button', {
        type: 'button',
        className: 'dtv-play-greeting-button',
        disabled: busy || !multiple,
        title: uiMessage('play.chat.previousGreeting'),
        'aria-label': uiMessage('play.chat.previousGreeting'),
        onClick: () => change('previous'),
      }, '‹'),
      h('div', { className: 'dtv-play-greeting-text' }, rawText(greeting.text)),
      h('button', {
        type: 'button',
        className: 'dtv-play-greeting-button',
        disabled: busy || !multiple,
        title: uiMessage('play.chat.nextGreeting'),
        'aria-label': uiMessage('play.chat.nextGreeting'),
        onClick: () => change('next'),
      }, '›'),
    ),
  )
}

function Turn({ turn, ...actionProps }) {
  if (turn.hidden) {
    return h('div', { className: 'dtv-play-chat-row' },
      h('p', { className: 'dtv-play-chat-status' }, uiMessage('play.chat.hiddenNode')),
      h(PlayTurnActions, { turn, ...actionProps }),
    )
  }
  return h('div', { className: 'dtv-play-chat-row' },
    turn.userText === '' ? null : h('div', { className: 'dtv-play-chat-bubble dtv-play-chat-user' }, rawText(turn.userText)),
    turn.assistantText === '' ? null : h('div', { className: 'dtv-play-chat-bubble dtv-play-chat-assistant' }, rawText(turn.assistantText)),
    turn.imported ? null : h(PlayTurnActions, { turn, ...actionProps }),
  )
}

export function MowanChatView({ sessionId, useSession, playClient, playthrough, openSession }) {
  installStyles()
  const sessionRevision = useSession(state => `${state.nodes?.length ?? 0}:${state.running === true}:${state.blank === true}`)
  const [revision, setRevision] = useState(0)
  const running = useSession(state => state.running === true)
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [greetingBusy, setGreetingBusy] = useState(false)

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    let active = true
    setError('')
    loadChatState(playClient, sessionId, playthrough).then(next => {
      if (active) setState(next)
    }).catch(reason => {
      if (!active) return
      setState(null)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [playClient, playthrough, revision, sessionId, sessionRevision])

  const changeGreeting = async direction => {
    if (state?.greeting == null || greetingBusy) return
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

  return h('div', { className: 'dtv-play-chat' },
    error === '' ? null : h('p', { className: 'dtv-play-chat-status', 'data-error': true }, rawText(error)),
    state === null && error === '' ? h('p', { className: 'dtv-play-chat-status' }, uiMessage('play.chat.loading')) : null,
    state === null ? null : h('div', { className: 'dtv-play-chat-list' },
      state.greeting === null ? null : h(Greeting, { greeting: state.greeting, busy: greetingBusy, change: changeGreeting }),
      ...state.turns.map(turn => h(Turn, {
        key: turn.id,
        turn,
        playthrough,
        playClient,
        openSession,
        running,
        onChanged: () => setRevision(value => value + 1),
        onError: setError,
      })),
      state.greeting === null && state.turns.length === 0
        ? h('p', { className: 'dtv-play-chat-status' }, uiMessage('play.chat.empty'))
        : null,
    ),
  )
}
