import test from 'node:test'
import assert from 'node:assert/strict'
import { createMvuCardBinding } from '../packages/client/src/play/mvu-bridge.js'

const scope = { sessionId: 's', variantId: 'v', endEventId: 2 }
const snapshot = revision => ({ version: 1, scope, revision, status: 'available', variables: { stat_data: { hp: 100 - revision }, schema: { type: 'object' } } })

test('binding validates scope, detaches data, polls committed changes and disposes', async t => {
  let revision = 1
  const binding = await createMvuCardBinding({ client: { getMvuSnapshot: async () => snapshot(revision) }, scope, pollMs: 250 })
  t.after(() => binding.dispose())
  const first = binding.getSnapshot(); first.variables.stat_data.hp = 0
  assert.equal(binding.getSnapshot().variables.stat_data.hp, 99)
  const changed = new Promise(resolve => binding.subscribe(resolve))
  revision = 2
  assert.equal((await changed).revision, 2)
  binding.dispose()
  assert.throws(() => binding.getSnapshot(), /disposed/)
  await assert.rejects(createMvuCardBinding({ client: { getMvuSnapshot: async () => ({ ...snapshot(1), scope: { ...scope, sessionId: 'other' } }) }, scope }), /scope mismatch/)
})
test('abort during initial snapshot stops transport and exposes no binding', async () => {
  const controller = new AbortController()
  let stopped = false
  const promise = createMvuCardBinding({ scope, signal: controller.signal, client: { getMvuSnapshot: (_scope, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { stopped = true; reject(signal.reason) }, { once: true })) } })
  controller.abort()
  await assert.rejects(promise)
  assert.equal(stopped, true)
})

test('a failed poll issued before a committed write cannot erase the newer snapshot', async () => {
  const scope = { sessionId: 's', nodeId: 'n' }, snap = revision => ({ version: 1, status: 'available', scope, revision, currentRevision: revision, variables: { stat_data: { hp: revision }, schema: {} } })
  let calls = 0, rejectPoll, entered
  const ready = new Promise(resolve => { entered = resolve })
  const binding = await createMvuCardBinding({ scope, pollMs: 250, writeGrant: { grantId: 'g', sourceIdentity: {} }, client: {
    getMvuSnapshot: () => ++calls === 1 ? snap(1) : (entered(), new Promise((_, reject) => { rejectPoll = reject })),
    postMvuOperation: async path => path === 'card-binding' ? { capability: 'private', snapshot: snap(1) } : path === 'card-write' ? snap(2) : { ok: true },
  } })
  const notifications = []; binding.subscribe(value => notifications.push(value))
  await ready
  await binding.write({ operation: 'patch', value: [], expectedRevision: 1, operationId: 'write', cause: 'script' })
  rejectPoll(new Error('old transport failure'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(binding.getSnapshot().status, 'available'); assert.equal(binding.getSnapshot().revision, 2)
  assert.deepEqual(notifications.map(value => value.revision), [2])
  binding.dispose()
})
