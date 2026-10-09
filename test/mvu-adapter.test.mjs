import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MvuService, applyMvuUpdate, normalizeVariables, parseMvuUpdate } from '../packages/mvu-adapter/src/index.js'

const initial = { stat_data: { hp: 100, name: 'Ada', described: [20, 'energy'], bag: [] }, schema: { type: 'object', extensible: false, properties: { hp: { type: 'number', required: true }, name: { type: 'string' }, described: { type: 'array', elementType: { type: 'any' }, extensible: false }, bag: { type: 'array', elementType: { type: 'string' }, extensible: true } } } }
const scope = { sessionId: 's', authority: 'local' }
const event = (seq, type, data) => ({ seq, type, data })
function session(id = 's', turns = ["_.add('hp', -5);"], reasons = [], parentSession) {
  const events = turns.flatMap((text, i) => [
    event(i * 4, 'turn/start', { turn: i + 1 }),
    event(i * 4 + 1, 'user/message', { turn: i + 1, message: { id: `u${i}`, role: 'user', source: { kind: 'user' }, content: [] } }),
    event(i * 4 + 2, 'assistant/message', { turn: i + 1, step: 1, message: { id: `${id}-m${i}`, role: 'assistant', content: [{ type: 'text', text }] } }),
    event(i * 4 + 3, 'turn/end', { turn: i + 1, reason: { kind: reasons[i] ?? 'completed' } }),
  ])
  return { id, header: { id, version: 4, ...(parentSession ? { parentSession } : {}) }, snapshotEvents: () => events, events }
}
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mvu-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const options = { storageDir: directory, resources: [{ sharing: 'shared', id: 'mvu:test', sessionIds: ['*'], initial }] }
  return { options, service: new MvuService(options) }
}

test('MVU literals preserve nested strings and ordered JSONPatch/legacy operations without evaluating code', () => {
  const commands = parseMvuUpdate(`<JSONPatch>[{"op":"delta","path":"/hp","value":-3}]</JSONPatch>\n_.set('name', 'a ); b'); _.set('hp', 97, '80'); _.add('described', -2); _.insert('bag', 'rope');`)
  const result = applyMvuUpdate(initial, commands)
  assert.equal(result.stat_data.hp, 80)
  assert.equal(result.stat_data.name, 'a ); b')
  assert.deepEqual(result.stat_data.described, [18, 'energy'])
  assert.deepEqual(result.stat_data.bag, ['rope'])
  assert.equal(initial.stat_data.hp, 100)
  assert.throws(() => parseMvuUpdate("_.set('hp', process.exit());"), { code: 'MVU_SCHEMA_CODE' })
  assert.equal(applyMvuUpdate(initial, parseMvuUpdate("_.set('hp', 1 + 2);")).stat_data.hp, 3)
  assert.throws(() => parseMvuUpdate("_.set('hp', 1"), /Unterminated/)
})
test('per-command schema rejection preserves accepted candidates; fatal input never mutates caller state', () => {
  for (const text of ["_.set('__proto__.x', 1);", "_.insert('bag', 'constructor', 1);", '<JSONPatch>[{"op":"copy","path":"/hp","from":"/name"}]</JSONPatch>']) assert.throws(() => parseMvuUpdate(text))
  for (const text of ["_.set('hp', 70); _.set('missing', 3);", "_.delete('hp');", "_.insert('', 'new', 1);"]) assert.equal(applyMvuUpdate(initial, parseMvuUpdate(text)).update_diagnostics.length, 1)
  for (const text of ["_.set('hp', 'NaN');", "_.insert('bag', 99, 'rope');"]) assert.throws(() => applyMvuUpdate(initial, parseMvuUpdate(text)))
  assert.equal(initial.stat_data.hp, 100)
  assert.deepEqual(normalizeVariables({ stat_data: {}, schema: { type: 'object', template: {} } }).schema.template, {})
})
test('JSON pointer escaping, extensible collections, atomic move and deletion', () => {
  const vars = { stat_data: { 'a/b': 1, obj: { x: 1 }, arr: ['a', 'b'] }, schema: { type: 'object', extensible: true, properties: { obj: { type: 'object', extensible: true, properties: { x: { type: 'number' } } }, arr: { type: 'array', extensible: true, elementType: { type: 'string' } } } } }
  const result = applyMvuUpdate(vars, parseMvuUpdate('<JSONPatch>[{"op":"replace","path":"/a~1b","value":2},{"op":"move","from":"/obj/x","path":"/obj/y"},{"op":"add","path":"/arr/-","value":"c"},{"op":"remove","path":"/arr/0"}]</JSONPatch>'))
  assert.deepEqual(result.stat_data, { 'a/b': 2, obj: { y: 1 }, arr: ['b', 'c'] })
})
test('only completed final message commits; replay/restart idempotency and historical snapshots', async t => {
  const { service, options } = fixture(t), s = session('s', ["_.add('hp', -5);", "_.add('hp', -10);", "_.add('hp', -20);"], ['completed', 'aborted', 'completed'])
  s.events.splice(2, 0, event(1.5, 'assistant/message', { turn: 1, message: { id: 'tool-step', content: [{ type: 'text', text: "_.add('hp', -80);" }, { type: 'tool-call' }] } }))
  const facts = []; service.observe(f => facts.push(f))
  await service.ingest(s)
  assert.equal((await service.read({ id: 'mvu:test', scope })).content.stat_data.hp, 75)
  assert.equal((await service.read({ id: 'mvu:test', scope: { ...scope, endEventId: 2 } })).content.stat_data.hp, 95)
  assert.equal(facts.filter(f => f.phase === 'completed').length, 2)
  const before = await service.history({ id: 'mvu:test', scope })
  await service.ingest(s)
  assert.deepEqual(await service.history({ id: 'mvu:test', scope }), before)
  const restarted = new MvuService(options)
  await restarted.ingest(s)
  assert.deepEqual(await restarted.history({ id: 'mvu:test', scope }), before)
})
test('fork inheritance never reapplies shared entity updates; new reply updates the one shared id', async t => {
  const { service } = fixture(t), parent = session('s', ["_.add('hp', -5);", "_.add('hp', -10);"])
  await service.ingest(parent)
  const child = session('child', [], [], 's')
  child.events.push(...parent.events.slice(0, 3), event(3, 'session/end-seed', { inherited: true }), event(4, 'turn/end', { turn: 1, reason: { kind: 'forked' } }),
    event(5, 'turn/start', { turn: 2 }), event(6, 'assistant/message', { turn: 2, message: { id: 'regenerated', content: [{ type: 'text', text: "_.add('hp', -1);" }] } }), event(7, 'turn/end', { turn: 2, reason: { kind: 'completed' } }))
  await service.ingest(child)
  assert.equal((await service.read({ id: 'mvu:test', scope: { sessionId: 'child' } })).content.stat_data.hp, 84)
  assert.equal((await service.read({ id: 'mvu:test', scope })).content.stat_data.hp, 84)
  assert.equal((await service.read({ id: 'mvu:test', scope: { ...scope, endEventId: 2 } })).content.stat_data.hp, 95)
})
test('failed updates retain unchanged snapshot and later turns recover; policy can suppress writes', async t => {
  const { service } = fixture(t), s = session('s', ["_.set('hp', 50); _.set('missing', 1);", "_.add('hp', -2);"])
  await service.ingest(s)
  assert.equal((await service.read({ id: 'mvu:test', scope })).content.stat_data.hp, 48)
  assert.equal((await service.history({ id: 'mvu:test', scope }))[0].variables.update_diagnostics[0].code, 'MVU_PATH_MISSING')
  const unhook = service.registerUsage(() => ({ enabled: false }))
  await service.ingest(session('other'))
  assert.equal((await service.read({ id: 'mvu:test', scope: { sessionId: 'other' } })).content.stat_data.hp, 48)
  unhook()
})
test('manual edits enforce CAS, idempotency and isolation, and feed the next turn', async t => {
  const { service } = fixture(t), s = session()
  await service.ingest(s)
  const content = (await service.read({ id: 'mvu:test', scope })).content
  content.stat_data.hp = 60
  const request = { id: 'mvu:test', content, scope, expectedRevision: 1, operationId: 'edit' }
  const result = await service.update(request)
  assert.deepEqual(await service.update(request), result)
  await assert.rejects(service.update({ ...request, content: initial }), { code: 'MVU_IDEMPOTENCY_CONFLICT' })
  await assert.rejects(service.update({ ...request, operationId: 'different' }), { code: 'REVISION_CONFLICT' })
  await service.ingest(session('s', ["_.add('hp', -5);", "_.add('hp', -2);"]))
  assert.equal((await service.read({ id: 'mvu:test', scope })).content.stat_data.hp, 58)
  await assert.rejects(service.read({ id: 'mvu:test', scope: { ...scope, authority: 'remote' } }), { code: 'MVU_AUTHORITY' })
})
test('request resolution is read-only and a registry selection is needed for injection', async t => {
  const { service } = fixture(t)
  const result = await service.resolveRequest({ sessionId: 's', preview: true, turn: null, step: null })
  assert.match(result.blocks[0].text, /100/)
  assert.deepEqual(await service.history({ id: 'mvu:test', scope }), [])
  assert.equal((await service.read({ id: 'mvu:test', scope })).revision, 0)
})

test('same id shares current content and revision across sessions; explicit copies evolve independently', async t => {
  const { service, options } = fixture(t)
  await service.update({ id: 'mvu:test', content: { stat_data: { hp: 80 } }, expectedRevision: 0, operationId: 'A-edit', scope: { sessionId: 'A' } })
  const a = await service.read({ id: 'mvu:test', scope: { sessionId: 'A' } }), b = await service.read({ id: 'mvu:test', scope: { sessionId: 'B' } })
  assert.deepEqual(a.content, b.content); assert.equal(a.revision, b.revision)
  await assert.rejects(service.update({ id: 'mvu:test', content: initial, expectedRevision: 0, operationId: 'B-edit', scope: { sessionId: 'B' } }), { code: 'REVISION_CONFLICT' })
  const copy = await service.copy({ id: 'mvu:test', newId: 'mvu:copy', scope: { sessionId: 'B' } })
  await service.update({ id: copy.id, content: { stat_data: { hp: 10 } }, expectedRevision: 0, operationId: 'copy-edit', scope: { sessionId: 'B' } })
  assert.equal((await service.read({ id: 'mvu:test', scope: { sessionId: 'B' } })).content.stat_data.hp, 80)
  const restored = new MvuService(options)
  assert.equal((await restored.read({ id: 'mvu:copy', scope: { sessionId: 'B' } })).content.stat_data.hp, 10)
})
test('saved management preference survives restart while registration/removal governs actual execution', async t => {
  const { service, options } = fixture(t)
  await service.setManagementMode({ id: 'mvu:test', mode: 'managed', scope, expectedRevision: 0, operationId: 'delegate' })
  const restarted = new MvuService(options)
  const missing = restarted.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  await restarted.ingest(session())
  assert.equal((await restarted.read({ id: 'mvu:test', scope })).content.stat_data.hp, 100)
  assert.equal((await restarted.resolveRequest({ sessionId: 's' })).blocks.length, 0)
  missing()
  const stop = restarted.registerUsage(() => ({ enabled: true, checkCurrent: () => true }), { providerId: 'dsh-memory-manager' })
  await restarted.ingest(session('s', ["_.add('hp', -5);", "_.add('hp', -3);"]))
  assert.equal((await restarted.read({ id: 'mvu:test', scope })).content.stat_data.hp, 97)
  stop()
  assert.equal((await restarted.resolveRequest({ sessionId: 's' })).blocks.length, 1)
  const row = await restarted.read({ id: 'mvu:test', scope })
  assert.equal(row.managementMode, 'native'); assert.equal(row.storedManagementMode, 'managed')
})
