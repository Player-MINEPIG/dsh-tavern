import {
  createElement,
  useState,
} from 'react'
import { PLUGIN_ID } from '../../../identity.js'
import {
  createLocalizedElement,
  translate,
  uiMessage,
} from '../i18n.js'
import { createPlayNodeController } from './nodes.js'

const h = createLocalizedElement(createElement)
const controllers = new WeakMap()

const css = `
.dtv-play-turn-actions{display:flex;align-items:center;gap:2px;min-height:28px}.dtv-play-turn-action{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;display:grid;place-items:center}.dtv-play-turn-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dtv-play-turn-action:disabled{cursor:default;opacity:.38}.dtv-play-turn-position{padding:0 5px;color:var(--dsw-alias-label-tertiary);font-size:10px}
`

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-turn-actions"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = `${PLUGIN_ID}-play-turn-actions`
  style.textContent = css
  document.head.append(style)
}

function controller(client) {
  let value = controllers.get(client)
  if (value === undefined) {
    value = createPlayNodeController(client)
    controllers.set(client, value)
  }
  return value
}

function Action({ icon, label, disabled = false, disabledLabel, onClick }) {
  return h('button', {
    type: 'button',
    className: 'dtv-play-turn-action',
    disabled,
    title: disabled ? (disabledLabel ?? uiMessage('play.chat.runningDisabled')) : label,
    'aria-label': label,
    onClick,
  }, icon)
}

export function PlayTurnActions({
  turn,
  playthrough,
  playClient,
  openSession,
  running,
  onChanged,
  onError,
}) {
  installStyles()
  const [busy, setBusy] = useState(false)
  const disabled = running || busy
  const position = Math.max(0, turn.variants.findIndex(item => item.id === turn.variant.id))

  const mutate = async operation => {
    if (disabled) return
    setBusy(true)
    onError('')
    try {
      await operation()
      onChanged()
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const adopt = offset => mutate(async () => {
    const target = turn.variants[(position + offset + turn.variants.length) % turn.variants.length]
    const result = await controller(playClient).adoptVariant(playthrough, turn.id, target.id)
    openSession(result.sessionId)
  })

  const copy = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error(translate('play.chat.copyUnavailable'))
      await navigator.clipboard.writeText(turn.assistantText)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  if (turn.hidden) {
    return h('div', { className: 'dtv-play-turn-actions' },
      h(Action, {
        icon: '◉',
        label: uiMessage('play.chat.restoreNode'),
        disabled,
        onClick: () => mutate(() => controller(playClient).setHidden(playthrough, turn.id, false)),
      }),
    )
  }

  return h('div', { className: 'dtv-play-turn-actions' },
    h(Action, { icon: '⧉', label: uiMessage('play.chat.copy'), onClick: copy }),
    h(Action, {
      icon: '‹',
      label: uiMessage('play.chat.previousReply'),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage('play.chat.noOtherReply') : undefined,
      onClick: () => adopt(-1),
    }),
    turn.variants.length < 2 ? null : h('span', { className: 'dtv-play-turn-position' }, `${position + 1}/${turn.variants.length}`),
    h(Action, {
      icon: '›',
      label: uiMessage('play.chat.nextReply'),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage('play.chat.noOtherReply') : undefined,
      onClick: () => adopt(1),
    }),
    h(Action, {
      icon: '✦',
      label: uiMessage('play.chat.generateReply'),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).createReplySwipe(playthrough, turn.id)
        openSession(result.sessionId)
      }),
    }),
    h(Action, {
      icon: '⑂',
      label: uiMessage('play.chat.forkPlaythrough'),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).forkPlaythrough(playthrough, turn.id)
        openSession(result.sessionId)
      }),
    }),
    h(Action, {
      icon: '✎',
      label: uiMessage('play.chat.editDisplay'),
      disabled,
      onClick: () => {
        const value = window.prompt(translate('play.chat.editDisplayPrompt'), turn.assistantText)
        if (value !== null) mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, value))
      },
    }),
    turn.displayOverridden ? h(Action, {
      icon: '↺',
      label: uiMessage('play.chat.restoreOriginal'),
      disabled,
      onClick: () => mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, null)),
    }) : null,
    h(Action, {
      icon: '⊘',
      label: uiMessage('play.chat.hideNode'),
      disabled,
      onClick: () => {
        if (window.confirm(translate('play.chat.hideConfirm'))) {
          mutate(() => controller(playClient).setHidden(playthrough, turn.id, true))
        }
      },
    }),
  )
}
