import test from 'node:test'
import assert from 'node:assert/strict'
import {
  embeddedCharacterBookResource,
  exportCharacterCardJson,
  parseSillyTavernCharacterCard,
} from '../packages/tavern-format/src/index.js'

test('normalizes a V1 card while preserving its complete source object', () => {
  const raw = {
    name: 'V1 synthetic',
    description: 'Description',
    personality: 'Patient',
    scenario: 'A test',
    first_mes: 'Hello',
    mes_example: '<START>\n{{char}}: Example',
    creatorcomment: 'Notes',
    future_field: { retained: true },
  }
  const card = parseSillyTavernCharacterCard(raw, {
    id: 'v1',
    now: '2026-08-14T00:00:00.000Z',
    fileName: '../display-only.json',
  })

  assert.equal(card.source.format, 'sillytavern-v1')
  assert.equal(card.data.creatorNotes, 'Notes')
  assert.equal(card.data.firstMessage, 'Hello')
  assert.equal(card.source.raw.future_field.retained, true)
  assert.equal(card.source.fileName, '../display-only.json')
  assert.deepEqual(JSON.parse(exportCharacterCardJson(card)), raw)
})

test('normalizes V2 data and exposes embedded character_book without activating it', () => {
  const raw = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'V2 synthetic',
      description: 'Description',
      personality: '',
      scenario: '',
      first_mes: 'First',
      mes_example: '',
      creator_notes: '',
      system_prompt: 'Stay in character',
      post_history_instructions: 'After history',
      alternate_greetings: ['Alternative'],
      tags: ['synthetic'],
      creator: 'test',
      character_version: '1',
      character_book: { name: 'Embedded', entries: [{ keys: ['test'], content: 'inert' }] },
      extensions: { future: true },
    },
    unknown_top_level: 42,
  }
  const card = parseSillyTavernCharacterCard(JSON.stringify(raw), { id: 'v2' })
  const book = embeddedCharacterBookResource(card)

  assert.equal(card.source.format, 'sillytavern-v2')
  assert.equal(card.data.systemPrompt, 'Stay in character')
  assert.equal(card.data.characterBook.entries[0].content, 'inert')
  assert.equal(book.ownerCharacterId, 'v2')
  assert.deepEqual(book.book, raw.data.character_book)
  assert.notEqual(book.book, card.data.characterBook)
  assert.equal(card.source.raw.unknown_top_level, 42)
  assert.ok(card.compatibility.unsupportedFeatures.some((item) => item.code === 'embedded-character-book-pass-through'))
})

test('accepts a future V3 minor version with diagnostics and preserves inert assets', () => {
  const card = parseSillyTavernCharacterCard({
    spec: 'chara_card_v3',
    spec_version: '3.1',
    data: {
      name: 'V3 synthetic',
      nickname: 'V3',
      description: '{{future_macro}}',
      alternate_greetings: [],
      group_only_greetings: ['Group'],
      assets: [{ type: 'icon', uri: 'https://invalid.example/never-fetch' }],
      extensions: {},
    },
  }, { id: 'v3' })

  assert.equal(card.source.format, 'character-card-v3')
  assert.deepEqual(card.data.groupOnlyGreetings, ['Group'])
  assert.equal(card.data.assets[0].type, 'icon')
  assert.ok(card.compatibility.warnings.some((item) => item.code === 'newer-v3-version'))
  assert.deepEqual(card.compatibility.unknownMacroNames, ['future_macro'])
})

test('rejects invalid known field types without discarding the field path', () => {
  assert.throws(() => parseSillyTavernCharacterCard({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: { name: 'Bad', alternate_greetings: 'not-an-array' },
  }), /data\.alternate_greetings must be an array of strings/)
  assert.throws(() => parseSillyTavernCharacterCard('[]'), /must be an object/)
  assert.throws(() => parseSillyTavernCharacterCard('{'), /Invalid character-card JSON/)
})
