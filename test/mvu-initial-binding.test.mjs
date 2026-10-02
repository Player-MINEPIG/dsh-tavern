import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { installMvu } from '../packages/mvu-adapter/src/host.js'

function fixture(t, { managed = false, resources } = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-initial-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const scope = { mode: 'initial', playthroughId: 'p', sessionId: 's', characterId: 'c', sessionFormatVersion: 4 }
  const selections = new SessionSelectionStore(storageDir); selections.set('s', { characterCardId: 'c' })
  let events = [], valid = true, policy = { enabled: true, revision: 1 }
  const session = { id: 's', header: { id: 's', version: 4, createdAt: 'stable' }, snapshotEvents: () => events }
  const playthrough = { id: 'p', ext: { pmpDshTavern: { rootSessionId: 's', characterId: 'c' } } }, timeline = { nodes: [], head: null }
  const sourceIdentity = { version: 1, sha256: 'a'.repeat(64), scope }
  const handlers = new Map(), services = new Map([['sessions', new Map([['s', session]])]])
  const ctx = { get: name => services.get(name), provide: (name, service) => services.set(name, service),
    on: (name, handler) => { handlers.set(name, handler) }, effect: fn => fn() }
  services.set('tavernRenderingAuthority', { resolve: async () => ({ valid, write: true, scope }), isCurrent: () => valid })
  const resource = { id: 'mvu:initial', characterId: 'c', sessionIds: ['s', 'other'], managementMode: managed ? 'managed' : 'native', initial: { stat_data: { hp: 10 } }, schemaSource: 'const Schema=z.object({hp:z.number().min(0)});' }
  const options = { storageDir, resources: resources ?? [resource], sources: { register: () => () => {} },
    memberships: { captureLease: () => () => true, readCatalog: () => ({ catalog: { playthroughs: [playthrough] } }), readTimeline: () => ({ timeline }) },
    getSelection: id => selections.get(id), getSelectionToken: id => selections.selectionRevision(id), isActive: (r, id) => r.characterId === selections.get(id).characterCardId }
  const service = installMvu(ctx, options); t.after(() => service.dispose())
  const facts = []; service.observe(f => facts.push(f))
  return { service, scope, sourceIdentity, session, playthrough, timeline, facts, options, ctx, selections,
    allow: () => service.registerUsage(request => { const captured = policy; assert.equal(request.on, 'card_variable_update'); return { enabled: captured.enabled, configRevision: captured.revision, checkCurrent: () => policy === captured } }),
    reload: () => { policy = { enabled: false, revision: 2 } }, revoke: () => { valid = false },
    select: id => { selections.set('s', { characterCardId: id }) },
    start: () => { const event = { type: 'turn/start', seq: 0, data: { turn: 1 } }; events = [event]; handlers.get('session/event')(session, event) },
    bind: () => service.createCardBinding({ scope, sourceIdentity, grantId: 'grant' }) }
}
const request = (capability, revision, operationId = 'opening') => ({ capability, operation: 'replace', value: { stat_data: { hp: 7 } }, expectedRevision: revision, operationId, cause: 'user-interaction' })

test('initial scope exposes source schema and commits one shared current entity with CAS and idempotency', async t => {
  const f = fixture(t, { managed: true }); f.allow()
  const before = await f.service.snapshot(f.scope)
  assert.equal(before.status, 'available'); assert.equal(before.variables.stat_data.hp, 10)
  assert.equal(before.variables.mvu_schema.source, f.options.resources[0].schemaSource)
  const { capability } = await f.bind(), input = request(capability, 0)
  const result = await f.service.cardWrite(input)
  assert.equal(result.variables.stat_data.hp, 7); assert.equal(result.revision, 1)
  assert.deepEqual(await f.service.cardWrite(input), result)
  assert.equal((await f.service.snapshot(f.scope)).variables.stat_data.hp, 7)
  assert.equal((await f.service.read({ id: 'mvu:initial', scope: { sessionId: 'other' } })).content.stat_data.hp, 7)
  await assert.rejects(f.service.cardWrite(request(capability, 0, 'stale')), { code: 'REVISION_CONFLICT' })
  await assert.rejects(f.service.cardWrite({ ...request(capability, 1, 'invalid'), value: { stat_data: { hp: -1 } } }), { code: 'MVU_SCHEMA' })
  assert.equal(f.facts.filter(fact => fact.phase === 'applied').length, 1)
  assert.ok(f.facts.filter(fact => ['applied', 'completed', 'triggered'].includes(fact.phase)).every(fact => fact.configRevision === 1))
  const history = await f.service.history({ id: 'mvu:initial', scope: { sessionId: 's' } })
  assert.equal(history[0].source.initial, true); assert.equal(history[0].source.messageId, undefined)
  f.start()
  assert.equal((await f.service.read({ id: 'mvu:initial', scope: { sessionId: 's' } })).content.stat_data.hp, 7)
  await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.cardWrite(request(capability, 1, 'after-start')), { code: 'MVU_READ_ONLY' })
})

test('initial mode does not relax durable scope, membership, character, fork or unique resource checks', async t => {
  const f = fixture(t)
  await assert.rejects(f.service.snapshot({ sessionId: 's', playthroughId: 'p' }), { code: 'MVU_SCOPE' })
  await assert.rejects(f.service.snapshot({ ...f.scope, nodeId: 'n' }), { code: 'MVU_SCOPE' })
  await assert.rejects(f.service.snapshot({ ...f.scope, mode: 'unknown' }), { code: 'MVU_SCOPE' })
  f.playthrough.ext.pmpDshTavern.rootSessionId = 'other'
  await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }); f.playthrough.ext.pmpDshTavern.rootSessionId = 's'
  f.select('other'); await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }); f.select('c')
  f.session.header.parentSession = 'parent'; await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }); delete f.session.header.parentSession
  f.timeline.nodes.push({ id: 'n', variants: [] }); await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }); f.timeline.nodes.length = 0
  f.service.resources.push({ ...f.service.resources[0], id: 'mvu:duplicate' })
  await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_AMBIGUOUS' })
  await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' })
})

test('initial binding switch-away-and-back stays revoked; fresh binding is required', async t => {
  const f = fixture(t); f.allow(); const { capability } = await f.bind()
  f.select('other'); f.select('c')
  await assert.rejects(f.service.cardWrite(request(capability, 0)), { code: 'MVU_READ_ONLY' })
  const fresh = await f.bind()
  assert.equal((await f.service.cardWrite(request(fresh.capability, 0))).revision, 1)
})

test('native grant-only and missing or asynchronous policy leases never permit card writes', async t => {
  for (const decision of [undefined, { enabled: true }, { enabled: true, checkCurrent: async () => true }]) {
    const f = fixture(t); if (decision) f.service.registerUsage(() => decision)
    const { capability } = await f.bind()
    await assert.rejects(f.service.cardWrite(request(capability, 0)))
    assert.equal((await f.service.read({ id: 'mvu:initial', scope: { sessionId: 's' } })).revision, 0)
    assert.ok(!f.facts.some(fact => fact.phase === 'applied'))
  }
})

test('final scope await cannot retain an old policy, initial scope, grant or live capability', async t => {
  for (const action of ['policy', 'turn', 'character', 'membership', 'grant', 'capability', 'abort']) {
    const f = fixture(t); f.allow(); const { capability } = await f.bind(), controller = new AbortController()
    const resolve = f.service.resolveScope; let count = 0
    f.service.resolveScope = async scope => {
      const evidence = await resolve(scope)
      if (++count === 2) {
        if (action === 'policy') f.reload()
        if (action === 'turn') f.start()
        if (action === 'character') { f.select('other'); f.select('c') }
        if (action === 'membership') f.playthrough.ext.pmpDshTavern.rootSessionId = 'other'
        if (action === 'grant') f.revoke()
        if (action === 'capability') f.service.revokeCardBinding(capability)
        if (action === 'abort') controller.abort()
      }
      return evidence
    }
    await assert.rejects(f.service.cardWrite({ ...request(capability, 0), signal: controller.signal }), undefined, action)
    assert.equal((await f.service.read({ id: 'mvu:initial', scope: { sessionId: 's' } })).revision, 0, action)
    assert.ok(!f.facts.some(fact => fact.phase === 'applied'), action)
  }
})


test('another session selection does not invalidate initial capability; offline inspection is never a live lease', async t => {
  const f = fixture(t); f.allow(); const { capability } = await f.bind()
  f.selections.set('unrelated', { characterCardId: 'other' })
  assert.equal((await f.service.cardWrite(request(capability, 0))).revision, 1)
  f.ctx.get('sessions').delete('s')
  f.ctx.provide('sessionController', { inspect: async () => ({ header: f.session.header, events: [] }) })
  await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.cardWrite(request(capability, 1, 'offline')), { code: 'MVU_READ_ONLY' })
  f.ctx.provide('sessionController', { resolveAgent: async id => { assert.equal(id, 's'); f.ctx.get('sessions').set('s', f.session); return { agent: { session: f.session } } } })
  assert.ok((await f.bind()).capability)
})

test('initial versions survive reload and flow into first durable reply without replaying initial edits', async t => {
  const f = fixture(t); f.allow(); const { capability } = await f.bind()
  await f.service.cardWrite(request(capability, 0))
  f.service.dispose()
  const restored = installMvu(f.ctx, f.options); t.after(() => restored.dispose())
  assert.equal((await restored.snapshot(f.scope)).variables.stat_data.hp, 7)
  const events = [
    { seq: 0, type: 'turn/start', data: { turn: 1 } },
    { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'first', content: [{ type: 'text', text: "_.add('hp', -1);" }] } } },
    { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  f.session.snapshotEvents = () => events
  await restored.ingest(f.session)
  const row = await restored.read({ id: 'mvu:initial', scope: { sessionId: 's' } })
  assert.equal(row.content.stat_data.hp, 6); assert.equal(row.revision, 2)
  await restored.ingest(f.session)
  assert.equal((await restored.read({ id: 'mvu:initial', scope: { sessionId: 's' } })).revision, 2)
  f.session.header.createdAt = 'different'
  await assert.rejects(restored.read({ id: 'mvu:initial', scope: { sessionId: 's' } }), { code: 'MVU_HISTORY_UNAVAILABLE' })
})

test('initial scope crosses the JSON HTTP and shared client binding without exposing its capability', async t => {
  const { Readable } = await import('node:stream')
  const { createMvuApi } = await import('../packages/mvu-adapter/src/http.js')
  const { createMvuCardBinding } = await import('../packages/client/src/play/mvu-bridge.js')
  const { API_V1 } = await import('../packages/identity.js')
  const f = fixture(t); f.allow(); const api = createMvuApi(f.service)
  const invoke = (url, body) => new Promise((resolve, reject) => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []); req.url = url; req.method = body ? 'POST' : 'GET'
    const res = { setHeader() {}, end(text) { const result = JSON.parse(text); if (this.statusCode >= 400) reject(Object.assign(new Error(result.error), { code: result.code })); else resolve(result) } }
    Promise.resolve(api(req, res)).catch(reject)
  })
  const client = { getMvuSnapshot: scope => invoke(`${API_V1}/mvu/snapshot?scope=${encodeURIComponent(JSON.stringify(scope))}`), postMvuOperation: (path, body) => invoke(`${API_V1}/mvu/${path}`, body) }
  const binding = await createMvuCardBinding({ client, scope: f.scope, writeGrant: { grantId: 'grant', sourceIdentity: f.sourceIdentity } }); t.after(() => binding.dispose())
  assert.equal(binding.getSnapshot().capability, undefined); assert.equal(binding.getSnapshot().writable, true)
  const notices = []; binding.subscribe(snapshot => notices.push(snapshot))
  await binding.write({ operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -3 }], expectedRevision: 0, operationId: 'http-opening', cause: 'user-interaction' })
  assert.equal(binding.getSnapshot().variables.stat_data.hp, 7)
  assert.equal(notices.length, 1); assert.equal(notices[0].revision, 1)
  f.start()
  await assert.rejects(binding.write({ operation: 'patch', value: [], expectedRevision: 1, operationId: 'http-stale', cause: 'script' }), { code: 'MVU_READ_ONLY' })
})


test('official new-session permission metadata permits initial scope; all activity and unknown events still refuse it', async t => {
  // Neutral replay of the sequence emitted by official SessionController creation plus Tavern RP mode.
  const metadata = [
    { seq: 0, type: 'permission/preset', data: { preset: 'workspace-write' } },
    { seq: 1, type: 'sandbox/mode', data: { mode: 'workspace-write' } },
    { seq: 2, type: 'approval/policy', data: { policy: 'ask' } },
    { seq: 3, type: 'sandbox/mode', data: { mode: 'read-only' } },
  ]
  const f = fixture(t); f.allow(); f.session.snapshotEvents = () => metadata
  assert.equal((await f.service.snapshot(f.scope)).variables.stat_data.hp, 10)
  const { capability } = await f.bind()
  assert.equal((await f.service.cardWrite(request(capability, 0))).variables.stat_data.hp, 7)
  for (const type of ['turn/start', 'turn/end', 'user/message', 'assistant/message', 'agent/inbox/spliced', 'request/header', 'permission/other', 'approval/request']) {
    f.session.snapshotEvents = () => [...metadata, { seq: 4, type, data: {} }]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' }, type)
    await assert.rejects(f.service.cardWrite(request(capability, 1, type)), { code: 'MVU_READ_ONLY' }, type)
  }
})

test('empty restore markers permit initial scope but never inherited, malformed or active history', async t => {
  const f = fixture(t); f.allow()
  const marker = { seq: 0, type: 'session/end-seed', data: {} }
  f.session.header.isSeeded = false
  f.session.snapshotEvents = () => [marker]
  assert.equal((await f.service.snapshot(f.scope)).variables.stat_data.hp, 10)
  const { capability } = await f.bind()
  assert.equal((await f.service.cardWrite(request(capability, 0))).revision, 1)
  for (const data of [{ inherited: true }, { inherited: false }, { unknown: true }, null, [], '']) {
    f.session.snapshotEvents = () => [{ ...marker, data }]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
    await assert.rejects(f.service.cardWrite(request(capability, 1, 'invalid-marker')), { code: 'MVU_READ_ONLY' })
  }
  f.session.snapshotEvents = () => [marker]
  f.session.header.isSeeded = true
  await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
  f.session.header.isSeeded = false
  for (const type of ['turn/start', 'turn/end', 'user/message', 'assistant/message', 'agent/inbox/spliced', 'request/header', 'session/other']) {
    f.session.snapshotEvents = () => [{ seq: 0, type, data: {} }, { ...marker, seq: 1 }]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' }, type)
    await assert.rejects(f.service.cardWrite(request(capability, 1, type)), { code: 'MVU_READ_ONLY' }, type)
  }
})
