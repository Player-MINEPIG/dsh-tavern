import test from 'node:test'
import assert from 'node:assert/strict'
import { loadChatState } from '../packages/client/src/play/chat.js'

test('Chat load registers a completed real turn before projecting it', async () => {
  const calls = []
  const messageState = {
    incompleteTurn: false,
    messages: [
      { id: 'user', role: 'user', seq: 1, content: [], text: 'Hello' },
      { id: 'assistant', role: 'assistant', seq: 3, content: [], text: 'Hi' },
    ],
  }
  let timeline = { nodes: [] }
  const client = {
    async getMessages() { calls.push('messages'); return messageState },
    async getTimeline() { calls.push('timeline'); return timeline },
    async putTimeline(_playthrough, next) { calls.push('write'); timeline = next; return next },
    async getCharacterSelection() {
      calls.push('selection')
      return { selection: { characterCardId: 'character-a', character: { greetingIndex: 0 } } }
    },
    async getCharacter() {
      calls.push('character')
      return { character: { id: 'character-a', name: 'Alice', data: { firstMessage: 'Greeting' } } }
    },
  }

  const state = await loadChatState(client, 'session-a', { path: 'timeline.json' })
  assert.deepEqual(calls, ['messages', 'timeline', 'write', 'messages', 'selection', 'character'])
  assert.equal(state.turns.length, 1)
  assert.equal(state.turns[0].userText, 'Hello')
  assert.equal(state.turns[0].assistantText, 'Hi')
  assert.equal(state.greeting, null)
  assert.equal(JSON.stringify(timeline).includes('Hello'), false)
})

test('Chat load never writes while a turn is incomplete', async () => {
  let writes = 0
  const client = {
    async getMessages() {
      return { incompleteTurn: true, messages: [{ id: 'user', role: 'user', seq: 1, content: [], text: 'Hello' }] }
    },
    async getTimeline() { return { nodes: [] } },
    async putTimeline() { writes += 1 },
    async getCharacterSelection() { return { selection: null } },
  }
  const state = await loadChatState(client, 'session-a', { path: 'timeline.json' })
  assert.equal(writes, 0)
  assert.deepEqual(state.turns, [])
  assert.equal(state.greeting, null)
})
