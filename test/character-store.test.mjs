import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CharacterStore,
  createCharacterAdapter,
  selectedCharacterCardResource,
} from '../packages/character/src/index.js'

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

test('persists normalized cards and exports the exact imported artifact bytes', () => {
  const { directory, store } = temporaryStore()
  const source = Buffer.from(synthetic())
  try {
    const card = store.import(source, { id: 'stored', fileName: '../../display.json', now: '2026-08-14T00:00:00.000Z' })
    assert.equal(card.source.sha256, createHash('sha256').update(source).digest('hex'))
    assert.deepEqual(store.artifact(card.id).bytes, source)
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
