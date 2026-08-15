import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeWorldBookCandidates,
  mergeWorldBookLoaderResults,
  parseWorldBook,
  projectWorldBookForLoader,
} from '../packages/world-book/src/index.js'

function model(position, content = 'Lore content') {
  return parseWorldBook({
    name: 'Bridge fixture',
    entries: {
      1: { uid: 1, key: [], content, constant: true, position },
    },
  })
}

test('projects exact ST before/after positions to the loader adapter contract', () => {
  const before = model(0)
  const beforeResult = projectWorldBookForLoader(before, computeWorldBookCandidates(before), { resourceId: 'book-a' })
  assert.deepEqual(beforeResult.loreEntries, [{ id: 'book-a:1', uid: 1, content: 'Lore content', position: 'before' }])
  assert.deepEqual(beforeResult.resources, [{
    id: 'book-a',
    name: 'Bridge fixture',
    format: 'sillytavern-world-info',
    entryCount: 1,
    matchedEntryCount: 1,
    activeEntryIds: ['book-a:1'],
  }])
  assert.deepEqual(beforeResult.diagnostics, [])

  const after = model(1)
  assert.equal(projectWorldBookForLoader(after, computeWorldBookCandidates(after)).loreEntries[0].position, 'after')
})

test('reports honest loader degradation for depth and outlet positions', () => {
  const depth = model(4)
  const depthResult = projectWorldBookForLoader(depth, computeWorldBookCandidates(depth), { resourceId: 'depth-book' })
  assert.equal(depthResult.loreEntries[0].position, 'after')
  assert.equal(depthResult.diagnostics[0].code, 'WORLD_BOOK_POSITION_APPROXIMATED')

  const outlet = model(7)
  const outletResult = projectWorldBookForLoader(outlet, computeWorldBookCandidates(outlet), { resourceId: 'outlet-book' })
  assert.deepEqual(outletResult.loreEntries, [])
  assert.equal(outletResult.diagnostics[0].code, 'WORLD_BOOK_OUTLET_SKIPPED')
})

test('omits empty content, forwards parser diagnostics, and merges selected books purely', () => {
  const empty = model(0, '')
  empty.diagnostics.push({ code: 'fixture-warning', severity: 'warning', path: '$', message: 'fixture' })
  const projected = projectWorldBookForLoader(empty, computeWorldBookCandidates(empty), { resource: { id: 'empty', selected: true } })
  assert.deepEqual(projected.loreEntries, [])
  assert.deepEqual(projected.diagnostics.map(item => item.code), ['fixture-warning', 'WORLD_BOOK_EMPTY_CONTENT_SKIPPED'])
  assert.equal(projected.resources[0].selected, true)

  const merged = mergeWorldBookLoaderResults([projected, { loreEntries: [{ uid: 2, content: 'x', position: 'after' }], resources: [], diagnostics: [] }])
  assert.equal(merged.loreEntries.length, 1)
  assert.equal(merged.resources.length, 1)
  assert.equal(merged.diagnostics.length, 2)
})

test('reports regex keys blocked by the safe default', () => {
  const regex = parseWorldBook({
    name: 'Regex fixture',
    entries: {
      1: { uid: 1, key: ['/a+/'], content: 'Regex lore', constant: false, position: 1 },
    },
  })
  const projected = projectWorldBookForLoader(regex, computeWorldBookCandidates(regex, { text: 'aaa' }), { resourceId: 'regex' })
  assert.deepEqual(projected.loreEntries, [])
  assert.equal(projected.diagnostics[0].code, 'WORLD_BOOK_REGEX_DISABLED')
})

test('audit distinguishes configured main keywords from the keywords matched this turn', () => {
  const keyed = parseWorldBook({
    name: 'Keyword audit fixture',
    entries: {
      1: { uid: 1, key: ['港口', 'harbor'], keysecondary: ['钟声'], content: 'Matched lore', position: 1 },
    },
  })
  const projected = projectWorldBookForLoader(
    keyed,
    computeWorldBookCandidates(keyed, { text: 'The harbor is open，钟声响起。' }),
    { resourceId: 'keyword-audit' },
  )
  const decision = projected.audit.resources[0].decisions[0]
  assert.equal(decision.decision, 'included')
  assert.deepEqual(decision.primaryKeys, ['港口', 'harbor'])
  assert.deepEqual(decision.secondaryKeys, ['钟声'])
  assert.deepEqual(decision.primaryMatches, ['harbor'])
  assert.deepEqual(decision.secondaryMatches, ['钟声'])
})
