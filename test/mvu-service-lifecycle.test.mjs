// Review-only synthetic tests. Writes solely to fresh temporary storage.
// Run: node --test test/mvu-service-lifecycle.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const paths = ['packages/mvu-adapter/src/service.js', 'packages/mvu-adapter/src/host.js', 'packages/mvu-adapter/src/http.js', 'packages/client/src/play/mvu-bridge.js']
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]))
const before = hashes()
const { MvuService } = await import(pathToFileURL(join(root, paths[0])).href)
const { createMvuCardBinding } = await import(pathToFileURL(join(root, paths[3])).href)
const { installMvu } = await import(pathToFileURL(join(root, paths[1])).href)
const results = []
async function check(name, run) { await test(name, () => run({})) }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const state = hp => ({ stat_data: { hp }, schema: { type: 'object', properties: { hp: { type: 'number' } }, extensible: false } })
const scope = { sessionId: 'root', authority: 'local' }
const events = (id, delta = -5) => [
  { seq: 0, type: 'turn/start', data: { turn: 1 } },
  { seq: 1, type: 'assistant/message', data: { turn: 1, step: 1, message: { id, content: [{ type: 'text', text: `_.add('hp', ${delta});` }] } } },
  { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
]
const session = (id = 'root', ev = events('root-msg'), parentSession, inheritedEventCount = 0) => ({ id, header: { id, version: 4, createdAt: 100, ...(parentSession ? { parentSession } : {}) }, inheritedEventCount, snapshotEvents: () => ev, events: ev })
async function fixture(run, extra = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-service-followup-'))
  const options = { storageDir, resources: [{ id: 'mvu:shared', sessionIds: ['root', 'child', 'grandchild'], initial: state(100) }], ...extra }
  const service = new MvuService(options)
  try { await run(service, options) } finally { service.dispose(); rmSync(storageDir, { recursive: true, force: true }) }
}
const read = (service, bound = scope) => service.read({ id: 'mvu:shared', scope: bound })

await check('usage removal followed by rejection must not consume the durable event', observation => fixture(async (service, options) => {
  const entered = deferred(), decision = deferred()
  const stop = service.registerUsage(() => { entered.resolve(); return decision.promise })
  const pending = service.ingest(session()).then(() => 'resolved', error => error.code ?? error.name)
  await entered.promise; stop(); decision.reject(new DOMException('adapter detached', 'AbortError'))
  observation.pending = await pending
  observation.afterCancel = (await read(service)).revision
  service.registerUsage(() => ({ enabled: true }))
  await service.ingest(session())
  observation.afterRetry = { revision: (await read(service)).revision, hp: (await read(service)).content.stat_data.hp }
  observation.persisted = existsSync(join(options.storageDir, 'mvu-state.json'))
  assert.equal(observation.afterCancel, 0)
  assert.equal(observation.afterRetry.hp, 95)
}))

await check('service disposal while usage rejects cannot persist a receipt', observation => fixture(async (service, options) => {
  const entered = deferred(), decision = deferred()
  service.registerUsage(() => { entered.resolve(); return decision.promise })
  const pending = service.ingest(session()).then(() => 'resolved', error => error.code ?? error.name)
  await entered.promise; service.dispose(); decision.reject(new DOMException('unloaded', 'AbortError'))
  observation.pending = await pending
  const restored = new MvuService(options)
  try { observation.revision = (await read(restored)).revision; assert.equal(observation.revision, 0) } finally { restored.dispose() }
}))

await check('request cancellation after awaited usage produces no output or state', observation => fixture(async (service, options) => {
  const entered = deferred(), decision = deferred(), controller = new AbortController()
  service.registerUsage(() => { entered.resolve(); return decision.promise })
  const pending = service.resolveRequest({ sessionId: 'root', preview: true, turn: null, step: null, signal: controller.signal })
  const rejection = assert.rejects(pending, { name: 'AbortError' })
  await entered.promise; controller.abort(); decision.resolve({ enabled: true }); await rejection
  observation.persisted = existsSync(join(options.storageDir, 'mvu-state.json'))
  assert.equal(observation.persisted, false)
}))

await check('removing an earlier usage provider while another awaits must cancel the old decision', observation => fixture(async service => {
  const entered = deferred(), decision = deferred()
  const stop = service.registerUsage(() => ({ enabled: true }))
  service.registerUsage(() => { entered.resolve(); return decision.promise })
  const pending = service.ingest(session()).then(() => 'resolved', error => error.code ?? error.name)
  await entered.promise; stop(); decision.resolve({ enabled: true })
  observation.pending = await pending
  const row = await read(service); observation.revision = row.revision; observation.hp = row.content.stat_data.hp
  assert.equal(row.revision, 0)
}))

await check('nested inherited historical snapshots use the origin revision and stay read-only', observation => fixture(async service => {
  const rootSession = session()
  const childEvents = [...rootSession.events, { seq: 3, type: 'session/end-seed', data: { inherited: true } },
    { seq: 4, type: 'turn/start', data: { turn: 2 } },
    { seq: 5, type: 'assistant/message', data: { turn: 2, message: { id: 'child-msg', content: [{ type: 'text', text: "_.add('hp', -3);" }] } } },
    { seq: 6, type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } }]
  await service.ingest(rootSession)
  await service.ingest(session('child', childEvents, 'root', 3))
  await service.ingest(session('grandchild', [...childEvents, { seq: 7, type: 'session/end-seed', data: { inherited: true } }], 'child', 7))
  const old = await read(service, { sessionId: 'grandchild', endEventId: 1 })
  observation.historical = { hp: old.content.stat_data.hp, revision: old.revision, currentRevision: old.currentRevision }
  assert.deepEqual(observation.historical, { hp: 95, revision: 1, currentRevision: 2 })
  await assert.rejects(service.update({ id: 'mvu:shared', scope: { sessionId: 'grandchild', endEventId: 1 }, content: state(1), expectedRevision: 2, operationId: 'historical-edit' }), { code: 'MVU_SCOPE' })
  await assert.rejects(read(service, { sessionId: 'forbidden', endEventId: 1 }), { code: 'SCOPE_MISMATCH' })
  assert.equal((await read(service)).revision, 2)
}))

await check('global current edit uses entity CAS while historical revisions cannot overwrite it', observation => fixture(async service => {
  await service.ingest(session())
  const global = await read(service, {})
  const edited = await service.update({ id: global.id, scope: {}, content: state(80), expectedRevision: global.revision, operationId: 'global-edit' })
  observation.edited = { revision: edited.revision, hp: edited.content.stat_data.hp }
  const old = await read(service, { sessionId: 'root', endEventId: 1 })
  observation.historical = { revision: old.revision, currentRevision: old.currentRevision, hp: old.content.stat_data.hp }
  await assert.rejects(service.update({ id: global.id, scope: {}, content: state(70), expectedRevision: old.revision, operationId: 'stale-historical-cas' }), { code: 'REVISION_CONFLICT' })
  assert.deepEqual(observation.edited, { revision: 2, hp: 80 })
  assert.deepEqual(observation.historical, { revision: 1, currentRevision: 2, hp: 95 })
  assert.equal((await service.list({ scope: { authority: 'local' } }))[0].content.stat_data.hp, 80)
}))

await check('authority-only global edit emits a JSON-safe completion fact', observation => fixture(async service => {
  const facts = []; service.observe(fact => facts.push(fact))
  const result = await service.update({ id: 'mvu:shared', scope: { authority: 'local' }, content: state(80), expectedRevision: 0, operationId: 'global-observed-edit' })
  observation.revision = result.revision; observation.facts = facts
  assert.equal(result.revision, 1)
  assert.equal(facts.filter(fact => fact.detail === 'manual-update' && fact.revision === 1).length, 1)
}))

await check('Host snapshot rejects forged coordinates and resolves an inherited canonical variant', async observation => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-host-snapshot-followup-'))
  const rootSession = session(), childEvents = [...rootSession.events, { seq: 3, type: 'session/end-seed', data: { inherited: true } }]
  const child = session('child', childEvents, 'root', 3), sessions = new Map([['root', rootSession], ['child', child]])
  const services = new Map([['sessions', { get: id => sessions.get(id) }]])
  const ctx = { get: name => services.get(name), provide: (name, value) => services.set(name, value), on() {}, effect() {} }
  const memberships = {
    readCatalog: () => ({ catalog: { playthroughs: [{ id: 'play' }] } }),
    readTimeline: () => ({ timeline: { nodes: [{ id: 'node', variants: [{ id: 'variant', sessionId: 'child', endEventId: 1, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } }] }] } }),
  }
  const service = installMvu(ctx, { storageDir, memberships, resources: [{ id: 'mvu:shared', sessionIds: ['root', 'child'], initial: state(100) }] })
  try {
    await service.ingest(rootSession); await service.ingest(child)
    await service.update({ id: 'mvu:shared', scope, content: state(70), expectedRevision: 1, operationId: 'advance-current' })
    const bound = { playthroughId: 'play', nodeId: 'node', variantId: 'variant', sessionId: 'child', endEventId: 1, sessionFormatVersion: 4 }
    const snapshot = await service.snapshot(bound)
    observation.snapshot = { status: snapshot.status, revision: snapshot.revision, hp: snapshot.variables.stat_data?.hp }
    assert.deepEqual(observation.snapshot, { status: 'available', revision: 1, hp: 95 })
    for (const replacement of [{ variantId: 'forged' }, { sessionId: 'root' }, { endEventId: 2 }, { sessionFormatVersion: 3 }]) await assert.rejects(service.snapshot({ ...bound, ...replacement }), { code: 'MVU_SCOPE' })
    assert.equal((await read(service)).revision, 2)
  } finally { service.dispose(); rmSync(storageDir, { recursive: true, force: true }) }
})

await check('disposed bridge ignores a delayed transport that does not honor abort', async observation => {
  const bound = { sessionId: 'root', variantId: 'v', endEventId: 1 }, entered = deferred(), pending = deferred()
  let calls = 0, notifications = 0
  const snap = revision => ({ version: 1, scope: bound, revision, status: 'available', variables: state(100 - revision) })
  const binding = await createMvuCardBinding({ scope: bound, pollMs: 250, client: { getMvuSnapshot: () => ++calls === 1 ? snap(1) : (entered.resolve(), pending.promise) } })
  binding.subscribe(() => notifications++)
  await entered.promise; binding.dispose(); pending.resolve(snap(2)); await new Promise(resolve => setImmediate(resolve))
  observation.notifications = notifications; observation.calls = calls
  assert.equal(notifications, 0); assert.throws(() => binding.getSnapshot(), /disposed/)
})

const after = hashes()
