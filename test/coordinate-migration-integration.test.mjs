import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import * as zlib from 'node:zlib'
import { validateTimelineCoordinates } from '../packages/play/src/session-coordinates.js'
import { buildCoordinateMap, migrateManifest, stampTimelineManifest } from '../scripts/migrate-session-coordinates.mjs'

test('migration refuses unverified format releases before reading or writing session data', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tavern-unverified-codecs-'))
  try {
    const packageDir = join(directory, 'node_modules', '@deepseek-ai', 'dsh-session-format-v3-to-v4')
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ version: '0.1.7-rc.2' }))
    await assert.rejects(buildCoordinateMap('unread-source', 'unread-target', directory, []),
      /Migration requires DSH format library 0\.1\.7-alpha\.1, 0\.1\.7-alpha\.2, 0\.1\.7-rc\.1, 0\.2\.0-rc\.2, 0\.2\.1-rc\.2, 0\.2\.1-rc\.3 or 0\.2\.2-rc\.1; found 0\.1\.7-rc\.2/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

const dshRoot = process.env.DSH_TAVERN_COMPAT_ROOT
test('real DSH codecs validate offline migration, backups, compressed logs, and reruns', { skip: !dshRoot }, async () => {
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { sessionFormatV2ToV3, releasedV2SessionFormatCodec: v2, releasedV3SessionFormatCodec: v3 } = await load('@deepseek-ai/dsh-session-format-v2-to-v3')
  const { createSessionFormatCatalogWithChildren } = await load('@deepseek-ai/dsh-session-format-catalog')
  const { releasedV4SessionFormatCodec: v4 } = await load('@deepseek-ai/dsh-session-format-v3-to-v4')
  const directory = mkdtempSync(join(tmpdir(), 'tavern-coordinate-migration-'))
  try {
    const workspace = join(directory, 'rp'), storageDir = join(directory, 'storage')
    mkdirSync(join(workspace, 'c', 'p'), { recursive: true }); mkdirSync(storageDir)
    const header = { version: 2, id: 'test-session', createdAt: 1, isSeeded: false, delegationDepth: 0 }
    const user = id => ({ type: 'user/message', data: { role: 'user', id, source: { kind: 'user' }, content: [{ type: 'text', text: id }] }, surfaceOp: 'append' })
    const events = [
      { type: 'turn/start', data: { turn: 1 } }, { type: 'step/start', data: { turn: 1, step: 1 } }, user('a'),
      { type: 'request/header', data: { header: { config: { provider: 'mock', model: 'mock' }, system: 'SYSTEM' }, reason: 'initial' } }, user('b'),
    ].map((event, seq) => ({ ...event, seq, time: 42 }))
    const restore = createSessionFormatCatalogWithChildren([]).createRestore(v2.encodeHeader(header, 0), { recovery: 'strict', validation: 'current' })
    for (const event of events) restore.decodeRow(v2.encodeEvent(event))
    const artifact = restore.finish()
    const targetHeader = artifact.header, collector = { values: artifact.events }, cut = artifact.inheritedEventCount
    const jsonl = (header, events) => [header, ...events].map(row => JSON.stringify(row)).join('\n') + '\n'
    const source = join(directory, 'session.v2.jsonl.zstd'), target = join(directory, 'session.v4.jsonl.zstd')
    writeFileSync(source, zlib.zstdCompressSync(jsonl(v2.encodeHeader(header, 0), events.map(v2.encodeEvent))))
    const targetBytes = zlib.zstdCompressSync(jsonl(v4.encodeHeader(targetHeader, cut), collector.values.map(v4.encodeEvent)))
    writeFileSync(target, targetBytes)
    const timeline = { nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: header.id, startEventId: 2, endEventId: 4 }] }] }
    const timelinePath = join(workspace, 'c', 'p', 'timeline.json')
    writeFileSync(timelinePath, JSON.stringify(timeline))
    const bindingPath = join(storageDir, 'import-context-bindings.json')
    writeFileSync(bindingPath, JSON.stringify({ schemaVersion: 1, sessions: { [header.id]: { state: 'claimed', claim: { eventSeqs: [2], identity: 'event-seqs:2' } } } }))
    const manifest = { dshRoot, workspace, storageDir, sessions: [{ source, target, children: [] }], timelines: ['c/p/timeline.json'] }
    assert.equal((await migrateManifest(manifest)).files.length, 2)
    assert.deepEqual(JSON.parse(readFileSync(timelinePath)), timeline)
    const wrong = structuredClone(collector.values)
    wrong.find(event => event.type === 'user/message').data.content[0].text = 'changed'
    writeFileSync(target, zlib.zstdCompressSync(jsonl(v4.encodeHeader(targetHeader, cut), wrong.map(v4.encodeEvent))))
    await assert.rejects(migrateManifest(manifest, { apply: true }), /not the verified migration successor/)
    assert.deepEqual(JSON.parse(readFileSync(timelinePath)), timeline)
    writeFileSync(target, targetBytes)
    await migrateManifest(manifest, { apply: true })
    const variant = JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0]
    assert.deepEqual([variant.startEventId, variant.endEventId], [3, 6])
    assert.equal(variant.ext.pmpDshTavern.sessionFormatVersion, 4)
    assert.equal(JSON.parse(readFileSync(bindingPath)).sessions[header.id].claim.identity, 'event-seqs:3')
    assert.deepEqual(JSON.parse(readFileSync(timelinePath + '.pre-v4-coordinates')), timeline)
    assert.deepEqual((await migrateManifest(manifest, { apply: true })).files, [])
    assert.deepEqual(readFileSync(target), targetBytes)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

for (const version of [0, 1]) test(`real V${version}→V4 migration handles collapsed chunks and appended zstd frames`, { skip: !dshRoot }, async () => {
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const { createSessionFormatCatalogWithChildren } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-catalog')).href)
  const sessionFormatCatalog = createSessionFormatCatalogWithChildren([])
  const { releasedV4SessionFormatCodec: v4 } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-v3-to-v4')).href)
  const directory = mkdtempSync(join(tmpdir(), 'tavern-legacy-coordinates-'))
  try {
    const workspace = join(directory, 'rp'), storageDir = join(directory, 'storage')
    mkdirSync(workspace); mkdirSync(storageDir)
    const header = { type: 'session', version, id: 'legacy-session', createdAt: 1, delegationDepth: 0 }
    const content = [{ type: 'text', text: 'reply' }]
    const chunk = value => ({ type: 'assistant/chunk', data: { turn: 1, step: 1, chunk: value } })
    const events = [
      { type: 'turn/start', data: { turn: 1 } }, { type: 'step/start', data: { turn: 1, step: 1 } },
      { type: 'user/message', data: { role: 'user', id: 'user', source: { kind: 'user' }, content }, surfaceOp: 'append' },
      { type: 'request/header', data: { header: { config: { provider: 'mock', model: 'mock' }, system: 'SYSTEM' }, reason: 'initial' } },
      chunk({ type: 'block-start', index: 0, blockType: 'text' }), chunk({ type: 'text-delta', index: 0, text: 'reply' }),
      chunk({ type: 'block-end', index: 0, block: content[0] }), chunk({ type: 'finish', reason: { kind: 'stop' } }),
      { type: 'assistant/message', data: { turn: 1, step: 1, message: { role: 'assistant', id: 'assistant', content, source: { kind: 'model', provider: 'mock', model: 'mock' } } }, sourceEventSeqs: [4, 5, 6, 7], surfaceOp: 'append' },
      { type: 'step/end', data: { turn: 1, step: 1 } }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ].map((event, seq) => ({ ...event, seq, time: 42 }))
    const restore = sessionFormatCatalog.createRestore(header, { recovery: 'strict', validation: 'current' })
    for (const event of events) restore.decodeRow(event)
    const targetArtifact = restore.finish()
    const compressRows = rows => Buffer.concat(rows.map(row => zlib.zstdCompressSync(JSON.stringify(row) + '\n')))
    const source = join(directory, 'session.jsonl.zstd'), target = join(directory, 'session.v4.jsonl.zstd')
    writeFileSync(source, compressRows([header, ...events]))
    const targetBytes = compressRows([v4.encodeHeader(targetArtifact.header, targetArtifact.inheritedEventCount), ...targetArtifact.events.map(v4.encodeEvent)])
    writeFileSync(target, targetBytes)
    const timelinePath = join(workspace, 'timeline.json')
    writeFileSync(timelinePath, JSON.stringify({ nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: header.id, startEventId: 2, endEventId: 8, ext: { pmpDshTavern: { sessionFormatVersion: version } } }] }] }))
    const bindingPath = join(storageDir, 'import-context-bindings.json')
    writeFileSync(bindingPath, JSON.stringify({ schemaVersion: 1, sessions: { [header.id]: { sessionFormatVersion: version, claim: { eventSeqs: [2], identity: 'event-seqs:2' }, terminal: { endEventSeq: 10 } } } }))
    const manifest = { dshRoot, workspace, storageDir, sessions: [{ source, target, children: [] }], timelines: ['timeline.json'] }
    // A truncated later frame must be rejected, even when its first frame is valid.
    writeFileSync(target, targetBytes.subarray(0, -1))
    await assert.rejects(migrateManifest(manifest, { apply: true }))
    assert.equal(JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0].endEventId, 8)
    writeFileSync(target, targetBytes)
    await migrateManifest(manifest, { apply: true })
    const variant = JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0]
    assert.deepEqual([variant.startEventId, variant.endEventId], [3, 6])
    assert.equal(variant.ext.pmpDshTavern.sessionFormatVersion, 4)
    assert.equal(JSON.parse(readFileSync(bindingPath)).sessions[header.id].terminal.endEventSeq, 8)
    assert.deepEqual((await migrateManifest(manifest, { apply: true })).files, [])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test('migration CLI executes through a symlinked installation path', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tavern-migration-cli-'))
  try {
    const linkedRoot = join(directory, 'plugin')
    symlinkSync(fileURLToPath(new URL('..', import.meta.url)), linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
    const output = execFileSync(process.execPath, [join(linkedRoot, 'scripts/migrate-session-coordinates.mjs'), '--help'], { encoding: 'utf8' })
    assert.match(output, /Usage: node scripts\/migrate-session-coordinates\.mjs/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('stamp-only CLI repairs a verified V4 swipe without a source log or a gated timeline read', { skip: !dshRoot }, async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'tavern-v4-stamp-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const { releasedV4SessionFormatCodec: codec } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-v3-to-v4')))
  const header = { id: 'child', version: 4, createdAt: 1, isSeeded: false, delegationDepth: 0 }
  const content = [{ type: 'text', text: 'fixture' }]
  const events = [
    { type: 'turn/start', data: { turn: 1 } }, { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'user/message', surfaceOp: 'append', data: { id: 'prompt', role: 'user', source: { kind: 'user' }, content } },
    { type: 'assistant/message', surfaceOp: 'append', data: { turn: 1, step: 1, stream: [], message: {
      id: 'reply', role: 'assistant', source: { kind: 'model', provider: 'mock', model: 'mock' }, content,
    } } },
    { type: 'step/end', data: { turn: 1, step: 1 } }, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ].map((event, seq) => ({ ...event, seq, time: 42 }))
  const log = Buffer.concat([codec.encodeHeader(header, 0), ...events.map(codec.encodeEvent)]
    .map(row => zlib.zstdCompressSync(JSON.stringify(row) + '\n')))
  const target = join(workspace, 'session.v4.jsonl.zstd')
  writeFileSync(target, log)
  const marker = { sessionFormatVersion: 4 }
  const variant = { id: 'v', sessionId: 'child', startEventId: 2, endEventId: 3, ext: { external: 'keep', pmpDshTavern: { other: true } } }
  const active = { ...variant, id: 'active', sessionId: 'parent', ext: { pmpDshTavern: marker } }
  const original = { head: { sessionId: 'parent', nodeId: 'qa', variantId: 'active' },
    nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'active', variants: [active, variant] }] }
  const timeline = 'timeline.json', path = join(workspace, timeline)
  const input = JSON.stringify(original)
  writeFileSync(path, input)
  const reference = { nodeId: 'qa', variantId: 'v', sessionId: 'child', userMessageId: 'prompt', assistantMessageId: 'reply' }
  const manifest = { workspace, timeline, dshRoot, sessions: [{ target }], variants: [reference] }
  const manifestPath = join(workspace, 'stamp.json')
  writeFileSync(manifestPath, JSON.stringify(manifest))
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(new URL('../scripts/migrate-session-coordinates.mjs', import.meta.url)),
    '--stamp-only', '--manifest', manifestPath, ...args,
  ]))
  const auto = await stampTimelineManifest({ workspace, timeline, dshRoot, sessions: [{ target }] }, { autoV3V4: true })
  assert.deepEqual(auto.remaining, [])
  const plan = run()
  assert.deepEqual(auto.stamped, plan.stamped)
  assert.deepEqual(plan.stamped, [{ nodeId: 'qa', variantId: 'v' }])
  const backups = () => readdirSync(workspace).filter(name => name.startsWith('timeline.json.pre-v4-stamp-'))
  assert.deepEqual(backups(), [])
  for (const invalid of [[reference, reference], [{ ...reference, sessionId: 'parent' }],
    [reference, { ...reference, variantId: 'unknown' }]]) {
    await assert.rejects(stampTimelineManifest({ ...manifest, variants: invalid }, { apply: true }), /mismatched variant/)
    assert.equal(readFileSync(path, 'utf8'), input)
    assert.deepEqual(backups(), [])
  }
  const stale = structuredClone(original)
  stale.nodes[0].variants[1].ext.pmpDshTavern.sessionFormatVersion = 3
  writeFileSync(path, JSON.stringify(stale))
  await assert.rejects(stampTimelineManifest(manifest, { apply: true }), /require migration/)
  writeFileSync(path, input)
  await assert.rejects(stampTimelineManifest({ ...manifest, variants: [{ ...reference, assistantMessageId: 'wrong' }] },
    { apply: true }), /message identities/)
  assert.deepEqual(run('--apply').remaining, [])
  const expected = structuredClone(original)
  expected.nodes[0].variants[1].ext.pmpDshTavern.sessionFormatVersion = 4
  const repaired = JSON.parse(readFileSync(path))
  assert.deepEqual(repaired, expected)
  await validateTimelineCoordinates(repaired, async () => ({ sessionFormatVersion: 4 }))
  assert.deepEqual(run('--apply').stamped, [])
  assert.equal(backups().length, 1)
  assert.equal(readFileSync(join(workspace, backups()[0]), 'utf8'), input)
  assert.deepEqual(readFileSync(target), log)
})

test('automatic V3/V4 repair distinguishes stable coordinates from an inserted closer and a confirmed V4 suffix', { skip: !dshRoot }, async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'tavern-v3-v4-auto-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { releasedV3SessionFormatCodec: v3, releasedV4SessionFormatCodec: v4 } = await load('@deepseek-ai/dsh-session-format-v3-to-v4')
  const { createSessionFormatCatalogWithChildren } = await load('@deepseek-ai/dsh-session-format-catalog')
  const header = { id: 'session', version: 3, createdAt: 1, isSeeded: false, delegationDepth: 0 }
  const user = turn => ({ role: 'user', id: 'question-' + turn, source: { kind: 'user' }, content: [{ type: 'text', text: 'question' }] })
  const turnEvents = turn => [
    { type: 'turn/start', data: { turn } }, { type: 'step/start', data: { turn, step: 1 } },
    { type: 'user/message', surfaceOp: 'append', data: user(turn) },
    { type: 'assistant/message', surfaceOp: 'append', data: { turn, step: 1, stream: [], message: {
      id: 'reply-' + turn, role: 'assistant', content: [{ type: 'text', text: 'reply' }], source: { kind: 'model', provider: 'mock', model: 'mock' },
    } } },
    { type: 'step/end', data: { turn, step: 1 } }, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } },
  ]
  const original = [...turnEvents(1).slice(0, -1),
    { type: 'agent/inbox/spliced', data: { target: 'next-turn', inserted: [user(2)] } }, ...turnEvents(2)]
  const restore = createSessionFormatCatalogWithChildren([]).createRestore(v3.encodeHeader(header, 0), { recovery: 'strict', validation: 'current' })
  for (const [seq, event] of original.entries()) restore.decodeRow(v3.encodeEvent({ ...event, seq, time: seq + 1 }))
  const converted = restore.finish()
  assert.equal(converted.events[6].data.reason.kind, 'interrupted')
  const events = [...converted.events, ...turnEvents(3).map((event, i) => ({ ...event, seq: i + converted.events.length, time: 50 + i }))]
  const rows = [v4.encodeHeader(converted.header, 0), ...events.map(v4.encodeEvent)]
  const target = join(workspace, 'session.v4.jsonl')
  writeFileSync(target, rows.map(row => JSON.stringify(row)).join('\n'))
  const timeline = 'timeline.json', path = join(workspace, timeline)
  const node = (id, startEventId, endEventId, options = {}) => ({ id, kind: 'qa', adoptedVariantId: id,
    variants: [{ id, sessionId: header.id, startEventId, endEventId, ...options }] })
  const nodes = [node('first', 2, 3), node('second', 9, 10), node('new', 15, 16),
    node('explicit', 2, 3, { ext: { pmpDshTavern: { sessionFormatVersion: 3 } } }),
    node('missing', 2, 3, { sessionId: 'other' }), node('wrong', 0, 1)]
  const input = JSON.stringify({ nodes })
  writeFileSync(path, input)
  const manifest = { dshRoot, workspace, timeline, sessions: [{ target }] }
  const manifestPath = join(workspace, 'manifest.json')
  const run = (...args) => {
    writeFileSync(manifestPath, JSON.stringify(manifest))
    return JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/migrate-session-coordinates.mjs', import.meta.url)),
      '--auto-v3-v4', '--manifest', manifestPath, ...args]))
  }
  const preview = run()
  assert.deepEqual(preview.stamped.map(row => row.variantId), ['first'])
  assert.deepEqual(preview.remaining.map(row => row.reason), ['possible-v3-offset', 'possible-v3-offset', 'explicit-historical-version', 'missing-session-log', 'unverified-message-range'])
  assert.equal(readFileSync(path, 'utf8'), input)
  manifest.sessions[0].postUpgradeUserMessageId = 'reply-3'
  await assert.rejects(stampTimelineManifest(manifest, { autoV3V4: true, apply: true }), /post-upgrade user message/)
  assert.equal(readFileSync(path, 'utf8'), input)
  manifest.sessions[0].postUpgradeUserMessageId = 'question-3'
  assert.deepEqual(run('--apply').stamped.map(row => row.variantId), ['first', 'new'])
  for (const index of [0, 2]) nodes[index].variants[0].ext = { pmpDshTavern: { sessionFormatVersion: 4 } }
  assert.deepEqual(JSON.parse(readFileSync(path)), { nodes })
  assert.deepEqual(run('--apply').stamped, [])
  const backups = readdirSync(workspace).filter(name => name.includes('.pre-v4-stamp-'))
  assert.equal(backups.length, 1)
  assert.equal(readFileSync(join(workspace, backups[0]), 'utf8'), input)
})
