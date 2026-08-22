import test from 'node:test'
import assert from 'node:assert/strict'
import { createChromeModeServiceCore } from '../packages/client/src/play/chrome-service.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function tick() {
  await Promise.resolve()
  await Promise.resolve()
}

test('snapshot and subscriptions are read-only, immediate, and validated', () => {
  const { face, internal } = createChromeModeServiceCore({
    initial: { mode: 'native' },
    read: async () => ({ mode: 'native' }),
    write: async mode => ({ mode }),
  })
  const seen = []
  const dispose = face.subscribe(snapshot => seen.push(snapshot))
  assert.deepEqual(seen, [{ mode: 'native', revision: null }])
  assert.equal(Object.isFrozen(face.getSnapshot()), true)
  assert.throws(() => internal.acceptSnapshot({ mode: 'invalid', revision: 'x' }), /mode/)
  assert.equal(face.getMode(), 'native')
  internal.acceptSnapshot({ mode: 'native', revision: 'r1' })
  internal.acceptSnapshot({ mode: 'native', revision: 'r1' })
  assert.equal(seen.length, 2)
  dispose()
  dispose()
  internal.acceptSnapshot({ mode: 'play', revision: 'r2' })
  assert.equal(seen.length, 2)
})

test('refresh and writes commit only server-confirmed snapshots', async () => {
  let readValue = { mode: 'play', revision: 'read-1' }
  let failWrite = true
  const { face } = createChromeModeServiceCore({
    read: async () => readValue,
    write: async mode => {
      if (failWrite) throw new Error('write failed')
      return { mode, revision: 'write-1' }
    },
  })
  const seen = []
  face.subscribe(snapshot => seen.push(snapshot))
  await assert.rejects(face.setMode('play'), /write failed/)
  assert.equal(face.getMode(), 'native')
  assert.equal(seen.length, 1)
  await face.refresh()
  assert.equal(face.getMode(), 'play')
  await face.refresh()
  assert.equal(seen.length, 2)
  readValue = { mode: 'play', revision: 'read-2' }
  await face.refresh()
  assert.equal(seen.length, 3)
  failWrite = false
  await face.setMode('native')
  assert.deepEqual(face.getSnapshot(), { mode: 'native', revision: 'write-1' })
})

test('queued set and switch operations preserve invocation intent', async () => {
  const writes = []
  const pending = []
  const service = createChromeModeServiceCore({
    read: async () => ({ mode: 'native', revision: 'read' }),
    write: mode => {
      writes.push(mode)
      const operation = deferred()
      pending.push(operation)
      return operation.promise
    },
  })
  const first = service.face.setMode('play')
  const second = service.face.switchMode()
  const third = service.face.switchMode()
  await tick()
  assert.deepEqual(writes, ['play'])
  service.internal.acceptSnapshot({ mode: 'play', revision: 'event-1' })
  pending[0].resolve({ mode: 'play', revision: 'write-1' })
  await first
  await tick()
  assert.deepEqual(writes, ['play', 'native'])
  pending[1].resolve({ mode: 'native', revision: 'write-2' })
  await second
  await tick()
  assert.deepEqual(writes, ['play', 'native', 'play'])
  pending[2].resolve({ mode: 'play', revision: 'write-3' })
  await third
  assert.deepEqual(service.face.getSnapshot(), { mode: 'play', revision: 'write-3' })
})

test('when effects enter, leave, re-enter, and remain independently owned', async () => {
  const { face, internal } = createChromeModeServiceCore({
    read: async () => ({ mode: 'native' }),
    write: async mode => ({ mode }),
  })
  const calls = []
  const cancelA = face.when('play', () => {
    calls.push('setup-a')
    return () => calls.push('dispose-a')
  })
  face.when('play', () => {
    calls.push('setup-b')
    return () => calls.push('dispose-b')
  })
  internal.acceptSnapshot({ mode: 'play', revision: '1' })
  await tick()
  assert.deepEqual(calls, ['setup-a', 'setup-b'])
  cancelA()
  assert.deepEqual(calls, ['setup-a', 'setup-b', 'dispose-a'])
  internal.acceptSnapshot({ mode: 'native', revision: '2' })
  await tick()
  assert.deepEqual(calls, ['setup-a', 'setup-b', 'dispose-a', 'dispose-b'])
  internal.acceptSnapshot({ mode: 'play', revision: '3' })
  await tick()
  assert.deepEqual(calls, ['setup-a', 'setup-b', 'dispose-a', 'dispose-b', 'setup-b'])
})

test('late async when setup is disposed after its mode becomes stale', async () => {
  const setupResult = deferred()
  let disposed = 0
  const { face, internal } = createChromeModeServiceCore({
    read: async () => ({ mode: 'native' }),
    write: async mode => ({ mode }),
  })
  face.when('play', () => setupResult.promise)
  internal.acceptSnapshot({ mode: 'play', revision: '1' })
  internal.acceptSnapshot({ mode: 'native', revision: '2' })
  setupResult.resolve(() => { disposed += 1 })
  await tick()
  assert.equal(disposed, 1)
})

test('dispose clears effects and rejects current or future authority operations', async () => {
  const writeResult = deferred()
  let effectDisposed = 0
  const service = createChromeModeServiceCore({
    initial: { mode: 'play', revision: 'initial' },
    read: async () => ({ mode: 'native', revision: 'read' }),
    write: () => writeResult.promise,
  })
  service.face.when('play', () => () => { effectDisposed += 1 })
  await tick()
  const pendingWrite = service.face.setMode('native')
  await tick()
  service.internal.dispose()
  service.internal.dispose()
  assert.equal(effectDisposed, 1)
  writeResult.resolve({ mode: 'native', revision: 'late' })
  await assert.rejects(pendingWrite, error => error.code === 'CHROME_SERVICE_DISPOSED')
  assert.deepEqual(service.face.getSnapshot(), { mode: 'play', revision: 'initial' })
  let notified = 0
  service.face.subscribe(() => { notified += 1 })
  service.face.when('play', () => { notified += 1 })
  assert.equal(notified, 0)
  await assert.rejects(service.face.refresh(), error => error.code === 'CHROME_SERVICE_DISPOSED')
  await assert.rejects(service.face.setMode('native'), error => error.code === 'CHROME_SERVICE_DISPOSED')
  await assert.rejects(service.face.switchMode(), error => error.code === 'CHROME_SERVICE_DISPOSED')
  assert.throws(() => service.internal.acceptSnapshot({ mode: 'native' }), error => error.code === 'CHROME_SERVICE_DISPOSED')
})
