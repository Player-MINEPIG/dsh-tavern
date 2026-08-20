import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjacentGreetingIndex,
  projectGreeting,
} from '../packages/client/src/play/chat-model.js'

test('greeting remains a frontend projection throughout its character playthrough', () => {
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
    openingCharacterId: 'character-a',
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

  assert.equal(projectGreeting(input).text, 'Second hello')
  assert.equal(projectGreeting({ ...input, openingCharacterId: 'character-b' }), null)
})

test('empty or mismatched greetings do not create a fake conversation record', () => {
  const selectionResponse = {
    selection: { characterCardId: 'character-a', character: { greetingIndex: 0 } },
  }
  assert.equal(projectGreeting({
    openingCharacterId: 'character-a',
    selectionResponse,
    characterResponse: {
      character: { id: 'character-a', name: 'Alice', data: { firstMessage: '', alternateGreetings: [] } },
    },
  }), null)
  assert.equal(projectGreeting({
    openingCharacterId: 'character-a',
    selectionResponse,
    characterResponse: {
      character: { id: 'character-b', name: 'Bob', data: { firstMessage: 'Hello' } },
    },
  }), null)
})
