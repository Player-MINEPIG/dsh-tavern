import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createSessionApiHandler } from '../packages/play/src/sessions.js'

function request(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  return req
}

function response() {
  let resolve
  const done = new Promise(value => { resolve = value })
  const res = {
    statusCode: 200,
    setHeader() {},
    end(payload) { resolve({ status: res.statusCode, body: JSON.parse(String(payload)) }) },
  }
  return { res, done }
}

test('session creation validates import context before create and binds it to the new empty session', async () => {
  const calls = []
  const host = {
    prepareImportContext(reference) { calls.push(['prepare', reference]); return { path: reference.path, hash: 'verified' } },
    async createSession() { calls.push(['create']); return { sessionId: 'session-imported' } },
    bindImportContext(sessionId, prepared) { calls.push(['bind', sessionId, prepared]) },
  }
  const handler = createSessionApiHandler({
    host,
    workspaceStore: { get: () => ({ rootPath: 'D:/rp', workspaceId: 'workspace-rp' }) },
  })
  const output = response()
  await handler.create(request({ importContextRef: { path: 'card/play/import-context.json' } }), output.res)
  assert.equal((await output.done).status, 201)
  assert.deepEqual(calls, [
    ['prepare', { path: 'card/play/import-context.json' }],
    ['create'],
    ['bind', 'session-imported', { path: 'card/play/import-context.json', hash: 'verified' }],
  ])
})
