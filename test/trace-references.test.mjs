import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { digest, counts } from '../packages/prompt-metadata.js'
import { captureBodyReferences, createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { AssemblyRecorder } from '../packages/tavern-trace/src/assembly-recorder.js'
import { TavernTraceStore } from '../packages/tavern-trace/src/store.js'
import { TavernTraceRecorder } from '../packages/tavern-trace/src/recorder.js'

const part = (name, text) => ({ name, ...counts(text), hash: digest(text) })
const message = (id, role, text) => ({ id, role, content: [{ type: 'text', text }] })
function fixture() {
  const system = message('sys', 'system', 'FIRST😀\n\nSECOND')
  const context = { ...message('context', 'user', '[official context]\nCONTEXT'), source: {
    kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot', sections: [{ name: 'context', text: 'CONTEXT' }],
  } }
  const events = [{ seq: 0, type: 'system/message', data: { message: system } }, { seq: 1, type: 'user/message', data: context }]
  const session = { id: 'session', seq: 2, header: { id: 'session', version: 3, createdAt: 123 },
    surface: { nodes: [0, 1] }, snapshotEvents: () => structuredClone(events) }
  const sections = [{ ...part('one', 'FIRST😀'), offsetUtf16: 0 }, { ...part('two', 'SECOND'), offsetUtf16: 9 }]
  const contexts = [part('context', 'CONTEXT')]
  const refs = captureBodyReferences(session, { messages: [system, context] }, sections, contexts, 0)
  const row = { schemaVersion: 4, id: 'capture', sessionId: 'session', contentStatus: 'reference-only', bodyStorage: 'official-session', sections, contexts, ...refs }
  return { session, system, context, events, row, inspection: () => ({ meta: session.header, events }) }
}

test('references hydrate exact Unicode ranges and official context sections in one cold inspection', async () => {
  const f = fixture(); let calls = 0
  const read = createAssemblyBodyReader({ inspect: async id => { calls++; assert.equal(id, 'session'); return f.inspection() } })
  const hydrated = await read(f.row)
  assert.equal(calls, 1)
  assert.equal(hydrated.contentStatus, 'available')
  assert.deepEqual(hydrated.sections.map(p => p.text), ['FIRST😀', 'SECOND'])
  assert.equal(hydrated.contexts[0].text, 'CONTEXT')
  assert.deepEqual(hydrated.systemMessages, ['FIRST😀\n\nSECOND'])
  assert.equal(f.row.sections[0].text, undefined)
})

test('durable references survive surface replacement and inherited child prefixes', async () => {
  const f = fixture()
  f.events.push({ seq: 2, type: 'system/message', data: { message: message('new', 'system', 'REPLACEMENT') } })
  f.session.surface.nodes = [2]
  const read = createAssemblyBodyReader({ inspect: async () => f.inspection() })
  assert.equal((await read(f.row)).sections[0].text, 'FIRST😀')
  f.session.id = f.session.header.id = 'child'
  f.row.sessionId = f.row.sessionRef.sessionId = 'child'
  assert.equal((await read(f.row)).sections[0].text, 'FIRST😀')
})

test('reuse points to the original official event and duplicate actual messages are not guessed', () => {
  const f = fixture()
  f.session.seq = 3
  f.events.push({ seq: 2, type: 'turn/end', data: {} })
  const refs = captureBodyReferences(f.session, { messages: [f.system] }, f.row.sections, [], 0)
  assert.equal(refs.systemMessageRefs[0].eventSeq, 0)
  assert.equal(refs.sessionRef.logCutSeq, 2)
  const contexts = [part('context', 'CONTEXT')]
  captureBodyReferences(f.session, { messages: [f.context, f.context] }, [], contexts, null)
  assert.equal(contexts[0].reference, undefined)
})

for (const [name, mutate, expected] of [
  ['format change', f => { f.session.header.version = 2 }, 'format-mismatch'],
  ['recreated session', f => { f.session.header.createdAt++ }, 'session-mismatch'],
  ['truncated history', f => { f.events.pop() }, 'cut-unavailable'],
  ['wrong event type', f => { f.events[0].type = 'assistant/message' }, 'event-unavailable'],
  ['wrong message identity', f => { f.events[0].data.message.id = 'other' }, 'identity-mismatch'],
  ['modified body', f => { f.events[0].data.message.content[0].text = 'other' }, 'hash-mismatch'],
  ['invalid range', f => { f.row.sections[0].reference.range.endUtf16 = 999 }, 'range-mismatch'],
  ['wrong section digest', f => { f.row.sections[0].hash = digest('other') }, 'hash-mismatch'],
]) test(`${name} returns explicit unavailability without a body fallback`, async () => {
  const f = fixture(); mutate(f)
  // A malformed/old caller cannot smuggle a cached copy into the response.
  f.row.sections[0].text = 'CACHED COPY'
  const hydrated = await createAssemblyBodyReader({ inspect: async () => f.inspection() })(f.row)
  assert.equal(hydrated.sections[0].referenceError, expected)
  assert.equal(hydrated.sections[0].text, undefined)
})

test('missing official history keeps metadata and never exposes internal paths', async () => {
  const f = fixture()
  const read = createAssemblyBodyReader({ inspect: async () => { throw Object.assign(new Error('/secret/path'), { code: 'SESSION_NOT_FOUND' }) } })
  const row = await read(f.row)
  assert.equal(row.referenceError, 'history-unavailable')
  assert.equal(row.contentStatus, 'reference-unavailable')
  assert.equal(row.sections[0].hash, f.row.sections[0].hash)
  assert.equal(row.systemMessages, undefined)
  assert.ok(!JSON.stringify(row).includes('/secret'))
})

test('context source identity is verified separately from the message body', async () => {
  const f = fixture(); f.events[1].data.source.sections[0].name = 'different'
  const row = await createAssemblyBodyReader({ inspect: async () => f.inspection() })(f.row)
  assert.equal(row.contentStatus, 'partially-available')
  assert.equal(row.contexts[0].referenceError, 'identity-mismatch')
})

test('legacy request headers resolve only in their original session format', async () => {
  const f = fixture(); f.session.header.version = 2
  f.events.splice(0, 2, { seq: 0, type: 'request/header', data: { header: { system: 'FIRST😀\n\nSECOND' } } })
  f.session.seq = 1
  const row = { ...f.row, ...captureBodyReferences(f.session, { system: 'FIRST😀\n\nSECOND' }, f.row.sections, [], 0), contexts: [] }
  const read = createAssemblyBodyReader({ inspect: async () => f.inspection() })
  assert.equal((await read(row)).sections[1].text, 'SECOND')
  f.session.header.version = 3
  assert.equal((await read(row)).referenceError, 'format-mismatch')
})

test('shared v1/v3 captures store one metadata record and never duplicate large card bodies', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trace-shared-'))
  try {
    const assemblies = new AssemblyStore(directory)
    const v1 = new TavernTraceStore(directory, {}, assemblies)
    const auditRecorder = new TavernTraceRecorder(v1)
    const recorder = new AssemblyRecorder(assemblies)
    const capture = (size, step) => {
      const text = 'PRIVATE-CARD-'.repeat(size)
      const section = { name: 'card', text, sources: [{ kind: 'character', resourceId: 'card', field: 'description', text, ...counts(text) }] }
      const snapshot = { sections: [section], systemText: text, officialAssembly: { sections: [section], contexts: [], variables: {} } }
      const payload = { agent: { id: 'session' }, turn: 1, step, snapshot }
      const audit = auditRecorder.begin(payload)
      recorder.begin({ ...payload, legacyRecord: audit })
      // A later v1 update must survive persistence of the pending v3 snapshot.
      v1.upsert('session', { ...audit, status: 'confirmed-latest' })
      const id = recorder.request({ sessionId: 'session', messages: [message('sys', 'system', text)] })
      const stored = assemblies.get('session', id)
      assert.equal(stored.attempt, 1)
      assert.equal(stored.audit.status, 'confirmed-latest')
      assert.equal(stored.sections[0].sources[0].text, undefined)
      assert.equal(stored.sections[0].sources[0].hash, digest(text))
      return Buffer.byteLength(JSON.stringify(stored))
    }
    const small = capture(100, 1)
    const large = capture(100000, 2)
    assert.ok(large < small + 200, `${large} vs ${small}`)
    assert.deepEqual(readdirSync(directory), ['tavern-trace-records.json'])
    const file = readFileSync(assemblies.path, 'utf8')
    assert.ok(!file.includes('PRIVATE-CARD'))
    assert.equal(JSON.parse(file).records.length, 2)
    const restored = new AssemblyStore(directory)
    assert.equal(new TavernTraceStore(directory, {}, restored).list('session').length, 2)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('existing v1 audits and v3 snapshots stay readable and byte-for-byte unchanged', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'trace-old-'))
  try {
    const legacyStore = new TavernTraceStore(directory)
    legacyStore.upsert('session', { id: '1:1:1', turn: 1, step: 1, attempt: 1, recordedAt: 1, status: 'header-observed' })
    const v1Before = readFileSync(legacyStore.statePath, 'utf8')
    const oldPath = join(directory, 'tavern-assemblies.json')
    const historical = { schemaVersion: 3, id: 'old', sessionId: 'session', recordedAt: 1, audit: { id: '1:1:1', turn: 1, step: 1, attempt: 1, recordedAt: 1, status: 'awaiting-header' }, sections: [{ text: 'OLD SNAPSHOT', sources: [{ text: 'OLD ORIGINAL' }] }] }
    const v3Before = JSON.stringify({ schemaVersion: 3, records: [historical] })
    writeFileSync(oldPath, v3Before)
    const assemblies = new AssemblyStore(directory)
    const v1 = new TavernTraceStore(directory, {}, assemblies)
    v1.upsert('session', { id: '2:1:1', captureId: 'new', turn: 2, step: 1, attempt: 1, recordedAt: 2 })
    assert.equal(v1.list('session').length, 2)
    assert.equal(v1.list('session')[0].status, 'header-observed')
    const read = createAssemblyBodyReader({ inspect: () => { throw new Error('must not inspect old snapshots') } })
    assert.deepEqual(await read(assemblies.get('session', 'old')), historical)
    assert.equal(readFileSync(oldPath, 'utf8'), v3Before)
    assert.equal(readFileSync(legacyStore.statePath, 'utf8'), v1Before)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
