import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTurnDisplayRegex, loadChatState } from '../packages/client/src/play/chat.js'

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

test('Chat automatically composes bound preset and character source regex', async () => {
  const messages = {
    incompleteTurn: false,
    messages: [
      { id: 'u', role: 'user', seq: 1, content: [], text: 'Alice asks' },
      { id: 'a', role: 'assistant', seq: 2, content: [], text: 'Alice answers' },
    ],
  }
  const client = {
    async getMessages() { return messages },
    async getTimeline() {
      return { nodes: [{
        id: 'qa', kind: 'qa', hidden: false, displayOverride: null, adoptedVariantId: 'v',
        variants: [{ id: 'v', sessionId: 'session-a', startEventId: 1, endEventId: 2 }],
      }] }
    },
    async putTimeline() { throw new Error('must not write') },
    async getCharacterSelection() {
      return { selection: { characterCardId: 'character-a', character: { greetingIndex: 0 } } }
    },
    async getCharacter() {
      return { character: {
        id: 'character-a', name: 'Character', data: { firstMessage: '' },
        source: { raw: { data: { extensions: { regex_scripts: [
          { id: 'card', findRegex: '/Preset/g', replaceString: 'Card', placement: [2], disabled: false },
        ] } } } },
      } }
    },
    async getPreset() {
      return { preset: { id: 'preset-a', source: { raw: { regex_scripts: [
        { id: 'preset', findRegex: '/Alice/g', replaceString: 'Preset', placement: [1, 2], disabled: false },
      ] } } } }
    },
    async getActive() { return { selection: { presetId: 'preset-a', characterCardId: 'character-a' } } },
    async getFile() { return { content: JSON.stringify({ schemaVersion: 1, rules: [] }) } },
  }
  const state = await loadChatState(client, 'session-a', { path: 'timeline.json' })
  assert.equal(state.turns[0].userText, 'Preset asks')
  assert.equal(state.turns[0].assistantText, 'Card answers')
  assert.equal(messages.messages[1].text, 'Alice answers')
})

test('Chat applies ST minDepth and maxDepth to existing timeline messages', async () => {
  const messages = { incompleteTurn: false, messages: [
    { id: 'u1', role: 'user', seq: 1, content: [], text: 'old——user' },
    { id: 'a1', role: 'assistant', seq: 2, content: [], text: 'old——assistant' },
    { id: 'u2', role: 'user', seq: 3, content: [], text: 'new——user' },
    { id: 'a2', role: 'assistant', seq: 4, content: [], text: 'new——assistant' },
  ] }
  const timeline = { nodes: [
    { id: 'qa1', kind: 'qa', hidden: false, displayOverride: null, adoptedVariantId: 'v1', variants: [
      { id: 'v1', sessionId: 'session-a', startEventId: 1, endEventId: 2 },
    ] },
    { id: 'qa2', kind: 'qa', hidden: false, displayOverride: null, adoptedVariantId: 'v2', variants: [
      { id: 'v2', sessionId: 'session-a', startEventId: 3, endEventId: 4 },
    ] },
  ] }
  const client = {
    async getMessages() { return messages },
    async getTimeline() { return timeline },
    async getCharacterSelection() { return { selection: null } },
    async getActive() { return { selection: { presetId: 'preset-a' } } },
    async getPreset() { return { preset: { source: { raw: { extensions: { regex_scripts: [{
      id: 'depth', scriptName: 'Depth', findRegex: '/——/g', replaceString: ',',
      placement: [2], disabled: false, markdownOnly: true, minDepth: 2, maxDepth: 2,
    }] } } } } } },
    async getFile() { return { content: JSON.stringify({ schemaVersion: 1, rules: [] }) } },
  }
  const state = await loadChatState(client, 'session-a', { path: 'timeline.json' })
  assert.equal(state.turns[0].assistantText, 'old,assistant')
  assert.equal(state.turns[1].assistantText, 'new——assistant')
  assert.equal(messages.messages[1].text, 'old——assistant')
})

test('live turns use the same display rules without changing their source projection', () => {
  const turn = { id: 'live', userText: '{{user}} asks Alice', assistantText: '{{char}} answers Alice', reasoningText: 'Alice thinks' }
  const before = structuredClone(turn)
  const projected = applyTurnDisplayRegex(turn, {
    rules: [{
      id: 'both', name: 'both', enabled: true, find: '/Alice/g', replace: 'Rendered',
      target: 'both', scope: { kind: 'global', resourceId: null }, flags: '', ext: {},
    }],
    bindings: {},
    macros: { user: 'Reader', character: 'Card' },
  })
  assert.equal(projected.userText, 'Reader asks Rendered')
  assert.equal(projected.assistantText, 'Card answers Rendered')
  assert.equal(projected.reasoningText, 'Alice thinks')
  assert.deepEqual(turn, before)
})

test('display regex may suppress a context-triggered assistant output without removing its context row', () => {
  const turn = {
    id: 'context-turn', triggerKind: 'context', userText: '',
    contexts: [{ id: 'context-1', text: 'Background report' }],
    assistantText: '<draft>internal</draft>', reasoningText: '',
  }
  const projected = applyTurnDisplayRegex(turn, {
    rules: [{
      id: 'hide-draft', name: 'hide draft', enabled: true,
      find: '/<draft>[\\s\\S]*?<\\/draft>/g', replace: '', target: 'assistant',
      scope: { kind: 'global', resourceId: null }, flags: '', ext: {},
    }],
    bindings: {},
    macros: { user: 'User', character: 'Assistant' },
  })
  assert.equal(projected.assistantText, '')
  assert.deepEqual(projected.contexts, turn.contexts)
})
