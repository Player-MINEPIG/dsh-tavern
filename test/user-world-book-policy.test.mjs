import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  UserWorldBookBindingStore,
  composeWorldBookSelection,
  userWorldBookPolicyConstants,
} from '../packages/tavern-loader/src/user-world-book-policy.js'

test('user world-book bindings persist independently and compose explicit books first with stable deduplication', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-world-books-'))
  try {
    const bindings = new UserWorldBookBindingStore(directory, { now: () => '2026-08-15T00:00:00.000Z' })
    assert.deepEqual(bindings.set('reader-a', ['shared', 'user-only', 'shared']), ['shared', 'user-only'])
    assert.deepEqual(new UserWorldBookBindingStore(directory).get('reader-a'), ['shared', 'user-only'])
    assert.deepEqual(composeWorldBookSelection(['session-only', 'shared'], bindings.get('reader-a')), {
      explicitIds: ['session-only', 'shared'],
      userBoundIds: ['shared', 'user-only'],
      presetBoundIds: [],
      characterBoundIds: [],
      effectiveIds: ['session-only', 'shared', 'user-only'],
      duplicateIds: ['shared'],
      order: 'session-explicit-then-user-then-preset-then-character',
    })

    const stored = JSON.parse(readFileSync(join(directory, 'user-world-book-bindings.json'), 'utf8'))
    assert.deepEqual(Object.keys(stored.bindings['reader-a']), ['worldBookIds', 'updatedAt'])
    assert.doesNotMatch(JSON.stringify(stored), /description|persona/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('relationship cleanup is scoped to a deleted user or world book', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-world-book-cleanup-'))
  try {
    const bindings = new UserWorldBookBindingStore(directory)
    bindings.set('reader-a', ['shared', 'alpha'])
    bindings.set('reader-b', ['shared', 'beta'])
    assert.equal(bindings.clearWorldBook('shared'), true)
    assert.deepEqual(bindings.get('reader-a'), ['alpha'])
    assert.deepEqual(bindings.get('reader-b'), ['beta'])
    assert.equal(bindings.clearUser('reader-a'), true)
    assert.deepEqual(bindings.get('reader-a'), [])
    assert.deepEqual(bindings.get('reader-b'), ['beta'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('user world-book binding writes are bounded and transactional', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-world-book-limits-'))
  try {
    const bindings = new UserWorldBookBindingStore(directory, { maxStateBytes: 300 })
    bindings.set('reader-a', ['safe'])
    assert.throws(() => bindings.set('reader-b', Array.from({ length: 100 }, (_, index) => `book-${index}`)), error => (
      error?.code === 'USER_WORLD_BOOK_BINDING_STORAGE_LIMIT_REACHED'
    ))
    assert.deepEqual(bindings.get('reader-a'), ['safe'])
    assert.deepEqual(bindings.get('reader-b'), [])
    assert.throws(() => bindings.set('../unsafe', []), /Invalid user id/)
    assert.throws(() => bindings.set('reader-a', Array.from({ length: 101 }, (_, index) => `book-${index}`)), /at most 100/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('user world-book binding capacity fails explicitly without evicting saved intent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-world-book-capacity-'))
  try {
    const bindings = new UserWorldBookBindingStore(directory, { maxUsers: 1 })
    bindings.set('reader-a', ['book-a'])
    assert.throws(() => bindings.set('reader-b', ['book-b']), error => (
      error?.code === 'USER_WORLD_BOOK_BINDING_LIMIT_REACHED'
    ))
    assert.deepEqual(bindings.get('reader-a'), ['book-a'])
    assert.deepEqual(bindings.get('reader-b'), [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('oversized relationship files are rejected before JSON parsing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-world-book-read-limit-'))
  try {
    writeFileSync(
      join(directory, 'user-world-book-bindings.json'),
      Buffer.alloc(userWorldBookPolicyConstants.hardMaxReadBytes + 1, 0x20),
    )
    assert.throws(() => new UserWorldBookBindingStore(directory), error => (
      error?.code === 'USER_WORLD_BOOK_BINDING_FILE_TOO_LARGE'
    ))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
