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
  assert.equal(adjacentGreetingIndex({ ...greeting, index: 2 }, 'next'), null)

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


function greetingFor(firstMessage, alternateGreetings, greetingIndex = 0) {
  return projectGreeting({
    openingCharacterId: 'card',
    selectionResponse: { selection: { characterCardId: 'card', character: { greetingIndex } } },
    characterResponse: { character: { id: 'card', data: { firstMessage, alternateGreetings } } },
  })
}

test('empty alternate entries are not next greetings and navigation stops at either end', () => {
  const greeting = greetingFor('Only opening', ['', '  \n'])
  assert.equal(greeting.text, 'Only opening')
  assert.deepEqual(greeting.options.map(o => o.index), [0])
  assert.equal(adjacentGreetingIndex(greeting, 'previous'), null)
  assert.equal(adjacentGreetingIndex(greeting, 'next'), null)
  assert.equal(adjacentGreetingIndex(null, 'next'), null)
})

test('a previously selected empty greeting retains a route back without changing the selection', () => {
  const stuck = greetingFor('Original opening', [''], 1)
  assert.equal(stuck.index, 1)
  assert.equal(stuck.text, '')
  assert.equal(adjacentGreetingIndex(stuck, 'previous'), 0)
  assert.equal(adjacentGreetingIndex(stuck, 'next'), null)
  const recovered = greetingFor('Original opening', [''], 0)
  assert.equal(recovered.text, 'Original opening')
  assert.equal(adjacentGreetingIndex(recovered, 'next'), null)
})

test('blank default can reach an alternate and empty gaps preserve original card indices', () => {
  const greeting = greetingFor('', ['', 'Second', '  ', 'Fourth'])
  assert.equal(greeting.index, 0)
  assert.equal(adjacentGreetingIndex(greeting, 'next'), 2)
  const second = greetingFor('', ['', 'Second', '  ', 'Fourth'], 2)
  assert.equal(adjacentGreetingIndex(second, 'previous'), null)
  assert.equal(adjacentGreetingIndex(second, 'next'), 4)
  const fourth = greetingFor('', ['', 'Second', '  ', 'Fourth'], 4)
  assert.equal(adjacentGreetingIndex(fourth, 'previous'), 2)
  assert.equal(adjacentGreetingIndex(fourth, 'next'), null)
  assert.equal(greetingFor('  ', ['', '\n']), null)
})
