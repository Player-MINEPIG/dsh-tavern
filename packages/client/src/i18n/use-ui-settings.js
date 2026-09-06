import { useEffect, useState } from 'react'
import { CLIENT_UI_SETTINGS_EVENT } from '../../../identity.js'
import { getClientUiSettings } from './runtime.js'

// Locale-only changes must render too, even when the scale stays unchanged.
export function useClientUiSettings() {
  const [settings, setSettings] = useState(getClientUiSettings)
  useEffect(() => {
    const refresh = () => setSettings(getClientUiSettings())
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, refresh)
    refresh()
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, refresh)
  }, [])
  return settings
}
