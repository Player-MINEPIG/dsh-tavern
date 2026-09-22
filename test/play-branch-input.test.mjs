import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { API_V2 } from '../packages/identity.js'

function fixture({ queued = ['old-user'], steering = ['old-steering'] } = {}) {
  const source = { nextTurn: [...queued], nextStep: [...steering] }
  const child = {
    id: 'child', status: 'idle',
    inbox: {
      nextTurn: [...queued], nextStep: [...steering],
      clear() { calls.push('clear:child'); this.nextStep = []; this.nextTurn = [] },
    },
  }
  const calls = []
  const controller = {
    async inspect() { return { meta: { version: 3 }, events: [] } },
    async fork() { calls.push('fork'); return { sessionId: child.id } },
    async resolveAgent(id) { calls.push(`resolve:${id}`); return { agent: child } },
  }
  const host = createPlayHost({ sessionController: controller })
  return { source, child, controller, host, calls }
}

test('historical forks clear both child input queues before returning, without changing the source', async () => {
  const { source, child, host, calls } = fixture()
  assert.deepEqual(await host.forkSession({ sessionId: 'parent', atSeq: 3 }), { sessionId: 'child' })
  assert.deepEqual(child.inbox.nextTurn, [])
  assert.deepEqual(child.inbox.nextStep, [])
  assert.deepEqual(source, { nextTurn: ['old-user'], nextStep: ['old-steering'] })
  assert.deepEqual(calls, ['fork', 'resolve:child', 'clear:child'])
})

test('empty child queues need no cancellation events', async () => {
  const { host, calls } = fixture({ queued: [], steering: [] })
  await host.forkSession({ sessionId: 'parent', atSeq: 3 })
  assert.deepEqual(calls, ['fork', 'resolve:child'])
})

test('missing public Agent resolution fails before creating an unchecked child', async () => {
  const { host, controller, calls } = fixture()
  delete controller.resolveAgent
  await assert.rejects(host.forkSession({ sessionId: 'parent', atSeq: 3 }), { status: 501, code: 'PLAY_HOST_UNAVAILABLE' })
  assert.deepEqual(calls, [])
})

for (const failure of ['running', 'wrong-agent', 'unreadable', 'throws', 'retained', 'resolution']) {
  test(`branch API refuses ${failure} child before copying context`, async () => {
    const { host, controller, child } = fixture()
    if (failure === 'running') child.status = 'running'
    if (failure === 'wrong-agent') child.id = 'parent'
    controller.fork = async () => ({ sessionId: 'child' })
    if (failure === 'unreadable') delete child.inbox.nextStep
    if (failure === 'throws') child.inbox.clear = () => { throw new Error('durable write failed') }
    if (failure === 'retained') child.inbox.clear = () => {}
    if (failure === 'resolution') controller.resolveAgent = async () => ({ error: new Error('unavailable') })
    let copies = 0
    host.copySelection = () => { copies++ }
    const handler = createPlayApiHandler({ host, workspaceStore: {}, chromeStore: {} })
    const req = Readable.from([Buffer.from(JSON.stringify({ atEventId: 3 }))])
    req.method = 'POST'
    req.url = `${API_V2}/sessions/parent/branch`
    const result = await new Promise((resolve, reject) => {
      const res = { statusCode: 200, setHeader() {}, end(text) { resolve({ status: this.statusCode, body: JSON.parse(text) }) } }
      Promise.resolve(handler(req, res)).catch(reject)
    })
    assert.equal(result.status, 502)
    assert.equal(result.body.code, 'PLAY_BRANCH_INPUT_RESET_FAILED')
    assert.equal(result.body.sessionId, undefined)
    assert.equal(copies, 0)
  })
}
