import { CLIENT_CONVERSATION_SETTINGS_EVENT } from '../../identity.js'

export const DEFAULT_CONVERSATION_SETTINGS = Object.freeze({ textScale: 1, actionScale: 1 })
export const CONVERSATION_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5])

let current = { ...DEFAULT_CONVERSATION_SETTINGS }

function boundedScale(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0.75 && numeric <= 1.5
    ? Number(numeric.toFixed(2))
    : fallback
}

export function getClientConversationSettings() {
  return { ...current }
}

export function setClientConversationSettings(value, { announce = true } = {}) {
  current = {
    textScale: boundedScale(value?.textScale, DEFAULT_CONVERSATION_SETTINGS.textScale),
    actionScale: boundedScale(value?.actionScale, DEFAULT_CONVERSATION_SETTINGS.actionScale),
  }
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLIENT_CONVERSATION_SETTINGS_EVENT, {
      detail: getClientConversationSettings(),
    }))
  }
  return getClientConversationSettings()
}
