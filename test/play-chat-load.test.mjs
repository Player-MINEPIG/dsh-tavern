import test from 'node:test'
import assert from 'node:assert/strict'
import { loadChatState } from '../packages/client/src/play/chat.js'
import { readFileSync } from 'node:fs'

const chatSource = readFileSync(new URL('../packages/client/src/play/chat.js', import.meta.url), 'utf8')

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

  const state = await loadChatState(client, 'session-a', {
    path: 'timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-a' } },
  })
  assert.deepEqual(calls, ['messages', 'timeline', 'write', 'messages', 'selection', 'character'])
  assert.equal(state.turns.length, 1)
  assert.equal(state.turns[0].userText, 'Hello')
  assert.equal(state.turns[0].assistantText, 'Hi')
  assert.equal(state.greeting.text, 'Greeting')
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

test('Chat display expands bound user and character names without changing greeting source', async () => {
  const greeting = 'Welcome {{user}}; {{char}} is waiting.'
  const client = {
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async getTimeline() { return { nodes: [] } },
    async getCharacterSelection() {
      return { selection: { characterCardId: 'character-a', character: { greetingIndex: 0 } } }
    },
    async getCharacter() {
      return { character: { id: 'character-a', name: 'Card', data: { nickname: '', name: 'Alice', firstMessage: greeting } } }
    },
    async getActive() { return { resources: { user: { id: 'user-a', name: 'Reader' } } } },
  }

  const state = await loadChatState(client, 'session-a', {
    path: 'timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-a' } },
  })
  assert.equal(state.greeting.text, 'Welcome Reader; Alice is waiting.')
  assert.equal(greeting, 'Welcome {{user}}; {{char}} is waiting.')
})

test('empty imported playthrough exposes authoritative binding, latest QA and mutable opening controls', async () => {
  const client = {
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async getTimeline() { return { nodes: [] } },
    async getImportContextBinding() { return { path: 'character-a/pt/import-context.json', state: 'pending' } },
    async getFile(path) {
      if (path === 'character-a/pt/import-context.json') {
        return { content: JSON.stringify({ schemaVersion: 1, greeting: null, qa: [
          { user: 'Old Q1', assistant: 'Old A1' },
          { user: 'Old Q2', assistant: 'Old A2' },
        ] }) }
      }
      const error = new Error('missing')
      error.code = 'PLAY_FILE_NOT_FOUND'
      throw error
    },
    async getCharacterSelection() { return { selection: null } },
  }
  const state = await loadChatState(client, 'session-a', {
    path: 'character-a/pt/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'session-a' } },
  })
  assert.equal(state.importBinding.state, 'pending')
  assert.equal(state.importMutable, true)
  assert.equal(state.turns.at(-1).importLast, true)
  assert.equal(state.turns.at(-1).assistantText, 'Old A2')
})

test('consumed import binding is never mutable even before timeline reconciliation', async () => {
  const client = {
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async getTimeline() { return { nodes: [] } },
    async getImportContextBinding() { return { path: 'character-a/pt/import-context.json', state: 'consumed' } },
    async getFile() { return { content: JSON.stringify({ schemaVersion: 1, greeting: null, qa: [] }) } },
    async getCharacterSelection() { return { selection: null } },
  }
  const state = await loadChatState(client, 'session-a', {
    path: 'character-a/pt/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'session-a' } },
  })
  assert.equal(state.importMutable, false)
})

test('unbound import action is passed into the greeting container as its footer', () => {
  assert.match(chatSource, /function Greeting\(\{ greeting, busy, change, footer = null \}\)/)
  assert.match(chatSource, /footer: state\.importBinding === null \? importControls : null/)
  assert.match(chatSource, /state\.greeting === null && state\.importBinding === null \? importControls : null/)
})
