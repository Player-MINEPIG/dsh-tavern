import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sessionCoordinates, requireCoordinates, validateTimelineCoordinates } from '../packages/play/src/session-coordinates.js'
import { migrateTimelineCoordinates, migrateImportCoordinates } from '../packages/play/src/coordinate-migration.js'
import { TavernTraceRecorder, TavernTraceStore } from '../packages/tavern-trace/src/index.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
import { ImportContextRuntime } from '../packages/tavern-loader/src/import-context-runtime.js'
import { appendCompletedTurns } from '../packages/client/src/play/turns.js'

const migrated = { meta: { version: 3 }, events: [{ type: 'system/message', data: { message: { id: 'v2-to-v3-system-' + 'a'.repeat(64) } } }] }
const timeline = () => ({ nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [
  { id: 'v', sessionId: 's', startEventId: 2, endEventId: 4 },
  { id: 'swipe', sessionId: 'child', startEventId: 4, endEventId: 6 },
] }], head: { sessionId: 's', nodeId: 'qa', variantId: 'v' }, ext: { thirdParty: 'preserved' } })
const maps = new Map([['s', [0, 1, 3, 5, 6, 7, 8]], ['child', [0, 1, 3, 5, 6, 7, 8]]])

test('migrated, unversioned coordinates refuse; native V3 and explicit matching versions work', async () => {
  const current = sessionCoordinates(migrated)
  assert.throws(() => requireCoordinates(undefined, current), { code: 'PLAY_COORDINATES_MIGRATION_REQUIRED' })
  assert.throws(() => requireCoordinates(2, current), { code: 'PLAY_COORDINATES_MIGRATION_REQUIRED' })
  requireCoordinates(3, current)
  requireCoordinates(undefined, sessionCoordinates({ meta: { version: 3 }, events: [] }))
  await assert.rejects(validateTimelineCoordinates(timeline(), async () => current), { code: 'PLAY_COORDINATES_MIGRATION_REQUIRED' })
  await validateTimelineCoordinates(migrateTimelineCoordinates(timeline(), maps), async () => current)
})

test('migration remaps every swipe without changing IDs, head, or external ext; repeat is idempotent', () => {
  const source = timeline(), copy = structuredClone(source)
  const next = migrateTimelineCoordinates(source, maps)
  assert.deepEqual(source, copy)
  assert.deepEqual(next.head, source.head)
  assert.deepEqual(next.ext, source.ext)
  assert.deepEqual(next.nodes[0].variants.map(v => [v.id, v.startEventId, v.endEventId]), [['v',3,6],['swipe',6,8]])
  assert.equal(next.nodes[0].variants[1].ext.pmpDshTavern.sessionFormatVersion, 3)
  assert.deepEqual(migrateTimelineCoordinates(next, maps), next)
  assert.throws(() => migrateTimelineCoordinates(source, new Map([['s', maps.get('s')]])), /Missing Session mapping/)
  assert.throws(() => migrateTimelineCoordinates(source, new Map([['s', [0]], ['child', [0]]])), /No verified/)
})

test('import claims, terminal and parent lineage coordinates migrate with their owning Session', () => {
  const state = { schemaVersion: 1, sessions: {
    s: { state: 'consumed', hash: 'keep', claim: { eventSeqs: [2], identity: 'event-seqs:2' }, terminal: { endEventSeq: 6 } },
    child: { state: 'pending', lineage: { sourceSessionId: 's', sourceEndEventSeq: 6, forkEventSeq: 4, sourceClaimIdentity: 'event-seqs:2' } },
  } }
  const next = migrateImportCoordinates(state, maps)
  assert.equal(next.sessions.s.claim.identity, 'event-seqs:3')
  assert.deepEqual(next.sessions.s.claim.eventSeqs, [3])
  assert.equal(next.sessions.s.terminal.endEventSeq, 8)
  assert.equal(next.sessions.child.lineage.forkEventSeq, 6)
  assert.equal(next.sessions.child.lineage.sourceEndEventSeq, 8)
  assert.equal(next.sessions.child.lineage.sourceClaimIdentity, 'event-seqs:3')
  assert.equal(next.sessions.s.hash, 'keep')
  assert.deepEqual(migrateImportCoordinates(next, maps), next)
})

test('Host refuses an old client fork before invoking the controller', async () => {
  let calls = 0
  const host = createPlayHost({ sessionController: { inspect: async () => migrated, fork: async () => { calls++; return { sessionId: 'child' } } } })
  await assert.rejects(host.forkSession({ sessionId: 's', atSeq: 4 }), { code: 'PLAY_COORDINATES_MIGRATION_REQUIRED' })
  assert.equal(calls, 0)
  await host.forkSession({ sessionId: 's', atSeq: 6, sessionFormatVersion: 3 })
  assert.equal(calls, 1)
})

test('new completed turns carry the observed Session coordinate version', () => {
  const result = appendCompletedTurns({ nodes: [] }, { sessionFormatVersion: 3, incompleteTurn: false, messages: [
    { role: 'user', seq: 3 }, { role: 'assistant', seq: 6 },
  ] }, 's')
  assert.equal(result.timeline.nodes[0].variants[0].ext.pmpDshTavern.sessionFormatVersion, 3)
})

test('V3 Trace reads the effective system surface, including replaced, reused, and cleared prompts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tavern-trace-v3-'))
  try {
    const recorder = new TavernTraceRecorder(new TavernTraceStore(directory))
    let text = 'OLD'
    const header = { config: { temperature: 0.25 } }
    const events = [{ type: 'request/header', seq: 4, data: { header } }]
    const session = { id: 's', header: { version: 3 }, seq: 5, snapshotEvents: () => events,
      requestHeader: () => header,
      deriveMessages: () => text === '' ? [] : [{ role: 'system', content: [{ type: 'text', text }] }],
    }
    const begin = step => recorder.begin({ agent: { id: 's', session }, turn: 1, step, snapshot: { systemText: 'NEW', callConfig: { temperature: 0.25 } } })
    begin(1); text = 'NEW'
    const first = recorder.observeSessionEvent(session, events[0])
    assert.equal(first.authority.tavernProfilePresent, true)
    assert.equal(first.authority.systemSource, 'system/message')
    assert.equal(first.authority.tavernCallConfigApplied, true)
    begin(2)
    assert.equal(recorder.observeSessionEvent(session, { type: 'assistant/message', data: { turn: 1, step: 2 } }).authority.tavernProfilePresent, true)
    begin(3); text = ''
    assert.equal(recorder.observeSessionEvent(session, { type: 'assistant/message', data: { turn: 1, step: 3 } }).authority.tavernProfilePresent, false)
    assert.equal(JSON.stringify(recorder.store.list('s')).includes('NEW'), false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test('an assembly rejection preserves an old claimed import binding at turn end', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-import-coordinate-'))
  try {
    const runtime = new ImportContextRuntime(dir, {})
    runtime.state.sessions.s = { state: 'claimed', sessionFormatVersion: 0, claim: { eventSeqs: [2], identity: 'event-seqs:2' } }
    const before = structuredClone(runtime.state)
    const session = { header: { version: 3 }, events: migrated.events }
    assert.equal(runtime.consumeAfterTurn('s', { type: 'turn/end', seq: 9, data: { turn: 1 } }, session), false)
    assert.deepEqual(runtime.state, before)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
