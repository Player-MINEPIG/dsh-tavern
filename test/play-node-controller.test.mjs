import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'

function fixture() {
  return {
    nodes: [{
      id: 'qa-1',
      kind: 'qa',
      hidden: false,
      displayOverride: null,
      adoptedVariantId: 'v-1',
      variants: [
        { id: 'v-1', sessionId: 'session-1', startEventId: 1, endEventId: 3 },
        { id: 'v-2', sessionId: 'session-2', startEventId: 1, endEventId: 3 },
      ],
    }],
  }
}

test('node controller rereads and serializes display-only metadata writes', async () => {
  let timeline = fixture()
  let writes = 0
  let active = 0
  let maximum = 0
  const client = {
    async getTimeline() { return structuredClone(timeline) },
    async putTimeline(_playthrough, next) {
      writes += 1
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise(resolve => setImmediate(resolve))
      timeline = structuredClone(next)
      active -= 1
    },
  }
  const controller = createPlayNodeController(client)
  await Promise.all([
    controller.setHidden({}, 'qa-1', true),
    controller.setDisplayOverride({}, 'qa-1', 'display only'),
  ])
  assert.equal(writes, 2)
  assert.equal(maximum, 1)
  assert.equal(timeline.nodes[0].hidden, true)
  assert.equal(timeline.nodes[0].displayOverride, 'display only')
  assert.throws(() => controller.setDisplayOverride({}, 'qa-1', 42), /string or null/)
})

test('adopt writes the pointer, verifies focus, and returns navigation only after success', async () => {
  let timeline = fixture()
  const calls = []
  const client = {
    async getTimeline() { calls.push('read'); return structuredClone(timeline) },
    async putTimeline(_playthrough, next) { calls.push('write'); timeline = structuredClone(next) },
    async getFocus() {
      calls.push('focus')
      const node = timeline.nodes[0]
      return { sessionId: node.variants.find(item => item.id === node.adoptedVariantId).sessionId }
    },
  }
  const result = await createPlayNodeController(client).adoptVariant({}, 'qa-1', 'v-2')
  assert.deepEqual(calls, ['read', 'write', 'focus'])
  assert.equal(result.sessionId, 'session-2')
  assert.equal(timeline.nodes[0].adoptedVariantId, 'v-2')

  await assert.rejects(
    createPlayNodeController({ ...client, async getFocus() { return { sessionId: 'wrong' } } })
      .adoptVariant({}, 'qa-1', 'v-1'),
    /does not match/,
  )
})

test('failed writes never request focus', async () => {
  let focusReads = 0
  const controller = createPlayNodeController({
    async getTimeline() { return fixture() },
    async putTimeline() { throw new Error('disk full') },
    async getFocus() { focusReads += 1; return { sessionId: 'session-2' } },
  })
  await assert.rejects(controller.adoptVariant({}, 'qa-1', 'v-2'), /disk full/)
  assert.equal(focusReads, 0)
})

test('rollback reuses DSH branch validation but keeps every node in the same playthrough', async () => {
  let timeline = {
    nodes: [
      {
        id: 'qa-1', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'v-1',
        variants: [{ id: 'v-1', sessionId: 'session-old', startEventId: 1, endEventId: 2 }],
      },
      {
        id: 'qa-2', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: 'v-1', adoptedVariantId: 'v-2',
        variants: [{ id: 'v-2', sessionId: 'session-old', startEventId: 3, endEventId: 4 }],
      },
    ],
    head: { sessionId: 'session-old', nodeId: 'qa-2', variantId: 'v-2' },
  }
  let branches = 0
  const client = {
    async getTimeline() { return structuredClone(timeline) },
    async postBranch(sessionId, eventId) {
      branches += 1
      assert.deepEqual([sessionId, eventId], ['session-old', 2])
      return { sessionId: 'session-rollback' }
    },
    async getMessages() {
      return { incompleteTurn: false, messages: [
        { role: 'user', seq: 1 }, { role: 'assistant', seq: 2 },
      ] }
    },
    async putTimeline(_playthrough, next) { timeline = structuredClone(next) },
    async getFocus() { return { playthroughId: 'pt', ...timeline.head } },
  }
  const result = await createPlayNodeController(client).rollbackPlaythrough({ id: 'pt' }, 'qa-1')
  assert.equal(branches, 1)
  assert.equal(result.sessionId, 'session-rollback')
  assert.equal(timeline.nodes.length, 2)
  assert.deepEqual(timeline.head, {
    sessionId: 'session-rollback', nodeId: 'qa-1', variantId: 'v-1',
  })
})
