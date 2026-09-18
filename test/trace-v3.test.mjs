import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileTavernProfile } from '../packages/tavern-loader/src/profile-loader.js'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { AssemblyRecorder } from '../packages/tavern-trace/src/assembly-recorder.js'
import { TavernTraceStore } from '../packages/tavern-trace/src/store.js'
import { TavernTraceRecorder } from '../packages/tavern-trace/src/recorder.js'
import { createPromptTraceApi } from '../packages/tavern-loader/src/prompt-trace-api.js'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'trace-v3-'))
  const store = new AssemblyStore(directory)
  return { directory, store, recorder: new AssemblyRecorder(store), cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}
const prompt = (identifier, content, marker = false) => ({ identifier, content, marker, enabled: true, role: 'system' })
function assembled() {
  const snapshot = compileTavernProfile({
    preset: { id: 'p', prompts: [prompt('main', 'ORIGINAL'), prompt('charDescription', '', true), prompt('tail', 'TAIL')] },
    character: { id: 'c', data: { name: 'Alice', description: '角色😀', systemPrompt: '前{{original}}后{{original}}' } },
  })
  snapshot.officialAssembly = { sections: snapshot.sections.map(({ name, text }) => ({ name, text })), contexts: [], variables: {} }
  return snapshot
}
const start = (recorder, snapshot = assembled(), step = 1) => recorder.begin({ agent: { id: 'session' }, turn: 1, step, snapshot })
const request = text => ({ sessionId: 'session', provider: 'fake', model: 'test', messages: [{ role: 'system', content: [{ type: 'text', text }] }], tools: [] })

test('interleaved official sections preserve original text and mixed sources without inserting whitespace', () => {
  const snapshot = assembled()
  assert.equal(snapshot.sections.map(s => s.text).join('\n\n'), snapshot.systemText)
  const main = snapshot.sections.find(s => s.text.includes('前ORIGINAL后ORIGINAL'))
  assert.deepEqual(main.sources.map(s => s.kind), ['preset', 'character'])
  assert.equal(main.sources[1].text, '前{{original}}后{{original}}')
  assert.ok(snapshot.sections.findIndex(s => s.text.includes('角色😀')) < snapshot.sections.findIndex(s => s.text.includes('TAIL')))
  assert.equal(new Set(snapshot.sections.map(s => s.name)).size, snapshot.sections.length)
})

test('same-step retry and subsequent step keep immutable runtime snapshots after restart', () => {
  const f = fixture()
  try {
    const snapshot = assembled()
    start(f.recorder, snapshot)
    const id = f.recorder.request(request(snapshot.systemText))
    snapshot.sections[1].sources[0].text = 'EDITED'
    assert.equal(f.store.get('session', id).delivery.assemblyVerified, true)
    assert.ok(!JSON.stringify(f.store.get('session', id)).includes('EDITED'))
    start(f.recorder); f.recorder.request(request('OTHER'))
    start(f.recorder, assembled(), 2); f.recorder.finish('session', 'request-unconfirmed')
    const restored = new AssemblyStore(f.directory)
    assert.deepEqual(restored.list('session').map(r => [r.step, r.attempt]), [[1, 1], [1, 2], [2, 1]])
    assert.equal(restored.get('session', restored.list('session')[1].id).delivery.assemblyVerified, false)
    assert.ok(!JSON.stringify(restored.list('session')).includes('ORIGINAL'))
  } finally { f.cleanup() }
})

test('a complete prompt or duplicate output never gets guessed source offsets', () => {
  const f = fixture()
  try {
    start(f.recorder)
    const id = f.recorder.request(request('COMPLETE'))
    const row = f.store.get('session', id)
    assert.equal(row.delivery.assemblyVerified, false)
    assert.deepEqual(row.systemMessages, ['COMPLETE'])
    start(f.recorder)
    const options = request(assembled().systemText); options.messages.push(options.messages[0])
    const second = f.recorder.request(options)
    assert.equal(f.store.get('session', second).delivery.systemMessageIndex, null)
  } finally { f.cleanup() }
})

test('oversize records retain explicit omissions; total retention survives reload; corrupt JSON fails visibly', () => {
  const f = fixture()
  try {
    const tiny = new AssemblyStore(f.directory, { maxRecordBytes: 4096, maxTotalBytes: 8192 })
    const row = tiny.put({ id: 'a', sessionId: 'session', turn: 1, step: 1, attempt: 1, status: 'request-observed', sections: ['x'.repeat(9000)] })
    assert.equal(row.contentStatus, 'omitted-size-limit')
    for (let i = 0; i < 300; i++) tiny.put({ ...row, id: String(i) })
    assert.ok(Buffer.byteLength(readFileSync(tiny.path)) <= 8192)
    assert.ok(tiny.list('session').length < 256)
    writeFileSync(tiny.path, '{broken')
    assert.throws(() => new AssemblyStore(f.directory))
  } finally { f.cleanup() }
})

async function invoke(api, path, method = 'GET') {
  let result; const headers = {}
  const res = { setHeader: (k, v) => { headers[k] = v }, end: text => { result = JSON.parse(text) } }
  await api({ url: path, method }, res)
  return { status: res.statusCode, body: result, headers }
}
test('v3 exposes read-only index/detail primitives with explicit IDs and cold historical reads', async () => {
  const f = fixture()
  try {
    start(f.recorder); const id = f.recorder.request(request(assembled().systemText))
    const api = createPromptTraceApi({ assemblies: f.store })
    const base = '/pmp-dsh-tavern/api/v3'
    assert.equal((await invoke(api, `${base}/capabilities`)).body.contract, 'prompt-trace-primitives')
    const list = await invoke(api, `${base}/sessions/session/assemblies`)
    assert.equal(list.headers['Cache-Control'], 'no-store')
    assert.equal(list.body.records.length, 1)
    assert.equal((await invoke(api, `${base}/sessions/session/assemblies/${id}`)).body.record.sections.length, 4)
    assert.equal((await invoke(api, `${base}/sessions/session/assemblies/missing`)).status, 404)
    assert.equal((await invoke(api, `${base}/sessions/%00/assemblies`)).status, 400)
    assert.equal((await invoke(api, `${base}/capabilities`, 'PUT')).status, 405)
  } finally { f.cleanup() }
})

test('removed current-source endpoint stays absent while historical source inputs remain readable', async () => {
  const f = fixture()
  try {
    start(f.recorder); const id = f.recorder.request(request(assembled().systemText))
    const api = createPromptTraceApi({ assemblies: new AssemblyStore(f.directory) })
    const base = '/pmp-dsh-tavern/api/v3'
    for (const path of ['/sessions/session/sources', '/sessions/session/sources/extra']) {
      const response = await invoke(api, base + path)
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    }
    const capabilities = (await invoke(api, `${base}/capabilities`)).body
    assert.equal(capabilities.historicalAssemblies, true)
    assert.equal('currentSources' in capabilities, false)
    assert.equal('maxSourceBytes' in capabilities, false)
    const { record } = (await invoke(api, `${base}/sessions/session/assemblies/${id}`)).body
    const source = record.sections.flatMap(section => section.sources).find(source => source.text === '角色😀')
    assert.equal(source.resourceId, 'c')
    assert.equal(source.characters, 3)
    assert.equal(source.utf16Units, 4)
    assert.equal(source.utf8Bytes, 10)
  } finally { f.cleanup() }
})

test('failures and legacy metadata remain explicit; v3 errors do not disclose internal paths', async () => {
  const f = fixture()
  try {
    f.recorder.failure({ agent: { id: 'session' }, turn: 1, step: 1 })
    assert.equal(f.store.list('session')[0].status, 'assembly-or-preparation-failed')
    start(f.recorder, assembled(), 2)
    f.recorder.failure({ agent: { id: 'session' }, turn: 1, step: 2 })
    assert.equal(f.store.list('session')[1].status, 'request-failed-before-observation')
    const api = createPromptTraceApi({ assemblies: f.store,
      legacyStore: { list: () => [{ id: 'old', turn: 0, step: 1, attempt: 1, recordedAt: 1, worldBooks: [] }] } })
    const base = '/pmp-dsh-tavern/api/v3/sessions/session'
    const list = await invoke(api, `${base}/assemblies`)
    assert.equal(list.body.records[0].contentStatus, 'legacy-metadata-only')
    const legacy = await invoke(api, `${base}/assemblies/legacy%3Aold`)
    assert.deepEqual(legacy.body.record.audit.worldBooks, [])
    assert.equal(legacy.body.record.sections, undefined)
    const failingApi = createPromptTraceApi({ assemblies: { list: () => { throw new Error('/private/storage/path') } } })
    const failure = await invoke(failingApi, `${base}/assemblies`)
    assert.equal(failure.status, 500)
    assert.ok(!JSON.stringify(failure).includes('/private/storage/path'))
  } finally { f.cleanup() }
})

test('legacy merging keeps the earlier request when v3 eviction resets the same-step counter', async () => {
  const f = fixture()
  try {
    const store = new AssemblyStore(f.directory, { maxRecordBytes: 4096, maxTotalBytes: 4096 })
    const recorder = new AssemblyRecorder(store)
    const legacyStore = new TavernTraceStore(f.directory)
    const legacyRecorder = new TavernTraceRecorder(legacyStore)
    const snapshot = { systemText: 'PROMPT', callConfig: {}, sections: [], audit: {},
      officialAssembly: { sections: [{ name: 'test', text: 'PROMPT' }], contexts: [], variables: {} } }
    const capture = () => {
      const payload = { agent: { id: 'session' }, turn: 1, step: 1, snapshot }
      const legacyRecord = legacyRecorder.begin(payload)
      recorder.begin({ ...payload, legacyRecord })
      return { legacyRecord, id: recorder.request(request('PROMPT')) }
    }
    const first = capture()
    assert.equal(store.get('session', first.id).attempt, 1)
    for (const id of ['pressure-1', 'pressure-2']) {
      store.put({ schemaVersion: 3, id, sessionId: 'other', sections: [{ text: 'x'.repeat(3200) }] })
    }
    assert.equal(store.get('session', first.id), null)
    assert.equal(legacyStore.list('session').length, 1)
    const second = capture()
    assert.equal(second.legacyRecord.attempt, 2)
    assert.equal(store.get('session', second.id).attempt, 1)
    const restored = new AssemblyStore(f.directory, { maxRecordBytes: 4096, maxTotalBytes: 4096 })
    const api = createPromptTraceApi({ assemblies: restored, legacyStore })
    const list = await invoke(api, '/pmp-dsh-tavern/api/v3/sessions/session/assemblies')
    assert.deepEqual(new Set(list.body.records.map(row => row.id)), new Set([`legacy:${first.legacyRecord.id}`, second.id]))
    const current = list.body.records.find(row => row.id === second.id)
    assert.equal(current.legacyCaptureId, second.legacyRecord.captureId)
    assert.equal('audit' in current, false)
    assert.ok(!JSON.stringify(list.body).includes('PROMPT'))
  } finally { f.cleanup() }
})

test('legacy merging uses captured identity for omitted records and never guesses unlinked records', async () => {
  const f = fixture()
  try {
    const store = new AssemblyStore(f.directory, { maxRecordBytes: 4096, maxTotalBytes: 8192 })
    const legacyStore = new TavernTraceStore(f.directory)
    const legacy = { id: '1:1:1', captureId: 'fixed-test-capture', turn: 1, step: 1, attempt: 1, recordedAt: 1 }
    legacyStore.upsert('session', legacy)
    const base = { schemaVersion: 3, sessionId: 'session', turn: 1, step: 1, attempt: 1, recordedAt: 1 }
    store.put({ ...base, id: 'unlinked', audit: {} })
    let api = createPromptTraceApi({ assemblies: store, legacyStore })
    let list = await invoke(api, '/pmp-dsh-tavern/api/v3/sessions/session/assemblies')
    assert.deepEqual(new Set(list.body.records.map(row => row.id)), new Set(['legacy:1:1:1', 'unlinked']))
    const omitted = store.put({ ...base, id: 'omitted', audit: legacy, sections: [{ text: 'x'.repeat(9000) }] })
    assert.equal(omitted.contentStatus, 'omitted-size-limit')
    assert.equal(omitted.legacyCaptureId, legacy.captureId)
    assert.equal('audit' in omitted, false)
    api = createPromptTraceApi({ assemblies: new AssemblyStore(f.directory), legacyStore })
    list = await invoke(api, '/pmp-dsh-tavern/api/v3/sessions/session/assemblies')
    assert.deepEqual(new Set(list.body.records.map(row => row.id)), new Set(['omitted', 'unlinked']))
  } finally { f.cleanup() }
})

async function assertDistinctCaptureAfterReverseEviction(sameTimestamp) {
  const f = fixture()
  try {
    let time = 0
    const now = () => sameTimestamp ? 7 : ++time
    let legacyStore = new TavernTraceStore(f.directory, { maxSessions: 1 })
    let legacyRecorder = new TavernTraceRecorder(legacyStore, { now })
    const payload = { agent: { id: 'session' }, turn: 1, step: 1, snapshot: assembled() }
    const first = legacyRecorder.begin(payload)
    f.recorder.begin({ ...payload, legacyRecord: first })
    const firstId = f.recorder.request(request(payload.snapshot.systemText))
    legacyRecorder.finalize(payload.agent, 'request-not-confirmed')
    legacyRecorder.begin({ ...payload, agent: { id: 'zzz-other' } })
    assert.equal(legacyStore.list('session').length, 0)
    if (sameTimestamp) {
      // Reopen with room for both sessions. Otherwise the one-session store's
      // tie-breaking policy would immediately evict the new record as well.
      legacyStore = new TavernTraceStore(f.directory, { maxSessions: 2 })
      legacyRecorder = new TavernTraceRecorder(legacyStore, { now })
    }
    const second = legacyRecorder.begin(payload)
    assert.equal(first.id, second.id)
    assert.equal(first.recordedAt === second.recordedAt, sameTimestamp)
    assert.notEqual(first.captureId, second.captureId)
    assert.match(first.captureId, /^[0-9a-f-]{36}$/)
    assert.equal(legacyStore.list('session')[0].captureId, second.captureId)
    // The second v3 capture never reaches persistence, e.g. after a write error.
    const api = createPromptTraceApi({ assemblies: new AssemblyStore(f.directory), legacyStore })
    const list = await invoke(api, '/pmp-dsh-tavern/api/v3/sessions/session/assemblies')
    assert.deepEqual(new Set(list.body.records.map(row => row.id)), new Set([firstId, `legacy:${second.id}`]))
    const detail = await invoke(api, `/pmp-dsh-tavern/api/v3/sessions/session/assemblies/legacy%3A${encodeURIComponent(second.id)}`)
    assert.equal(detail.body.record.audit.captureId, second.captureId)
  } finally { f.cleanup() }
}

test('reverse eviction never merges a new legacy capture with an older v3 record using the same ID', async () => {
  await assertDistinctCaptureAfterReverseEviction(false)
})

test('capture identity survives eviction and restart even when reused IDs have identical timestamps', async () => {
  await assertDistinctCaptureAfterReverseEviction(true)
})

test('historical snapshots without capture UUIDs are never matched by reused ID or timestamp', async () => {
  const f = fixture()
  try {
    const legacyStore = new TavernTraceStore(f.directory)
    const legacy = { id: '1:1:1', turn: 1, step: 1, attempt: 1, recordedAt: 1 }
    legacyStore.upsert('session', legacy)
    f.store.put({ schemaVersion: 3, sessionId: 'session', id: 'historical-v3',
      turn: 1, step: 1, attempt: 1, recordedAt: 1, audit: legacy })
    const api = createPromptTraceApi({ assemblies: new AssemblyStore(f.directory), legacyStore })
    const list = await invoke(api, '/pmp-dsh-tavern/api/v3/sessions/session/assemblies')
    assert.deepEqual(new Set(list.body.records.map(row => row.id)), new Set(['historical-v3', 'legacy:1:1:1']))
  } finally { f.cleanup() }
})
