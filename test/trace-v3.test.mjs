import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileTavernProfile } from '../packages/tavern-loader/src/profile-loader.js'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { AssemblyRecorder } from '../packages/tavern-trace/src/assembly-recorder.js'
import { PromptSourceService, createPromptTraceApi } from '../packages/tavern-loader/src/prompt-trace-api.js'

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
    const api = createPromptTraceApi({ assemblies: f.store, sources: { getSources: () => ({ revision: 'r' }) }, ensureSession: () => {} })
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

test('current sources preserve documents and revisions without activating matching or assembly', () => {
  let description = 'original😀'
  const service = new PromptSourceService({
    selections: { get: () => ({ presetId: null, characterCardId: 'c', userId: null, worldBookIds: [], character: { greetingIndex: 8 } }) },
    characters: { get: () => ({ id: 'c', data: { description, firstMessage: 'hello', alternateGreetings: ['alt'] } }) },
    resourceWorldBooks: { get: () => [] },
  })
  const first = service.getSources('session')
  assert.equal(first.greeting.effectiveIndex, 0)
  assert.equal(first.fieldLengths['/character/data/description'].characters, 9)
  description = 'edited'
  assert.notEqual(service.getSources('session').revision, first.revision)
  assert.equal(first.documents.character.data.description, 'original😀')
})

test('failures and legacy metadata remain explicit; v3 errors do not disclose internal paths', async () => {
  const f = fixture()
  try {
    f.recorder.failure({ agent: { id: 'session' }, turn: 1, step: 1 })
    assert.equal(f.store.list('session')[0].status, 'assembly-or-preparation-failed')
    start(f.recorder, assembled(), 2)
    f.recorder.failure({ agent: { id: 'session' }, turn: 1, step: 2 })
    assert.equal(f.store.list('session')[1].status, 'request-failed-before-observation')
    const api = createPromptTraceApi({ assemblies: f.store, sources: { getSources: () => { throw new Error('/private/storage/path') } }, ensureSession: () => {},
      legacyStore: { list: () => [{ id: 'old', turn: 0, step: 1, attempt: 1, recordedAt: 1, worldBooks: [] }] } })
    const base = '/pmp-dsh-tavern/api/v3/sessions/session'
    const list = await invoke(api, `${base}/assemblies`)
    assert.equal(list.body.records[0].contentStatus, 'legacy-metadata-only')
    const legacy = await invoke(api, `${base}/assemblies/legacy%3Aold`)
    assert.deepEqual(legacy.body.record.audit.worldBooks, [])
    assert.equal(legacy.body.record.sections, undefined)
    const failure = await invoke(api, `${base}/sources`)
    assert.equal(failure.status, 500)
    assert.ok(!JSON.stringify(failure).includes('/private/storage/path'))
  } finally { f.cleanup() }
})
