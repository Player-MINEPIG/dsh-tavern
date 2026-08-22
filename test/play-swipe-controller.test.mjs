import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'

function timelineFixture() {
  return {
    nodes: [{
      id: 'qa-1',
      kind: 'qa',
      displayOverride: null,
      adoptedVariantId: 'v-1',
      variants: [{ id: 'v-1', sessionId: 'session-old', startEventId: 1, endEventId: 3 }],
    }],
  }
}

function twoTurnTimelineFixture() {
  return {
    nodes: [
      timelineFixture().nodes[0],
      {
        id: 'qa-2',
        kind: 'qa',
        displayOverride: null,
        parentVariantId: 'v-1',
        adoptedVariantId: 'v-2',
        variants: [{ id: 'v-2', sessionId: 'session-old', startEventId: 4, endEventId: 6 }],
      },
    ],
    head: { sessionId: 'session-old', nodeId: 'qa-2', variantId: 'v-2' },
  }
}

test('reply swipe branches, resends the real user text, waits, then atomically adopts', async () => {
  let timeline = twoTurnTimelineFixture()
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
            { role: 'user', seq: 1, text: 'Earlier user prompt' },
            { role: 'assistant', seq: 3, text: 'Earlier answer' },
            { role: 'user', seq: 4, text: 'Original user prompt' },
            { role: 'assistant', seq: 6, text: 'Old answer' },
          ],
        }
      }
      polls += 1
      return polls === 1
        ? { incompleteTurn: true, messages: [{ role: 'user', seq: 4, text: 'Original user prompt' }] }
        : { incompleteTurn: false, messages: [
          { role: 'user', seq: 4, text: 'Original user prompt' },
          { role: 'assistant', seq: 7, text: 'New answer' },
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
  const result = await controller.createReplySwipe({ path: 'timeline.json' }, 'qa-2')

  assert.equal(result.sessionId, 'session-new')
  assert.equal(timeline.nodes[1].adoptedVariantId, 'variant-new')
  assert.deepEqual(timeline.head, {
    sessionId: 'session-new', nodeId: 'qa-2', variantId: 'variant-new',
  })
  assert.deepEqual(timeline.nodes[1].variants[1], {
    id: 'variant-new',
    sessionId: 'session-new',
    startEventId: 4,
    endEventId: 7,
  })
  assert.deepEqual(calls, [
    'timeline',
    'messages:session-old',
    'branch:session-old:3',
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
  const original = twoTurnTimelineFixture()
  let writes = 0
  const common = {
    async getTimeline() { return structuredClone(original) },
    async getMessages(sessionId) {
      return sessionId === 'session-old'
        ? { incompleteTurn: false, messages: [{ role: 'user', seq: 4, text: 'Prompt' }] }
        : { incompleteTurn: false, messages: [] }
    },
    async postUserMessage() { return { accepted: true } },
    async putTimeline() { writes += 1 },
  }
  await assert.rejects(
    createPlayNodeController({
      ...common,
      async postBranch() { const error = new Error('open turn'); error.status = 409; throw error },
    }).createReplySwipe({}, 'qa-2'),
    /open turn/,
  )
  assert.equal(writes, 0)

  await assert.rejects(
    createPlayNodeController({
      ...common,
      async postBranch() { return { sessionId: 'session-new' } },
    }, { delay: async () => {}, maxPolls: 2 }).createReplySwipe({}, 'qa-2'),
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

test('retrying a context output swipes the nearest preceding real user turn', async () => {
  let timeline = {
    nodes: [
      {
        id: 'qa-human', kind: 'qa', displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'v-human',
        variants: [{ id: 'v-human', sessionId: 'session-old', startEventId: 1, endEventId: 2 }],
      },
      {
        id: 'qa-context', kind: 'qa', displayOverride: null,
        parentVariantId: 'v-human', adoptedVariantId: 'v-context',
        variants: [{ id: 'v-context', sessionId: 'session-old', startEventId: 3, endEventId: 4 }],
      },
    ],
    head: { sessionId: 'session-old', nodeId: 'qa-context', variantId: 'v-context' },
  }
  const calls = []
  const client = {
    async getTimeline() { return structuredClone(timeline) },
    async getMessages(sessionId) {
      if (sessionId === 'session-new') return { incompleteTurn: false, messages: [
        { role: 'user', seq: 1, text: 'Human prompt', origin: { kind: 'user' } },
        { role: 'assistant', seq: 5, text: 'Retry' },
      ] }
      return { incompleteTurn: false, messages: [
        { role: 'user', seq: 1, text: 'Human prompt', origin: { kind: 'user' } },
        { role: 'assistant', seq: 2, text: 'First' },
        { role: 'user', seq: 3, text: 'Injected', origin: { kind: 'context' } },
        { role: 'assistant', seq: 4, text: 'Final' },
      ] }
    },
    async postSession(sessionId, importContextRef) {
      calls.push(['session', sessionId, importContextRef])
      return { sessionId: 'session-new' }
    },
    async postUserMessage(_sessionId, text) { calls.push(text) },
    async putTimeline(_playthrough, value) { timeline = structuredClone(value) },
    async getFocus() { return { sessionId: 'session-new' } },
  }
  await createPlayNodeController(client, { idFactory: () => 'v-retry' })
    .createReplySwipe({}, 'qa-context')
  assert.deepEqual(calls, [['session', 'session-old', undefined], 'Human prompt'])
  assert.equal(timeline.nodes[0].adoptedVariantId, 'v-retry')
  assert.equal(timeline.nodes[1].adoptedVariantId, 'v-context')
  assert.deepEqual(timeline.head, {
    sessionId: 'session-new', nodeId: 'qa-human', variantId: 'v-retry',
  })
})
