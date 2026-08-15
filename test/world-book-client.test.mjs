import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveUserWorldBookSource,
  parseKeywords,
} from '../packages/world-book-library/src/client.js'

test('world-book keyword editor accepts Chinese and English comma separators', () => {
  assert.deepEqual(parseKeywords('harbor, quay，灯塔 , 港口'), ['harbor', 'quay', '灯塔', '港口'])
  assert.deepEqual(parseKeywords('，alpha,, beta，'), ['alpha', 'beta'])
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
