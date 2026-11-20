import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createCreationService } from '../packages/play/src/creation.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'play-creation-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const root = join(dir, 'rp'); mkdirSync(root)
  const storage = join(dir, 'storage'), store = new PlayWorkspaceStore(storage)
  await store.bindRoot(root)
  const row = { id: 'run', path: 'card/run/timeline.json', ext: { pmpDshTavern: { characterId: 'card' } } }
  const options = { expectedRevision: null, expectedRevisionPresent: true }
  store.writeFile('catalog.json', JSON.stringify({ playthroughs: [row] }), options)
  const variant = (id, sessionId, startEventId, endEventId) => ({ id, sessionId, startEventId, endEventId, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } })
  const node = (id, ...variants) => ({ id, kind: 'qa', adoptedVariantId: variants.at(-1).id, variants })
  const timeline = { nodes: [node('q1', variant('v1', 'ancestor', 0, 1)),
    node('q2', variant('v2a', 'ancestor', 2, 3), variant('v2b', 'source', 2, 3)),
    node('q3', variant('v3', 'source', 4, 5))] }
  const file = store.writeFile(row.path, JSON.stringify(timeline), options)
  const req = { nodeId: 'q2', creationId: 'fork-action', expectedWorkspaceScope: JSON.stringify([null, root]), expectedRevision: file.revision }
  const calls = [], events = [0, 1, 2, 3, 4, 5].map(seq => {
    const role = seq % 2 ? 'assistant' : 'user'
    return { seq, type: role + '/message', data: { message: { role, id: 'message-' + seq } } }
  })
  let forks = 0
  const host = {
    coordinates: async () => ({ sessionFormatVersion: 4 }),
    async forkSession(input, { operation }) {
      assert.deepEqual(input, { sessionId: 'source', atSeq: 3, sessionFormatVersion: 4 })
      const sessionId = 'child-' + ++forks
      operation.checkpoint('session.created', { sessionId })
      return { sessionId }
    },
    inspectSession: async id => ({ meta: { id, version: 4 }, events: id.startsWith('child') ? events.slice(0, 4) : events,
      inheritedEventCount: id.startsWith('child') ? 4 : 0 }),
    async copySelection() { calls.push('selection') },
    async copyImportContextLineage() { calls.push('lineage') },
  }
  const service = createCreationService(store, host)
  const reopen = () => createCreationService(new PlayWorkspaceStore(storage), host)
  return { store, service, reopen, row, req, host, calls, forks: () => forks, timeline }
}

test('fork publishes one verified prefix, preserving native and source identities; replay survives a newer fork and Host restart', async t => {
  const f = await fixture(t)
  const first = await f.service.run('run', f.req)
  assert.equal(first.playthrough.title, '2周目')
  assert.deepEqual(first.timeline.nodes.map(node => node.id), ['q1', 'q2'])
  assert.deepEqual(first.timeline.nodes.map(node => node.variants.map(v => v.sessionId)), [['ancestor'], ['ancestor', 'child-1']])
  assert.deepEqual(first.timeline.head, { nodeId: 'q2', variantId: 'v2b', sessionId: 'child-1' })
  assert.deepEqual(JSON.parse(f.store.readFile(f.row.path).content), f.timeline)
  assert.equal((await f.reopen().run('run', { ...f.req, creationId: 'another' })).playthrough.title, '3周目')
  assert.equal((await f.reopen().run('run', f.req)).playthrough.id, first.playthrough.id)
  assert.deepEqual(f.calls, ['selection', 'lineage', 'selection', 'lineage'])
  assert.equal(f.forks(), 2)
})

for (const failedFile of ['timeline.json', 'catalog.json']) {
  test('interrupted ' + failedFile + ' writes recover over restart without another child or losing concurrent catalog additions', async t => {
    const f = await fixture(t)
    f.store.beforeRename = ({ absolute }) => { if (absolute.endsWith('/' + failedFile)) throw Error('simulated failure') }
    await assert.rejects(f.service.run('run', f.req), /simulated failure/)
    const service = f.reopen()
    const inspected = await service.repair(f.row, { apply: false })
    assert.equal(inspected.remaining[0].stage, 'ready')
    const file = f.store.readFile('catalog.json')
    f.store.beforeRename = null
    f.store.writeFile('catalog.json', JSON.stringify({ playthroughs: [f.row,
      { id: 'race', path: 'card/race/timeline.json', ext: { pmpDshTavern: { characterId: 'card', playthroughNumber: 7 } } }] }),
      { expectedRevision: file.revision, expectedRevisionPresent: true })
    const changes = []
    const result = await service.repair(f.row, { apply: true, beforeWrite: (file, path) => changes.push([path, file?.revision]) })
    assert.deepEqual(result.remaining, [])
    assert.equal(changes.at(-1)[0], 'catalog.json')
    assert.equal((await service.run('run', f.req)).playthrough.title, '8周目')
    assert.equal(f.forks(), 1)
    assert.deepEqual(f.calls, ['selection', 'lineage'])
  })
}

test('unknown native result or incomplete Host setup is reported on preview, repair, retry and a new action', async t => {
  for (const known of [false, true]) {
    const f = await fixture(t)
    let attempts = 0
    f.host.forkSession = async (_, { operation }) => {
      attempts++
      if (known) operation.checkpoint('session.created', { sessionId: 'saved-child' })
      throw Error('native completion unknown')
    }
    await assert.rejects(f.service.run('run', f.req, { operationId: 'traced', checkpoint() {} }), /native completion unknown/)
    const service = f.reopen()
    for (const apply of [false, true]) {
      const report = await service.repair(f.row, { apply })
      assert.equal(report.remaining[0].stage, known ? 'created' : 'starting')
      if (known) assert.equal(report.remaining[0].sessionId, 'saved-child')
    }
    for (const creationId of ['fork-action', 'next']) await assert.rejects(service.run('run', { ...f.req, creationId }), { code: 'PLAY_CREATION_PENDING' })
    assert.throws(() => service.dismiss('run', 'wrong-id', f.req.expectedWorkspaceScope))
    assert.throws(() => service.dismiss('run', 'traced', 'another workspace'))
    service.dismiss('run', 'traced', f.req.expectedWorkspaceScope)
    await assert.rejects(service.run('run', f.req), { code: 'PLAY_CREATION_DISMISSED' })
    assert.equal(attempts, 1)
    assert.deepEqual(JSON.parse(f.store.readFile('catalog.json').content).playthroughs, [f.row])
  }
})

test('mismatched child message identity never publishes a timeline', async t => {
  const f = await fixture(t)
  const inspect = f.host.inspectSession
  f.host.inspectSession = async id => {
    const log = structuredClone(await inspect(id))
    if (id.startsWith('child')) log.events[3].data.message.id = 'different-reply'
    return log
  }
  await assert.rejects(f.service.run('run', f.req), { code: 'PLAY_CREATION_CONFLICT' })
  assert.equal((await f.reopen().repair(f.row, { apply: true })).remaining[0].code, 'PLAY_CREATION_CONFLICT')
  assert.equal(f.forks(), 1)
  assert.deepEqual(f.store.list('card').list.map(x => x.path), ['card/run'])
})

test('stalled preflight expires before writes and cannot submit a late native call', async t => {
  const f = await fixture(t), gate = Promise.withResolvers(), started = Promise.withResolvers()
  const timer = setInterval(() => {}, 100); t.after(() => clearInterval(timer))
  const service = createCreationService(f.store, f.host, { waitMs: 30 })
  f.host.coordinates = async () => { started.resolve(); return gate.promise }
  const first = service.run('run', f.req)
  await started.promise
  await assert.rejects(first, { code: 'PLAY_CREATION_PREFLIGHT_STOPPED' })
  assert.equal(await service.repair(f.row, { apply: false }), null)
  gate.resolve({ sessionFormatVersion: 4 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.forks(), 0)
  assert.equal((await service.run('run', f.req)).sessionId, 'child-1')
})

test('timeout during native fork keeps unknown outcomes visible, then saves a late child for explicit repair', async t => {
  const f = await fixture(t), gate = Promise.withResolvers(), started = Promise.withResolvers()
  const timer = setInterval(() => {}, 100); t.after(() => clearInterval(timer))
  const service = createCreationService(f.store, f.host, { waitMs: 25 })
  const fork = f.host.forkSession
  f.host.forkSession = async (...args) => { started.resolve(); await gate.promise; return fork(...args) }
  const first = service.run('run', f.req)
  await started.promise
  await assert.rejects(first, { code: 'PLAY_CREATION_PENDING' })
  assert.equal((await service.repair(f.row, { apply: true })).remaining[0].code, 'PLAY_CREATION_BUSY')
  await assert.rejects(service.run('run', f.req), { code: 'PLAY_CREATION_BUSY' })
  assert.throws(() => service.dismiss('run', f.req.creationId, f.req.expectedWorkspaceScope), { code: 'PLAY_CREATION_BUSY' })
  gate.resolve()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal((await service.repair(f.row, { apply: false })).remaining[0].stage, 'forked')
  assert.equal(JSON.parse(f.store.readFile('catalog.json').content).playthroughs.length, 1)
  assert.deepEqual((await f.reopen().repair(f.row, { apply: true })).remaining, [])
  assert.equal(f.forks(), 1)
})

test('stale visible reply and changed workspace are rejected before the fork', async t => {
  const f = await fixture(t)
  await assert.rejects(f.service.run('run', { ...f.req, variantId: 'v2a' }), { code: 'PLAY_CREATION_CONFLICT' })
  await assert.rejects(f.service.run('run', { ...f.req, expectedWorkspaceScope: 'old' }), { code: 'PLAY_WORKSPACE_CHANGED' })
  assert.equal(f.forks(), 0)
})

test('a failed lineage copy reuses the known child and completed selection copy', async t => {
  const f = await fixture(t)
  f.host.copyImportContextLineage = async () => { throw Error('lineage unavailable') }
  await assert.rejects(f.service.run('run', f.req), { code: 'PLAY_BRANCH_COPY_FAILED' })
  assert.equal((await f.service.repair(f.row, { apply: false })).remaining[0].stage, 'selection-copied')
  f.host.copyImportContextLineage = async () => f.calls.push('lineage')
  assert.deepEqual((await f.reopen().repair(f.row, { apply: true })).remaining, [])
  assert.deepEqual(f.calls, ['selection', 'lineage'])
  assert.equal(f.forks(), 1)
})

test('a child used natively while publication was interrupted is preserved for manual inspection', async t => {
  const f = await fixture(t)
  f.store.beforeRename = () => { throw Error('catalog unavailable') }
  await assert.rejects(f.service.run('run', f.req), /catalog unavailable/)
  const inspect = f.host.inspectSession
  f.host.inspectSession = async id => {
    const log = await inspect(id)
    if (id.startsWith('child')) log.events.push({ seq: 4, type: 'turn/start', data: { turn: 2 } })
    return log
  }
  const repair = await f.reopen().repair(f.row, { apply: true })
  assert.equal(repair.remaining[0].code, 'PLAY_CREATION_CONFLICT')
  assert.equal(f.forks(), 1)
  assert.equal(JSON.parse(f.store.readFile('catalog.json').content).playthroughs.length, 1)
})
