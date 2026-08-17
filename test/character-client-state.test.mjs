import test from 'node:test'
import assert from 'node:assert/strict'
import {
  characterBindingDirty,
  characterEditorDirty,
  characterEditorDraft,
  characterEditorPatch,
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

test('character greeting and strategy changes are unapplied until the session binding matches', () => {
  const applied = {
    characterCardId: 'card',
    character: { greetingIndex: 0, preferCharacterSystemPrompt: true, preferCharacterPostHistory: true },
  }
  assert.equal(characterBindingDirty(applied, applied), false)
  assert.equal(characterBindingDirty(applied, { ...applied, character: { ...applied.character, greetingIndex: 1 } }), true)
  assert.equal(characterBindingDirty(applied, { ...applied, character: { ...applied.character, preferCharacterSystemPrompt: false } }), true)
  assert.equal(characterBindingDirty(null, applied), false)
  assert.equal(characterBindingDirty(applied, { ...applied, characterCardId: 'other' }), false)
})

test('editor draft keeps greeting indexes stable while turning tags into a save patch', () => {
  const draft = characterEditorDraft({
    data: {
      name: 'Guide',
      nickname: '',
      description: 'Desc',
      personality: '',
      scenario: '',
      firstMessage: 'First',
      alternateGreetings: ['Second', 'Third'],
      messageExample: '',
      creatorNotes: '',
      systemPrompt: '',
      postHistoryInstructions: '',
      tags: ['one', 'two'],
      creator: 'test',
      characterVersion: '1',
    },
  })
  assert.equal(characterEditorDirty(draft, structuredClone(draft)), false)
  const edited = { ...draft, firstMessage: 'First edited', tagsText: 'one, two, three' }
  assert.equal(characterEditorDirty(draft, edited), true)
  assert.deepEqual(characterEditorPatch(edited).alternateGreetings, ['Second', 'Third'])
  assert.deepEqual(characterEditorPatch(edited).tags, ['one', 'two', 'three'])
  assert.equal(characterGreetingOptions({ data: edited }).length, 3)
})
