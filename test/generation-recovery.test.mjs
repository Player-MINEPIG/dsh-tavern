import assert from 'node:assert/strict'
import test from 'node:test'
import { runGenerationOperation, repairGenerationOperation } from '../packages/client/src/play/generation-recovery.js'

const row = { id: 'one', path: 'card/one/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'root' } } }
const scope = '["rp","rp-root"]'
function fixture({ retry = false, later = false } = {}) {
  const variant = (id, start, end) => ({ id, sessionId: 'root', startEventId: start, endEventId: end, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } })
  const node = (id, v, parent) => ({ id, kind: 'qa', variants: [v], adoptedVariantId: v.id, parentVariantId: parent })
  const nodes = [...(later ? [node('first', variant('v1', 1, 2), null)] : []),
    ...(retry ? [] : [node('target', variant('v2', later ? 5 : 1, later ? 6 : 2), later ? 'v1' : null)])]
  let timeline = { nodes }
  if (nodes.length) timeline.head = { nodeId: nodes.at(-1).id, variantId: nodes.at(-1).adoptedVariantId, sessionId: 'root' }
  let checkpoint, revision = 1
  const receipts = new Map(), log = []
  const action = { action: 'start', operationKey: 'key', expectedWorkspaceScope: scope, ...(retry
    ? { kind: 'request-retry', sessionId: 'root', userEventId: later ? 5 : 1 }
    : { kind: 'reply-swipe', nodeId: 'target', variantId: 'v2' }) }
  const persistChild = (operation, options) => {
    assert.equal(checkpoint.data.stage, 'creating')
    assert.equal(options.checkpointKey, 'key')
    assert.equal(options.checkpointId, row.id)
    assert.equal(options.expectedWorkspaceScope, scope)
    assert.ok(!receipts.has(options.operationKey))
    const result = { sessionId: 'child' }
    receipts.set(options.operationKey, { state: 'done', result }); log.push(operation)
    return result
  }
  const client = {
    getFile: async () => ({ revision: String(revision), content: JSON.stringify(timeline) }),
    async putFile(path, content, options) {
      assert.equal(path, row.path)
      assert.equal(options.expectedRevision, String(revision))
      assert.equal(options.checkpointId, row.id)
      assert.equal(options.checkpointKey, checkpoint.key)
      timeline = JSON.parse(content); revision++
    },
    getCoordinates: async () => ({ sessionFormatVersion: 4 }),
    getMessages: async () => ({ messages: [{ seq: later ? 5 : 1, role: 'user', origin: { kind: 'user' }, content: [{ type: 'text', text: 'private input' }] }],
      incompleteTurn: false, stoppedRequest: retry ? { userEventId: later ? 5 : 1 } : null, sessionFormatVersion: 4 }),
    getImportContextBinding: async () => null,
    getSessionReceipt: async key => receipts.get(key) ?? { state: 'missing' },
    getCheckpoint: async (_row, _scope, key) => key && key !== checkpoint?.key ? null : checkpoint,
    async putCheckpoint(_row, options) {
      assert.equal(options.expectedRevision, checkpoint?.revision ?? null)
      if (!checkpoint) assert.equal(options.expectedTimelineRevision, String(revision))
      assert.equal(options.expectedWorkspaceScope, scope)
      checkpoint = JSON.parse(JSON.stringify({ owner: options.owner, data: options.data, key: options.key,
        revision: (checkpoint?.revision ?? 0) + 1, released: options.released === true }))
      return checkpoint
    },
    postBranch: async (_id, at, version, _state, opts) => {
      assert.equal(at, 2); assert.equal(version, 4); return persistChild('branch', opts)
    },
    postSession: async (_id, _ref, _state, opts) => persistChild('session', opts),
    async postUserMessage(id, text, options) {
      assert.equal(checkpoint.data.stage, 'sending')
      assert.equal(text, 'private input'); assert.equal(id, 'child')
      assert.equal(options.operationKey, options.requestId)
      assert.equal(options.checkpointKey, 'key')
      assert.ok(!receipts.has(options.operationKey))
      receipts.set(options.operationKey, {state:'done', result:{accepted:true}}); log.push('send')
    },
    async getRequestOutcome(id, opts) {
      assert.equal(id, 'child'); assert.equal(opts.stage, 'accepted')
      assert.equal(opts.boundary, later ? 2 : -1); assert.equal(opts.version, 4)
      assert.ok(receipts.has(opts.requestId)); return { state:'ready', start: later ? 5 : 1, end: later ? 6 : 2, version:4 }
    },
  }
  return { client, action, log, checkpoint: () => checkpoint, edit() { timeline.label = 'keep edit'; revision++ } }
}

for (const retry of [false, true]) for (const later of [false, true]) test('atomic generation composes ' +
  (later ? 'branch' : 'session create') + ', request and CAS publication for ' + (retry ? 'retry' : 'swipe'), async () => {
  const f = fixture({ retry, later })
  const {client, action} = f
  await runGenerationOperation(client,row,action)
  f.edit()
  assert.doesNotMatch(JSON.stringify(f.checkpoint()), /private input/)
  const reopened = { ...client }
  const status = await runGenerationOperation(reopened, row, { ...action, action:'status' })
  assert.equal(status.state,'ready')
  const preview = await repairGenerationOperation(reopened, row, f.checkpoint(), { apply: false })
  assert.equal(preview.changes[0].kind, 'generation-recovered')
  const backups = []
  await repairGenerationOperation(reopened,row,f.checkpoint(), { apply:true,beforeWrite:(file,path)=>backups.push([file.revision,path]) })
  assert.deepEqual(backups,[['2',row.path]])
  const result = await runGenerationOperation(reopened,row,{...action,action:'finish'})
  assert.equal(result.timeline.label,'keep edit')
  assert.equal(result.timeline.head.sessionId,'child')
  assert.equal(result.timeline.nodes.at(-1).variants.length,retry ? 1 : 2)
  assert.deepEqual(f.log,[later?'branch':'session','send'])
})

test('lost native acknowledgements use the same receipt; repair never starts a native request', async () => {
  const f = fixture()
  const { client, action } = f
  const lose = { ...client, async postSession(...args) { await client.postSession(...args); throw Error('connection lost') } }
  await assert.rejects(runGenerationOperation(lose,row,action),/connection lost/)
  const report = await repairGenerationOperation(client,row,f.checkpoint(),{apply:true})
  assert.equal(report.remaining[0].reason,'generation-pending')
  assert.deepEqual(f.log,['session'])
  await runGenerationOperation(client,row,action)
  await runGenerationOperation(client,row,action)
  assert.deepEqual(f.log,['session','send'])
})
