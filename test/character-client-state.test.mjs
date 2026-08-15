import test from 'node:test'
import assert from 'node:assert/strict'
import {
  characterGreetingOptions,
  defaultCharacterSelection,
} from '../packages/character/src/client-state.js'

test('character greeting options keep first_mes at stable index zero', () => {
  assert.deepEqual(characterGreetingOptions({ data: { firstMessage: 'First', alternateGreetings: ['Second', 'Third'] } }), [
    { index: 0, labelKey: 'character.greeting.default', text: 'First' },
    { index: 1, labelKey: 'character.greeting.alternate', labelValues: { index: 1 }, text: 'Second' },
    { index: 2, labelKey: 'character.greeting.alternate', labelValues: { index: 2 }, text: 'Third' },
  ])
  assert.equal(characterGreetingOptions({ data: { firstMessage: '', alternateGreetings: [] } })[0].labelKey, 'character.greeting.defaultEmpty')
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
