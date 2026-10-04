import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MvuService, stateInstanceId } from '../packages/mvu-adapter/src/index.js'
import { installMvu } from '../packages/mvu-adapter/src/host.js'
import { createCharacterPlaythrough, playthroughIsReusable } from '../packages/client/src/play/create.js'

function fixture(t, extra = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-instances-'))
  t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const sessions = new Map(), requests = [], facts = []
  const options = { storageDir, resources: [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }], inspect: async id => sessions.get(id), captureSessionLease: id => { const live = sessions.get(id), value = JSON.stringify(live); return () => sessions.get(id) === live && JSON.stringify(live) === value }, ...extra }
  let service
  const restart = () => { service?.dispose(); service = new MvuService(options); service.registerUsage(request => { requests.push(request); return { enabled: true, checkCurrent: () => true } }); service.observe(f => facts.push(f)); return service }
  restart()
  const create = (id, parent, prefix = []) => {
    const session = { id, header: { id, version: 4, createdAt: sessions.size + 1, ...(parent ? { parentSession: parent } : {}) }, events: structuredClone(prefix), inheritedEventCount: prefix.length, snapshotEvents() { return this.events } }
    sessions.set(id, session); return session
  }
  const read = async id => (await service.list({ scope: { sessionId: id } })).find(r => r.templateId === 'mvu:template')
  const edit = async (id, hp, operationId = 'edit') => { const row = await read(id); return service.update({ id: row.id, scope: { sessionId: id }, expectedRevision: row.revision, operationId, content: { stat_data: { hp } } }) }
  const turn = async (id, delta) => {
    const session = sessions.get(id), turn = Math.max(0, ...session.events.map(e => e.data?.turn ?? 0)) + 1, seq = session.events.length
    const start = { seq, type: 'turn/start', data: { turn } }; session.events.push(start)
    await service.checkpoint(session, start)
    session.events.push({ seq: seq + 1, type: 'assistant/message', data: { turn, message: { id: `${id}-${turn}`, content: [{ type: 'text', text: `_.add('hp', ${delta});` }] } } }, { seq: seq + 2, type: 'turn/end', data: { turn, reason: { kind: 'completed' } } })
    await service.ingest(session); return seq + 1
  }
  const fork = async (from, to, atEventId, ticket) => {
    ticket ??= await service.captureSessionSeed({ sessionId: from, kind: 'fork', atEventId })
    const source = sessions.get(from), prefix = source.events.filter(e => e.seq <= atEventId)
    const child = create(to, from, prefix)
    child.events.push({ seq: child.events.length, type: 'session/end-seed', data: {} }, { seq: child.events.length + 1, type: 'turn/end', data: { turn: prefix.at(-1).data.turn, reason: { kind: 'forked' } } })
    await service.installSessionSeed({ ticket, sessionId: to }); return ticket
  }
  return { get service() { return service }, options, sessions, requests, facts, create, read, edit, turn, fork, restart }
}

test('fresh sessions use distinct state IDs, independent current/CAS, and instance IDs in manager policy and prompt sources', async t => {
  const f = fixture(t); f.create('A'); f.create('B')
  const [a, b] = await Promise.all([f.read('A'), f.read('B')])
  assert.notEqual(a.id, b.id); assert.equal(a.templateId, 'mvu:template'); assert.equal(await f.service.read({ id: 'mvu:template', scope: { sessionId: 'A' } }), null)
  await f.edit('A', 80); assert.equal((await f.read('B')).content.stat_data.hp, 100)
  await f.edit('B', 40); assert.equal((await f.read('A')).content.stat_data.hp, 80)
  await assert.rejects(f.service.read({ id: a.id, scope: { sessionId: 'B' } }), { code: 'SCOPE_MISMATCH' })
  const request = await f.service.resolveRequest({ sessionId: 'A' })
  assert.equal(request.blocks[0].source.resourceId, a.id); assert.equal(f.requests.at(-1).id, a.id)
  f.restart(); assert.equal((await f.read('A')).id, a.id); assert.equal((await f.read('B')).content.stat_data.hp, 40)
})

test('fork freezes a concrete snapshot before creation; parent advance, child and grandchild updates never cross-write', async t => {
  const f = fixture(t); f.create('parent')
  const first = await f.turn('parent', -10), before = await f.read('parent')
  const ticket = await f.service.captureSessionSeed({ sessionId: 'parent', kind: 'fork', atEventId: first })
  await f.edit('parent', 60)
  await f.fork('parent', 'child', first, ticket)
  const child = await f.read('child'); assert.notEqual(child.id, before.id); assert.equal(child.revision, 0); assert.equal(child.content.stat_data.hp, 90)
  assert.equal(child.inheritedFrom.id, before.id); assert.equal(child.inheritedFrom.revision, before.revision)
  assert.equal((await f.service.read({ id: child.id, scope: { sessionId: 'child', endEventId: first } })).content.stat_data.hp, 90)
  const second = await f.turn('child', -1); await f.fork('child', 'grandchild', second)
  await f.turn('grandchild', -2)
  assert.equal((await f.read('parent')).content.stat_data.hp, 60); assert.equal((await f.read('child')).content.stat_data.hp, 89); assert.equal((await f.read('grandchild')).content.stat_data.hp, 87)
  f.restart(); assert.equal((await f.read('child')).content.stat_data.hp, 89)
})

test('root reply swipe inherits the original pre-turn opening state, even after the parent advances', async t => {
  const f = fixture(t); f.create('root'); await f.edit('root', 70, 'opening')
  const reply = await f.turn('root', -10); await f.edit('root', 20, 'later')
  const ticket = await f.service.captureSessionSeed({ sessionId: 'root', kind: 'reply-swipe', atEventId: reply, targetSessionId: 'swipe' })
  f.create('swipe'); await assert.rejects(f.read('swipe'), { code: 'MVU_SEED_PENDING' })
  f.restart(); await assert.rejects(f.read('swipe'), { code: 'MVU_SEED_PENDING' })
  const ids = await f.service.installSessionSeed({ ticket, sessionId: 'swipe' }); assert.deepEqual(await f.service.installSessionSeed({ ticket, sessionId: 'swipe' }), ids)
  assert.equal((await f.read('swipe')).content.stat_data.hp, 70)
  await f.turn('swipe', -2); assert.equal((await f.read('swipe')).content.stat_data.hp, 68); assert.equal((await f.read('root')).content.stat_data.hp, 20)
  const checkpoint = JSON.parse(readFileSync(join(f.options.storageDir, 'mvu-instances.json'))).resources[(await f.read('root')).id].checkpoints[0]
  assert.equal(checkpoint.variables.stat_data.hp, 70)
})

test('unseeded forks, mismatched prefixes, target reuse and missing durable identity fail closed', async t => {
  const f = fixture(t); f.create('root'); const reply = await f.turn('root', -1)
  f.create('orphan', 'root'); await assert.rejects(f.read('orphan'), { code: 'MVU_SEED_REQUIRED' })
  const ticket = await f.service.captureSessionSeed({ sessionId: 'root', kind: 'fork', atEventId: reply })
  f.create('wrong', 'other'); await assert.rejects(f.service.installSessionSeed({ ticket, sessionId: 'wrong' }), { code: 'MVU_SEED_MISMATCH' })
  f.create('mutated', 'root', f.sessions.get('root').events.slice(0, 2)); f.sessions.get('mutated').events[1].data.message.id = 'forged'
  await assert.rejects(f.service.installSessionSeed({ ticket, sessionId: 'mutated' }), { code: 'MVU_SEED_MISMATCH' })
  await f.fork('root', 'child', reply, ticket)
  await assert.rejects(f.service.installSessionSeed({ ticket, sessionId: 'wrong' }), { code: 'MVU_SEED_CONFLICT' })
  f.sessions.get('child').header.createdAt++
  await assert.rejects(f.read('child'), { code: 'MVU_SESSION_IDENTITY' })
  const missing = f.create('missing'); delete missing.header.createdAt
  await assert.rejects(f.read('missing'), { code: 'MVU_SESSION_IDENTITY' })
})

test('seed copy never re-evaluates a schema transform or transfers policy, grants, operation IDs or revision', async t => {
  const f = fixture(t, { resources: [{ id: 'mvu:template', sessionIds: ['*'], managementMode: 'managed', initial: { stat_data: { hp: 0 } }, schemaSource: 'const Schema=z.object({hp:z.number().transform(v=>v+1)});' }] })
  f.create('root'); const reply = await f.turn('root', 0), root = await f.read('root')
  await f.fork('root', 'child', reply)
  const child = await f.read('child'); assert.deepEqual(child.content, root.content); assert.equal(child.revision, 0); assert.equal(child.managementMode, 'managed')
  const ledger = JSON.parse(readFileSync(join(f.options.storageDir, 'mvu-instances.json'))).resources[child.id]
  assert(ledger.versions.every(v => !v.operationId && !v.result))
  f.service.dispose(); const noPolicy = new MvuService(f.options)
  assert.equal((await noPolicy.resolveRequest({ sessionId: 'child' })).blocks.length, 0)
  assert.equal(await noPolicy.createCardBinding({}).catch(e => e.code), 'MVU_SCOPE')
  noPolicy.dispose()
})

test('legacy shared ledger stays byte-for-byte read-only and cannot feed active instances or requests', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-legacy-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const legacy = { version: 1, resources: { 'mvu:template': { revision: 3, currentKey: 'legacy-key', definition: { id: 'mvu:template', sessionIds: ['old'], initial: { stat_data: { hp: 100 } } }, versions: [{ key: 'legacy-key', source: { sessionId: 'old', manual: true }, variables: { stat_data: { hp: 50 } }, revision: 3 }] } } }
  const path = join(storageDir, 'mvu-state.json'), bytes = JSON.stringify(legacy); writeFileSync(path, bytes)
  const f = fixture(t, { storageDir }); f.create('old'); f.create('fresh')
  const row = await f.service.read({ id: 'mvu:template', scope: { sessionId: 'old' } })
  assert.equal(row.content.stat_data.hp, 50); assert.equal(row.legacy, true); assert.equal(row.capabilities.edit, false)
  await assert.rejects(f.read('old'), { code: 'MVU_MIGRATION_REQUIRED' })
  await assert.rejects(f.service.update({ id: row.id, scope: { sessionId: 'old' }, content: row.content, expectedRevision: row.revision, operationId: 'edit-legacy' }), { code: 'MVU_MIGRATION_REQUIRED' })
  await assert.rejects(f.service.copy({ id: row.id, scope: { sessionId: 'old' }, newId: 'mvu:copy' }), { code: 'MVU_MIGRATION_REQUIRED' })
  assert.equal((await f.read('fresh')).content.stat_data.hp, 100)
  assert.equal(readFileSync(path, 'utf8'), bytes)
})

test('an initialized legacy empty playthrough can start a separate new run and explicitly restore selected data', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-legacy-new-run-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const path = join(storageDir, 'mvu-state.json')
  const bytes = JSON.stringify({ version: 1, resources: { 'mvu:template': {
    revision: 7, currentKey: 'old-opening', managementMode: 'native',
    definition: { id: 'mvu:template', sessionIds: ['old'], initial: { stat_data: { hp: 100 } } },
    versions: [{ key: 'old-opening', revision: 7, operationId: 'old-click', variables: { stat_data: { hp: 50 } },
      source: { sessionId: 'old', sessionCreatedAt: 1, sessionFormatVersion: 4, initial: true, manual: true, card: true, messageSeq: -1 } }],
  } } })
  writeFileSync(path, bytes)
  const f = fixture(t, { storageDir, resources: [{ id: 'mvu:template', sessionIds: ['*'], managementMode: 'managed', initial: { stat_data: { hp: 100 } }, schemaSource: 'const Schema=z.object({hp:z.number().min(0).max(100)});' }] })
  f.create('old')
  const previous = { id: 'old-run', path: 'card/old-run/timeline.json', ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'old', playthroughNumber: 1 } } }
  let catalog = { playthroughs: [previous] }
  const timelines = new Map([[previous.path, { nodes: [] }]])
  const client = {
    getCatalog: async () => structuredClone(catalog), putCatalog: async value => { catalog = structuredClone(value) },
    getTimeline: async play => timelines.get(play.path), putTimeline: async (play, value) => { timelines.set(play.path, value) }, createDirs: async () => {},
    getMessages: async () => ({ messages: [], incompleteTurn: false }),
    getCharacterSelection: async () => ({ selection: { characterCardId: 'card' } }),
    postSession: async from => { assert.equal(from, 'old'); f.create('new'); return { sessionId: 'new' } },
  }
  // This was the exact mismatch: DSH is blank while the old MVU opening is persisted.
  assert.equal(await playthroughIsReusable(client, previous), true)
  await assert.rejects(f.read('old'), { code: 'MVU_MIGRATION_REQUIRED' })
  const created = await createCharacterPlaythrough(client, { character: { id: 'card' }, selectionFromSessionId: 'old', reuseEmpty: false, randomUUID: () => 'new-run' })
  assert.equal(created.reused, false); assert.equal(created.sessionId, 'new')
  assert.deepEqual(catalog.playthroughs[0], previous)
  const fresh = await f.read('new')
  assert.equal(fresh.content.stat_data.hp, 100); assert.equal(fresh.revision, 0); assert.equal(fresh.managementMode, 'managed')
  const legacy = await f.service.read({ id: 'mvu:template', scope: { sessionId: 'old' } })
  assert.equal(legacy.revision, 7); assert.equal(legacy.content.stat_data.hp, 50); assert.equal(legacy.capabilities.edit, false)
  // Explicit data recovery composes existing primitives; it is not history or permission migration.
  await assert.rejects(f.service.update({ id: fresh.id, scope: { sessionId: 'new' }, expectedRevision: 0, operationId: 'invalid-restore', content: { stat_data: { hp: 'invalid' } } }), { code: 'MVU_SCHEMA' })
  assert.equal((await f.read('new')).revision, 0)
  const request = { id: fresh.id, scope: { sessionId: 'new' }, expectedRevision: 0, operationId: 'explicit-restore', content: { stat_data: legacy.content.stat_data } }
  await f.service.update(request); await f.service.update(request)
  const restored = await f.read('new')
  assert.equal(restored.content.stat_data.hp, 50); assert.equal(restored.revision, 1)
  assert.deepEqual(restored.content.mvu_schema, fresh.content.mvu_schema)
  assert.equal(restored.managementMode, 'managed')
  const record = JSON.parse(readFileSync(join(storageDir, 'mvu-instances.json'))).resources[fresh.id]
  assert.deepEqual(record.versions.map(v => v.operationId), ['explicit-restore'])
  assert.equal(record.seed, undefined)
  assert.equal(readFileSync(path, 'utf8'), bytes)
  f.service.dispose()
  const noPolicy = new MvuService(f.options); t.after(() => noPolicy.dispose())
  assert.equal((await noPolicy.resolveRequest({ sessionId: 'new' })).blocks.length, 0)
})

test('one instance is allocated under concurrent refresh and caller-provided content never enters a seed', async t => {
  const f = fixture(t); f.create('root'); const rows = await Promise.all(Array.from({ length: 12 }, () => f.read('root')))
  assert.equal(new Set(rows.map(r => r.id)).size, 1); assert.equal(f.service.resources.length, 1)
  assert.equal(rows[0].id, stateInstanceId('mvu:template', { sessionId: 'root', createdAt: 1 }))
  const reply = await f.turn('root', -1)
  const ticket = await f.service.captureSessionSeed({ sessionId: 'root', kind: 'fork', atEventId: reply, variables: { stat_data: { hp: 999 } } })
  await f.fork('root', 'child', reply, ticket); assert.equal((await f.read('child')).content.stat_data.hp, 99)
})

test('new instances after restart retain exactly one initialization transform', async t => {
  const f = fixture(t, { resources: [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 0 } }, schemaSource: 'const Schema=z.object({hp:z.number().transform(v=>v+1)});' }] })
  f.create('A'); const a = await f.read('A'); f.restart(); f.create('B')
  assert.equal(a.content.stat_data.hp, 1); assert.equal((await f.read('B')).content.stat_data.hp, 1)
})

test('editing an inherited head can seed another fork and its first-reply swipe retains the original opening baseline', async t => {
  const f = fixture(t); f.create('A'); await f.edit('A', 70); const reply = await f.turn('A', -10)
  await f.fork('A', 'B', reply); await f.edit('B', 50); await f.fork('B', 'C', reply)
  assert.equal((await f.read('C')).content.stat_data.hp, 50)
  const ticket = await f.service.captureSessionSeed({ sessionId: 'C', kind: 'reply-swipe', atEventId: reply, targetSessionId: 'D' })
  f.create('D'); await f.service.installSessionSeed({ ticket, sessionId: 'D' })
  assert.equal((await f.read('D')).content.stat_data.hp, 70)
})

test('Host checkpoint cannot overtake a prior reply commit while refresh awaits, including a complete next turn', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-host-order-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const handlers = new Map(), sessions = new Map(), services = new Map([['sessions', sessions]])
  const ctx = { get: key => services.get(key), provide: (key, value) => services.set(key, value), on: (event, fn) => handlers.set(event, fn), effect: fn => fn() }
  let release, blocked = false; const pending = new Promise(resolve => { release = resolve }), errors = []
  const service = installMvu(ctx, { storageDir, resources: [{ id: 'mvu:t', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }], sources: { register: () => () => {} }, refresh: async () => { if (blocked) await pending }, onError: e => errors.push(e) })
  t.after(() => service.dispose())
  const session = { id: 'A', header: { id: 'A', createdAt: 1, version: 4 }, events: [], snapshotEvents() { return this.events } }; sessions.set('A', session)
  await service.list({ scope: { sessionId: 'A' } })
  const emit = (type, data) => { const event = { type, data, seq: session.events.length }; session.events.push(event); handlers.get('session/event')(session, event); return event }
  emit('turn/start', { turn: 1 }); await service.flush()
  emit('assistant/message', { turn: 1, message: { id: 'm1', content: [{ type: 'text', text: "_.add('hp', -10);" }] } })
  blocked = true; emit('turn/end', { turn: 1, reason: { kind: 'completed' } })
  const second = emit('turn/start', { turn: 2 }), checkpoint = service.checkpoint(session, second)
  emit('assistant/message', { turn: 2, message: { id: 'm2', content: [{ type: 'text', text: "_.add('hp', -1);" }] } })
  emit('turn/end', { turn: 2, reason: { kind: 'completed' } })
  release(); blocked = false; await checkpoint; await service.flush()
  assert.deepEqual(errors, [])
  assert.equal((await service.list({ scope: { sessionId: 'A' } }))[0].content.stat_data.hp, 89)
})

test('management edit waits for a published reply commit instead of being overwritten by delayed ingest', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-edit-order-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const handlers = new Map(), sessions = new Map(), services = new Map([['sessions', sessions]])
  const ctx = { get: key => services.get(key), provide: (key, value) => services.set(key, value), on: (event, fn) => handlers.set(event, fn), effect: fn => fn() }
  let release, blocked = false; const pending = new Promise(resolve => { release = resolve })
  const service = installMvu(ctx, { storageDir, resources: [{ id: 'mvu:t', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }], sources: { register: () => () => {} }, refresh: async () => { if (blocked) await pending } })
  t.after(() => service.dispose())
  const session = { id: 'A', header: { id: 'A', createdAt: 1, version: 4 }, events: [], snapshotEvents() { return this.events } }; sessions.set('A', session)
  const [row] = await service.list({ scope: { sessionId: 'A' } })
  const emit = (type, data) => { const event = { type, data, seq: session.events.length }; session.events.push(event); handlers.get('session/event')(session, event) }
  emit('turn/start', { turn: 1 }); await service.flush()
  emit('assistant/message', { turn: 1, message: { id: 'm1', content: [{ type: 'text', text: "_.add('hp', -10);" }] } })
  blocked = true; emit('turn/end', { turn: 1, reason: { kind: 'completed' } })
  let settled = false
  const edit = service.update({ id: row.id, scope: { sessionId: 'A' }, expectedRevision: row.revision, operationId: 'concurrent-edit', content: { stat_data: { hp: 50 } } }).finally(() => { settled = true })
  const rejected = assert.rejects(edit, { code: 'REVISION_CONFLICT' })
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false)
  release(); await rejected; await service.flush()
  assert.equal((await service.read({ id: row.id, scope: { sessionId: 'A' } })).content.stat_data.hp, 90)
})

test('seed capture and install abort after awaited inspection without persisting a receipt or child state', async t => {
  const f = fixture(t); f.create('A'); const reply = await f.turn('A', -1), controller = new AbortController(), original = f.service.inspect
  f.service.inspect = async id => { const live = await original(id), result = { header: structuredClone(live.header), events: structuredClone(live.events) }; if (id === 'A') controller.abort(); return result }
  await assert.rejects(f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: reply, targetSessionId: 'B', signal: controller.signal }), { name: 'AbortError' })
  assert.deepEqual(JSON.parse(readFileSync(join(f.options.storageDir, 'mvu-instances.json'))).seeds ?? {}, {})
  f.service.inspect = original
  const ticket = await f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: reply, targetSessionId: 'B' }); f.create('B')
  const second = new AbortController(), before = readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8')
  f.service.inspect = async id => { const live = await original(id), result = { header: structuredClone(live.header), events: structuredClone(live.events) }; if (id === 'A') second.abort(); return result }
  await assert.rejects(f.service.installSessionSeed({ ticket, sessionId: 'B', signal: second.signal }), { name: 'AbortError' })
  assert.equal(readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8'), before)
})

test('seed final commit refuses target activity or identity replacement during source inspection', async t => {
  for (const change of ['turn', 'identity']) {
    const f = fixture(t); f.create('A'); const reply = await f.turn('A', -1)
    const ticket = await f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: reply, targetSessionId: 'B' }), child = f.create('B'), original = f.service.inspect
    const before = readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8')
    f.service.inspect = async id => {
      const result = { header: structuredClone((await original(id)).header), events: structuredClone((await original(id)).events) }
      if (id === 'A') { if (change === 'turn') child.events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }); else child.header.createdAt++ }
      return result
    }
    await assert.rejects(f.service.installSessionSeed({ ticket, sessionId: 'B' }), { code: 'MVU_SEED_CONFLICT' })
    assert.equal(readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8'), before)
  }
})

test('instance edit refuses a turn starting after its inspected snapshot and seed without a Host lease', async t => {
  const f = fixture(t); const session = f.create('A'), row = await f.read('A'), original = f.service.inspect
  f.service.inspect = async id => { const live = await original(id), snapshot = { header: structuredClone(live.header), events: structuredClone(live.events) }; live.events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }); return snapshot }
  await assert.rejects(f.service.update({ id: row.id, scope: { sessionId: 'A' }, expectedRevision: 0, operationId: 'racy-edit', content: { stat_data: { hp: 50 } } }), { code: 'MVU_READ_ONLY' })
  f.service.inspect = original; session.events = []; const reply = await f.turn('A', -1)
  f.service.captureSessionLease = undefined
  await assert.rejects(f.service.captureSessionSeed({ sessionId: 'A', kind: 'fork', atEventId: reply }), { code: 'MVU_SESSION_LEASE' })
})

test('rejected remote read/list cannot allocate a local session state instance', async t => {
  const f = fixture(t); f.create('A')
  await assert.rejects(f.service.list({ scope: { authority: 'remote', sessionId: 'A' } }), { code: 'MVU_AUTHORITY' })
  await assert.rejects(f.service.read({ id: 'mvu:missing', scope: { authority: 'remote', sessionId: 'A' } }), { code: 'MVU_AUTHORITY' })
  assert.equal(f.service.resources.length, 0)
})

test('non-root swipe uses its target checkpoint; ordinary fork keeps a later manual edit on the prefix', async t => {
  const f = fixture(t); f.create('A'); const first = await f.turn('A', -10)
  const failed = await f.turn('A', '"invalid"'); assert.equal((await f.read('A')).content.stat_data.hp, 90)
  await f.edit('A', 50)
  await f.fork('A', 'ordinary', first); assert.equal((await f.read('ordinary')).content.stat_data.hp, 50)
  const ticket = await f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: failed, prefixEndEventId: first })
  f.create('swipe', 'A', f.sessions.get('A').events.filter(e => e.seq <= first))
  await f.service.installSessionSeed({ ticket, sessionId: 'swipe' })
  assert.equal((await f.read('swipe')).content.stat_data.hp, 90)
  await f.turn('swipe', -1); assert.equal((await f.read('swipe')).content.stat_data.hp, 89); assert.equal((await f.read('A')).content.stat_data.hp, 50)
  await assert.rejects(f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: first, prefixEndEventId: failed }), { code: 'MVU_SEED' })
})

test('fork preserves its captured versionKey when a later edit is appended on an older reply coordinate', async t => {
  const f = fixture(t); f.create('A'); const first = await f.turn('A', -10), failed = await f.turn('A', '"invalid"')
  await f.edit('A', 50)
  const before = await f.read('A')
  assert.equal((await f.service.read({ id: before.id, scope: { sessionId: 'A', endEventId: failed } })).content.stat_data.hp, 90)
  await f.fork('A', 'B', failed); const child = await f.read('B'); assert.equal(child.content.stat_data.hp, 90)
  assert.equal((await f.service.read({ id: child.id, scope: { sessionId: 'B', endEventId: failed } })).content.stat_data.hp, 90)
  await f.fork('A', 'C', first); assert.equal((await f.read('C')).content.stat_data.hp, 50)
})

test('non-root swipe baseline retains valid prefix provenance for editing and another fork', async t => {
  const f = fixture(t); f.create('A'); const first = await f.turn('A', -10), second = await f.turn('A', -1)
  const ticket = await f.service.captureSessionSeed({ sessionId: 'A', kind: 'reply-swipe', atEventId: second, prefixEndEventId: first })
  const child = f.create('B', 'A', f.sessions.get('A').events.filter(e => e.seq <= first))
  child.events.push({ seq: child.events.length, type: 'session/end-seed', data: {} }, { seq: child.events.length + 1, type: 'turn/end', data: { turn: 1, reason: { kind: 'forked' } } })
  await f.service.installSessionSeed({ ticket, sessionId: 'B' })
  await f.edit('B', 50); await f.fork('B', 'C', first)
  assert.equal((await f.read('C')).content.stat_data.hp, 50)
})

test('switching a configured parent to managed cannot create a native child by forking', async t => {
  const f = fixture(t); f.create('A'); const reply = await f.turn('A', -1), parent = await f.read('A')
  await f.service.setManagementMode({ id: parent.id, scope: { sessionId: 'A' }, mode: 'managed', operationId: 'manage', expectedRevision: parent.revision })
  await f.fork('A', 'B', reply); assert.equal((await f.read('B')).managementMode, 'managed')
  f.service.dispose(); const restored = new MvuService(f.options)
  assert.equal((await restored.resolveRequest({ sessionId: 'B' })).blocks.length, 0); restored.dispose()
})

test('cold resume published Host work settles before a management transaction captures its session lease', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-cold-edit-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const handlers = new Map(), sessions = new Map(), services = new Map([['sessions', sessions]])
  const ctx = { get: key => services.get(key), provide: (key, value) => services.set(key, value), on: (event, fn) => handlers.set(event, fn), effect: fn => fn() }
  let release, blocked = false; const pending = new Promise(resolve => { release = resolve })
  const service = installMvu(ctx, { storageDir, resources: [{ id: 'mvu:t', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }], sources: { register: () => () => {} }, refresh: async () => { if (blocked) await pending } }); t.after(() => service.dispose())
  const session = { id: 'A', header: { id: 'A', createdAt: 1, version: 4 }, events: [], snapshotEvents() { return this.events } }; sessions.set('A', session)
  const [row] = await service.list({ scope: { sessionId: 'A' } }), start = { seq: 0, type: 'turn/start', data: { turn: 1 } }; session.events.push(start); handlers.get('session/event')(session, start); await service.flush()
  session.events.push({ seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'm1', content: [{ type: 'text', text: "_.add('hp', -10);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  sessions.delete('A'); handlers.get('session/disposed')(session)
  services.set('sessionController', { async resolveAgent(id) { sessions.set(id, session); handlers.get('session/created')(session); handlers.get('agent/created')({ agent: { session } }); return { agent: { session } } } })
  blocked = true; let settled = false
  const edit = service.update({ id: row.id, scope: { sessionId: 'A' }, expectedRevision: row.revision, operationId: 'cold-edit', content: { stat_data: { hp: 50 } } }).finally(() => { settled = true })
  const rejected = assert.rejects(edit, { code: 'REVISION_CONFLICT' })
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false)
  release(); await rejected; await service.flush()
  assert.equal((await service.read({ id: row.id, scope: { sessionId: 'A' } })).content.stat_data.hp, 90)
})

test('card capability commits only its instance and rejects identity changes during its awaited execution check', async t => {
  const f = fixture(t); f.create('A'); f.create('B'); const reply = await f.turn('A', -1); await f.turn('B', -1)
  const scope = { playthroughId: 'p', sessionId: 'A', nodeId: 'n', variantId: 'v', endEventId: reply, sessionFormatVersion: 4 }, sourceIdentity = { version: 1, sha256: 'a'.repeat(64), scope }
  const { createHash } = await import('node:crypto'), text = f.sessions.get('A').events.find(e => e.seq === reply).data.message.content[0].text
  const fingerprint = createHash('sha256').update(JSON.stringify(text)).digest('hex')
  f.service.resolveScope = async input => { assert.deepEqual(input, scope); return { writableHead: true, messageId: 'A-1', fingerprint } }
  f.service.authorizeCardWrite = async ({ grantId, sourceIdentity: identity }) => grantId === 'g' && JSON.stringify(identity) === JSON.stringify(sourceIdentity) ? { valid: true, write: true, scope, checkCurrent: () => true } : null
  const bound = await f.service.createCardBinding({ scope, grantId: 'g', sourceIdentity }), a = await f.read('A'), b = await f.read('B')
  const write = { capability: bound.capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -2 }], expectedRevision: a.revision, operationId: 'card-click', cause: 'user-interaction' }
  const result = await f.service.cardWrite(write); assert.equal(result.resourceId, a.id); assert.equal(result.variables.stat_data.hp, 97); assert.equal((await f.read('B')).content.stat_data.hp, b.content.stat_data.hp)
  const before = readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8')
  const authorize=f.service.authorizeCardWrite
  f.service.authorizeCardWrite=async input=>{const result=await authorize(input);f.sessions.get('A').header.createdAt++;return result}
  await assert.rejects(f.service.cardWrite({ ...write, expectedRevision: result.revision, operationId: 'reused-session' }), { code: 'MVU_READ_ONLY' })
  assert.equal(readFileSync(join(f.options.storageDir, 'mvu-instances.json'), 'utf8'), before)
})

test('legacy wildcard access blocks recorded or uncertain old conversations while a fresh empty session starts independently', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-legacy-wildcard-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const bytes = JSON.stringify({ version: 1, resources: { 'mvu:template': { revision: 1, currentKey: 'old', definition: { id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }, versions: [{ key: 'old', revision: 1, source: { sessionId: 'old', manual: true }, variables: { stat_data: { hp: 50 } } }] } } })
  writeFileSync(join(storageDir, 'mvu-state.json'), bytes)
  const f = fixture(t, { storageDir }); f.create('old'); f.create('fresh'); const unknown = f.create('unknown'); unknown.events.push({ seq: 0, type: 'user/message', data: {} })
  await assert.rejects(f.read('old'), { code: 'MVU_MIGRATION_REQUIRED' }); await assert.rejects(f.read('unknown'), { code: 'MVU_MIGRATION_REQUIRED' })
  assert.equal((await f.read('fresh')).content.stat_data.hp, 100); assert.equal(readFileSync(join(storageDir, 'mvu-state.json'), 'utf8'), bytes)
})
