import test from 'node:test'
import assert from 'node:assert/strict'
import {
  characterGreetingOptions,
  defaultCharacterSelection,
  shouldShowCharacterLauncher,
} from '../packages/character/src/client-state.js'

test('character launcher is available only before a conversation becomes active', () => {
  assert.equal(shouldShowCharacterLauncher({ current: undefined, byId: {} }), true)
  assert.equal(shouldShowCharacterLauncher({ current: 'blank', byId: { blank: { blank: true } } }), true)
  assert.equal(shouldShowCharacterLauncher({ current: 'active', byId: { active: { blank: false } } }), false)
})

test('character greeting options keep first_mes at stable index zero', () => {
  assert.deepEqual(characterGreetingOptions({ data: { firstMessage: 'First', alternateGreetings: ['Second', 'Third'] } }), [
    { index: 0, label: '默认开场', text: 'First' },
    { index: 1, label: '备选开场 1', text: 'Second' },
    { index: 2, label: '备选开场 2', text: 'Third' },
  ])
  assert.equal(characterGreetingOptions({ data: { firstMessage: '', alternateGreetings: [] } })[0].label, '默认开场（空）')
})

test('new bindings default to loader-controlled system and post-history fields', () => {
  assert.deepEqual(defaultCharacterSelection('card'), {
    characterCardId: 'card',
    character: {
      greetingIndex: 0,
      preferCharacterSystemPrompt: true,
      preferCharacterPostHistory: true,
    },
  })
})
