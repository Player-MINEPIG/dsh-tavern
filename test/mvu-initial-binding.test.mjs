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
  const resource = { sharing: 'shared', id: 'mvu:initial', characterId: 'c', sessionIds: ['s', 'other'], managementMode: managed ? 'managed' : 'native', initial: { stat_data: { hp: 10 } }, schemaSource: 'const Schema=z.object({hp:z.number().min(0)});' }
  const options = { storageDir, resources: resources ?? [resource], sources: { register: () => () => {} },
    memberships: { captureLease: () => () => true, readCatalog: () => ({ catalog: { playthroughs: [playthrough] } }), readTimeline: () => ({ timeline }) },
    getSelection: id => selections.get(id), getSelectionToken: id => selections.selectionRevision(id), isActive: (r, id) => r.characterId === selections.get(id).characterCardId }
  const service = installMvu(ctx, options); t.after(() => service.dispose())
  const facts = []; service.observe(f => facts.push(f))
  return { service, scope, sourceIdentity, session, playthrough, timeline, facts, options, ctx, selections,
    allow: () => service.registerUsage(request => { const captured = policy; assert.equal(request.on, 'card_variable_update'); return { enabled: captured.enabled, configRevision: captured.revision, checkCurrent: () => policy === captured } }),
    reload: () => { policy = { enabled: false, revision: 2 } }, revoke: () => { valid = false },
    select: id => { selections.set('s', { characterCardId: id }) },
    append: (type, data) => { const event = { type, data, seq: events.length }; events = [...events, event]; handlers.get('session/event')(session, event) },
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
  for (const action of ['policy', 'turn', 'model', 'title', 'character', 'membership', 'grant', 'capability', 'abort']) {
    const f = fixture(t); f.allow(); const { capability } = await f.bind(), controller = new AbortController()
    const resolve = f.service.resolveScope; let count = 0
    f.service.resolveScope = async scope => {
      const evidence = await resolve(scope)
      if (++count === 2) {
        if (action === 'policy') f.reload()
        if (action === 'turn') f.start()
        if (action === 'model') f.append('model/selection', { provider: 'synthetic', model: 'test' })
        if (action === 'title') f.append('session/title', { title: 'Opening', messageSeqs: [], source: { kind: 'user' } })
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

test('indexed greeting HTTP read and initial write retain the observed source token', async t => {
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
  const greeting = { ...f.scope, mode: 'greeting', greetingIndex: 0 }
  const snapshot = await client.getMvuSnapshot(greeting)
  assert.equal(snapshot.viewIdentity.greetingIndex, 0)
  Object.assign(f.scope, { greetingIndex: 0, selectionToken: snapshot.viewIdentity.selectionToken })
  const binding = await createMvuCardBinding({ client, scope: f.scope, writeGrant: { grantId: 'grant', sourceIdentity: f.sourceIdentity } }); t.after(() => binding.dispose())
  assert.equal((await binding.write({ operation: 'replace', value: { stat_data: { hp: 7 } }, expectedRevision: 0, operationId: 'indexed-http', cause: 'user-interaction' })).revision, 1)
  for (const [scope, code] of [[{ ...greeting, greetingIndex: 1 }, 'MVU_READ_ONLY'], [{ ...greeting, greetingIndex: -1 }, 'MVU_SCOPE'], [{ ...greeting, selectionToken: 'b'.repeat(64) }, 'MVU_READ_ONLY'], [{ ...greeting, messageId: 'forged' }, 'MVU_SCOPE']]) {
    await assert.rejects(client.getMvuSnapshot(scope), { code })
  }
  f.selections.set('s', { character: { greetingIndex: 1 } })
  f.selections.set('s', { character: { greetingIndex: 0 } })
  await assert.rejects(client.postMvuOperation('card-binding', { scope: f.scope, grantId: 'grant', sourceIdentity: f.sourceIdentity }), { code: 'MVU_READ_ONLY' })
  assert.equal((await f.service.read({ id: 'mvu:initial', scope: { sessionId: 's' } })).revision, 1)
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

test('model selection permits fresh initial bindings but revokes prior leases and rejects malformed payloads', async t => {
  const f = fixture(t); f.allow()
  const old = await f.bind()
  f.append('model/selection', { provider: 'synthetic', model: 'test' })
  assert.equal((await f.service.snapshot(f.scope)).status, 'available')
  await assert.rejects(f.service.cardWrite(request(old.capability, 0)), { code: 'MVU_READ_ONLY' })
  const fresh = await f.bind()
  assert.equal((await f.service.cardWrite(request(fresh.capability, 0))).revision, 1)
  f.append('model/selection', { provider: 'synthetic', model: 'test', reasoningEffort: 'adapter-owned' })
  await assert.rejects(f.service.cardWrite(request(fresh.capability, 1, 'old-selection')), { code: 'MVU_READ_ONLY' })
  assert.ok((await f.bind()).capability)
  for (const data of [null, [], '', {}, { provider: 'p' }, { model: 'm' }, { provider: '', model: 'm' },
    { provider: 'p', model: 1 }, { provider: 'p', model: '' }, { provider: 1, model: 'm' },
    { provider: 'p', model: 'm', reasoningEffort: '' }, { provider: 'p', model: 'm', reasoningEffort: null },
    { provider: 'p', model: 'm', reasoningEffort: 1 }, { provider: 'p', model: 'm', reasoningEffort: undefined },
    { provider: 'p', model: 'm', content: [] }, { provider: 'p', model: 'm', unknown: true }]) {
    f.session.snapshotEvents = () => [{ seq: 0, type: 'model/selection', data }]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
    await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' })
  }
  for (const type of ['turn/start', 'turn/end', 'user/message', 'assistant/message', 'agent/inbox/spliced', 'request/header', 'model/other']) {
    f.session.snapshotEvents = () => [
      { seq: 0, type: 'model/selection', data: { provider: 'synthetic', model: 'test' } },
      { seq: 1, type, data: {} },
      { seq: 2, type: 'model/selection', data: { provider: 'synthetic', model: 'test' } },
    ]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' }, type)
    await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }, type)
  }
})

test('explicit user titles allow fresh initial bindings without reviving old capabilities', async t => {
  const f = fixture(t); f.allow()
  const title = value => ({ title: value, messageSeqs: [], source: { kind: 'user' } })
  const original = await f.bind()
  f.append('session/title', title('Opening'))
  assert.equal((await f.service.snapshot(f.scope)).status, 'available')
  await assert.rejects(f.service.cardWrite(request(original.capability, 0, 'before-title')), { code: 'MVU_READ_ONLY' })
  const renamed = await f.bind()
  f.append('session/title', title('Other')); f.append('session/title', title('Opening'))
  await assert.rejects(f.service.cardWrite(request(renamed.capability, 0, 'title-restored')), { code: 'MVU_READ_ONLY' })
  const fresh = await f.bind()
  assert.equal((await f.service.cardWrite(request(fresh.capability, 0, 'after-title'))).revision, 1)
  f.start(); f.append('session/title', title('After turn'))
  await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.cardWrite(request(fresh.capability, 1, 'after-turn-title')), { code: 'MVU_READ_ONLY' })
})

test('title metadata rejects automatic sources, message references, malformed and unknown fields or activity', async t => {
  const f = fixture(t)
  const valid = { title: 'Opening', messageSeqs: [], source: { kind: 'user' } }
  const invalid = [null, [], '', {}, { title: 'Opening' }, { ...valid, title: '' }, { ...valid, title: '  ' },
    { ...valid, title: 1 }, { ...valid, messageSeqs: [0] }, { ...valid, messageSeqs: null }, { ...valid, messageSeqs: {} },
    { ...valid, source: null }, { ...valid, source: [] }, { ...valid, source: {} },
    { ...valid, source: { kind: 'fallback' } }, { ...valid, source: { kind: 'provider', provider: 'p', model: 'm' } },
    { ...valid, source: { kind: 'user', extra: true } }, { ...valid, unknown: true }]
  for (const data of invalid) {
    f.session.snapshotEvents = () => [{ seq: 0, type: 'session/title', data }]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' }, JSON.stringify(data))
    await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }, JSON.stringify(data))
  }
  for (const type of ['turn/start', 'turn/end', 'user/message', 'assistant/message', 'agent/inbox/spliced', 'request/header', 'session/title-llm-request', 'session/title-other']) {
    f.session.snapshotEvents = () => [
      { seq: 0, type: 'session/title', data: valid }, { seq: 1, type, data: {} }, { seq: 2, type: 'session/title', data: valid },
    ]
    await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' }, type)
    await assert.rejects(f.bind(), { code: 'MVU_READ_ONLY' }, type)
  }
})

test('greeting is an explicit current read view after a turn and never a write capability', async t => {
  const f = fixture(t); f.allow()
  const scope = { ...f.scope, mode: 'greeting' }
  assert.equal((await f.service.snapshot(scope)).variables.stat_data.hp, 10)
  const initial = await f.bind()
  await f.service.cardWrite(request(initial.capability, 0))
  f.start()
  assert.equal((await f.service.snapshot(scope)).variables.stat_data.hp, 7)
  await assert.rejects(f.service.snapshot(f.scope), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.createCardBinding({ scope, grantId: 'grant', sourceIdentity: { ...f.sourceIdentity, scope } }), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.cardWrite(request(initial.capability, 1, 'after-turn')), { code: 'MVU_READ_ONLY' })
  await assert.rejects(f.service.snapshot({ ...scope, nodeId: 'forged' }), { code: 'MVU_SCOPE' })
  f.select('other'); await assert.rejects(f.service.snapshot(scope), { code: 'MVU_READ_ONLY' }); f.select('c')
  f.playthrough.ext.pmpDshTavern.rootSessionId = 'other'
  await assert.rejects(f.service.snapshot(scope), { code: 'MVU_READ_ONLY' })
})

test('greeting reads a stored session without starting an Agent and rechecks access after async listing', async t => {
  const f = fixture(t), scope = { ...f.scope, mode: 'greeting' }
  f.ctx.get('sessions').delete('s')
  f.ctx.provide('sessionController', { inspect: async () => ({ meta: f.session.header, events: [] }), resolveAgent: () => { throw Error('Reading a greeting must not start an Agent') } })
  assert.equal((await f.service.snapshot(scope)).status, 'available')
  const list = f.service.list.bind(f.service)
  f.service.list = async input => { const rows = await list(input); f.select('other'); return rows }
  await assert.rejects(f.service.snapshot(scope), { code: 'MVU_READ_ONLY' })
})

test('a selected greeting view cannot lazily acquire a newer selection lease or survive selection ABA', async t => {
 const f=fixture(t);f.allow()
 f.selections.set('s',{character:{greetingIndex:0}})
 const readScope={...f.scope,mode:'greeting',greetingIndex:0}
 const observed=await f.service.snapshot(readScope)
 assert.equal(observed.viewIdentity.greetingIndex,0)
 assert.match(observed.viewIdentity.selectionToken,/^[a-f0-9]{64}$/)
 const scope={...f.scope,greetingIndex:0,selectionToken:observed.viewIdentity.selectionToken}
 f.ctx.get('tavernRenderingAuthority').resolve=async request=>({valid:true,write:true,scope:request.sourceIdentity.scope})
 const bind=input=>f.service.createCardBinding({scope:input,grantId:'grant',sourceIdentity:{version:1,sha256:'a'.repeat(64),scope:input}})
 await assert.rejects(bind({...scope,selectionToken:undefined}),{code:'MVU_SCOPE'})
 f.selections.set('s',{character:{greetingIndex:1}})
 await assert.rejects(f.service.snapshot(readScope),{code:'MVU_READ_ONLY'})
 await assert.rejects(bind(scope),{code:'MVU_READ_ONLY'})
 f.selections.set('s',{character:{greetingIndex:0}})
 await assert.rejects(bind(scope),{code:'MVU_READ_ONLY'})
 const fresh=await f.service.snapshot(readScope)
 assert.notEqual(fresh.viewIdentity.selectionToken,observed.viewIdentity.selectionToken)
 assert.ok((await bind({...scope,selectionToken:fresh.viewIdentity.selectionToken})).capability)
 assert.equal((await f.service.read({id:'mvu:initial',scope:{sessionId:'s'}})).revision,0)
 assert.equal(f.facts.filter(fact=>fact.phase==='applied').length,0)
})

test('greeting view identity rejects malformed coordinates and changes with the Host instance', async t => {
 const f=fixture(t)
 for(const greetingIndex of [-1,0.5,'0'])await assert.rejects(f.service.snapshot({...f.scope,mode:'greeting',greetingIndex}),{code:'MVU_SCOPE'})
 await assert.rejects(f.service.snapshot({...f.scope,mode:'greeting',selectionToken:'foreign'}),{code:'MVU_SCOPE'})
 const old=await f.service.snapshot({...f.scope,mode:'greeting',greetingIndex:0})
 f.service.dispose()
 const renewed=installMvu(f.ctx,f.options);t.after(()=>renewed.dispose())
 await assert.rejects(renewed.snapshot({...f.scope,mode:'greeting',greetingIndex:0,selectionToken:old.viewIdentity.selectionToken}),{code:'MVU_READ_ONLY'})
})
