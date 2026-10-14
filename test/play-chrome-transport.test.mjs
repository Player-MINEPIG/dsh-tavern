import test from 'node:test'
import assert from 'node:assert/strict'
import { startChromeModeTransport } from '../packages/client/src/play/chrome-transport.js'
import { normalizeChrome } from '../packages/client/src/play/schema.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'

class FakeTarget {
  listeners = new Map()
  addEventListener(name, listener) { this.listeners.set(name, listener) }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name)
  }
  emit(name, value) { this.listeners.get(name)?.(value) }
}

class FakeEventSource extends FakeTarget {
  static instances = []
  constructor(url) {
    super()
    this.url = url
    this.closed = 0
    FakeEventSource.instances.push(this)
  }
  close() { this.closed += 1 }
}

const settle = () => new Promise(resolve => setImmediate(resolve))

test('default transport polls without opening an extra browser SSE connection', async () => {
  const original = globalThis.EventSource
  globalThis.EventSource = FakeEventSource
  FakeEventSource.instances = []
  const intervals = new Map()
  const disposers = []
  let refreshes = 0
  try {
    for (let tab = 0; tab < 3; tab += 1) {
      disposers.push(startChromeModeTransport({
        face: { refresh: async () => { refreshes += 1 } },
        internal: { acceptSnapshot: () => {} },
        eventsUrl: '/events',
        focusTarget: new FakeTarget(),
        setIntervalImpl: callback => { intervals.set(tab, callback); return tab },
        clearIntervalImpl: id => intervals.delete(id),
      }))
    }
    await settle()
    assert.equal(FakeEventSource.instances.length, 0)
    assert.equal(intervals.size, 3)
    assert.equal(refreshes, 3)
    for (const poll of intervals.values()) poll()
    await settle()
    assert.equal(refreshes, 6)
  } finally {
    for (const dispose of disposers) dispose()
    if (original === undefined) delete globalThis.EventSource
    else globalThis.EventSource = original
  }
  assert.equal(intervals.size, 0)
})

test('slow refresh does not accumulate polling and focus requests', async () => {
  let resolveRead
  const read = new Promise(resolve => { resolveRead = resolve })
  const intervals = new Map()
  const focusTarget = new FakeTarget()
  let refreshes = 0
  const dispose = startChromeModeTransport({
    face: { refresh: () => { refreshes += 1; return read } },
    internal: { acceptSnapshot: () => {} },
    eventsUrl: '/events',
    EventSourceImpl: null,
    focusTarget,
    setIntervalImpl: callback => { intervals.set('poll', callback); return 'poll' },
    clearIntervalImpl: id => intervals.delete(id),
  })
  try {
    await settle()
    for (let tick = 0; tick < 10; tick += 1) {
      intervals.get('poll')()
      focusTarget.emit('focus')
    }
    await settle()
    assert.equal(refreshes, 1)
    resolveRead()
    await settle()
    intervals.get('poll')()
    await settle()
    assert.equal(refreshes, 2)
  } finally {
    dispose()
    resolveRead()
  }
  focusTarget.emit('focus')
  await settle()
  assert.equal(refreshes, 2)
})

test('chrome client accepts revisioned and legacy snapshots', async () => {
  assert.deepEqual(normalizeChrome({ mode: 'play', revision: 'r1' }), { mode: 'play', revision: 'r1' })
  assert.deepEqual(normalizeChrome({ mode: 'native' }), { mode: 'native', revision: null })
  assert.throws(() => normalizeChrome({ mode: 'play', revision: '' }), /revision/)

  const requests = []
  const client = createLivePlayClient({
    apiRoot: '/custom/v2',
    fetchImpl: async url => {
      requests.push(url)
      return { ok: true, json: async () => ({ ok: true, mode: 'native', revision: 'server' }) }
    },
  })
  assert.equal(client.chromeEventsUrl, '/custom/v2/chrome/events')
  assert.deepEqual(await client.getChrome(), { mode: 'native', revision: 'server' })
  assert.deepEqual(requests, ['/custom/v2/chrome'])
})

test('transport converges SSE, focus, and polling fallback then disposes', async () => {
  FakeEventSource.instances = []
  const focusTarget = new FakeTarget()
  const intervals = new Map()
  let nextTimer = 1
  const accepted = []
  let refreshes = 0
  const dispose = startChromeModeTransport({
    face: { refresh: async () => { refreshes += 1 } },
    internal: { acceptSnapshot: snapshot => accepted.push(snapshot) },
    eventsUrl: '/events',
    EventSourceImpl: FakeEventSource,
    focusTarget,
    setIntervalImpl: callback => {
      const id = nextTimer++
      intervals.set(id, callback)
      return id
    },
    clearIntervalImpl: id => intervals.delete(id),
  })
  await settle()
  assert.equal(refreshes, 1)
  const source = FakeEventSource.instances[0]
  assert.equal(source.url, '/events')
  source.emit('chrome/change', { data: '{"mode":"play","revision":"r1"}' })
  assert.deepEqual(accepted, [{ mode: 'play', revision: 'r1' }])

  source.emit('error')
  source.emit('error')
  assert.equal(intervals.size, 1)
  intervals.values().next().value()
  focusTarget.emit('focus')
  await settle()
  assert.equal(refreshes, 2)

  source.emit('open')
  assert.equal(intervals.size, 0)
  source.emit('chrome/change', { data: 'not-json' })
  await settle()
  assert.equal(refreshes, 3)

  dispose()
  dispose()
  assert.equal(source.closed, 1)
  assert.equal(focusTarget.listeners.size, 0)
  source.emit('error')
  source.emit('chrome/change', { data: '{"mode":"native","revision":"r2"}' })
  assert.equal(intervals.size, 0)
  assert.equal(accepted.length, 1)
})

test('missing or failed EventSource starts one bounded polling fallback', async () => {
  const intervals = new Map()
  let refreshes = 0
  const options = {
    face: { refresh: async () => { refreshes += 1 } },
    internal: { acceptSnapshot: () => {} },
    eventsUrl: '/events',
    focusTarget: new FakeTarget(),
    setIntervalImpl: callback => { intervals.set('timer', callback); return 'timer' },
    clearIntervalImpl: id => intervals.delete(id),
  }
  const dispose = startChromeModeTransport({ ...options, EventSourceImpl: undefined })
  await settle()
  assert.equal(refreshes, 1)
  assert.equal(intervals.size, 1)
  intervals.get('timer')()
  await settle()
  assert.equal(refreshes, 2)
  dispose()
  assert.equal(intervals.size, 0)

  class ThrowingEventSource {
    constructor() { throw new Error('unsupported') }
  }
  const secondIntervals = new Map()
  const disposeSecond = startChromeModeTransport({
    ...options,
    EventSourceImpl: ThrowingEventSource,
    setIntervalImpl: callback => { secondIntervals.set('timer', callback); return 'timer' },
    clearIntervalImpl: id => secondIntervals.delete(id),
  })
  assert.equal(secondIntervals.size, 1)
  disposeSecond()
  assert.equal(secondIntervals.size, 0)
})
