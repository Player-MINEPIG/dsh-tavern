import test from 'node:test'
import assert from 'node:assert/strict'
import { runBranchOperation, repairBranchOperation } from '../packages/client/src/play/branch-recovery.js'

const row = {id: 'source', path: 'card/source/timeline.json'}
const scope = JSON.stringify(['rp', '/rp'])
const variant = {id: 'reply', sessionId: 'parent', startEventId: 0, endEventId: 1, ext: {pmpDshTavern: {sessionFormatVersion: 4}}}
const head = {sessionId: 'parent', nodeId: 'qa', variantId: variant.id}
const initial = {nodes: [{id: 'qa', adoptedVariantId: variant.id, parentVariantId: null, variants: [variant]}], head}
function fixture() {
  const files = new Map(), checkpoints = new Map(), receipts = new Map(), writes = []
  let current, forks = 0, sequence = 0
  const set = (path, content) => files.set(path, {content, revision: String(++sequence)})
  set(row.path, JSON.stringify(initial))
  set('catalog.json', JSON.stringify({playthroughs: [row]}))
  const client = {
    getWorkspace: () => ({workspaceId: 'rp', rootPath: '/rp'}),
    getCheckpoint: (_, __, key) => key ? checkpoints.get(key) ?? null : current ?? null,
    putCheckpoint: (_, request) => {
      if (request.expectedTimelineRevision) assert.equal(request.expectedTimelineRevision, files.get(row.path).revision)
      assert.equal(current && !current.released ? current.revision : null, request.expectedRevision)
      current = {...request, revision: (current?.revision ?? 0) + 1}
      checkpoints.set(current.key, current)
      return current
    },
    getSessionEvidence: id => ({sessionId: id, sessionFormatVersion: 4, inheritedEventCount: id === 'parent' ? 0 : 2,
      endpoints: [{seq: 0, id: 'q', role: 'user'}, {seq: 1, id: 'a', role: 'assistant'}]}),
    getSessionReceipt: key => receipts.get(key) ?? {state: 'missing'},
    postBranch: async (_, __, ___, ____, options) => {
      assert.equal(options.checkpointId, row.id)
      assert.equal(options.checkpointKey, current.key)
      forks++
      receipts.set(options.operationKey, {state: 'done', result: {sessionId: 'child-' + forks}})
    },
    getFile(path) {
      if (!files.has(path)) throw Object.assign(Error('missing'), {code: 'PLAY_PATH_NOT_FOUND'})
      return files.get(path)
    },
    putFile(path, content, options) {
      assert.equal(options.checkpointId, row.id)
      assert.equal(options.checkpointKey, current.key)
      assert.equal(options.expectedRevision, files.get(path)?.revision ?? null)
      writes.push(path)
      set(path, content)
    },
    getFocus: row => JSON.parse(files.get(row.path).content).head,
  }
  return {client, files, set, writes, forks: () => forks}
}

for (const kind of ['fork', 'rollback']) {
  test(kind + ' composes atomic calls and recovers a lost branch acknowledgement after a client restart', async () => {
    const f = fixture()
    const native = f.client.postBranch
    f.client.postBranch = async (...args) => { await native(...args); throw Error('lost acknowledgement') }
    const request = {kind, nodeId: 'qa', creationId: 'first'}
    await assert.rejects(runBranchOperation(f.client, row, request), /lost acknowledgement/)
    const cp = f.client.getCheckpoint(row, scope)
    const repair = {...f.client, postBranch: assert.fail}
    const next = structuredClone(initial)
    next.nodes[0].displayOverride = 'edited'
    f.set(row.path, JSON.stringify(next))
    const backups = []
    assert.equal((await repairBranchOperation(repair, row, cp, {apply: false})).changes.length, 1)
    assert.deepEqual(f.writes, [])
    const report = await repairBranchOperation(repair, row, cp, {apply: true, beforeWrite: (_, p) => backups.push(p)})
    assert.deepEqual(report.remaining, [])
    assert.deepEqual(backups, f.writes)
    const result = await runBranchOperation(f.client, row, request)
    assert.equal(result.timeline.nodes[0].displayOverride, 'edited')
    assert.equal(result.timeline.head.sessionId, 'child-1')
    assert.equal(f.forks(), 1)
  })
}

test('unconfirmed native outcome preserves the checkpoint without issuing a second fork', async () => {
  const f = fixture()
  f.client.postBranch = async () => { throw Error('disconnected before result') }
  await assert.rejects(runBranchOperation(f.client, row, {kind: 'fork', nodeId: 'qa', creationId: 'first'}))
  const cp = f.client.getCheckpoint(row, scope)
  for (const state of ['missing', 'pending']) {
    const client = {...f.client, getSessionReceipt: () => ({state}), postBranch: assert.fail}
    const report = await repairBranchOperation(client, row, cp, {apply: true})
    assert.equal(report.remaining[0].operationId, cp.key)
  }
  assert.deepEqual(f.writes, [])
})

test('repair rejects a child whose inherited question has the same coordinate but a different ID', async () => {
  const f = fixture()
  const evidence = f.client.getSessionEvidence
  f.client.getSessionEvidence = id => {
    const result = evidence(id)
    if (id !== 'parent') result.endpoints[0].id = 'unrelated'
    return result
  }
  await assert.rejects(runBranchOperation(f.client, row, {kind: 'rollback', nodeId: 'qa', creationId: 'first'}))
  assert.deepEqual(f.writes, [])
})
