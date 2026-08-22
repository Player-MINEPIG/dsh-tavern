import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveUserWorldBookSource,
  parseKeywords,
  reconcileKeywordEditorText,
  reorderWorldBookEntriesAtBoundary,
} from '../packages/world-book-library/src/client.js'

test('world-book keyword editor accepts Chinese and English comma separators', () => {
  assert.deepEqual(parseKeywords('harbor, quay，灯塔 , 港口'), ['harbor', 'quay', '灯塔', '港口'])
  assert.deepEqual(parseKeywords('，alpha,, beta，'), ['alpha', 'beta'])
})

test('world-book keyword editor preserves an in-progress delimiter while syncing parsed keywords', () => {
  assert.equal(reconcileKeywordEditorText('harbor,', ['harbor']), 'harbor,')
  assert.equal(reconcileKeywordEditorText('港口，', ['港口']), '港口，')
  assert.equal(reconcileKeywordEditorText('harbor, 灯塔', ['harbor', '灯塔']), 'harbor, 灯塔')
  assert.equal(reconcileKeywordEditorText('stale, value', ['fresh', '灯塔']), 'fresh, 灯塔')
  assert.equal(reconcileKeywordEditorText(',', []), ',')
})

test('world-book panel derives ordered user bindings and deduplication from the active loader snapshot', () => {
  const source = deriveUserWorldBookSource({
    resources: {
      user: { id: 'user-a', name: '测试用户' },
      worldBooks: [
        { id: 'shared', name: '共享书', bindingSources: ['session', 'user'] },
        { id: 'user-only', name: '用户书', bindingSources: ['user'] },
      ],
    },
    worldBookSelection: {
      explicitIds: ['session-only', 'shared'],
      userBoundIds: ['shared', 'user-only'],
      effectiveIds: ['session-only', 'shared', 'user-only'],
      duplicateIds: ['shared'],
    },
  }, {
    worldBooks: [
      { id: 'shared', name: '旧目录名' },
      { id: 'user-only', name: '用户书' },
    ],
  })

  assert.deepEqual(source, {
    user: { id: 'user-a', name: '测试用户' },
    books: [
      { id: 'shared', name: '共享书', duplicate: true },
      { id: 'user-only', name: '用户书', duplicate: false },
    ],
  })
  assert.deepEqual(deriveUserWorldBookSource(null, null), { user: null, books: [] })
})

test('world-book entry dragging uses preset-style boundaries and updates runtime priority', () => {
  const entries = [
    { uid: 1, insertionOrder: 100 },
    { uid: 2, insertionOrder: 50 },
    { uid: 3, insertionOrder: 25 },
  ]
  assert.deepEqual(
    reorderWorldBookEntriesAtBoundary(entries, 2, 0).map(entry => [entry.uid, entry.insertionOrder]),
    [[3, 300], [1, 200], [2, 100]],
  )
  assert.equal(reorderWorldBookEntriesAtBoundary(entries, 1, 2), entries)

  const embedded = reorderWorldBookEntriesAtBoundary([
    { id: 1, insertion_order: 100 },
    { id: 2, insertion_order: 100 },
  ], 0, 2, 'insertion_order')
  assert.deepEqual(embedded.map(entry => [entry.id, entry.insertion_order]), [[2, 200], [1, 100]])
})
