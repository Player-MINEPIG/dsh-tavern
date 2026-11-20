import test from 'node:test'
import assert from 'node:assert/strict'
import { forkPlaythroughAtNode } from '../packages/client/src/play/fork.js'

test('fork retries send the same creation identity and start a fresh identity after acknowledgement', async () => {
  const calls = [], playthrough = { id: 'run', path: 'a/run/timeline.json' }
  const client = {
    getWorkspace: async () => ({ workspaceId: 'a', rootPath: '/work' }),
    async forkPlaythrough(row, body) {
      assert.equal(row, playthrough)
      calls.push(body)
      if (calls.length === 1) throw Error('response lost')
      return { playthrough: { id: 'child' }, sessionId: 'child-session' }
    },
  }
  const request = () => forkPlaythroughAtNode(client, { playthrough, nodeId: 'qa' })
  await assert.rejects(request(), /response lost/)
  assert.equal((await request()).sessionId, 'child-session')
  assert.deepEqual(calls[1], calls[0])
  assert.equal(calls[1].expectedWorkspaceScope, JSON.stringify(['a', '/work']))
  await request()
  assert.notEqual(calls[2].creationId, calls[1].creationId)
})

test('clients without a durable fork service stop before creating a native child', async () => {
  await assert.rejects(forkPlaythroughAtNode({ postBranch: assert.fail }, { playthrough: { id: 'run' }, nodeId: 'qa' }), { code: 'PLAY_CREATION_UNAVAILABLE' })
})

test('a fresh browser client reuses a lost fork receipt after remount', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const disk = new Map()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: key => disk.get(key), setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key),
  } } })
  t.after(() => previous ? Object.defineProperty(globalThis, 'window', previous) : delete globalThis.window)
  const calls = []
  const client = () => ({
    apiRoot: '/play', getWorkspace: async () => ({ rootPath: '/rp', workspaceId: 'work' }),
    forkPlaythrough: async (_row, body) => {
      calls.push(body)
      if (calls.length === 1) throw Error('connection reset')
      return { sessionId: 'original-child' }
    },
  })
  const args = { playthrough: { id: 'run', path: 'a/run/timeline.json' }, nodeId: 'qa', variantId: 'visible' }
  await assert.rejects(forkPlaythroughAtNode(client(), args), /connection reset/)
  assert.equal(disk.size, 1)
  assert.equal((await forkPlaythroughAtNode(client(), args)).sessionId, 'original-child')
  assert.deepEqual(calls[0], calls[1])
  assert.equal(calls[1].variantId, 'visible')
  assert.equal(disk.size, 0)
})

test('a late client preflight cannot submit a fork after the user sees a timeout', async t => {
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', () => controller.signal)
  const scope = Promise.withResolvers()
  let called = false
  const client = { getWorkspace: () => scope.promise, forkPlaythrough() { called = true } }
  const request = forkPlaythroughAtNode(client, { playthrough: { id: 'run' }, nodeId: 'qa' })
  controller.abort()
  await assert.rejects(request, { code: 'PLAY_CREATION_TIMEOUT' })
  scope.resolve({ workspaceId: 'work', rootPath: '/rp' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(called, false)
})
