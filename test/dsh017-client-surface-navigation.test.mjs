import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { createSurfaceNavigation } from '../packages/client/src/index.js'
import { SessionTemplatePanel } from '../packages/session-template/src/client.js'

function dirtyTemplatePanel(registerBeforeLeave, close) {
  const selection = { worldBookIds: [], character: {}, rp: {} }
  const states = [[{ id: 'template', name: 'Saved', selection }], 'template', 'Edited', false, selection,
    { presets: [], characters: [], users: [], worldBooks: [] }, { key: 'template.ready' }]
  const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
  const previous = dispatcher.current
  let cursor = 0, cleanup
  dispatcher.current = {
    useState: () => [states[cursor++], () => {}],
    useRef: current => ({ current }),
    useCallback: callback => callback,
    useEffect: (effect, deps) => {
      if (registerBeforeLeave && deps?.includes(registerBeforeLeave)) cleanup = effect()
    },
  }
  try {
    const panel = SessionTemplatePanel({ registerBeforeLeave, close })
    return { closeButton: panel.props.children[0].props.children[1], cleanup }
  } finally { dispatcher.current = previous }
}

test('dirty template panel guards every shell transition and close confirms only once', () => {
  const previousWindow = globalThis.window
  let accept = false, confirmations = 0
  globalThis.window = { confirm: () => { confirmations++; return accept } }
  try {
    const commits = []
    const navigation = createSurfaceNavigation(value => commits.push(value))
    const panel = dirtyTemplatePanel(navigation.register, () => navigation.request(null, 'session-template'))
    for (const destination of [null, 'user', 'diagnostics']) {
      assert.equal(navigation.request(destination, 'session-template'), false)
    }
    assert.deepEqual(commits, [])
    assert.equal(confirmations, 3)
    assert.equal(navigation.request('session-template', 'session-template'), true)
    assert.equal(confirmations, 3)
    accept = true
    panel.closeButton.props.onClick()
    assert.equal(confirmations, 4)
    assert.deepEqual(commits, [null])
    panel.cleanup()
    navigation.request('user', null)
    assert.equal(confirmations, 4)
    assert.deepEqual(commits, [null, 'user'])
  } finally { globalThis.window = previousWindow }
})

test('late cleanup from the old panel cannot remove a newer guard', () => {
  const commits = []
  const navigation = createSurfaceNavigation(value => commits.push(value))
  const cleanup = navigation.register(() => true)
  navigation.register(() => false)
  cleanup()
  assert.equal(navigation.request('user', 'session-template'), false)
  assert.deepEqual(commits, [])
})

test('shell routes Escape, launcher switches and diagnostic requests through guarded navigation', () => {
  const source = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  assert.match(source, /else if \(surface !== null\) requestSurface\(null\)/)
  assert.match(source, /const open = id => \{\s*if \(!requestSurface\(id\)\) return/)
  assert.match(source, /subscribeOpen\(playthroughId => \{\s*if \(!requestSurface\('diagnostics'\)\) return/)
  assert.match(source, /SessionTemplatePanel, \{[\s\S]*registerBeforeLeave,[\s\S]*close,/)
})
