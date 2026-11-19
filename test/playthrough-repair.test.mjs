import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { messagesFromEvents } from '../packages/play/src/sessions.js'
import { variantFormatVersion, withVariantFormat } from '../packages/play/src/session-coordinates.js'
import { repairPlaythroughs } from '../packages/tavern-loader/src/playthrough-repair.js'

function turn(number, reason = 'completed', role = 'both') {
  const user = { id: 'u' + number, role: 'user', content: [{ type: 'text', text: 'private question' }] }
  const reply = { id: 'a' + number, role: 'assistant', content: reason === 'aborted' ? [] : [{ type: 'text', text: 'private reply' }] }
  return [
    { type: 'turn/start', data: { turn: number } },
    ...(role === 'both' ? [{ type: 'user/message', data: user }] : []),
    { type: 'assistant/message', data: { message: reply } },
    { type: 'turn/end', data: { turn: number, reason: { kind: reason } } },
  ]
}

function node(id, sessionId, startEventId, endEventId, marked = false) {
  const variant = { id: id + '-v', sessionId, startEventId, endEventId }
  return { id, kind: 'qa', adoptedVariantId: variant.id, variants: [marked ? withVariantFormat(variant, 4) : variant] }
}

async function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-repair-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const root = join(dir, 'rp')
  mkdirSync(root)
  const store = new PlayWorkspaceStore(join(dir, 'storage'))
  await store.bindRoot(root)
  const sessions = new Map(), rows = []
  const write = (path, data, revision = null) => store.writeFile(path, JSON.stringify(data), { expectedRevisionPresent: true, expectedRevision: revision })
  function add(id, timeline = { nodes: [] }, known = {}) {
    const row = { id, path: id + '/timeline.json', ext: { pmpDshTavern: { rootSessionId: id, ...known } } }
    rows.push(row)
    if (timeline) write(row.path, timeline)
    return row.path
  }
  function record(id, events, inheritedEventCount = 0) {
    sessions.set(id, { meta: { version: 4, id }, inheritedEventCount, events: events.map((e, seq) => ({ ...e, seq })) })
  }
  const dependencies = { store, isDraftProtected: row => row.id === 'draft', getCharacter() {},
    deriveMessages: cut => messagesFromEvents(cut.events), host: {
      async inspectSession(id) {
        if (!sessions.has(id)) throw Object.assign(Error(), { code: 'PLAY_SESSION_NOT_FOUND' })
        return sessions.get(id)
      },
    } }
  const run = options => repairPlaythroughs(dependencies, { agent: { session: { header: { cwd: root } } }, ...options })
  return { root, store, add, record, write, dependencies, sessions, run, save: () => write('catalog.json', { playthroughs: rows }) }
}

test('repair backs up exact bytes, reconciles durable new QA and skips inherited events on repeated runs', async t => {
  const w = await workspace(t)
  const path = w.add('head')
  w.record('head', [...turn(1), ...turn(2)], 4)
  w.save()
  const original = w.store.readFile(path).content
  const preview = await w.run({ apply: false })
  assert.equal(preview.items[0].changes[0].added, 1)
  assert.equal(w.store.readFile(path).content, original)
  assert.deepEqual(readdirSync(join(w.root, 'head')), ['timeline.json'])
  const report = await w.run()
  assert.equal(readFileSync(join(w.root, report.items[0].backup), 'utf8'), original)
  const [qa] = JSON.parse(w.store.readFile(path).content).nodes
  assert.equal(qa.variants[0].startEventId, 5)
  assert.equal(variantFormatVersion(qa.variants[0]), 4)
  assert.doesNotMatch(JSON.stringify(report), /private/)
  assert.deepEqual((await w.run()).items, [])
  assert.equal(readdirSync(join(w.root, 'head')).length, 2)
})

test('only explicitly scoped V3/V4 origins can stamp intact endpoints before a possible shift', async t => {
  const w = await workspace(t)
  const timeline = { nodes: [node('safe', 'a', 1, 2), node('shift', 'a', 5, 6)] }
  const path = w.add('a', timeline)
  const other = w.add('b', { nodes: [node('unknown', 'b', 1, 2)] })
  w.record('a', [...turn(1, 'interrupted'), ...turn(2)])
  w.record('b', turn(1))
  w.save()
  const original = w.store.readFile(other)
  assert.equal((await w.run()).items[0].remaining[0].reason, 'unknown-coordinate-origin')
  await assert.rejects(w.run({ v3v4: true }), /ID/)
  const [item] = (await w.run({ id: 'a', v3v4: true })).items
  assert.deepEqual(item.changes, [{ kind: 'format-marker', nodeId: 'safe', variantId: 'safe-v' }])
  assert.equal(item.remaining[0].reason, 'possible-v3-offset')
  assert.deepEqual(JSON.parse(w.store.readFile(path).content).nodes.map(n => variantFormatVersion(n.variants[0])), [4, undefined])
  assert.deepEqual(w.store.readFile(other), original)
  assert.deepEqual((await w.run({ id: 'a', v3v4: true })).items[0].changes, [])
})

test('repair reports missing evidence, card, timeline, import coordinates and protected runs independently', async t => {
  const w = await workspace(t)
  w.add('missing-file', null)
  w.add('missing-session')
  w.add('draft')
  w.add('archived', null, { archivedAt: '2026-01-01T00:00:00.000Z' })
  w.add('old', { nodes: [node('uncertain', 'old', 1, 2)] }, { characterId: 'missing' })
  w.record('old', [...turn(1), { type: 'system/message', data: { message: { id: 'v2-to-v3-system-' + 'a'.repeat(64) } } }])
  w.dependencies.getCharacter = () => { throw Object.assign(Error(), { code: 'CHARACTER_NOT_FOUND' }) }
  w.dependencies.host.getImportContextBinding = () => ({ claim: {}, sessionFormatVersion: 3 })
  w.save()
  const { items } = await w.run()
  assert.deepEqual(items.map(item => item.remaining[0].reason), ['PLAY_PATH_NOT_FOUND', 'PLAY_SESSION_NOT_FOUND', 'pending-draft', 'archived', 'CHARACTER_NOT_FOUND'])
  const old = (await w.run({ id: 'old', v3v4: true })).items[0]
  assert.deepEqual(old.remaining.map(issue => issue.reason), ['CHARACTER_NOT_FOUND', 'earlier-format', 'import-coordinates'])
  assert.equal(old.backup, undefined)
})

test('repair handles continuations, proven bodyless cancelled leaves and leaves interrupted history alone', async t => {
  const w = await workspace(t)
  const paths = new Map()
  for (const id of ['continued', 'stopped', 'open', 'interrupted']) {
    const timeline = { nodes: [node('existing', id, 1, 2, true)] }
    paths.set(id, w.add(id, timeline))
  }
  w.record('continued', [...turn(1), ...turn(2, 'completed', 'assistant')])
  w.record('stopped', turn(1, 'aborted'))
  w.record('open', [...turn(1), ...turn(2).slice(0, -1)])
  w.record('interrupted', [...turn(1), ...turn(2, 'interrupted')])
  w.save()
  const { items } = await w.run()
  assert.equal(items[0].changes[0].extended, true)
  assert.equal(items[1].changes[0].removed, 1)
  assert.equal(JSON.parse(w.store.readFile(paths.get('stopped')).content).nodes.length, 0)
  assert.deepEqual(items.slice(2).map(i => i.remaining[0].reason), ['turn-in-progress', 'unverified-turn'])
  assert.deepEqual((await w.run()).items.map(i => i.id), ['open', 'interrupted'])
})

test('repair refuses stale reads and calls from another workspace', async t => {
  const w = await workspace(t)
  const path = w.add('changed')
  w.record('changed', turn(1))
  w.save()
  await assert.rejects(w.run({ agent: { session: { header: { cwd: tmpdir() } } } }), /工作区/)
  w.dependencies.host.inspectSession = async id => {
    w.write(path, { nodes: [], ext: { other: true } }, w.store.readFile(path).revision)
    return w.sessions.get(id)
  }
  const [item] = (await w.run()).items
  assert.deepEqual(item.remaining, [{ reason: 'PLAY_FILE_REVISION_CONFLICT' }])
  assert.deepEqual(item.changes, [])
  assert.deepEqual(readdirSync(join(w.root, 'changed')), ['timeline.json'])
})

test('a matching version cannot hide a missing endpoint or a non-unique message identity', async t => {
  const w = await workspace(t)
  w.add('missing-endpoint', { nodes: [node('broken', 'missing-endpoint', 0, 2, true)] })
  w.record('missing-endpoint', turn(1))
  w.add('reused-id')
  w.record('reused-id', [...turn(1), ...turn(1)])
  w.save()
  const { items } = await w.run()
  assert.deepEqual(items.map(item => item.remaining[0].reason), ['unverified-message-range', 'unverified-message-range'])
  assert.ok(items.every(item => !item.backup && !item.changes.length))
})
