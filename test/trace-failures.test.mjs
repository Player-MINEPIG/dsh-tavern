import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { AssemblyRecorder } from '../packages/tavern-trace/src/assembly-recorder.js'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
import { createPromptTraceApi } from '../packages/tavern-loader/src/prompt-trace-api.js'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'trace-failure-'))
  const store = new AssemblyStore(directory)
  const recorder = new AssemblyRecorder(store)
  const meta = { id: 'session', version: 3, createdAt: 100 }
  const session = { id: meta.id, header: meta, seq: 5 }
  const event = { type: 'turn/end', seq: 4, data: { turn: 1,
    reason: { kind: 'error', error: { code: 'UNKNOWN', message: 'OFFICIAL_ONLY_ERROR' } } } }
  recorder.failure({ agent: { id: session.id }, turn: 1, step: 0 })
  recorder.observeSessionEvent(session, event)
  return { directory, store, recorder, session, inspection: { meta, events: [event] }, record: store.get('session', store.list('session')[0].id),
    cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}
async function invoke(api, url) {
  let body
  const res = { setHeader() {}, end(value) { body = JSON.parse(value) } }
  await api({ method: 'GET', url }, res)
  return { status: res.statusCode, body }
}

test('failure-only API details cold-read official errors while the index and disk stay body-free', async () => {
  const f = fixture()
  try {
    const restored = new AssemblyStore(f.directory)
    let calls = 0
    const api = createPromptTraceApi({ assemblies: restored,
      readBodies: createAssemblyBodyReader({ inspect: async () => { calls++; return f.inspection } }) })
    const base = '/pmp-dsh-tavern/api/v3/sessions/session/assemblies'
    const index = await invoke(api, base)
    assert.equal(calls, 0)
    assert.equal(index.body.records[0].failureStatus, 'reference-only')
    assert.ok(!JSON.stringify(index).includes('OFFICIAL_ONLY_ERROR'))
    const detail = await invoke(api, base + '/' + f.record.id)
    assert.equal(detail.status, 200)
    assert.equal(calls, 1)
    assert.equal(detail.body.record.contentStatus, 'assembly-unavailable')
    assert.equal(detail.body.record.failureStatus, 'available')
    assert.deepEqual(detail.body.record.failure, { code: 'UNKNOWN', message: 'OFFICIAL_ONLY_ERROR' })
    restored.put(detail.body.record)
    assert.ok(!readFileSync(restored.path, 'utf8').includes('OFFICIAL_ONLY_ERROR'))
    assert.equal(restored.get('session', f.record.id).failureStatus, 'reference-only')
  } finally { f.cleanup() }
})

test('unavailable or altered official failure events never return cached error text', async () => {
  const f = fixture()
  try {
    const cases = [
      [inspection => { inspection.meta.id = 'other' }, 'session-mismatch'],
      [inspection => { inspection.meta.createdAt++ }, 'session-mismatch'],
      [inspection => { inspection.meta.version = 4 }, 'format-mismatch'],
      [inspection => { inspection.events = [] }, 'cut-unavailable'],
      [inspection => { inspection.events[0].type = 'assistant/message' }, 'event-unavailable'],
      [inspection => { inspection.events[0].data.turn = 2 }, 'identity-mismatch'],
      [inspection => { inspection.events[0].data.reason.error.message = 'ALTERED' }, 'hash-mismatch'],
    ]
    for (const [change, expected] of cases) {
      const inspection = structuredClone(f.inspection)
      change(inspection)
      const read = createAssemblyBodyReader({ inspect: async () => inspection })
      const detail = await read({ ...f.record, failure: { message: 'STALE' } })
      assert.equal(detail.failure, undefined)
      assert.equal(detail.failureStatus, 'reference-unavailable')
      assert.equal(detail.failureReferenceError, expected)
    }
    const missing = await createAssemblyBodyReader({ inspect: async () => { throw Object.assign(new Error('missing'), { code: 'SESSION_NOT_FOUND' }) } })(f.record)
    assert.equal(missing.failureReferenceError, 'history-unavailable')
    assert.equal(missing.failure, undefined)
  } finally { f.cleanup() }
})

test('failure references validate their own event identity, not just a valid prompt reference', async () => {
  const f = fixture()
  try {
    for (const [patch, expected] of [
      [{ eventSeq: 3 }, 'event-unavailable'],
      [{ eventSeq: -1 }, 'event-unavailable'],
      [{ eventHash: 'bad' }, 'hash-mismatch'],
      [{ sessionRef: { ...f.record.failureRef.sessionRef, sessionId: 'other' } }, 'session-mismatch'],
    ]) {
      const record = { ...f.record, sessionRef: { ...f.record.failureRef.sessionRef }, failureRef: { ...f.record.failureRef, ...patch } }
      const detail = await createAssemblyBodyReader({ inspect: async () => f.inspection })(record)
      assert.equal(detail.failureReferenceError, expected)
      assert.equal(detail.failure, undefined)
    }
    const old = { schemaVersion: 4, bodyStorage: 'official-session', sessionId: 'session', status: 'assembly-or-preparation-failed' }
    const detail = await createAssemblyBodyReader({ inspect: async () => { throw new Error('must not inspect an unreferenced legacy failure') } })(old)
    assert.equal(detail.failure, undefined)
    assert.equal(detail.failureStatus, undefined)
  } finally { f.cleanup() }
})
