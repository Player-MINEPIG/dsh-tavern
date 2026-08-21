import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'

function timelineFixture() {
  return {
    nodes: [{
      id: 'qa-1',
      kind: 'qa',
      hidden: false,
      displayOverride: null,
      adoptedVariantId: 'v-1',
      variants: [{ id: 'v-1', sessionId: 'session-old', startEventId: 1, endEventId: 3 }],
    }],
  }
}

test('reply swipe branches, resends the real user text, waits, then atomically adopts', async () => {
  let timeline = timelineFixture()
  let polls = 0
  const calls = []
  const client = {
    async getTimeline() { calls.push('timeline'); return structuredClone(timeline) },
    async getMessages(sessionId) {
      calls.push(`messages:${sessionId}`)
      if (sessionId === 'session-old') {
        return {
          incompleteTurn: false,
          messages: [
            { role: 'user', seq: 1, text: 'Original user prompt' },
            { role: 'assistant', seq: 3, text: 'Old answer' },
          ],
        }
      }
      polls += 1
      return polls === 1
        ? { incompleteTurn: true, messages: [{ role: 'user', seq: 1, text: 'Original user prompt' }] }
        : { incompleteTurn: false, messages: [
          { role: 'user', seq: 1, text: 'Original user prompt' },
          { role: 'assistant', seq: 4, text: 'New answer' },
        ] }
    },
    async postBranch(sessionId, atEventId) {
      calls.push(`branch:${sessionId}:${atEventId}`)
      return { sessionId: 'session-new' }
    },
    async postUserMessage(sessionId, text) {
      calls.push(`prompt:${sessionId}:${text}`)
      return { accepted: true }
    },
    async putTimeline(_playthrough, next) { calls.push('write'); timeline = structuredClone(next) },
    async getFocus() { calls.push('focus'); return { sessionId: 'session-new' } },
  }
  const controller = createPlayNodeController(client, {
    delay: async () => { calls.push('delay') },
    maxPolls: 3,
    idFactory: () => 'variant-new',
  })
  const result = await controller.createReplySwipe({ path: 'timeline.json' }, 'qa-1')

  assert.equal(result.sessionId, 'session-new')
  assert.equal(timeline.nodes[0].adoptedVariantId, 'variant-new')
  assert.deepEqual(timeline.nodes[0].variants[1], {
    id: 'variant-new',
    sessionId: 'session-new',
    startEventId: 1,
    endEventId: 4,
  })
  assert.deepEqual(calls, [
    'timeline',
    'messages:session-old',
    'branch:session-old:0',
    'prompt:session-new:Original user prompt',
    'messages:session-new',
    'delay',
    'messages:session-new',
    'timeline',
    'write',
    'focus',
  ])
})

test('branch 409 and wait timeout leave timeline metadata untouched', async () => {
  const original = timelineFixture()
  let writes = 0
  const common = {
    async getTimeline() { return structuredClone(original) },
    async getMessages(sessionId) {
      return sessionId === 'session-old'
        ? { incompleteTurn: false, messages: [{ role: 'user', seq: 1, text: 'Prompt' }] }
        : { incompleteTurn: false, messages: [] }
    },
    async postUserMessage() { return { accepted: true } },
    async putTimeline() { writes += 1 },
  }
  await assert.rejects(
    createPlayNodeController({
      ...common,
      async postBranch() { const error = new Error('open turn'); error.status = 409; throw error },
    }).createReplySwipe({}, 'qa-1'),
    /open turn/,
  )
  assert.equal(writes, 0)

  await assert.rejects(
    createPlayNodeController({
      ...common,
      async postBranch() { return { sessionId: 'session-new' } },
    }, { delay: async () => {}, maxPolls: 2 }).createReplySwipe({}, 'qa-1'),
    /Timed out/,
  )
  assert.equal(writes, 0)
})

test('reply swipe refuses context injection even though its model-facing role is user', async () => {
  let branchCalls = 0
  const client = {
    async getTimeline() { return timelineFixture() },
    async getMessages() {
      return { incompleteTurn: false, messages: [
        {
          role: 'user', seq: 1, text: 'Background subagent report',
          origin: { kind: 'context', producer: 'subagent-report' },
        },
        { role: 'assistant', seq: 3, text: 'Parent acknowledgement', origin: { kind: 'assistant' } },
      ] }
    },
    async postBranch() { branchCalls += 1; return { sessionId: 'must-not-branch' } },
  }
  await assert.rejects(
    createPlayNodeController(client).createReplySwipe({}, 'qa-1'),
    /no reusable user message/,
  )
  assert.equal(branchCalls, 0)
})
