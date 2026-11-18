#!/usr/bin/env node
// Offline, explicit historical reference migration. Never writes a DSH session log.
import { readFileSync, writeFileSync, renameSync, unlinkSync, lstatSync, existsSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import * as zlib from 'node:zlib'
import { normalizeTimeline } from '../packages/play/src/timeline.js'
import { variantFormatVersion, withVariantFormat } from '../packages/play/src/session-coordinates.js'
import { migrateTimelineCoordinates, migrateImportCoordinates } from '../packages/play/src/coordinate-migration.js'
import { migrateTraceCoordinates } from '../packages/tavern-trace/src/coordinate-migration.js'
import { resolvePlayPath, assertSafeRoot } from '../packages/play/src/paths.js'

const help = `Usage: node scripts/migrate-session-coordinates.mjs --manifest <json> [--stamp-only] [--apply]

Stop DSH before --apply. The default only validates and previews changes.
Manifest: { "dshRoot": "/path/to/dsh-install", "workspace": "/path/to/rp",
  "storageDir": "/path/to/DSH_HOME/pmp-dsh-tavern",
  "sessions": [{ "source": "/path/session.v3.jsonl.zstd", "target": "/path/session.v4.jsonl.zstd", "children": [] }],
  "timelines": ["character/playthrough/timeline.json"] }

Use a DSH 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3 or 0.2.2-rc.1 installation. Each source/target pair must belong to the
same Session. Sources may use format V0, V1, V2, or V3. Unversioned references in each listed file must use the source log format.
Include every Session owning coordinates, including import lineage parents.
Raw JSONL and .zstd are supported. Original plugin files are backed up next to
the file as .pre-v4-coordinates; reruns skip references already marked V4.
Each pair must supply children: an explicit complete list of retained direct-child
log paths (or [] when none are available). Trace references are upgraded too.
With --stamp-only, use { dshRoot, workspace, timeline, sessions: [{ target }],
  variants: [{ nodeId, variantId, sessionId, userMessageId, assistantMessageId }] }.
Supply independently verified message IDs for each variant; see docs/DSH_0.1.7_MIGRATION_en.md.
DSH logs and unrelated plugin data are never rewritten.
`

function readLogRows(path, evidence) {
  if (!lstatSync(path).isFile()) throw new Error(`Expected a regular log file: ${path}`)
  let bytes = readFileSync(path)
  evidence.set(path, bytes)
  if (path.endsWith('.zstd')) {
    // DSH appends independent zstd frames. Node's sync API decodes only the
    // first frame; consume every frame, including the final strict EOF check.
    const frames = []
    for (let offset = 0; offset < bytes.length;) {
      const decoded = zlib.zstdDecompressSync(bytes.subarray(offset), { info: true })
      const consumed = decoded.engine.bytesWritten
      if (!Number.isSafeInteger(consumed) || consumed <= 0) throw new Error('Invalid compressed log frame')
      frames.push(decoded.buffer)
      offset += consumed
    }
    bytes = Buffer.concat(frames)
  }
  return bytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))
}

export async function buildCoordinateMap(sourcePath, targetPath, dshRoot, children) {
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const manifest = require('@deepseek-ai/dsh-session-format-v3-to-v4/package.json')
  // Explicitly verified codec releases; later prereleases may change migration semantics.
  if (!['0.1.7-alpha.1', '0.1.7-alpha.2', '0.1.7-rc.1', '0.2.0-rc.2', '0.2.1-rc.2', '0.2.1-rc.3', '0.2.2-rc.1'].includes(manifest.version)) {
    throw new Error(`Migration requires DSH format library 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3 or 0.2.2-rc.1; found ${manifest.version}`)
  }
  const { releasedV2SessionFormatCodec, releasedV3SessionFormatCodec, sessionFormatV2ToV3 } = await load('@deepseek-ai/dsh-session-format-v2-to-v3')
  const { releasedV0SessionFormatCodec, releasedV1SessionFormatCodec, sessionFormatV0ToV1 } = await load('@deepseek-ai/dsh-session-format-v0-to-v1')
  const { sessionFormatV1ToV2 } = await load('@deepseek-ai/dsh-session-format-v1-to-v2')
  const { SessionFormatEventCollector } = await load('@deepseek-ai/dsh-session-format')
  const { createSessionFormatCatalogWithChildren, historicalSessionFormatCatalog } = await load('@deepseek-ai/dsh-session-format-catalog')
  const { createSessionFormatV3ToV4, releasedV4SessionFormatCodec, historicalChildCatalogSource } = await load('@deepseek-ai/dsh-session-format-v3-to-v4')
  if (!Array.isArray(children) || children.some(path => typeof path !== 'string')) throw new Error('Explicit children log paths are required (use [] when none are available)')
  const evidence = new Map()
  function decode(rows, codec) {
    const decoder = codec.createDecoder(rows[0], 'strict')
    const collector = new SessionFormatEventCollector()
    for (const row of rows.slice(1)) decoder.decodeRow(row, collector)
    const inheritedEventCount = decoder.finish(collector)
    return { header: decoder.header, events: collector.values, inheritedEventCount }
  }
  const oldRows = readLogRows(sourcePath, evidence), newRows = readLogRows(targetPath, evidence)
  const sourceVersion = oldRows[0].version
  if (![0, 1, 2, 3].includes(sourceVersion) || newRows[0].version !== 4) throw new Error('Expected a V0/V1/V2/V3 source and V4 target')
  const source = decode(oldRows, [releasedV0SessionFormatCodec, releasedV1SessionFormatCodec, releasedV2SessionFormatCodec, releasedV3SessionFormatCodec][sourceVersion])
  const target = decode(newRows, releasedV4SessionFormatCodec)
  if (source.header.id !== target.header.id) throw new Error('Source and target Session IDs differ')
  // The official catalog verifies framing, vocabulary, surface, and lineage.
  const restore = (rows, catalog) => {
    const reader = catalog.createRestore(rows[0], { recovery: 'strict', validation: 'current' })
    for (const row of rows.slice(1)) reader.decodeRow(row)
    return reader.finish()
  }
  const childIds = new Set()
  const facts = children.map(path => {
    const childRows = readLogRows(resolve(path), evidence)
    const catalog = childRows[0].version === 4 ? createSessionFormatCatalogWithChildren([]) : historicalSessionFormatCatalog
    const child = restore(childRows, catalog)
    if (child.header.parentSession !== source.header.id || childIds.has(child.header.id)) throw new Error('Child evidence must identify unique direct children of the source Session')
    childIds.add(child.header.id)
    return historicalChildCatalogSource(child)
  })
  const catalog = createSessionFormatCatalogWithChildren(facts)
  const expected = restore(oldRows, catalog)
  const validatedTarget = restore(newRows, catalog)
  if (!isDeepStrictEqual(expected.header, validatedTarget.header)
    || expected.inheritedEventCount !== validatedTarget.inheritedEventCount
    || !isDeepStrictEqual(expected.events, validatedTarget.events.slice(0, expected.events.length))) {
    throw new Error(`V4 log is not the verified migration successor of ${source.header.id}`)
  }
  let artifact = source
  let mapping = source.events.map(event => event.seq)
  for (const migration of [sessionFormatV0ToV1, sessionFormatV1ToV2, sessionFormatV2ToV3, createSessionFormatV3ToV4(facts)].slice(sourceVersion)) {
    const header = migration.migrateHeader(artifact.header)
    const stage = migration.createStage({ sourceHeader: artifact.header, targetHeader: header,
      sourceInheritedEventCount: artifact.inheritedEventCount,
      sourceKind: artifact === source ? 'decoded' : 'transformed' })
    const collector = new SessionFormatEventCollector(), adjacent = []
    for (const event of artifact.events) {
      const start = collector.values.length
      stage.transformEvent(event, collector)
      if (migration.fromVersion === 3) {
        // Official V3→V4 emits an optional interrupted closer, then exactly the
        // transformed source event. finish() only appends child catalog facts.
        const emitted = collector.values.slice(start)
        if (emitted.length < 1 || emitted.length > 2
          || (emitted.length === 2 && (emitted[0].type !== 'turn/end' || emitted[0].data?.reason?.kind !== 'interrupted'))) throw new Error('Unexpected V3→V4 migration emission')
        adjacent[event.seq] = emitted.at(-1).seq
      } else if (migration.fromVersion !== 1) {
        // V0→V1 retains one event. V2→V3 only inserts system/message.
        const originals = collector.values.slice(start).filter(item => item.type !== 'system/message')
        if (originals.length !== 1) throw new Error('Unexpected migration emission')
        adjacent[event.seq] = originals[0].seq
      }
    }
    const inheritedEventCount = stage.finish(collector)
    if (migration.fromVersion === 1) {
      // V1 chunks collapse and buffered events can move. Only map Tavern's
      // retained message/terminal coordinates by unique, normalized identities.
      // Never infer a coordinate for removed chunks or arbitrary events.
      const identity = event => {
        const id = event.type === 'user/message' ? event.data.id
          : event.type === 'assistant/message' ? event.data.message?.id
            : event.type === 'turn/end' ? event.data.turn : undefined
        return id === undefined ? null : JSON.stringify([event.type, id, event.time])
      }
      const index = events => {
        const result = new Map()
        for (const event of events) {
          const key = identity(event)
          if (key !== null) result.set(key, result.has(key) ? null : event.seq)
        }
        return result
      }
      const before = index(artifact.events), after = index(collector.values)
      for (const event of artifact.events) {
        const key = identity(event), next = after.get(key)
        if (key !== null && before.get(key) === event.seq && Number.isSafeInteger(next)) adjacent[event.seq] = next
      }
    }
    mapping = mapping.map(seq => seq === undefined ? undefined : adjacent[seq])
    artifact = { header, events: collector.values, inheritedEventCount }
  }
  if (!isDeepStrictEqual(artifact, expected)) throw new Error('Migration mapping differs from the validated catalog output')
  mapping.sourceVersion = sourceVersion
  mapping.targetVersion = 4
  mapping.sourceArtifact = source
  mapping.targetArtifact = validatedTarget
  mapping.evidence = evidence
  return { sessionId: source.header.id, mapping }

}

function publishPlans(plans, evidence, backupSuffix) {
  const checkEvidence = () => {
    for (const entries of evidence) for (const [path, bytes] of entries) {
      if (!lstatSync(path).isFile() || !readFileSync(path).equals(bytes)) throw new Error('Session log changed while planning; stop DSH and retry')
    }
  }
  checkEvidence()
  for (const item of plans) {
    if (readFileSync(item.path, 'utf8') !== item.original) throw new Error('Plugin file changed while planning; stop DSH and retry')
    const backup = item.path + backupSuffix
    if (existsSync(backup) && (!lstatSync(backup).isFile() || readFileSync(backup, 'utf8') !== item.original)) throw new Error(`Conflicting backup: ${backup}`)
  }
  for (const item of plans) {
    const backup = item.path + backupSuffix
    if (!existsSync(backup)) writeFileSync(backup, item.original, { flag: 'wx', mode: 0o600 })
  }
  // Retain every pre-upgrade plugin file before publishing the first change.
  for (const item of plans) {
    checkEvidence()
    const temporary = item.path + `.coordinate-migration-${process.pid}.tmp`
    try {
      writeFileSync(temporary, item.content, { flag: 'wx', mode: 0o600 })
      if (!lstatSync(item.path).isFile() || readFileSync(item.path, 'utf8') !== item.original) throw new Error('Plugin file changed before commit')
      renameSync(temporary, item.path)
    } finally { if (existsSync(temporary)) unlinkSync(temporary) }
  }
}

// A missing marker cannot identify a coordinate generation. The operator supplies
// independent endpoint message identities for each selected node and variant.
export async function stampTimelineManifest(manifest, { apply = false } = {}) {
  const { workspace, timeline, sessions, variants, dshRoot } = manifest
  if (typeof timeline !== 'string' || timeline.split('/').at(-1) !== 'timeline.json'
    || !Array.isArray(sessions) || !sessions.length || !Array.isArray(variants) || !variants.length) {
    throw new Error('Expected one timeline.json, V4 sessions and explicit variant message identities')
  }
  const path = resolvePlayPath(resolve(workspace), timeline, { mustExist: true })
  const original = readFileSync(path, 'utf8'), value = JSON.parse(original)
  normalizeTimeline(value)
  const require = createRequire(join(resolve(dshRoot), 'package.json'))
  const { createSessionFormatCatalogWithChildren } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-format-catalog')))
  const catalog = createSessionFormatCatalogWithChildren([])
  const evidence = new Map(), logs = new Map()
  for (const { target } of sessions) {
    const rows = readLogRows(resolve(target), evidence)
    if (rows[0].version !== 4) throw new Error('Stamp-only requires a V4 log')
    const reader = catalog.createRestore(rows[0], { recovery: 'strict', validation: 'current' })
    for (const row of rows.slice(1)) reader.decodeRow(row)
    const artifact = reader.finish()
    if (artifact.header.version !== 4 || logs.has(artifact.header.id)) throw new Error('Unexpected or duplicate Session')
    const messages = new Map()
    for (const event of artifact.events) {
      const message = event.data?.message ?? event.data
      const isUser = message?.role === 'user' && (event.type === 'steering/message'
        || (event.type === 'user/message' && (message.source == null || message.source.kind === 'user')))
      if (!isUser && !(event.type === 'assistant/message' && message?.role === 'assistant')) continue
      if (typeof message.id !== 'string' || !message.id) continue
      // A reused message ID cannot identify a unique endpoint.
      messages.set(message.id, messages.has(message.id) ? null : { role: message.role, seq: event.seq })
    }
    logs.set(artifact.header.id, messages)
  }
  const selected = new Set(), stamped = []
  for (const { nodeId, variantId, sessionId, userMessageId, assistantMessageId } of variants) {
    const node = value.nodes.find(item => item.id === nodeId)
    const index = node?.variants.findIndex(item => item.id === variantId) ?? -1
    const variant = node?.variants[index], messages = logs.get(sessionId)
    const key = JSON.stringify([nodeId, variantId])
    if (!variant || !messages || variant.sessionId !== sessionId || selected.has(key)) {
      throw new Error(`Unknown, duplicate or mismatched variant: ${nodeId}/${variantId}`)
    }
    selected.add(key)
    const user = messages.get(userMessageId), assistant = messages.get(assistantMessageId)
    if (user?.role !== 'user' || user.seq !== variant.startEventId
      || assistant?.role !== 'assistant' || assistant.seq !== variant.endEventId) {
      throw new Error(`V4 message identities do not match ${nodeId}/${variantId}`)
    }
    const version = variantFormatVersion(variant)
    if (version === 4) continue
    if (version !== undefined) throw new Error(`Historical coordinates require migration: ${nodeId}/${variantId}`)
    node.variants[index] = withVariantFormat(variant, 4)
    stamped.push({ nodeId, variantId })
  }
  const remaining = value.nodes.flatMap(node => node.variants.filter(v => variantFormatVersion(v) !== 4)
    .map(v => ({ nodeId: node.id, variantId: v.id })))
  if (apply && stamped.length) {
    publishPlans([{ path, original, content: JSON.stringify(value, null, 2) + '\n' }], [evidence],
      '.pre-v4-stamp-' + createHash('sha256').update(original).digest('hex'))
  }
  return { applied: apply, timeline, stamped, remaining }
}

export async function migrateManifest(manifest, { apply = false } = {}) {
  const workspace = assertSafeRoot(resolve(manifest.workspace))
  const storage = assertSafeRoot(resolve(manifest.storageDir))
  if (!Array.isArray(manifest.sessions) || !Array.isArray(manifest.timelines)) throw new Error('sessions and timelines must be arrays')
  const maps = new Map()
  for (const pair of manifest.sessions) {
    const value = await buildCoordinateMap(resolve(pair.source), resolve(pair.target), manifest.dshRoot, pair.children)
    if (maps.has(value.sessionId)) throw new Error('Duplicate Session mapping')
    maps.set(value.sessionId, value.mapping)
  }
  const plans = [], seen = new Set()
  async function plan(path, transform) {
    if (seen.has(path)) throw new Error('Duplicate migration destination')
    seen.add(path)
    const original = readFileSync(path, 'utf8'), value = JSON.parse(original)
    const next = await transform(value)
    if (!isDeepStrictEqual(value, next)) plans.push({ path, original, content: JSON.stringify(next, null, 2) + '\n' })
  }
  for (const relative of manifest.timelines) {
    if (typeof relative !== 'string' || relative.split('/').at(-1) !== 'timeline.json') throw new Error('Expected a relative timeline.json path')
    await plan(resolvePlayPath(workspace, relative, { mustExist: true }), value => migrateTimelineCoordinates(value, maps))
  }
  const bindingPath = resolvePlayPath(storage, 'import-context-bindings.json', { mustExist: false })
  if (existsSync(bindingPath)) await plan(bindingPath, value => migrateImportCoordinates(value, maps))
  for (const name of ['tavern-trace-records.json', 'tavern-assemblies.json', 'tavern-traces.json']) {
    const path = resolvePlayPath(storage, name, { mustExist: false })
    if (existsSync(path)) await plan(path, value => migrateTraceCoordinates(value, maps))
  }
  // Validate every input and destination before the first write. Files are
  // individually atomic; version markers make a partially applied run resumable.
  if (apply) publishPlans(plans, [...maps.values()].map(map => map.evidence), '.pre-v4-coordinates')
  return { applied: apply, sessions: [...maps.keys()], files: plans.map(item => item.path) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    if (args.includes('--help') || args.length === 0) console.log(help)
    else {
      const index = args.indexOf('--manifest')
      if (index < 0 || !args[index + 1] || args.some((arg, i) => i !== index + 1 && !['--manifest', '--stamp-only', '--apply'].includes(arg))) throw new Error(help)
      const manifest = JSON.parse(readFileSync(resolve(args[index + 1]), 'utf8'))
      const migrate = args.includes('--stamp-only') ? stampTimelineManifest : migrateManifest
      console.log(JSON.stringify(await migrate(manifest, { apply: args.includes('--apply') }), null, 2))
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
