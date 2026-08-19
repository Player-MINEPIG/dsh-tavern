import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHROME_CLICK_DELAY,
  createChromeClickController,
  nextChromeMode,
} from '../packages/client/src/play/chrome.js'

function fakeScheduler() {
  const scheduled = new Map()
  let sequence = 0
  return {
    schedule(callback, delay) {
      const id = ++sequence
      scheduled.set(id, { callback, delay })
      return id
    },
    cancel(id) {
      scheduled.delete(id)
    },
    flush() {
      const tasks = [...scheduled.values()]
      scheduled.clear()
      for (const task of tasks) task.callback()
    },
    scheduled,
  }
}

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

test('a single launcher click opens the menu only after the double-click window', () => {
  const clock = fakeScheduler()
  let opens = 0
  const controller = createChromeClickController({
    getMode: () => 'native',
    persistMode: async mode => ({ mode }),
    openMenu: () => { opens += 1 },
    closeMenu: () => {},
    setMode: () => {},
    schedule: clock.schedule,
    cancel: clock.cancel,
  })

  assert.equal(controller.click(), true)
  assert.equal(controller.click(), false)
  assert.equal(opens, 0)
  assert.equal([...clock.scheduled.values()][0].delay, CHROME_CLICK_DELAY)
  clock.flush()
  assert.equal(opens, 1)
})

test('double-click cancels menu opening and commits mode only after PUT succeeds', async () => {
  const clock = fakeScheduler()
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
    openMenu: () => assert.fail('double-click must cancel menu opening'),
    closeMenu: () => { closes += 1 },
    setMode: saved => { mode = saved },
    schedule: clock.schedule,
    cancel: clock.cancel,
  })

  controller.click()
  const switching = controller.doubleClick()
  assert.equal(requestedMode, 'play')
  assert.equal(mode, 'native')
  assert.equal(closes, 1)
  assert.equal(clock.scheduled.size, 0)

  request.resolve({ mode: 'play' })
  assert.equal(await switching, true)
  assert.equal(mode, 'play')
})

test('failed and suppressed switches never change local chrome state', async () => {
  const clock = fakeScheduler()
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
    schedule: clock.schedule,
    cancel: clock.cancel,
  })

  assert.equal(controller.click({ suppressed: true }), false)
  assert.equal(await controller.doubleClick({ suppressed: true }), false)
  assert.equal(requests, 0)
  assert.equal(await controller.doubleClick(), false)
  assert.equal(mode, 'native')
  assert.equal(error, failure)

  controller.click()
  controller.dispose()
  clock.flush()
})
