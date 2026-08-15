import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorldBookStore } from '../packages/world-book-library/src/index.js'

const fixture = () => readFileSync(new URL('./fixtures/world-book/standalone-library.json', import.meta.url), 'utf8')

test('exposes the standalone resource use-case through its package subpath', async () => {
  const api = await import('dsh-tavern/world-book-library')
  assert.equal(typeof api.WorldBookStore, 'function')
  assert.equal(typeof api.createWorldBookApiHandler, 'function')
})

test('standalone world-book CRUD survives reload and preserves unknown imported fields', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-store-'))
  try {
    const store = new WorldBookStore(directory)
    const imported = store.import(fixture(), {
      id: 'synthetic-library',
      fileName: 'synthetic-library.json',
      now: '2026-08-15T00:00:00.000Z',
    })
    assert.equal(imported.book.entries.length, 2)
    assert.equal(store.list()[0].enabledEntryCount, 2)

    const edited = structuredClone(imported.book)
    edited.name = 'Edited Synthetic Library'
    edited.entries[0].comment = 'Edited title'
    edited.entries[0].keys = ['harbor', 'quay']
    edited.entries[0].caseSensitive = true
    edited.entries[0].matchWholeWords = true
    edited.entries[0].probability = 75
    edited.entries.push({
      uid: 13,
      keys: ['new'],
      secondaryKeys: [],
      comment: 'New entry',
      content: 'New synthetic lore.',
      enabled: true,
      constant: false,
      selective: false,
      insertionOrder: 50,
      position: 'after_character_definition',
      probability: 100,
    })
    store.update(imported.id, { book: edited }, { now: '2026-08-15T00:01:00.000Z' })

    const reloaded = new WorldBookStore(directory).get(imported.id)
    assert.equal(reloaded.name, 'Edited Synthetic Library')
    assert.equal(reloaded.book.entries.length, 3)
    assert.equal(reloaded.book.entries[0].comment, 'Edited title')
    assert.equal(reloaded.book.entries[0].caseSensitive, true)
    const exported = JSON.parse(store.export(imported.id).text)
    assert.deepEqual(exported.fixture_top_level, { preserve: true })
    assert.equal(exported.entries.harbor.fixture_entry_field, 'preserve')
    assert.deepEqual(exported.entries.harbor.key, ['harbor', 'quay'])

    store.delete(imported.id)
    assert.deepEqual(store.list(), [])
    assert.throws(() => store.get(imported.id), error => error.code === 'WORLD_BOOK_NOT_FOUND')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('creates a blank editable standalone book with independent ids', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-create-'))
  try {
    const store = new WorldBookStore(directory)
    const first = store.create({ name: 'First', id: 'first-book' })
    const second = store.create({ name: 'Second', id: 'second-book' })
    assert.equal(first.book.source.format, 'sillytavern-world-info')
    assert.deepEqual(first.book.entries, [])
    assert.deepEqual(store.list().map(item => item.id).toSorted(), ['first-book', 'second-book'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('import keeps an internal title and otherwise derives a clean title from the JSON filename', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-names-'))
  try {
    const store = new WorldBookStore(directory)
    const internal = store.import(JSON.stringify({ name: 'Inside Title', entries: {} }), {
      id: 'internal-title',
      fileName: 'ignored-file-name.json',
    })
    const filename = store.import(JSON.stringify({ entries: {} }), {
      id: 'filename-title',
      fileName: 'External Library.JSON',
    })

    assert.equal(internal.name, 'Inside Title')
    assert.equal(internal.book.name, 'Inside Title')
    assert.equal(filename.name, 'External Library')
    assert.equal(filename.book.name, 'External Library')
    assert.doesNotMatch(filename.name, /\.json$/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('edits an imported Character Book without adding standalone-only fields', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-book-library-'))
  try {
    const store = new WorldBookStore(directory)
    const document = store.import(JSON.stringify({
      name: 'Synthetic Character Book',
      extensions: { fixture: 'keep' },
      entries: [],
    }), { id: 'character-shaped-book' })
    store.update(document.id, { book: {
      ...document.book,
      entries: [{
        uid: 1, keys: ['shape'], secondaryKeys: [], comment: 'Shape', content: 'Character-shaped lore.',
        enabled: true, constant: false, selective: false, insertionOrder: 100,
        position: 'after_character_definition', probability: 100,
      }],
    } })
    const exported = JSON.parse(store.export(document.id).text)
    assert.equal(Array.isArray(exported.entries), true)
    assert.equal(exported.entries[0].id, 1)
    assert.equal(Object.hasOwn(exported.entries[0], 'uid'), false)
    assert.equal(Object.hasOwn(exported.entries[0], 'key'), false)
    assert.equal(exported.extensions.fixture, 'keep')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
