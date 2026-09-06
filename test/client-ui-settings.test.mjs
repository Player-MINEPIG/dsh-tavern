import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { useClientUiSettings } from '../packages/client/src/i18n/use-ui-settings.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'
import { CLIENT_UI_SETTINGS_EVENT } from '../packages/identity.js'

test('locale-only settings changes reach mounted consumers and unsubscribe on disposal', () => {
  const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
  const previous = dispatcher.current
  const previousWindow = globalThis.window
  const previousSettings = getClientUiSettings()
  const events = new EventTarget()
  globalThis.window = events
  let effect, state
  dispatcher.current = {
    useState(initial) { state = initial(); return [state, next => { state = next }] },
    useEffect(callback) { effect = callback },
  }
  let dispose
  try {
    setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
    useClientUiSettings()
    dispose = effect()
    setClientUiSettings({ locale: 'en', scale: 1 }, { announce: false })
    events.dispatchEvent(new Event(CLIENT_UI_SETTINGS_EVENT))
    assert.equal(state.locale, 'en')
    assert.equal(state.scale, 1)
    dispose()
    setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
    events.dispatchEvent(new Event(CLIENT_UI_SETTINGS_EVENT))
    assert.equal(state.locale, 'en')
  } finally {
    dispose?.()
    dispatcher.current = previous
    globalThis.window = previousWindow
    setClientUiSettings(previousSettings, { announce: false })
  }
})
