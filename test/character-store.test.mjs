import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CharacterStore,
  createCharacterAdapter,
  selectedCharacterCardResource,
} from '../packages/character/src/index.js'
import { embedCharacterCardPng, extractCharacterCardPng, parseSillyTavernCharacterCard } from '../packages/tavern-format/src/index.js'

function temporaryStore() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-'))
  return { directory, store: new CharacterStore(directory) }
}

function synthetic(name = 'Synthetic card') {
  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: { name, first_mes: 'First', alternate_greetings: ['Second'], extensions: {} },
  })
}

test('persists a single character document without a duplicate JSON artifact', () => {
  const { directory, store } = temporaryStore()
  const source = Buffer.from(synthetic())
  try {
    const card = store.import(source, { id: 'stored', fileName: '../../display.json', now: '2026-08-14T00:00:00.000Z' })
    assert.equal(card.source.sha256, createHash('sha256').update(source).digest('hex'))
    assert.equal(store.coverImage(card.id), null)
    assert.equal(existsSync(join(directory, 'character-artifacts', 'stored.bin')), false)
    assert.deepEqual(JSON.parse(store.json(card.id).text), JSON.parse(source))
    assert.equal(store.list()[0].hasEmbeddedCharacterBook, false)

    const reloaded = new CharacterStore(directory)
    assert.equal(reloaded.get('stored').name, 'Synthetic card')
    assert.throws(() => reloaded.get('../escape'), /Invalid character id/)
    assert.throws(() => reloaded.import(source, { id: 'stored' }), /already exists/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('orders characters by recency then A to Z until a custom order is saved', () => {
  const { directory, store } = temporaryStore()
  try {
    store.create({ id: 'older', name: 'Older', now: '2026-08-14T00:00:00.000Z' })
    store.create({ id: 'zulu', name: 'Zulu', now: '2026-08-15T00:00:00.000Z' })
    store.create({ id: 'alpha', name: 'Alpha', now: '2026-08-15T00:00:00.000Z' })
    assert.deepEqual(store.list().map(character => character.id), ['alpha', 'zulu', 'older'])

    store.setSorting('custom', ['zulu', 'older', 'alpha'])
    assert.deepEqual(new CharacterStore(directory).list().map(character => character.id), ['zulu', 'older', 'alpha'])
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'character-state.json'), 'utf8')).characterOrder, ['zulu', 'older', 'alpha'])
    assert.deepEqual(store.sorting(), { mode: 'custom' })

    assert.throws(() => store.setSorting('custom', ['zulu', 'zulu', 'alpha']), /Duplicate character id/)
    assert.throws(() => store.setSorting('custom', ['zulu', 'missing', 'alpha']), /Unknown character id/)
    assert.throws(() => store.setSorting('custom', ['zulu', 'alpha']), /every stored character/)

    store.setSorting('name')
    assert.deepEqual(store.list().map(character => character.id), ['alpha', 'older', 'zulu'])
    store.setSorting('updated')
    assert.deepEqual(store.list().map(character => character.id), ['alpha', 'zulu', 'older'])
    store.setSorting('custom', ['older', 'alpha', 'zulu'])
    store.create({ id: 'new', name: 'New', now: '2026-08-16T00:00:00.000Z' })
    assert.deepEqual(store.list().map(character => character.id), ['older', 'alpha', 'zulu', 'new'])

    store.delete('zulu')
    assert.deepEqual(new CharacterStore(directory).list().map(character => character.id), ['older', 'alpha', 'new'])
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'character-state.json'), 'utf8')).characterOrder, ['older', 'alpha', 'new'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('keeps a deleted character tombstone and safely identifies a reimported card', () => {
  const { directory, store } = temporaryStore()
  const source = Buffer.from(synthetic('Returning card'))
  try {
    store.import(source, { id: 'old-card' })
    store.delete('old-card')
    assert.deepEqual(store.missing(), [{
      id: 'old-card',
      name: 'Returning card',
      sha256: createHash('sha256').update(source).digest('hex'),
    }])

    store.import(source, { id: 'new-card' })
    assert.deepEqual(store.recoveryFor('new-card'), {
      previousId: 'old-card',
      characterId: 'new-card',
      match: 'sha256',
    })
    assert.equal(store.resolveMissing('old-card'), true)
    assert.deepEqual(new CharacterStore(directory).missing(), [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('keeps per-session selections durable and clears references on delete', () => {
  const { directory, store } = temporaryStore()
  try {
    store.import(synthetic('One'), { id: 'one' })
    store.import(synthetic('Two'), { id: 'two' })
    store.select('parent-session', {
      characterCardId: 'one',
      character: {
        greetingIndex: 1,
        preferCharacterSystemPrompt: false,
        preferCharacterPostHistory: true,
      },
    })
    store.copySelection('parent-session', 'child-session')
    store.select('explicit-child', { characterCardId: 'two', character: {} })
    store.copySelection('parent-session', 'explicit-child')

    const reloaded = new CharacterStore(directory)
    assert.equal(reloaded.selection('child-session').characterCardId, 'one')
    assert.equal(reloaded.selection('child-session').character.greetingIndex, 1)
    assert.equal(reloaded.selection('explicit-child').characterCardId, 'two')
    const resource = selectedCharacterCardResource(reloaded, 'child-session')
    assert.equal(resource.kind, 'character-card')
    assert.equal(resource.characterName, 'One')
    assert.deepEqual(resource.greeting, { index: 1, kind: 'alternate-greeting', text: 'Second' })
    assert.equal(resource.fields.systemPrompt, '')
    assert.equal('raw' in resource.source, false)
    const adapterResult = createCharacterAdapter(reloaded).resolve({
      selection: { characterCardId: 'one', character: { greetingIndex: 1 } },
      sessionId: 'child-session',
    })
    assert.equal(adapterResult.character.id, 'one')
    assert.equal(adapterResult.character.name, 'One')
    assert.equal(adapterResult.character.updatedAt, reloaded.get('one').updatedAt)
    assert.equal(adapterResult.character.data.firstMessage, 'First')
    assert.equal('raw' in adapterResult.character.source, false)
    assert.equal(JSON.parse(readFileSync(join(directory, 'character-state.json'), 'utf8')).schemaVersion, 1)

    reloaded.delete('one')
    assert.equal(reloaded.selection('parent-session'), null)
    assert.equal(reloaded.selection('child-session'), null)
    assert.equal(reloaded.selection('explicit-child').characterCardId, 'two')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('validates greeting and session selection input', () => {
  const { directory, store } = temporaryStore()
  try {
    store.import(synthetic(), { id: 'card' })
    assert.throws(() => store.select('', { characterCardId: 'card', character: {} }), /Invalid session id/)
    assert.throws(() => store.select('__proto__', { characterCardId: 'card', character: {} }), /Invalid session id/)
    assert.throws(() => store.select('session', { characterCardId: 'card', character: { greetingIndex: 2 } }), /greetingIndex/)
    assert.throws(() => store.select('session', { characterCardId: '../card', character: {} }), /Invalid character id/)
    const missing = createCharacterAdapter(store).resolve({ selection: { characterCardId: 'missing', character: {} } })
    assert.equal(missing.character, null)
    assert.equal(missing.diagnostics[0].code, 'character-card-not-found')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('updates an embedded Character Book in the character document', () => {
  const { directory, store } = temporaryStore()
  const source = Buffer.from(JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Editable', character_book: { name: 'Before', entries: [] } } }))
  try {
    store.import(source, { id: 'editable', now: '2026-08-14T00:00:00.000Z' })
    const book = { name: 'After', entries: [{ id: 7, keys: ['moon'], content: 'Synthetic', enabled: true, insertion_order: 50, extensions: {} }] }
    const updated = store.updateCharacterBook('editable', book, { now: '2026-08-15T00:00:00.000Z' })
    assert.deepEqual(updated.data.characterBook, book)
    assert.deepEqual(JSON.parse(store.json('editable').text).data.character_book, book)
    assert.equal(store.coverImage('editable'), null)
    assert.equal(new CharacterStore(directory).get('editable').updatedAt, '2026-08-15T00:00:00.000Z')
    assert.throws(() => store.updateCharacterBook('editable', { entries: ['bad'] }), /entry must be an object/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('imports V1 JSON and V1 PNG, edits fields without rewriting the artifact, and clamps greetings', () => {
  const { directory, store } = temporaryStore()
  const v1Json = Buffer.from(JSON.stringify({
    name: 'V1 JSON',
    description: 'Old description',
    first_mes: 'Hello',
    alternate_greetings: ['Second', 'Third'],
    leftover: true,
  }))
  const placeholder = readFileSync(new URL('../packages/tavern-format/assets/character-placeholder.png', import.meta.url))
  const v1Png = Buffer.from(embedCharacterCardPng(placeholder, JSON.stringify({ name: 'V1 PNG', first_mes: 'Hi' })))
  try {
    store.import(v1Json, { id: 'v1-json', fileName: 'v1.json' })
    store.import(v1Png, { id: 'v1-png', fileName: 'v1.png' })
    assert.equal(store.get('v1-json').source.format, 'sillytavern-v1')
    assert.equal(store.get('v1-png').source.container, 'png')
    assert.equal(store.get('v1-png').name, 'V1 PNG')

    store.select('session-a', { characterCardId: 'v1-json', character: { greetingIndex: 2 } })
    store.select('session-b', { characterCardId: 'v1-json', character: { greetingIndex: 1 } })
    const updated = store.update('v1-json', {
      description: 'New description',
      alternateGreetings: ['Only second'],
    }, { now: '2026-08-17T00:00:00.000Z' })
    assert.equal(updated.data.description, 'New description')
    assert.equal(updated.source.raw.leftover, true)
    assert.equal(store.coverImage('v1-json'), null)
    assert.equal(JSON.parse(store.json('v1-json').text).description, 'New description')
    assert.equal(store.selection('session-a').characterCardId, 'v1-json')
    assert.equal(store.selection('session-a').character.greetingIndex, 1)
    assert.equal(store.selection('session-b').character.greetingIndex, 1)

    const exported = store.png('v1-json')
    const extracted = extractCharacterCardPng(exported.bytes)
    assert.equal(JSON.parse(extracted.jsonText).description, 'New description')
    assert.equal(exported.mediaType, 'image/png')
    assert.equal(Buffer.from(exported.bytes.subarray(0, 8)).equals(placeholder.subarray(0, 8)), true)
    assert.equal(exported.bytes[16], placeholder[16])
    assert.equal(exported.bytes[17], placeholder[17])

    const pngEdited = store.update('v1-png', { firstMessage: 'Edited' })
    const cover = store.coverImage('v1-png')
    assert.notEqual(cover, null)
    assert.throws(() => extractCharacterCardPng(cover), /does not contain/)
    assert.equal(JSON.parse(store.json('v1-png').text).first_mes, 'Edited')
    const currentPng = store.png('v1-png')
    assert.notDeepEqual(currentPng.bytes, v1Png)
    assert.equal(parseSillyTavernCharacterCard(currentPng.bytes).data.firstMessage, 'Edited')
    assert.equal(pngEdited.updatedAt.length > 0, true)
    assert.equal(new CharacterStore(directory).get('v1-json').data.description, 'New description')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('creates a blank V2 card without a cover image', () => {
  const { directory, store } = temporaryStore()
  try {
    const created = store.create({ id: 'blank', name: 'Blank card', now: '2026-08-17T00:00:00.000Z' })
    assert.equal(created.source.format, 'sillytavern-v2')
    assert.equal(created.source.container, 'json')
    assert.equal(created.data.firstMessage, '')
    assert.equal(store.coverImage('blank'), null)
    assert.equal(JSON.parse(store.json('blank').text).data.name, 'Blank card')
    assert.throws(() => store.create({ id: 'blank' }), /already exists/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
