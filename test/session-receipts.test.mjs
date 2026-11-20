import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readSessionReceipt } from '../packages/play/src/session-receipts.js'
import { createSessionPrimitives, readSessionEvidence } from '../packages/play/src/sessions.js'

function fixture(t, host, waitMs) {
  const storageDir = mkdtempSync(join(tmpdir(), 'session-receipts-'))
  t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const binding = { rootPath: '/workspace', workspaceId: 'w' }
  const store = { storageDir, get: () => binding }
  const client = () => createSessionPrimitives({ workspaceStore: store, host, waitMs })
  const scope = JSON.stringify([binding.workspaceId, binding.rootPath])
  const request = { operationKey: 'call-1', expectedWorkspaceScope: scope }
  return { store, client, request, receipt: () => readSessionReceipt(store, scope, request.operationKey) }
}

test('keyed primitives replay a completed response after remount and reject changed input or action', async t => {
  let count = 0
  const f = fixture(t, { createSession: async () => ({ sessionId: 'created-' + ++count }) })
  const first = await f.client().create(f.request)
  assert.deepEqual(await f.client().create(f.request), first)
  assert.equal(count, 1)
  assert.equal(f.receipt().state, 'done')
  assert.deepEqual(f.receipt().result, first)
  await assert.rejects(f.client().branch('source', { ...f.request, atEventId: 0 }), { code: 'PLAY_SESSION_OPERATION_CONFLICT' })
  await assert.rejects(f.client().create({ ...f.request, selectionFromSessionId: 'other' }), { code: 'PLAY_SESSION_OPERATION_CONFLICT' })
})

test('a lost native acknowledgement is pending across remount and a concurrent retry never sends twice', async t => {
  let sends = 0
  const admission = Promise.withResolvers()
  const f = fixture(t, { promptSession: () => { sends++; return admission.promise } })
  const request = { ...f.request, requestId: 'native', text: 'private message body' }
  const first = f.client().userMessage('target', request)
  assert.equal(f.receipt().active, true)
  await assert.rejects(f.client().userMessage('target', request), { code: 'PLAY_SESSION_OPERATION_PENDING' })
  admission.reject(new Error('lost acknowledgement'))
  await assert.rejects(first, /lost acknowledgement/)
  assert.deepEqual(f.receipt(), { state: 'pending', stage: 'attempted', active: false })
  await assert.rejects(f.client().userMessage('target', request), { code: 'PLAY_SESSION_OPERATION_PENDING' })
  assert.equal(sends, 1)
  const dir = join(f.store.storageDir, 'session-receipts')
  assert.ok(!readFileSync(join(dir, readdirSync(dir)[0]), 'utf8').includes(request.text))
})

test('a known child with incomplete context is reported without silently approving or repeating the fork', async t => {
  let count = 0
  const f = fixture(t, {
    forkSession: async () => ({ sessionId: 'child-' + ++count }),
    copySelection: async () => { throw new Error('copy interrupted') },
  })
  const request = { ...f.request, atEventId: 2 }
  await assert.rejects(f.client().branch('parent', request), { code: 'PLAY_BRANCH_COPY_FAILED' })
  assert.deepEqual(f.receipt(), { state: 'pending', stage: 'session.created', sessionId: 'child-1', active: false })
  await assert.rejects(f.client().branch('parent', request), { code: 'PLAY_SESSION_OPERATION_PENDING' })
  assert.equal(count, 1)
})

test('expiry before admission releases the key, and a late preflight cannot create', async t => {
  const prepare = Promise.withResolvers()
  let count = 0
  const f = fixture(t, { prepareImportContext: () => prepare.promise,
    createSession: async () => ({ sessionId: 'child-' + ++count }), bindImportContext() {} }, 20)
  const keepAlive = setInterval(() => {}, 500)
  t.after(() => clearInterval(keepAlive))
  const body = { ...f.request, importContextRef: { path: 'context.json' } }
  await assert.rejects(f.client().create(body), { code: 'PLAY_SESSION_OPERATION_TIMEOUT' })
  assert.equal(f.receipt().state, 'missing')
  prepare.resolve({})
  assert.equal((await f.client().create(body)).sessionId, 'child-1')
  assert.equal(count, 1)
})

test('checkpoint ownership is checked after preparation before any native call', async t => {
  const prepare = Promise.withResolvers()
  let count = 0
  const f = fixture(t, { prepareImportContext: () => prepare.promise,
    createSession: async () => ({ sessionId: 'child-' + ++count }) })
  const request = { ...f.request, importContextRef: { path: 'context.json' }, checkpointId: 'row', checkpointKey: 'owner' }
  f.store.checkpoints = { assertOwner(id, key, scope) {
    assert.deepEqual([id, key, scope], ['row', 'owner', f.request.expectedWorkspaceScope])
    throw Error('dismissed during preparation')
  } }
  const started = f.client().create(request)
  prepare.resolve({})
  await assert.rejects(started, /dismissed during preparation/)
  assert.equal(count, 0)
  assert.equal(f.receipt().state, 'missing')
})

test('inheritance evidence uses unique message IDs across the entire log before restricting the range', async () => {
  const host = { inspectSession: async () => ({ meta: { id: 'child', version: 4 }, inheritedEventCount: 2, events: [
    { seq: 0, type: 'user/message', data: { id: 'u', role: 'user' } },
    { seq: 1, type: 'assistant/message', data: { id: 'a', role: 'assistant' } },
    { seq: 2, type: 'user/message', data: { id: 'u', role: 'user' } },
  ] }) }
  const e = await readSessionEvidence(host, 'child', { start: 0, end: 1 })
  assert.deepEqual(e.endpoints, [{ seq: 1, id: 'a', role: 'assistant' }])
  assert.equal(e.hasOwnTurns, true)
})
