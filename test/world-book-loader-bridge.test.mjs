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
