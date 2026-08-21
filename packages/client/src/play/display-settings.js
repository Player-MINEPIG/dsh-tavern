import { useEffect, useState } from 'react'
import { CLIENT_CONVERSATION_SETTINGS_EVENT } from '../../../identity.js'
import { getClientConversationSettings } from '../conversation-settings.js'

export function useConversationDisplaySettings() {
  const [settings, setSettings] = useState(getClientConversationSettings)
  useEffect(() => {
    const onSettings = event => setSettings({
      textScale: event.detail?.textScale ?? 1,
      actionScale: event.detail?.actionScale ?? 1,
    })
    window.addEventListener(CLIENT_CONVERSATION_SETTINGS_EVENT, onSettings)
    return () => window.removeEventListener(CLIENT_CONVERSATION_SETTINGS_EVENT, onSettings)
  }, [])
  return settings
}

export function conversationDisplayStyle(settings) {
  return {
    '--dtv-rp-text-scale': settings.textScale,
    '--dtv-rp-action-scale': settings.actionScale,
  }
}
