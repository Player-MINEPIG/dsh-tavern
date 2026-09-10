import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import * as zlib from 'node:zlib'
import { migrateManifest } from '../scripts/migrate-session-coordinates.mjs'

const dshRoot = process.env.DSH_TAVERN_COMPAT_ROOT
test('real 0.1.5 codecs validate offline migration, backups, compressed logs, and reruns', { skip: !dshRoot }, async () => {
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { sessionFormatV2ToV3, releasedV2SessionFormatCodec: v2, releasedV3SessionFormatCodec: v3 } = await load('@deepseek-ai/dsh-session-format-v2-to-v3')
  const { SessionFormatEventCollector } = await load('@deepseek-ai/dsh-session-format')
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
    const targetHeader = sessionFormatV2ToV3.migrateHeader(header), collector = new SessionFormatEventCollector()
    const stage = sessionFormatV2ToV3.createStage({ sourceHeader: header, targetHeader, sourceInheritedEventCount: 0, sourceKind: 'decoded' })
    for (const event of events) stage.transformEvent(event, collector)
    const cut = stage.finish(collector)
    const jsonl = (header, events) => [header, ...events].map(row => JSON.stringify(row)).join('\n') + '\n'
    const source = join(directory, 'session.v2.jsonl.zstd'), target = join(directory, 'session.v3.jsonl.zstd')
    writeFileSync(source, zlib.zstdCompressSync(jsonl(v2.encodeHeader(header, 0), events.map(v2.encodeEvent))))
    const targetBytes = zlib.zstdCompressSync(jsonl(v3.encodeHeader(targetHeader, cut), collector.values.map(v3.encodeEvent)))
    writeFileSync(target, targetBytes)
    const timeline = { nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: header.id, startEventId: 2, endEventId: 4 }] }] }
    const timelinePath = join(workspace, 'c', 'p', 'timeline.json')
    writeFileSync(timelinePath, JSON.stringify(timeline))
    const bindingPath = join(storageDir, 'import-context-bindings.json')
    writeFileSync(bindingPath, JSON.stringify({ schemaVersion: 1, sessions: { [header.id]: { state: 'claimed', claim: { eventSeqs: [2], identity: 'event-seqs:2' } } } }))
    const manifest = { dshRoot, workspace, storageDir, sessions: [{ source, target }], timelines: ['c/p/timeline.json'] }
    assert.equal((await migrateManifest(manifest)).files.length, 2)
    assert.deepEqual(JSON.parse(readFileSync(timelinePath)), timeline)
    const wrong = structuredClone(collector.values)
    wrong.find(event => event.type === 'user/message').data.content[0].text = 'changed'
    writeFileSync(target, zlib.zstdCompressSync(jsonl(v3.encodeHeader(targetHeader, cut), wrong.map(v3.encodeEvent))))
    await assert.rejects(migrateManifest(manifest, { apply: true }), /not the verified migration successor/)
    assert.deepEqual(JSON.parse(readFileSync(timelinePath)), timeline)
    writeFileSync(target, targetBytes)
    await migrateManifest(manifest, { apply: true })
    const variant = JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0]
    assert.deepEqual([variant.startEventId, variant.endEventId], [3, 6])
    assert.equal(variant.ext.pmpDshTavern.sessionFormatVersion, 3)
    assert.equal(JSON.parse(readFileSync(bindingPath)).sessions[header.id].claim.identity, 'event-seqs:3')
    assert.deepEqual(JSON.parse(readFileSync(timelinePath + '.pre-v3-coordinates')), timeline)
    assert.deepEqual((await migrateManifest(manifest, { apply: true })).files, [])
    assert.deepEqual(readFileSync(target), targetBytes)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

for (const version of [0, 1]) test(`real V${version}→V3 migration handles collapsed chunks and appended zstd frames`, { skip: !dshRoot }, async () => {
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const { sessionFormatCatalog } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-catalog')).href)
  const { releasedV3SessionFormatCodec: v3 } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-v2-to-v3')).href)
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
    const source = join(directory, 'session.jsonl.zstd'), target = join(directory, 'session.v3.jsonl.zstd')
    writeFileSync(source, compressRows([header, ...events]))
    const targetBytes = compressRows([v3.encodeHeader(targetArtifact.header, targetArtifact.inheritedEventCount), ...targetArtifact.events.map(v3.encodeEvent)])
    writeFileSync(target, targetBytes)
    const timelinePath = join(workspace, 'timeline.json')
    writeFileSync(timelinePath, JSON.stringify({ nodes: [{ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: header.id, startEventId: 2, endEventId: 8, ext: { pmpDshTavern: { sessionFormatVersion: version } } }] }] }))
    const bindingPath = join(storageDir, 'import-context-bindings.json')
    writeFileSync(bindingPath, JSON.stringify({ schemaVersion: 1, sessions: { [header.id]: { sessionFormatVersion: version, claim: { eventSeqs: [2], identity: 'event-seqs:2' }, terminal: { endEventSeq: 10 } } } }))
    const manifest = { dshRoot, workspace, storageDir, sessions: [{ source, target }], timelines: ['timeline.json'] }
    // A truncated later frame must be rejected, even when its first frame is valid.
    writeFileSync(target, targetBytes.subarray(0, -1))
    await assert.rejects(migrateManifest(manifest, { apply: true }))
    assert.equal(JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0].endEventId, 8)
    writeFileSync(target, targetBytes)
    await migrateManifest(manifest, { apply: true })
    const variant = JSON.parse(readFileSync(timelinePath)).nodes[0].variants[0]
    assert.deepEqual([variant.startEventId, variant.endEventId], [3, 6])
    assert.equal(variant.ext.pmpDshTavern.sessionFormatVersion, 3)
    assert.equal(JSON.parse(readFileSync(bindingPath)).sessions[header.id].terminal.endEventSeq, 8)
    assert.deepEqual((await migrateManifest(manifest, { apply: true })).files, [])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
