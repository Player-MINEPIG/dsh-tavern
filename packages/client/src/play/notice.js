import {
  createElement,
  useEffect,
  useState,
} from 'react'
import { CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../../identity.js'
import {
  createLocalizedElement,
  rawText,
  uiMessage,
} from '../i18n.js'
import { loadChatState } from './chat.js'
import {
  adjacentGreetingIndex,
  loadCurrentPlaythrough,
} from './chat-model.js'
import { RichText } from './rich-text.js'
import { shouldShowUnboundNotice } from './sidebar-model.js'

const h = createLocalizedElement(createElement)

const css = `
.dtv-play-unbound-notice{box-sizing:border-box;width:100%;margin:0;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 34%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45}
.dtv-play-opening-dock{box-sizing:border-box;width:100%;min-width:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-primary);box-shadow:0 4px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.dtv-play-opening-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px}.dtv-play-opening-name{min-width:0;overflow:hidden;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.dtv-play-opening-index{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px}
.dtv-play-opening-body{box-sizing:border-box;max-height:45dvh;overflow-x:hidden;overflow-y:auto;padding:13px 15px;font-size:14px;line-height:1.65;overflow-wrap:anywhere}.dtv-play-opening-body>:first-child{margin-top:0}.dtv-play-opening-body>:last-child{margin-bottom:0}.dtv-play-opening-body p,.dtv-play-opening-body ul,.dtv-play-opening-body ol,.dtv-play-opening-body blockquote,.dtv-play-opening-body pre,.dtv-play-opening-body table{margin:0 0 .85em}.dtv-play-opening-body ul,.dtv-play-opening-body ol{padding-left:1.5em}.dtv-play-opening-body pre,.dtv-play-opening-body table{max-width:100%;overflow:auto}.dtv-play-opening-body img,.dtv-play-opening-body video{max-width:100%;height:auto}
.dtv-play-opening-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2)}.dtv-play-opening-button{min-width:0;padding:6px 10px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}.dtv-play-opening-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-opening-button:disabled{opacity:.4;cursor:default}.dtv-play-opening-error{margin:0;padding:7px 12px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-state-error);font-size:11px;line-height:1.45}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-notice"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-notice`
  style.textContent = css
  document.head.append(style)
}

export function PlaySessionDock({ session, useSessions, playClient }) {
  installStyles()
  const sessionId = session?.sessionId ?? null
  const sessionBlank = session?.blank === true
  const composerPhase = session?.composerPhase
  const summary = useSessions(state => sessionId === null ? null : state.byId?.[sessionId] ?? null)
  const [revision, setRevision] = useState(0)
  const [content, setContent] = useState(null)
  const [greetingBusy, setGreetingBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    let active = true
    setContent(current => current?.sessionId === sessionId && current.kind === 'opening' ? current : null)
    setError('')
    if (sessionId === null || summary === null) return () => { active = false }
    Promise.all([
      playClient.getWorkspace(),
      playClient.getCharacterSelection(sessionId),
    ]).then(([workspace, selection]) => {
      if (!active) return
      if (shouldShowUnboundNotice({ workspace, session: summary, selection })) {
        setContent({ kind: 'unbound', sessionId })
        return
      }
      if (!sessionBlank || composerPhase !== 'blank') {
        setContent(null)
        return
      }
      loadCurrentPlaythrough(playClient, summary).then(binding => {
        if (!active) return
        if (binding === null || (binding.timeline?.nodes?.length ?? 0) !== 0) {
          setContent(null)
          return
        }
        loadChatState(playClient, sessionId, binding.playthrough).then(state => {
          if (!active) return
          setContent(state.greeting === null ? null : { kind: 'opening', greeting: state.greeting, sessionId })
        }, reason => {
          if (active) setError(reason instanceof Error ? reason.message : String(reason))
        })
      }, reason => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    }, reason => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [composerPhase, playClient, revision, sessionBlank, sessionId, summary])

  const changeGreeting = async direction => {
    if (content?.kind !== 'opening' || greetingBusy || sessionId === null) return
    const next = adjacentGreetingIndex(content.greeting, direction)
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

  if (content?.sessionId !== sessionId) return null
  if (content.kind === 'unbound') {
    return h('p', {
      className: 'dtv-play-unbound-notice',
      role: 'note',
    }, uiMessage('play.notice.unbound'))
  }
  if (content.kind !== 'opening' || !sessionBlank || composerPhase !== 'blank') return null
  const greeting = content.greeting
  const multiple = greeting.options.length > 1
  const position = Math.max(0, greeting.options.findIndex(option => option.index === greeting.index)) + 1
  return h('section', {
    className: 'dtv-play-opening-dock',
  },
  h('header', { className: 'dtv-play-opening-header' },
    h('span', { className: 'dtv-play-opening-name' }, rawText(greeting.characterName)),
    h('span', { className: 'dtv-play-opening-index' }, rawText(`${position} / ${greeting.options.length}`)),
  ),
  h(RichText, { className: 'dtv-play-opening-body', text: greeting.text }),
  error === '' ? null : h('p', { className: 'dtv-play-opening-error', role: 'alert' }, rawText(error)),
  h('footer', { className: 'dtv-play-opening-actions' },
    h('button', {
      type: 'button',
      className: 'dtv-play-opening-button',
      disabled: greetingBusy || !multiple,
      onClick: () => changeGreeting('previous'),
    }, uiMessage('play.chat.previousGreeting')),
    h('button', {
      type: 'button',
      className: 'dtv-play-opening-button',
      disabled: greetingBusy || !multiple,
      onClick: () => changeGreeting('next'),
    }, uiMessage('play.chat.nextGreeting')),
  ))
}
