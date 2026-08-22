import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createSessionApiHandler } from '../packages/play/src/sessions.js'

function request(body, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = method
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

test('empty session import context can be read, replaced and unbound', async () => {
  let binding = null
  const host = {
    async history() { return { events: [], hasMore: false } },
    async deriveMessages() { return [] },
    getImportContextBinding() { return binding },
    prepareImportContext(reference) { return { path: reference.path, hash: `hash-${reference.path}`, qaCount: 1 } },
    bindImportContext(_sessionId, prepared) { binding = { ...prepared, state: 'pending' }; return binding },
    unbindImportContext() { binding = null; return true },
  }
  const handler = createSessionApiHandler({ host, workspaceStore: {} })

  let output = response()
  await handler.importContext(request({}, 'GET'), output.res, 'session-empty', 'GET')
  assert.equal((await output.done).body.binding, null)

  output = response()
  await handler.importContext(request({ reference: { path: 'card/play/import-context.json' } }, 'PUT'), output.res, 'session-empty', 'PUT')
  assert.equal((await output.done).body.binding.path, 'card/play/import-context.json')

  output = response()
  await handler.importContext(request({}, 'DELETE'), output.res, 'session-empty', 'DELETE')
  assert.equal((await output.done).body.binding, null)
})

test('import context mutation locks after a message, open turn or consumption', async () => {
  let events = [{ event: { type: 'user/message', data: { id: 'u', role: 'user', content: [] }, seq: 1 } }]
  let binding = null
  const host = {
    async history() { return { events, hasMore: false } },
    async deriveMessages() { return events.some(item => item.event.type === 'user/message') ? [{ role: 'user' }] : [] },
    getImportContextBinding() { return binding },
    prepareImportContext() { return { path: 'context.json', hash: 'hash' } },
    bindImportContext() { throw new Error('must remain locked') },
    unbindImportContext() { throw new Error('must remain locked') },
  }
  const handler = createSessionApiHandler({ host, workspaceStore: {} })
  await assert.rejects(
    handler.importContext(request({ reference: { path: 'context.json' } }, 'PUT'), response().res, 'session-used', 'PUT'),
    error => error.code === 'PLAY_IMPORT_CONTEXT_LOCKED' && error.status === 409,
  )
  events = [{ event: { type: 'turn/start', seq: 2 } }]
  await assert.rejects(
    handler.importContext(request({}, 'DELETE'), response().res, 'session-running', 'DELETE'),
    error => error.code === 'PLAY_IMPORT_CONTEXT_LOCKED',
  )
  events = []
  binding = { path: 'context.json', state: 'claimed', claim: { eventSeqs: [1], identity: 'event-seqs:1' } }
  await assert.rejects(
    handler.importContext(request({}, 'DELETE'), response().res, 'session-claimed', 'DELETE'),
    error => error.code === 'PLAY_IMPORT_CONTEXT_LOCKED',
  )
  binding = { path: 'context.json', state: 'consumed' }
  await assert.rejects(
    handler.importContext(request({}, 'DELETE'), response().res, 'session-consumed', 'DELETE'),
    error => error.code === 'PLAY_IMPORT_CONTEXT_LOCKED',
  )
})
