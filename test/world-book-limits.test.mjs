import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  WORLD_BOOK_LIMITS,
  assertWorldBookStructure,
  computeWorldBookCandidates,
  parseWorldBook,
  validateWorldBook,
} from '../packages/world-book/src/index.js'
import { WorldBookStore } from '../packages/world-book-library/src/index.js'
import { createWorldBookAdapter } from '../packages/tavern-loader/src/world-book-adapter.js'

function rawEntry(content = 'bounded') {
  return { key: [], content, constant: true, disable: false, order: 100, position: 1 }
}

function nested(depth) {
  let value = 'leaf'
  for (let index = 0; index < depth; index += 1) value = { child: value }
  return value
}

test('shared World Book limits reject excessive entries, depth, nodes, strings and keys', () => {
  assert.throws(
    () => assertWorldBookStructure({ entries: Array.from({ length: WORLD_BOOK_LIMITS.maxEntries + 1 }, () => ({})) }),
    error => error.code === 'WORLD_BOOK_ENTRY_LIMIT',
  )
  assert.throws(
    () => assertWorldBookStructure({ entries: [], extensions: nested(WORLD_BOOK_LIMITS.maxJsonDepth + 1) }),
    error => error.code === 'WORLD_BOOK_DEPTH_LIMIT',
  )
  assert.throws(
    () => assertWorldBookStructure({ entries: [], extensions: [1, 2, 3] }, { maxJsonNodes: 3 }),
    error => error.code === 'WORLD_BOOK_NODE_LIMIT',
  )
  assert.throws(
    () => assertWorldBookStructure({ entries: [], value: 'long' }, { maxStringCharacters: 3 }),
    error => error.code === 'WORLD_BOOK_STRING_LIMIT',
  )
  assert.throws(
    () => assertWorldBookStructure({ entries: [], abc: true }, { maxObjectKeyCharacters: 2 }),
    error => error.code === 'WORLD_BOOK_KEY_LIMIT',
  )
})

test('format validation reports structural limits without normalizing unbounded input', () => {
  const raw = { entries: {}, extensions: nested(WORLD_BOOK_LIMITS.maxJsonDepth + 1) }
  const validation = validateWorldBook(raw)
  assert.equal(validation.valid, false)
  assert.equal(validation.diagnostics[0].code, 'WORLD_BOOK_DEPTH_LIMIT')
  assert.throws(() => parseWorldBook(raw), /nesting may not exceed/)
})

test('standalone import, update and stored-document reads share the structural guard', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-limits-'))
  try {
    const store = new WorldBookStore(directory)
    assert.throws(
      () => store.import(JSON.stringify({ entries: Array.from({ length: WORLD_BOOK_LIMITS.maxEntries + 1 }, () => ({})) })),
      /at most 10000 entries/,
    )
    const document = store.import(JSON.stringify({ entries: { one: rawEntry() } }), { id: 'bounded' })
    assert.throws(
      () => store.update(document.id, { entries: Array.from({ length: WORLD_BOOK_LIMITS.maxEntries + 1 }, () => ({})) }),
      /at most 10000 entries/,
    )
    const corrupted = structuredClone(document)
    corrupted.book.source.raw.extensions = nested(WORLD_BOOK_LIMITS.maxJsonDepth + 1)
    assert.throws(() => store.save(corrupted), /nesting may not exceed/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('matcher and adapter bound both per-resource and aggregate entry work', () => {
  assert.throws(
    () => computeWorldBookCandidates(Array.from({ length: WORLD_BOOK_LIMITS.maxRuntimeEntries + 1 }, () => ({}))),
    error => error.code === 'WORLD_BOOK_RUNTIME_ENTRY_LIMIT',
  )

  const documents = new Map([
    ['first', { id: 'first', name: 'First', book: parseWorldBook({ entries: { one: rawEntry('FIRST') } }) }],
    ['second', { id: 'second', name: 'Second', book: parseWorldBook({ entries: { two: rawEntry('SECOND') } }) }],
  ])
  const adapter = createWorldBookAdapter({ get: id => structuredClone(documents.get(id)) }, { maxRuntimeEntries: 1 })
  const result = adapter.resolve({ selection: { worldBookIds: ['first', 'second'] }, conversationText: '' })
  assert.deepEqual(result.resources.map(resource => resource.id), ['first'])
  assert.deepEqual(result.loreEntries.map(entry => entry.content), ['FIRST'])
  assert.equal(result.diagnostics.find(item => item.code === 'WORLD_BOOK_RUNTIME_TOTAL_LIMIT')?.resourceId, 'second')
})
