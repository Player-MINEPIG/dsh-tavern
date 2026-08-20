import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendCompletedTurns,
  createTurnReconciler,
} from '../packages/client/src/play/turns.js'

function ids(prefix, sessionId, start, end) {
  return `${prefix}-${sessionId}-${start}-${end}`
}

test('completed real message pairs append QA references without copying content', () => {
  const source = { nodes: [] }
  const result = appendCompletedTurns(source, {
    incompleteTurn: false,
    messages: [
      { id: 'system', role: 'system', seq: 0, text: 'context' },
      { id: 'user-1', role: 'user', seq: 1, text: 'hello' },
      { id: 'tool-1', role: 'tool', seq: 2, text: 'tool data' },
      { id: 'assistant-1', role: 'assistant', seq: 3, text: 'hi' },
      { id: 'user-2', role: 'user', seq: 5, text: 'again' },
      { id: 'assistant-2a', role: 'assistant', seq: 6, text: 'draft' },
      { id: 'assistant-2b', role: 'assistant', seq: 7, text: 'final' },
    ],
  }, 'session-a', { idFactory: ids })

  assert.equal(source.nodes.length, 0)
  assert.equal(result.added.length, 2)
  assert.deepEqual(result.timeline.nodes.map(node => node.variants[0]), [
    { id: 'variant-session-a-1-3', sessionId: 'session-a', startEventId: 1, endEventId: 3 },
    { id: 'variant-session-a-5-7', sessionId: 'session-a', startEventId: 5, endEventId: 7 },
  ])
  assert.equal(JSON.stringify(result.timeline).includes('hello'), false)
  assert.equal(JSON.stringify(result.timeline).includes('tool data'), false)
})

test('model-visible runtime context stays inside the preceding real user turn', () => {
  const result = appendCompletedTurns({ nodes: [] }, {
    incompleteTurn: false,
    messages: [
      { id: 'user-1', role: 'user', seq: 9, text: '姐我饿了。' },
      { id: 'runtime-1', role: 'user', seq: 10, text: 'Current runtime context.' },
      { id: 'assistant-1', role: 'assistant', seq: 1421, text: '给你做蛋包饭。' },
      { id: 'user-2', role: 'user', seq: 1428, text: '姐我饿了' },
      { id: 'assistant-2', role: 'assistant', seq: 6497, text: '再给你煮面。' },
    ],
  }, 'session-a', { idFactory: ids })

  assert.deepEqual(result.timeline.nodes.map(node => node.variants[0]), [
    { id: 'variant-session-a-9-1421', sessionId: 'session-a', startEventId: 9, endEventId: 1421 },
    { id: 'variant-session-a-1428-6497', sessionId: 'session-a', startEventId: 1428, endEventId: 6497 },
  ])
})

test('open or already-recorded turns never append a duplicate', () => {
  const existing = {
    nodes: [{
      id: 'qa-old',
      kind: 'qa',
      hidden: false,
      displayOverride: null,
      adoptedVariantId: 'variant-old',
      variants: [{ id: 'variant-old', sessionId: 'session-a', startEventId: 1, endEventId: 3 }],
    }],
  }
  const messages = {
    incompleteTurn: false,
    messages: [
      { role: 'user', seq: 1 },
      { role: 'assistant', seq: 3 },
      { role: 'user', seq: 5 },
    ],
  }
  assert.deepEqual(appendCompletedTurns(existing, { ...messages, incompleteTurn: true }, 'session-a').added, [])
  assert.deepEqual(appendCompletedTurns(existing, messages, 'session-a').added, [])
  assert.equal(appendCompletedTurns(existing, messages, 'session-a').timeline, existing)
})

test('an interrupted durable assistant prefix becomes a normal QA reference', () => {
  const result = appendCompletedTurns({ nodes: [] }, {
    incompleteTurn: false,
    messages: [
      { id: 'user-1', role: 'user', seq: 10, text: 'keep going' },
      {
        id: 'assistant-1',
        role: 'assistant',
        seq: 12,
        text: 'visible interrupted prefix',
        interrupted: true,
      },
    ],
  }, 'session-a', { idFactory: ids })

  assert.deepEqual(result.added, [{
    id: 'qa-session-a-10-12',
    kind: 'qa',
    hidden: false,
    displayOverride: null,
    adoptedVariantId: 'variant-session-a-10-12',
    variants: [{
      id: 'variant-session-a-10-12',
      sessionId: 'session-a',
      startEventId: 10,
      endEventId: 12,
    }],
  }])
  assert.equal(JSON.stringify(result.timeline).includes('visible interrupted prefix'), false)
})

test('reconciler serializes reread-before-write and survives a failed task', async () => {
  let timeline = { nodes: [] }
  let failFirst = true
  let activeWrites = 0
  let maximumWrites = 0
  const calls = []
  const client = {
    async getMessages() {
      calls.push('messages')
      return { incompleteTurn: false, messages: [{ role: 'user', seq: 1 }, { role: 'assistant', seq: 2 }] }
    },
    async getTimeline() { calls.push('timeline'); return timeline },
    async putTimeline(_playthrough, next) {
      calls.push('write')
      activeWrites += 1
      maximumWrites = Math.max(maximumWrites, activeWrites)
      await new Promise(resolve => setImmediate(resolve))
      activeWrites -= 1
      if (failFirst) {
        failFirst = false
        throw new Error('transient')
      }
      timeline = next
    },
  }
  const reconcile = createTurnReconciler(client)
  const first = reconcile('session-a', { path: 'timeline.json' })
  const second = reconcile('session-a', { path: 'timeline.json' })
  await assert.rejects(first, /transient/)
  assert.equal((await second).added.length, 1)
  assert.equal(maximumWrites, 1)
  assert.deepEqual(calls, ['messages', 'timeline', 'write', 'messages', 'timeline', 'write'])
})
