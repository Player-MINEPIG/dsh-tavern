import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  WORLD_BOOK_FORMATS,
  WorldBookValidationError,
  detectWorldBookFormat,
  exportCharacterBook,
  exportSillyTavernWorldBook,
  parseCharacterBook,
  parseSillyTavernWorldBook,
  parseWorldBook,
  stableStringify,
  validateWorldBook,
} from '../packages/world-book/src/index.js'

const fixture = name => readFileSync(new URL(`./fixtures/world-book/${name}`, import.meta.url), 'utf8')
const snapshot = name => readFileSync(new URL(`./snapshots/${name}`, import.meta.url), 'utf8').trimEnd()

test('exposes the world-book API through the root package subpath', async () => {
  const api = await import('dsh-tavern/world-book')
  assert.equal(typeof api.parseWorldBook, 'function')
  assert.equal(typeof api.computeWorldBookCandidates, 'function')
  assert.equal(typeof api.projectWorldBookForLoader, 'function')
})

test('recognizes standalone ST books and embedded character books by entries shape', () => {
  assert.equal(detectWorldBookFormat(fixture('minimal-world-book.json')), WORLD_BOOK_FORMATS.SILLY_TAVERN)
  assert.equal(detectWorldBookFormat(fixture('minimal-character-book.json')), WORLD_BOOK_FORMATS.CHARACTER_BOOK)
  assert.equal(detectWorldBookFormat('{'), null)
  assert.equal(detectWorldBookFormat({ entries: 'wrong' }), null)
})

test('normalizes standalone ST fields into a deterministic WorldBookModel snapshot', () => {
  const model = parseSillyTavernWorldBook(fixture('minimal-world-book.json'))
  assert.equal(model.entries[0].source.key, 'chapter-a')
  assert.equal(model.entries[0].position, 'at_depth')
  assert.equal(model.entries[0].role, 'assistant')
  assert.equal(model.entries[0].selectiveLogic, 'and_all')
  assert.equal(stableStringify(model), snapshot('world-book-model.json'))
})

test('preserves unknown standalone fields and reaches stable export idempotence', () => {
  const first = exportSillyTavernWorldBook(parseWorldBook(fixture('minimal-world-book.json')))
  const second = exportSillyTavernWorldBook(parseWorldBook(first))
  assert.deepEqual(second, first)
  assert.deepEqual(first.fixture_top_level, { revision: 1 })
  assert.equal(first.entries['chapter-a'].fixture_entry_field, 'preserve me too')
  assert.deepEqual(first.entries['chapter-a'].extensions['fixture/entry-note'], { colour: 'blue' })
})

test('round-trips hostile object-map keys as data properties without prototype mutation', () => {
  const model = parseWorldBook('{"entries":{"__proto__":{"uid":"safe","key":[],"content":""}}}')
  const output = exportSillyTavernWorldBook(model)
  assert.equal(Object.hasOwn(output.entries, '__proto__'), true)
  assert.equal(Object.getPrototypeOf(output.entries), Object.prototype)
  assert.equal(output.entries.__proto__.uid, 'safe')
})

test('accepts and exports the direct character_book contract without parsing a card', () => {
  const model = parseCharacterBook(fixture('minimal-character-book.json'))
  assert.equal(model.settings.tokenBudget, 256)
  assert.equal(model.entries[0].position, 'after_character_definition')
  assert.equal(model.entries[0].extensions['fixture/entry'], 'keep')

  const first = exportCharacterBook(model)
  const second = exportCharacterBook(parseCharacterBook(first))
  assert.deepEqual(second, first)
  assert.equal(first.fixture_book_field, 'keep')
  assert.equal(first.entries[0].fixture_entry_field, 42)
  assert.equal(first.entries[0].extensions['fixture/entry'], 'keep')
})

test('uses current ST embedded-book fallbacks for omitted optional activation fields', () => {
  const model = parseCharacterBook({
    extensions: {},
    entries: [{ keys: ['primary'], secondary_keys: ['filter'], content: 'value', insertion_order: 1, extensions: {} }],
  })
  assert.equal(model.entries[0].enabled, false)
  assert.equal(model.entries[0].selective, false)
  assert.equal(model.entries[0].position, 'after_character_definition')
  assert.deepEqual(model.diagnostics.map(item => item.code), ['missing-required-field'])
})

test('diagnoses missing Character Book V2 required fields without losing recoverability', () => {
  const result = validateWorldBook({ entries: [{}] })
  assert.equal(result.valid, true)
  assert.equal(result.format, WORLD_BOOK_FORMATS.CHARACTER_BOOK)
  assert.equal(result.diagnostics.filter(item => item.code === 'missing-required-field').length, 6)
})

test('converts between standalone and embedded shapes while preserving model semantics', () => {
  const standalone = parseSillyTavernWorldBook(fixture('minimal-world-book.json'))
  const embedded = exportCharacterBook(standalone)
  const reparsed = parseCharacterBook(embedded)
  assert.equal(reparsed.entries[0].uid, 7)
  assert.deepEqual(reparsed.entries[0].keys, standalone.entries[0].keys)
  assert.equal(reparsed.entries[0].position, 'at_depth')
  assert.equal(reparsed.entries[0].extensions['fixture/entry-note'].colour, 'blue')

  const back = exportSillyTavernWorldBook(reparsed)
  assert.equal(Object.values(back.entries)[0].position, 4)
  assert.equal(Object.values(back.entries)[0].role, 2)
})

test('reports structural errors without throwing from validate and throws diagnostics from parse', () => {
  const missing = validateWorldBook({ name: 'no entries' })
  assert.equal(missing.valid, false)
  assert.equal(missing.diagnostics[0].code, 'missing-entries')

  const wrongEntry = validateWorldBook({ entries: { bad: 3 } })
  assert.equal(wrongEntry.valid, false)
  assert.equal(wrongEntry.diagnostics[0].path, '$.entries.bad')

  assert.throws(
    () => parseWorldBook('{'),
    error => error instanceof WorldBookValidationError && error.diagnostics[0].code === 'invalid-json',
  )
  assert.throws(
    () => parseCharacterBook({ entries: {} }),
    error => error instanceof WorldBookValidationError && error.diagnostics.some(item => item.code === 'format-shape-mismatch'),
  )
})

test('warns and defaults recoverable field errors while retaining raw data', () => {
  const model = parseWorldBook({ entries: { x: { uid: -2, key: 'not-array', content: 9, probability: 101 } } })
  assert.equal(model.entries[0].uid, 'x')
  assert.deepEqual(model.entries[0].keys, [])
  assert.equal(model.entries[0].content, '')
  assert.equal(model.entries[0].probability, 100)
  assert.equal(model.entries[0].source.raw.content, 9)
  assert.deepEqual(model.diagnostics.map(item => item.code), ['invalid-uid', 'invalid-string-array', 'invalid-string', 'invalid-number'])
})

test('accepts numeric strings used by legacy books with an explicit coercion diagnostic', () => {
  const model = parseWorldBook({ entries: { x: { key: ['x'], content: 'x', order: '240', depth: '6' } } })
  assert.equal(model.entries[0].insertionOrder, 240)
  assert.equal(model.entries[0].depth, 6)
  assert.deepEqual(model.diagnostics.map(item => item.code), ['coerced-number', 'coerced-number'])
})

test('stableStringify recursively sorts object keys and preserves array order', () => {
  assert.equal(stableStringify({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] }, 0), '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}')
})
