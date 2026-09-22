import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { buildCoordinateMap, migrateManifest } from '../scripts/migrate-session-coordinates.mjs'
import { captureBodyReferences, createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
import { captureFailureReference } from '../packages/tavern-trace/src/failure-references.js'
import { digest, counts } from '../packages/prompt-metadata.js'
import { sessionCoordinates, requireCoordinates } from '../packages/play/src/session-coordinates.js'
import { apply } from '../packages/tavern-loader/src/index.js'

const root = process.env.DSH_TAVERN_COMPAT_ROOT
const user = id => ({ id, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: id }] })
const part = (name, text) => ({ name, offsetUtf16: 0, ...counts(text), hash: digest(text) })

test('V4 unversioned and stale coordinates refuse even without a historical system marker', () => {
  const coordinates = sessionCoordinates({ meta: { version: 4 }, events: [] })
  for (const version of [undefined, 3]) assert.throws(() => requireCoordinates(version, coordinates), { code: 'PLAY_COORDINATES_MIGRATION_REQUIRED' })
  requireCoordinates(4, coordinates)
})

test('agent/created initializes inherited selections, pending input and RP guard before the first request; failures propagate', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tavern-created-'))
  const listeners = new Map()
  try {
    const store = apply({ systemPrompt: { section() {} }, on: (name, listener) => listeners.set(name, listener),
      get() {}, emit() {}, effect() {}, logger: { info() {} } }, { storageDir: directory })
    store.characterStore.create({ id: 'c', name: 'Character' })
    store.sessionSelections.set('parent', { characterCardId: 'c' })
    const log = []
    const session = { id: 'child', header: { version: 4, parentSession: 'parent' }, seq: 0,
      snapshotEvents: () => log, ownEvents: () => log, append(type, data) { log.push({ seq: log.length, type, data }); this.seq++ } }
    const created = listeners.get('agent/created')
    assert.equal(listeners.has('agent/session-start'), false)
    created({ agent: { id: 'child', status: 'idle', session }, source: 'fork' })
    assert.equal(store.sessionSelections.get('child').characterCardId, 'c')
    assert.equal(store.pendingInputProjection.sessions.has(session), true)
    assert.equal(store.rpMode.stored('child').active, true)
    assert.equal(log.at(-1).data.mode, 'read-only')
    const broken = { ...session, id: 'broken', snapshotEvents: () => [], ownEvents: () => [], append() { throw new Error('disk full') } }
    assert.throws(() => created({ agent: { id: 'broken', status: 'idle', session: broken }, source: 'resume' }), /disk full/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('official V3→V4 interrupted-turn mapping upgrades timeline/import/Trace together, verifies bodies and retains backups', { skip: !root }, async () => {
  const require = createRequire(join(root, 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { createSessionFormatCatalogWithChildren } = await load('@deepseek-ai/dsh-session-format-catalog')
  const { releasedV3SessionFormatCodec: v3, releasedV4SessionFormatCodec: v4 } = await load('@deepseek-ai/dsh-session-format-v3-to-v4')
  const directory = mkdtempSync(join(tmpdir(), 'tavern-v4-upgrade-'))
  try {
    const workspace = join(directory, 'rp'), storageDir = join(directory, 'storage')
    mkdirSync(workspace); mkdirSync(storageDir)
    const header = { id: 'session', version: 3, createdAt: 1, isSeeded: false, delegationDepth: 0 }
    const system = { id: 'system', role: 'system', source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' }, content: [{ type: 'text', text: 'SYSTEM😀' }] }
    const context = { ...user('context'), source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot', sections: [{ name: 'ctx', text: 'CONTEXT' }] } }
    const events = [
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'sandbox/mode', data: { mode: 'read-only' } },
      { type: 'agent/inbox/spliced', data: { target: 'next-turn', inserted: [user('next')] } },
      { type: 'turn/start', data: { turn: 2 } },
      { type: 'step/start', data: { turn: 2, step: 1 } },
      { type: 'system/message', data: { turn: 2, step: 1, message: system }, surfaceOp: 'append' },
      { type: 'user/message', data: context, surfaceOp: 'append' },
      { type: 'step/end', data: { turn: 2, step: 1 } },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'error', error: { code: 'TEST', message: 'kept error' } } } },
    ].map((row, seq) => ({ ...row, seq, time: 10 + seq }))
    const oldRows = [v3.encodeHeader(header, 0), ...events.map(v3.encodeEvent)]
    const reader = createSessionFormatCatalogWithChildren([]).createRestore(oldRows[0], { recovery: 'strict', validation: 'current' })
    for (const row of oldRows.slice(1)) reader.decodeRow(row)
    const artifact = reader.finish()
    const source = join(directory, 's.v3.jsonl'), target = join(directory, 's.v4.jsonl')
    const writeRows = (path, rows) => writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
    writeRows(source, oldRows)
    writeRows(target, [v4.encodeHeader(artifact.header, artifact.inheritedEventCount), ...artifact.events.map(v4.encodeEvent)])
    const sourceBytes = readFileSync(source), targetBytes = readFileSync(target)
    const sections = [part('system', 'SYSTEM😀')], contexts = [part('ctx', 'CONTEXT')]
    const session = { id: header.id, header, seq: 7, snapshotEvents: () => events.slice(0, 7), surface: { nodes: [1, 5, 6] } }
    const refs = captureBodyReferences(session, { messages: [system, context] }, sections, contexts, 0)
    const trace = { schemaVersion: 4, records: [{ schemaVersion: 4, id: 'trace', sessionId: header.id, turn: 2, step: 1,
      bodyStorage: 'official-session', sections, contexts, ...refs,
      failureRef: captureFailureReference({ ...session, seq: events.length }, events.at(-1)),
      delivery: { sessionVersion: 3, logCutSeq: 6 }, audit: { authority: { headerEventSeq: null }, activation: { claimEventSeqs: [6] } } }] }
    const tracePath = join(storageDir, 'tavern-trace-records.json')
    writeFileSync(tracePath, JSON.stringify(trace))
    writeFileSync(join(workspace, 'timeline.json'), JSON.stringify({ nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: header.id, startEventId: 6, endEventId: 8, ext: { pmpDshTavern: { sessionFormatVersion: 3 } } }] }] }))
    writeFileSync(join(storageDir, 'import-context-bindings.json'), JSON.stringify({ schemaVersion: 1, sessions: { session: { sessionFormatVersion: 3, claim: { eventSeqs: [6], identity: 'event-seqs:6' }, terminal: { endEventSeq: 8 } } } }))
    const manifest = { dshRoot: root, workspace, storageDir, sessions: [{ source, target, children: [] }], timelines: ['timeline.json'] }
    await assert.rejects(buildCoordinateMap(source, target, root), /Explicit children/)
    const { mapping } = await buildCoordinateMap(source, target, root, [])
    assert.deepEqual(Array.from(mapping), [0, 1, 2, 4, 5, 6, 7, 8, 9])
    assert.equal((await migrateManifest(manifest)).files.length, 3)
    assert.equal(existsSync(tracePath + '.pre-v4-coordinates'), false)
    const bad = structuredClone(trace); bad.records[0].sections[0].reference.messageHash = 'corrupt'
    writeFileSync(tracePath, JSON.stringify(bad))
    await assert.rejects(migrateManifest(manifest, { apply: true }), /Trace body reference/)
    assert.equal(existsSync(join(workspace, 'timeline.json.pre-v4-coordinates')), false)
    writeFileSync(tracePath, JSON.stringify(trace))
    await migrateManifest(manifest, { apply: true })
    const upgraded = JSON.parse(readFileSync(tracePath)).records[0]
    assert.equal(upgraded.sessionRef.sessionFormatVersion, 4)
    assert.equal(upgraded.sections[0].reference.eventSeq, 6)
    assert.equal(upgraded.failureRef.eventSeq, 9)
    assert.deepEqual(upgraded.audit.activation.claimEventSeqs, [7])
    const read = createAssemblyBodyReader({ inspect: async () => ({ meta: artifact.header, events: artifact.events }) })
    const nativeSections = [part('system', 'SYSTEM😀')], nativeContexts = [part('ctx', 'CONTEXT')]
    const native = { id: header.id, header: artifact.header, seq: artifact.events.length, surface: { nodes: [6, 7] }, snapshotEvents: () => artifact.events }
    const nativeRefs = captureBodyReferences(native, { messages: [artifact.events[6].data.message, artifact.events[7].data] }, nativeSections, nativeContexts, 0)
    assert.equal(nativeRefs.sessionRef.sessionFormatVersion, 4)
    assert.equal(nativeContexts[0].reference.eventSeq, 7)
    assert.equal(captureFailureReference(native, artifact.events.at(-1)).sessionRef.sessionFormatVersion, 4)
    const cold = await read(upgraded)
    assert.equal(cold.sections[0].text, 'SYSTEM😀')
    assert.equal(cold.contexts[0].text, 'CONTEXT')
    assert.equal(cold.failure.message, 'kept error')
    assert.deepEqual(JSON.parse(readFileSync(tracePath + '.pre-v4-coordinates')), trace)
    assert.deepEqual((await migrateManifest(manifest, { apply: true })).files, [])

    assert.deepEqual(readFileSync(source), sourceBytes); assert.deepEqual(readFileSync(target), targetBytes)
    // Child catalog facts are derived from retained logs, never copied from the target.
    const childPath = join(directory, 'child.v3.jsonl')
    const childHeader = { ...header, id: 'child', parentSession: header.id, origin: 'subagent', createdAt: 2, delegationDepth: 1 }
    writeRows(childPath, [v3.encodeHeader(childHeader, 0)])
    const withChildren = createSessionFormatCatalogWithChildren([{ childId: 'child', childCreatedAt: 2, descriptorCount: 0, descriptor: null }])
      .createRestore(oldRows[0], { recovery: 'strict', validation: 'current' })
    for (const row of oldRows.slice(1)) withChildren.decodeRow(row)
    const parent = withChildren.finish()
    writeRows(target, [v4.encodeHeader(parent.header, parent.inheritedEventCount), ...parent.events.map(v4.encodeEvent)])
    assert.equal(parent.events.at(-1).type, 'subagent/catalog')
    assert.deepEqual(Array.from((await buildCoordinateMap(source, target, root, [childPath])).mapping), Array.from(mapping))
    await assert.rejects(buildCoordinateMap(source, target, root, [childPath, childPath]), /unique direct children/)
    writeRows(childPath, [v3.encodeHeader({ ...childHeader, createdAt: 3 }, 0)])
    await assert.rejects(buildCoordinateMap(source, target, root, [childPath]), /not the verified migration successor/)
    writeRows(childPath, [v3.encodeHeader({ ...childHeader, parentSession: 'wrong-parent' }, 0)])
    await assert.rejects(buildCoordinateMap(source, target, root, [childPath]), /unique direct children/)

  } finally { rmSync(directory, { recursive: true, force: true }) }
})
