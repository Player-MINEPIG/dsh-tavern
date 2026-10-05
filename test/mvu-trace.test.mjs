import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { MvuService } from '../packages/mvu-adapter/src/service.js'
import { MvuFacts } from '../packages/mvu-adapter/src/facts.js'
import { secureTavernApi } from '../packages/tavern-loader/src/api-security.js'
import { createMvuApi, isMvuApiPath } from '../packages/mvu-adapter/src/http.js'
import { editVariable, flattenVariables, roundEvents, roundSnapshot, rowsAt, variableChanges, mvuRequest } from '../packages/tavern-trace/src/mvu-data.js'
import { MvuVariablesTable, MvuEventsTable } from '../packages/tavern-trace/src/mvu-view.js'
import { TraceRecordContent } from '../packages/tavern-trace/src/client.js'
import { getClientUiSettings, setClientUiSettings, uiMessage } from '../packages/client/src/i18n.js'

const root = '/pmp-dsh-tavern/api/v1/mvu/'
const scope = { authority: 'local', sessionId: 's' }
const session = texts => ({ id: 's', header: { id: 's', version: 4, createdAt: 1 }, events: texts.flatMap((text, index) => [
  { seq: index * 3, type: 'turn/start', data: { turn: index + 1 } },
  { seq: index * 3 + 1, type: 'assistant/message', data: { turn: index + 1, message: { id: `reply-${index}`, content: [{ type: 'text', text }] } } },
  { seq: index * 3 + 2, type: 'turn/end', data: { turn: index + 1, reason: { kind: 'completed' } } },
]), snapshotEvents() { return this.events } })
function fixture(t, extra = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-trace-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const options = { storageDir, resources: [{ sharing: 'shared', id: 'mvu:trace', sessionIds: ['s'], initial: { stat_data: { hp: 10, note: '<script>private</script>' } }, schemaSource: 'const Schema=z.object({hp:z.number().min(0),note:z.string()});' }], ...extra }
  return { storageDir, options, service: new MvuService(options) }
}
async function request(service, action, body, query = {}) {
  const req = new EventEmitter(), res = new EventEmitter()
  req.method = body ? 'POST' : 'GET'
  req.url = root + action + '?' + new URLSearchParams({ scope: JSON.stringify(scope), ...query })
  res.setHeader = () => {}
  let result
  res.end = value => { res.writableEnded = true; result = { status: res.statusCode, data: JSON.parse(value) } }
  const task = createMvuApi(service)(req, res)
  if (body) { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end') }
  await task
  return result
}
test('table paths preserve nested arrays, empty collections, escaped keys and JSON types', () => {
  const rows = flattenVariables({ 'a/b': { '~x': [null, false, 'x'] }, empty: {} })
  assert.deepEqual(rows.map(row => [row.path, row.type]), [
    ['/stat_data/a~1b/~0x/0', 'null'], ['/stat_data/a~1b/~0x/1', 'boolean'], ['/stat_data/a~1b/~0x/2', 'string'], ['/stat_data/empty', 'object'],
  ])
  const content = { stat_data: { 'a/b': [1] }, mvu_schema: { trusted: true }, schema: { type: 'object' } }
  const changed = editVariable(content, ['a/b', '0'], '2')
  assert.equal(content.stat_data['a/b'][0], 1); assert.equal(changed.stat_data['a/b'][0], 2)
  assert.deepEqual(changed.mvu_schema, content.mvu_schema)
  assert.throws(() => editVariable(content, ['__proto__'], '{}'))
})
test('historical selection uses the exact source version and never substitutes a current snapshot', () => {
  const versions = [{ key: 'a', source: { turn: 1 }, variables: { stat_data: { hp: 10 } } }, { key: 'b', source: { turn: 2 }, variables: { stat_data: { hp: 8 } } }]
  assert.equal(roundSnapshot(versions, 1).key, 'a'); assert.equal(roundSnapshot(versions, 3), null)
  assert.equal(roundSnapshot(versions, 1).variables.stat_data.hp, 10)
})
test('before/after and latest-update projections include removals and retain unknown provenance', () => {
  assert.deepEqual(variableChanges({ hp: 10, bag: ['a'] }, { hp: 9, bag: [] }).map(c => c.path), ['/stat_data/hp', '/stat_data/bag/0', '/stat_data/bag'])
  const version = { key: 'a', revision: 1, beforeAvailable: true, before: { hp: 10 }, source: { turn: 1 }, variables: { stat_data: { hp: 9 } } }
  assert.equal(rowsAt(version.variables, [version], version)[0].updated.turn, 1)
  const unknown = roundEvents([{ ...version, beforeAvailable: false }], [], 1)[0]
  assert.equal(unknown.comparisonAvailable, false); assert.deepEqual(unknown.changes, [])
})
test('HTTP exposes source primitives with current local session scope and rejects scope widening', async t => {
  const { service } = fixture(t)
  const list = await request(service, 'resources'); assert.equal(list.status, 200); assert.equal(list.data.records[0].id, 'mvu:trace')
  for (const invalid of [{}, { authority: 'remote', sessionId: 's' }, { sessionId: 's', playthroughId: 'p' }, { sessionId: 's', endEventId: 1 }]) {
    const result = await request(service, 'resources', null, { scope: JSON.stringify(invalid) }); assert.equal(result.status, 400)
  }
  assert.equal((await request(service, 'resources', null, { scope: JSON.stringify({ sessionId: 'other' }) })).data.records.length, 0)
  assert.equal((await request(service, 'resource', null, { id: 'mvu:trace', scope: JSON.stringify({ sessionId: 'other' }) })).data.code, 'SCOPE_MISMATCH')
  assert.ok(isMvuApiPath(root + 'update'))
})
test('Trace edits return the validated source result, preserve schema, enforce CAS and reject historical writes', async t => {
  const { service } = fixture(t)
  await service.ingest(session(["_.add('hp', -1);", "_.add('hp', -2);"]))
  const historical = await request(service, 'resource', null, { id: 'mvu:trace', scope: JSON.stringify({ ...scope, endEventId: 1 }) })
  assert.equal(historical.data.record.content.stat_data.hp, 9); assert.equal(historical.data.record.historical, true)
  const row = (await request(service, 'resource', null, { id: 'mvu:trace' })).data.record
  const body = { id: row.id, scope, content: editVariable(row.content, ['hp'], '6'), expectedRevision: row.revision, operationId: 'editor' }
  const saved = await request(service, 'update', body)
  assert.equal(saved.status, 200); assert.equal(saved.data.content.stat_data.hp, 6); assert.deepEqual(saved.data.content.mvu_schema, row.content.mvu_schema)
  assert.deepEqual((await request(service, 'update', body)).data, saved.data)
  assert.equal((await request(service, 'update', { ...body, operationId: 'stale' })).data.code, 'REVISION_CONFLICT')
  assert.equal((await request(service, 'update', { ...body, scope: { ...scope, endEventId: 1 } })).data.code, 'MVU_SCOPE')
  const invalid = { ...body, operationId: 'invalid', expectedRevision: saved.data.revision, content: editVariable(saved.data.content, ['hp'], '-1') }
  assert.equal((await request(service, 'update', invalid)).data.code, 'MVU_SCHEMA')
  assert.equal((await service.read({ id: row.id, scope })).content.stat_data.hp, 6)
  assert.equal(historical.data.record.content.stat_data.hp, 9)
})
test('round histories and source observation metadata survive restart without private text in facts', async t => {
  const { service, options, storageDir } = fixture(t)
  await service.ingest(session(["_.add('hp', -1);", '<JSONPatch>[{"op":"bad","path":"/hp","value":2}]</JSONPatch>']))
  const history = (await request(service, 'history', null, { id: 'mvu:trace' })).data.versions
  assert.equal(history[0].before.hp, 10); assert.equal(history[1].error, 'MVU_UNSUPPORTED'); assert.equal(history[1].before.hp, 9)
  const current = await service.read({ id: 'mvu:trace', scope })
  await service.update({ id: current.id, scope, content: editVariable(current.content, ['hp'], '8'), expectedRevision: current.revision, operationId: 'manual' })
  const restarted = new MvuService(options)
  const facts = (await request(restarted, 'facts', null, { id: 'mvu:trace' })).data
  assert.ok(facts.records.some(row => row.phase === 'failed' && row.detail === 'MVU_UNSUPPORTED' && row.turn === 2))
  assert.ok(facts.records.some(row => row.on === 'manual_update'))
  assert.equal(facts.records.find(row => row.on === 'manual_update').turn, 2)
  const recovered = await restarted.history({ id: 'mvu:trace', scope, includeBefore: true })
  assert.equal(recovered.at(-1).action.turn, 2); assert.equal(roundSnapshot(recovered, 2).variables.stat_data.hp, 8)
  assert.ok(roundEvents(recovered, facts.records, 2).some(row => row.on === 'manual_update' && row.changes.some(change => change.after === 8)))
  const serialized = readFileSync(join(storageDir, 'mvu-facts.json'), 'utf8')
  assert.ok(!serialized.includes('<script>')); assert.ok(!serialized.includes('stat_data')); assert.ok(!serialized.includes('JSONPatch'))
  assert.equal((await request(restarted, 'facts', null, { id: 'mvu:trace', scope: JSON.stringify({ sessionId: 'other' }) })).data.code, 'SCOPE_MISMATCH')
})
test('facts retain denied card cause and round without a manager or candidate state commit', async t => {
  const bindingScope = { playthroughId: 'p', sessionId: 's', nodeId: 'n', variantId: 'v', endEventId: 1 }
  const text = "_.add('hp', -1);", fingerprint = createHash('sha256').update(JSON.stringify(text)).digest('hex')
  let enabled = true
  const { service } = fixture(t, { resolveScope: async () => ({ writableHead: true, messageId: 'reply-0', fingerprint }),
    authorizeCardWrite: async () => enabled ? { valid: true, write: true, scope: bindingScope, checkCurrent: () => enabled } : null })
  await service.ingest(session([text]))
  const identity = { version: 1, sha256: 'a'.repeat(64), scope: bindingScope }
  const { capability } = await service.createCardBinding({ scope: bindingScope, grantId: 'grant', sourceIdentity: identity })
  enabled = false
  await assert.rejects(service.cardWrite({ capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -1 }], expectedRevision: 1, operationId: 'denied', cause: 'interval' }), { code: 'MVU_WRITE_DENIED' })
  const facts = await service.facts({ id: 'mvu:trace', scope })
  assert.ok(facts.records.some(row => row.eventId === 'denied' && row.phase === 'skipped' && row.cause === 'interval' && row.turn === 1 && row.reason === 'MVU_WRITE_DENIED'))
  assert.ok(!facts.records.some(row => row.eventId === 'denied' && row.phase === 'applied'))
  assert.equal((await service.read({ id: 'mvu:trace', scope })).content.stat_data.hp, 9)
})
test('fact retention is bounded and corrupt optional facts never replace variable state', t => {
  const { storageDir } = fixture(t)
  writeFileSync(join(storageDir, 'mvu-facts.json'), JSON.stringify({ version: 1, records: Array.from({ length: 2048 }, (_, i) => ({ id: 'mvu:trace', sessionId: 's', eventId: String(i), phase: 'completed', recordedAt: i })) }))
  const facts = new MvuFacts(storageDir); facts.append({ id: 'mvu:trace', sessionId: 's', eventId: 'new', phase: 'failed', body: 'secret', variables: { private: true } })
  const records = facts.list('mvu:trace', 's').records
  assert.equal(records.length, 2048); assert.equal(records[0].eventId, '1'); assert.equal(records.at(-1).eventId, 'new'); assert.equal(records.at(-1).body, undefined)
  writeFileSync(join(storageDir, 'mvu-facts.json'), 'bad'); assert.equal(new MvuFacts(storageDir).unavailable, true)
})
test('MVU tables render literal data and historical mode has no edit button', () => {
  setClientUiSettings({ locale: 'zh-CN', scale: 1 }, { announce: false })
  const rows = flattenVariables({ note: '<img src=x onerror=alert(1)>' })
  const html = renderToStaticMarkup(MvuVariablesTable({ rows, editable: false }))
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img')); assert.ok(html.includes('实际值')); assert.ok(!html.includes('<button'))
  const event = { eventId: 'e', turn: 1, on: 'card_variable_update', phases: ['started', 'skipped'], reason: 'MVU_WRITE_DENIED', changes: [] }
  const events = renderToStaticMarkup(MvuEventsTable({ events: [event] }))
  assert.ok(events.includes('跳过 / 拒绝')); assert.ok(events.includes('MVU_WRITE_DENIED'))
})
test('source comparison cells render absent values as labels, including added and removed fields', async t => {
  const previous = getClientUiSettings()
  t.after(() => setClientUiSettings(previous, { announce: false }))
  const { service } = fixture(t, { resources: [{ sharing: 'shared', id: 'mvu:trace', sessionIds: ['s'], initial: { stat_data: { $meta: { extensible: true }, removed: false, changed: null } } }] })
  await service.ingest(session(['<JSONPatch>[{"op":"add","path":"/added","value":"<img src=x onerror=alert(1)>"},{"op":"remove","path":"/removed"},{"op":"replace","path":"/changed","value":false}]</JSONPatch>']))
  const history = (await request(service, 'history', null, { id: 'mvu:trace' })).data.versions
  const facts = (await request(service, 'facts', null, { id: 'mvu:trace' })).data.records
  const events = roundEvents(history, facts, 1), before = JSON.stringify({ history, facts })
  assert.equal(events[0].changes.filter(change => !change.beforePresent).length, 1)
  assert.equal(events[0].changes.filter(change => !change.afterPresent).length, 1)
  for (const [locale, label] of [['zh-CN', '不存在'], ['en', 'Absent']]) {
    setClientUiSettings({ locale }, { announce: false })
    assert.deepEqual(Object.keys(uiMessage('trace.mvu.absent')), ['value', 'toString'], 'use the real text wrapper that React must never receive as a component return')
    const html = renderToStaticMarkup(MvuEventsTable({ events }))
    assert.equal(html.split(label).length - 1, 2)
    assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img'))
    assert.ok(html.includes('null')); assert.ok(html.includes('false'))
    assert.ok(!html.includes('[object Object]'))
  }
  assert.equal(JSON.stringify({ history, facts }), before, 'rendering never rewrites source data or metadata')
})
test('unknown comparison provenance renders its own label rather than a wrapped React child', () => {
  const previous = getClientUiSettings()
  try {
    for (const [locale, label] of [['zh-CN', '未记录'], ['en', 'Not recorded']]) {
      setClientUiSettings({ locale }, { announce: false })
      const events = [{ eventId: 'unknown-comparison', phases: ['completed'], changes: [{ path: '/stat_data/known', beforeKnown: false, beforePresent: true, before: 'MUST NOT DISPLAY', afterPresent: true, after: 'known value' }] }]
      const html = renderToStaticMarkup(MvuEventsTable({ events }))
      assert.ok(html.includes(label)); assert.ok(html.includes('known value')); assert.ok(!html.includes('MUST NOT DISPLAY'))
    }
  } finally { setClientUiSettings(previous, { announce: false }) }
})
test('MVU is inserted immediately below world-book details inside each Trace round', () => {
  const node = TraceRecordContent({ record: { audit: {} }, sessionId: 's', turn: 2, latest: false })
  const children = node.props.children.flat().filter(Boolean)
  const index = children.findIndex(child => child.type?.name === 'MvuRoundSection')
  assert.ok(index > 0)
  assert.equal(children[index].props.turn, 2); assert.equal(children[index].props.latest, false)
  assert.equal(children[index - 1].props.children[0].props.children, '世界书触发情况')
})

 test('retry attempts remain separate and success does not inherit the earlier cancellation', () => {
  const version = { key: 'reply', revision: 1, source: { turn: 1 }, variables: { stat_data: { hp: 9 } }, beforeAvailable: true, before: { hp: 10 } }
  const base = { id: 'mvu:trace', eventId: 'reply', turn: 1 }
  const events = roundEvents([version], [
    { ...base, phase: 'started' }, { ...base, phase: 'failed', detail: 'MVU_USAGE_CANCELLED' },
    { ...base, phase: 'started' }, { ...base, phase: 'triggered' }, { ...base, phase: 'applied', revision: 1 }, { ...base, phase: 'completed', revision: 1, detail: 'state-committed' },
    { ...base, phase: 'started' }, { ...base, phase: 'completed', revision: 1, detail: 'idempotent-replay' },
  ], 1)
  assert.equal(events.length, 3)
  const success = events.find(row => row.phases.includes('applied'))
  assert.ok(!success.phases.includes('failed')); assert.equal(success.reason, undefined); assert.equal(success.changes.length, 1)
  assert.equal(events.find(row => row.detail === 'idempotent-replay').changes.length, 0)
  assert.equal(events.find(row => row.phases.includes('failed')).reason, 'MVU_USAGE_CANCELLED')
 })
 test('inherited receipts are snapshots with unknown original trigger/before, not new child applications', async t => {
  const { storageDir } = fixture(t), sessions = new Map()
  const options = { storageDir, resources: [{ id: 'mvu:instance', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }],
    inspect: async id => sessions.get(id), captureSessionLease: id => { const observed = sessions.get(id), fingerprint = JSON.stringify(observed); return () => sessions.get(id) === observed && JSON.stringify(observed) === fingerprint } }
  const service = new MvuService(options), parent = session([]), turn = session(["_.add('hp', -10);"]).events
  sessions.set('s', parent); parent.events.push(turn[0])
  await service.checkpoint(parent, parent.events[0]); parent.events.push(...turn.slice(1)); await service.ingest(parent)
  const row = (await service.list({ scope }))[0]
  await service.update({ id: row.id, scope, content: editVariable(row.content, ['hp'], '80'), expectedRevision: row.revision, operationId: 'parent-edit' })
  const ticket = await service.captureSessionSeed({ sessionId: 's', kind: 'fork', atEventId: 1 })
  const child = { id: 'child', header: { id: 'child', version: 4, createdAt: 2, parentSession: 's' }, inheritedEventCount: 2,
    events: [...structuredClone(parent.events.slice(0, 2)), { seq: 2, type: 'session/end-seed', data: {} }, { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'forked' } } }] }
  sessions.set('child', child); await service.installSessionSeed({ ticket, sessionId: 'child' })
  const childScope = { authority: 'local', sessionId: 'child' }, childRow = (await service.list({ scope: childScope }))[0]
  const history = await service.history({ id: childRow.id, scope: childScope, includeBefore: true })
  assert.ok(history.every(version => version.source.inherited && !version.beforeAvailable))
  const events = roundEvents(history, [], 1)
  assert.ok(events.every(event => event.on === 'inherited_snapshot' && !event.changes.length && !event.phases.length))
 })
 test('legacy read-only state cannot be edited through Trace transport', async t => {
  const { storageDir } = fixture(t)
  const legacy = JSON.stringify({ version: 1, resources: { 'mvu:old': { definition: { sharing: 'shared', id: 'mvu:old', sessionIds: ['s'], initial: { stat_data: { hp: 20 } } }, revision: 0, versions: [], currentKey: null } } })
  writeFileSync(join(storageDir, 'mvu-state.json'), legacy)
  const service = new MvuService({ storageDir, resources: [] })
  const result = await request(service, 'update', { id: 'mvu:old', scope, content: { stat_data: { hp: 1 } }, expectedRevision: 0, operationId: 'no-migration' })
  assert.equal(result.data.code, 'MVU_READ_ONLY'); assert.equal(readFileSync(join(storageDir, 'mvu-state.json'), 'utf8'), legacy)
 })

 test('Trace edits use the desktop embedded token and recover the token after Host restart', async t => {
  const { service } = fixture(t), originalFetch = globalThis.fetch, originalLocation = globalThis.location
  t.after(() => { globalThis.fetch = originalFetch; if (originalLocation === undefined) delete globalThis.location; else globalThis.location = originalLocation })
  globalThis.location = { protocol: 'dsh-app:' }
  let api = secureTavernApi(createMvuApi(service)), tokens = 0, rejected = 0
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/request-token')) tokens++
    const req = new EventEmitter(), res = new EventEmitter()
    req.url = url; req.method = options.method ?? 'GET'; req.socket = { remoteAddress: '127.0.0.1' }; req.headers = { host: 'localhost:53101', ...Object.fromEntries(new Headers(options.headers)) }
    res.setHeader = () => {}
    let response
    res.end = body => { res.writableEnded = true; if (res.statusCode === 403) rejected++; response = new Response(body, { status: res.statusCode ?? 200, headers: { 'Content-Type': 'application/json' } }) }
    const task = api(req, res)
    if (options.body) { req.emit('data', Buffer.from(options.body)); req.emit('end') }
    await task; return response
  }
  const row = await service.read({ id: 'mvu:trace', scope })
  const result = await mvuRequest('update', { body: { id: row.id, scope, content: editVariable(row.content, ['hp'], '7'), expectedRevision: row.revision, operationId: 'desktop-one' } })
  assert.equal(result.content.stat_data.hp, 7); assert.equal(tokens, 1); assert.equal(rejected, 0)
  api = secureTavernApi(createMvuApi(service))
  const second = await mvuRequest('update', { body: { id: row.id, scope, content: editVariable(result.content, ['hp'], '6'), expectedRevision: result.revision, operationId: 'desktop-two' } })
  assert.equal(second.content.stat_data.hp, 6); assert.equal(tokens, 2); assert.equal(rejected, 1)
  assert.equal((await service.history({ id: row.id, scope })).length, 2)
 })
