import test from 'node:test'
import assert from 'node:assert/strict'
import { loadChatState } from '../packages/client/src/play/chat.js'

test('Chat applies regex only after displayOverride and keeps source messages untouched', async () => {
  const messages = {
    incompleteTurn: false,
    messages: [
      { id: 'u', role: 'user', seq: 1, content: [], text: 'Alice asks' },
      { id: 'a', role: 'assistant', seq: 2, content: [], text: 'Original Alice' },
    ],
  }
  const original = structuredClone(messages)
  const timeline = { nodes: [{
    id: 'qa', kind: 'qa', hidden: false, displayOverride: 'Override Alice', adoptedVariantId: 'v',
    variants: [{ id: 'v', sessionId: 'session-a', startEventId: 1, endEventId: 2 }],
  }] }
  const client = {
    async getMessages() { return messages },
    async getTimeline() { return timeline },
    async putTimeline() { throw new Error('must not write') },
    async getCharacterSelection() { return { selection: null } },
    async getActive() { return { selection: { presetId: 'preset-a' } } },
    async getFile() {
      return { content: JSON.stringify({ schemaVersion: 1, rules: [
        { id: 'assistant', name: 'assistant', enabled: true, find: 'Alice', replace: 'A', target: 'assistant', scope: { kind: 'preset', resourceId: 'preset-a' } },
        { id: 'user', name: 'user', enabled: true, find: 'Alice', replace: 'U', target: 'user', scope: { kind: 'global' } },
      ] }) }
    },
  }
  const state = await loadChatState(client, 'session-a', { path: 'timeline.json' })
  assert.equal(state.turns[0].userText, 'U asks')
  assert.equal(state.turns[0].assistantText, 'Override A')
  assert.equal(state.turns[0].originalAssistantText, 'Original Alice')
  assert.deepEqual(messages, original)
})
