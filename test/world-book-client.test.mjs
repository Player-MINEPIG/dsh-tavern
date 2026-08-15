import test from 'node:test'
import assert from 'node:assert/strict'
import { parseKeywords } from '../packages/world-book-library/src/client.js'

test('world-book keyword editor accepts Chinese and English comma separators', () => {
  assert.deepEqual(parseKeywords('harbor, quay，灯塔 , 港口'), ['harbor', 'quay', '灯塔', '港口'])
  assert.deepEqual(parseKeywords('，alpha,, beta，'), ['alpha', 'beta'])
})
