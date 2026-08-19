import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjacentGreetingIndex,
  projectGreeting,
} from '../packages/client/src/play/chat-model.js'

test('greeting is a frontend projection only before any real record exists', () => {
  const character = {
    id: 'character-a',
    name: 'Alice card',
    data: {
      name: 'Alice',
      nickname: 'Al',
      firstMessage: 'First hello',
      alternateGreetings: ['Second hello', 'Third hello'],
    },
  }
  const input = {
    timeline: { nodes: [] },
    messages: [],
    selectionResponse: {
      selection: { characterCardId: 'character-a', character: { greetingIndex: 1 } },
    },
    characterResponse: { character },
  }
  const greeting = projectGreeting(input)
  assert.equal(greeting.characterName, 'Al')
  assert.equal(greeting.index, 1)
  assert.equal(greeting.text, 'Second hello')
  assert.equal(adjacentGreetingIndex(greeting, 'previous'), 0)
  assert.equal(adjacentGreetingIndex(greeting, 'next'), 2)
  assert.equal(adjacentGreetingIndex({ ...greeting, index: 2 }, 'next'), 0)

  assert.equal(projectGreeting({ ...input, messages: [{ role: 'user', text: 'real' }] }), null)
  assert.equal(projectGreeting({
    ...input,
    timeline: { nodes: [{ id: 'qa-existing' }] },
  }), null)
})

test('empty or mismatched greetings do not create a fake conversation record', () => {
  const selectionResponse = {
    selection: { characterCardId: 'character-a', character: { greetingIndex: 0 } },
  }
  assert.equal(projectGreeting({
    timeline: { nodes: [] },
    messages: [],
    selectionResponse,
    characterResponse: {
      character: { id: 'character-a', name: 'Alice', data: { firstMessage: '', alternateGreetings: [] } },
    },
  }), null)
  assert.equal(projectGreeting({
    timeline: { nodes: [] },
    messages: [],
    selectionResponse,
    characterResponse: {
      character: { id: 'character-b', name: 'Bob', data: { firstMessage: 'Hello' } },
    },
  }), null)
})
