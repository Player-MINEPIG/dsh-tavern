import {
  createElement,
  useEffect,
  useState,
} from 'react'
import { CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../../identity.js'
import { createLocalizedElement, uiMessage } from '../i18n.js'
import { shouldShowUnboundNotice } from './sidebar-model.js'

const h = createLocalizedElement(createElement)

const css = `
.dtv-play-unbound-notice{box-sizing:border-box;width:100%;margin:0;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 34%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-notice"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-notice`
  style.textContent = css
  document.head.append(style)
}

export function PlayUnboundNotice({ session, useSessions, playClient }) {
  installStyles()
  const sessionId = session?.sessionId ?? null
  const summary = useSessions(state => sessionId === null ? null : state.byId?.[sessionId] ?? null)
  const [revision, setRevision] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh)
  }, [])

  useEffect(() => {
    let active = true
    setVisible(false)
    if (sessionId === null || summary === null) return () => { active = false }
    Promise.all([
      playClient.getWorkspace(),
      playClient.getCharacterSelection(sessionId),
    ]).then(([workspace, selection]) => {
      if (active) setVisible(shouldShowUnboundNotice({ workspace, session: summary, selection }))
    }, () => {
      if (active) setVisible(false)
    })
    return () => { active = false }
  }, [playClient, revision, sessionId, summary])

  if (!visible) return null
  return h('p', {
    className: 'dtv-play-unbound-notice',
    role: 'note',
  }, uiMessage('play.notice.unbound'))
}
