import {
  createElement,
  useEffect,
  useState,
} from 'react'
import { CLIENT_REFRESH_EVENT, PLUGIN_ID } from '../../../identity.js'
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
.dtv-play-display-editor{display:flex;flex-direction:column;align-self:stretch;gap:8px}.dtv-play-display-editor textarea{box-sizing:border-box;width:100%;min-height:180px;max-height:55vh;resize:vertical;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.65}.dtv-play-display-editor textarea:focus{outline:2px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#2677d9) 35%,transparent);border-color:var(--dsw-alias-state-business-primary,#2677d9)}.dtv-play-display-editor-actions{display:flex;justify-content:flex-end;gap:8px}.dtv-play-display-editor-button{min-width:76px;min-height:34px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}.dtv-play-display-editor-button[data-primary=true]{border-color:transparent;background:var(--dsw-alias-state-business-primary,#2677d9);color:var(--dsw-alias-button-primary-label,#fff)}.dtv-play-display-editor-button:disabled{cursor:default;opacity:.45}
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

export function turnActionCapabilities(turn) {
  return {
    copy: true,
    variants: true,
    generateReply: true,
    fork: true,
    editDisplay: true,
  }
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
  const [editor, setEditor] = useState(null)
  const disabled = running || busy
  const position = Math.max(0, turn.variants.findIndex(item => item.id === turn.variant.id))
  const capabilities = turnActionCapabilities(turn)
  const hasPreviousVariant = position > 0
  const hasNextVariant = position + 1 < turn.variants.length
  useEffect(() => setEditor(null), [turn.id, turn.variant.id])

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

  const adopt = targetPosition => mutate(async () => {
    const target = turn.variants[targetPosition]
    if (target === undefined) throw new TypeError('Reply variant does not exist')
    const result = await controller(playClient).adoptVariant(playthrough, turn.id, target.id)
    openSession(result.sessionId)
  })

  const generate = () => mutate(async () => {
    const result = await controller(playClient).createReplySwipe(playthrough, turn.id)
    openSession(result.sessionId)
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
  })

  const copy = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error(translate('play.chat.copyUnavailable'))
      await navigator.clipboard.writeText(turn.assistantText)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  if (editor !== null) {
    return h('form', {
      className: 'dtv-play-display-editor',
      onSubmit: event => {
        event.preventDefault()
        const value = editor
        mutate(async () => {
          await controller(playClient).setDisplayOverride(playthrough, turn.id, value)
          setEditor(null)
        })
      },
    },
    h('textarea', {
      value: editor,
      autoFocus: true,
      disabled,
      'aria-label': uiMessage('play.chat.editDisplayPrompt'),
      onChange: event => setEditor(event.target.value),
      onKeyDown: event => {
        if (event.key === 'Escape' && !disabled) setEditor(null)
      },
    }),
    h('div', { className: 'dtv-play-display-editor-actions' },
      h('button', {
        type: 'button',
        className: 'dtv-play-display-editor-button',
        disabled,
        onClick: () => setEditor(null),
      }, uiMessage('common.cancel')),
      h('button', {
        type: 'submit',
        className: 'dtv-play-display-editor-button',
        'data-primary': true,
        disabled,
      }, uiMessage('common.save')),
    ))
  }

  return h('div', { className: 'dtv-play-turn-actions' },
    h(Action, { icon: '⧉', label: uiMessage('play.chat.copy'), onClick: copy }),
    !capabilities.variants ? null : h(Action, {
      icon: '‹',
      label: uiMessage('play.chat.previousReply'),
      disabled: disabled || !hasPreviousVariant,
      disabledLabel: !hasPreviousVariant ? uiMessage('play.chat.noOtherReply') : undefined,
      onClick: () => adopt(position - 1),
    }),
    !capabilities.variants || turn.variants.length < 2 ? null : h('span', { className: 'dtv-play-turn-position' }, `${position + 1}/${turn.variants.length}`),
    !capabilities.variants ? null : h(Action, {
      icon: '›',
      label: uiMessage(hasNextVariant ? 'play.chat.nextReply' : 'play.chat.generateReply'),
      disabled,
      onClick: hasNextVariant ? () => adopt(position + 1) : generate,
    }),
    h(Action, {
      icon: '⑂',
      label: uiMessage('play.chat.forkPlaythrough'),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).forkPlaythrough(playthrough, turn.id)
        window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
        openSession(result.sessionId)
      }),
    }),
    h(Action, {
      icon: '↩',
      label: uiMessage('play.chat.rollbackPlaythrough'),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).rollbackPlaythrough(playthrough, turn.id)
        openSession(result.sessionId)
      }),
    }),
    h(Action, {
      icon: '✎',
      label: uiMessage('play.chat.editDisplay'),
      disabled,
      onClick: () => setEditor(turn.assistantText),
    }),
    turn.displayOverridden ? h(Action, {
      icon: '↺',
      label: uiMessage('play.chat.restoreOriginal'),
      disabled,
      onClick: () => mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, null)),
    }) : null,
  )
}
