import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MvuService, compileMvuSchema, applyMvuSchema, applyMvuUpdate, parseMvuUpdate, validateMvuConfig } from '../packages/mvu-adapter/src/index.js'
import { createMvuApi } from '../packages/mvu-adapter/src/http.js'

function fixture(t) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-review-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const options = { storageDir, resources: [{ id: 'mvu:test', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }] }
  const session = { id: 's', header: { id: 's', version: 4, createdAt: 100 }, events: [
    { seq: 0, type: 'turn/start', data: { turn: 1 } },
    { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'reply', content: [{ type: 'text', text: "_.add('hp', -5);" }] } } },
    { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ], snapshotEvents() { return this.events } }
  return { options, service: new MvuService(options), session }
}
test('browser cannot override canonical variant with arbitrary messageId', async () => {
  let called = false, result
  const handler = createMvuApi({ snapshot() { called = true } })
  await handler({ method: 'GET', url: '/?scope=' + encodeURIComponent(JSON.stringify({ sessionId: 'A', messageId: 'B-message' })) }, { setHeader() {}, end(body) { result = JSON.parse(body) } })
  assert.equal(called, false); assert.equal(result.code, 'MVU_SCOPE')
})
test('service and usage-provider removal cancel in-flight commits', async t => {
  for (const removeService of [false, true]) {
    const { service, session, options } = fixture(t)
    let release, entered
    const ready = new Promise(resolve => { entered = resolve })
    const stop = service.registerUsage(async () => { entered(); await new Promise(resolve => { release = resolve }); return { enabled: true } })
    const pending = service.ingest(session); await ready
    if (removeService) service.dispose(); else stop()
    release()
    await assert.rejects(pending)
    const restored = new MvuService(options)
    assert.equal((await restored.read({ id: 'mvu:test', scope: { sessionId: 's' } })).revision, 0)
  }
})
test('orphaned durable references block reads until source history is reconciled', async t => {
  const { service, session, options } = fixture(t)
  await service.ingest(session)
  const restored = new MvuService(options), original = session.events
  session.events = []
  await assert.rejects(restored.ingest(session), { code: 'MVU_HISTORY_UNAVAILABLE' })
  await assert.rejects(restored.read({ id: 'mvu:test', scope: { sessionId: 's' } }), { code: 'MVU_HISTORY_UNAVAILABLE' })
  session.events = original; await restored.ingest(session)
  assert.equal((await restored.read({ id: 'mvu:test', scope: { sessionId: 's' } })).content.stat_data.hp, 95)
})
test('fork history resolves inherited origin without committing an update', async t => {
  const { service, session } = fixture(t); await service.ingest(session)
  const child = { ...session, id: 'child', header: { ...session.header, id: 'child', parentSession: 's' }, events: [...session.events, { seq: 3, type: 'session/end-seed', data: { inherited: true } }] }
  await service.ingest(child)
  const row = await service.read({ id: 'mvu:test', scope: { sessionId: 'child', endEventId: 1 } })
  assert.equal(row.content.stat_data.hp, 95); assert.equal(row.revision, 1)
})
test('candidate transform runs once and array constraints are enforced', () => {
  const definition = compileMvuSchema('const Schema=z.object({hp:z.number().transform(v=>v+1)});')
  const variables = { stat_data: { hp: 1 }, schema: { type: 'object', properties: {}, extensible: true }, mvu_schema: definition }
  assert.equal(applyMvuUpdate(variables, parseMvuUpdate("_.add('hp',1);")).stat_data.hp, 3)
  const array = compileMvuSchema('const Schema=z.object({xs:z.array(z.string()).min(1).max(2)});')
  assert.throws(() => applyMvuSchema({ xs: [] }, array)); assert.throws(() => applyMvuSchema({ xs: ['a', 'b', 'c'] }, array))
  assert.deepEqual(applyMvuSchema({ xs: ['a'], ignored: true }, array), { xs: ['a'] })
  assert.throws(() => validateMvuConfig({ type: 'mvu-state', store: { on: 'assistant_message_committed', strategy: ['parse_mvu_update', 'validate_update', { operation: 'apply_update', params: { target: 'other' } }] } }))
})

test('source schema validates manual edits exactly once and cannot be removed', async t => {
  const { options } = fixture(t)
  options.resources[0].schemaSource = 'const Schema=z.object({hp:z.number().min(0).transform(v=>v+1)});'
  const service = new MvuService(options), scope = { sessionId: 's' }
  const content = (await service.read({ id: 'mvu:test', scope })).content
  content.stat_data.hp = -7
  await assert.rejects(service.update({ id: 'mvu:test', scope, content, expectedRevision: 0, operationId: 'bad' }), { code: 'MVU_SCHEMA' })
  delete content.mvu_schema
  await assert.rejects(service.update({ id: 'mvu:test', scope, content, expectedRevision: 0, operationId: 'removed' }), { code: 'MVU_SCHEMA' })
  content.stat_data.hp = 10
  const request = { id: 'mvu:test', scope, content, expectedRevision: 0, operationId: 'ok' }
  const accepted = await service.update(request)
  assert.equal(accepted.content.stat_data.hp, 11)
  assert.deepEqual(await service.update(request), accepted)
})
test('canonical card snapshots cannot mix independent sessions with identical message coordinates', async t => {
  const { options, session } = fixture(t)
  const { createHash } = await import('node:crypto')
  const fingerprint = createHash('sha256').update(JSON.stringify("_.add('hp', -5);")).digest('hex')
  const service = new MvuService({ ...options, resolveScope: async () => ({ messageId: 'reply', fingerprint }) })
  await service.ingest(session)
  await service.ingest({ ...session, id: 'other', header: { ...session.header, id: 'other' } })
  assert.equal((await service.snapshot({ sessionId: 's', endEventId: 1 })).variables.stat_data.hp, 95)
  assert.equal((await service.snapshot({ sessionId: 'other', endEventId: 1 })).variables.stat_data.hp, 90)
})
test('all arithmetic, property keys and constraints reject object coercion before expansion', () => {
  let constants = "const a0=['1'];"
  for (let i = 1; i <= 18; i++) constants += `const a${i}=[a${i - 1},a${i - 1}];`
  for (const tail of ['z.any().transform(v=>+a18)', 'z.any().transform(v=>v[a18])', 'z.number().min(a18)', 'z.number().max(a18)']) {
    assert.throws(() => applyMvuSchema(1, compileMvuSchema(`${constants}const Schema=${tail};`)))
  }
  assert.throws(() => compileMvuSchema('const Schema=z.any().transform(v=>{if(false) return fetch(v); return v;});'))
  assert.throws(() => compileMvuSchema('const Schema=z.any(); $(()=>{registerMvuSchema(Schema);}); process.exit();'))
})
test('fatal second command leaves disk unchanged and never emits applied', async t => {
  const { options, session } = fixture(t)
  options.resources[0].initial = { stat_data: { hp: 10, bag: [] } }
  options.resources[0].schemaSource = 'const Schema=z.object({hp:z.number(),bag:z.array(z.number())});'
  const service = new MvuService(options), facts = []; service.observe(f => facts.push(f))
  session.events[1].data.message.content[0].text = `_.set('hp',9);_.set('bag',${JSON.stringify(Array(10020).fill(1))});`
  await service.ingest(session)
  const restored = new MvuService(options)
  assert.deepEqual((await restored.read({ id: 'mvu:test', scope: { sessionId: 's' } })).content.stat_data, { hp: 10, bag: [] })
  assert.ok(facts.some(f => f.phase === 'failed' && f.detail === 'MVU_LIMIT'))
  assert.ok(!facts.some(f => f.phase === 'applied'))
})
test('native metadata templates, required fields and remove by value/index', () => {
  const initial = { stat_data: { $meta: { extensible: true, required: ['hp'] }, hp: 10, bag: [{ $arrayMeta: true, $meta: { extensible: true, template: { count: 1, label: 'new' } } }], labels: ['a', 'b', '$__META_EXTENSIBLE__$'] } }
  const result = applyMvuUpdate(initial, parseMvuUpdate("_.insert('bag',{label:'rope'});_.remove('labels','a');_.remove('hp');"))
  assert.deepEqual(result.stat_data.bag, [{ count: 1, label: 'rope' }])
  assert.deepEqual(result.stat_data.labels, ['b'])
  assert.equal(result.stat_data.hp, 10)
  assert.equal(result.update_diagnostics.length, 1)
  assert.ok(!Object.hasOwn(result.stat_data, '$meta'))
  assert.throws(() => applyMvuUpdate(initial, parseMvuUpdate('<JSONPatch>[{"op":"remove","path":"/labels/length"}]</JSONPatch>')), { code: 'MVU_PATH' })
})
