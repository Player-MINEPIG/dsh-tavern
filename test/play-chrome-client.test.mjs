import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createChromeClickController,
  nextChromeMode,
} from '../packages/client/src/play/chrome.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

test('chrome modes toggle only between native and play', () => {
  assert.equal(nextChromeMode('native'), 'play')
  assert.equal(nextChromeMode('play'), 'native')
})

test('a single launcher click opens the menu immediately without waiting for the double-click window', () => {
  let opens = 0
  const controller = createChromeClickController({
    getMode: () => 'native',
    persistMode: async mode => ({ mode }),
    openMenu: () => { opens += 1 },
    closeMenu: () => {},
    setMode: () => {},
  })

  assert.equal(controller.click(), true)
  assert.equal(opens, 1)
  assert.equal(controller.click({ suppressed: true }), false)
  assert.equal(opens, 1)
})

test('the explicit menu action commits mode only after PUT succeeds', async () => {
  const request = deferred()
  let mode = 'native'
  let requestedMode = null
  let closes = 0
  const controller = createChromeClickController({
    getMode: () => mode,
    persistMode: desired => {
      requestedMode = desired
      return request.promise
    },
    openMenu: () => {},
    closeMenu: () => { closes += 1 },
    setMode: saved => { mode = saved },
  })

  const switching = controller.switchMode()
  assert.equal(requestedMode, 'play')
  assert.equal(mode, 'native')
  assert.equal(closes, 1)

  request.resolve({ mode: 'play' })
  assert.equal(await switching, true)
  assert.equal(mode, 'play')
})

test('failed and suppressed switches never change local chrome state', async () => {
  const failure = new Error('PUT failed')
  let mode = 'native'
  let error = null
  let requests = 0
  const controller = createChromeClickController({
    getMode: () => mode,
    persistMode: async () => {
      requests += 1
      throw failure
    },
    openMenu: () => assert.fail('suppressed click must not open'),
    closeMenu: () => {},
    setMode: saved => { mode = saved },
    setError: reason => { error = reason },
  })

  assert.equal(controller.click({ suppressed: true }), false)
  assert.equal(await controller.switchMode({ suppressed: true }), false)
  assert.equal(requests, 0)
  assert.equal(await controller.switchMode(), false)
  assert.equal(mode, 'native')
  assert.equal(error, failure)

  controller.dispose()
  assert.equal(controller.click(), false)
})
