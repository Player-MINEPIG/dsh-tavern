import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ResourceWorldBookBindingStore } from '../packages/tavern-loader/src/resource-world-book-policy.js'

test('preset and character world-book relations persist outside ST resource documents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-resource-world-books-'))
  try {
    const bindings = new ResourceWorldBookBindingStore(directory, {
      now: () => '2026-08-21T00:00:00.000Z',
    })
    assert.deepEqual(bindings.set('preset', 'preset-a', ['shared', 'preset-only', 'shared']), ['shared', 'preset-only'])
    assert.deepEqual(bindings.set('character', 'character-a', ['shared', 'character-only']), ['shared', 'character-only'])

    const restored = new ResourceWorldBookBindingStore(directory)
    assert.deepEqual(restored.get('preset', 'preset-a'), ['shared', 'preset-only'])
    assert.deepEqual(restored.get('character', 'character-a'), ['shared', 'character-only'])
    const stored = JSON.parse(readFileSync(join(directory, 'resource-world-book-bindings.json'), 'utf8'))
    assert.deepEqual(Object.keys(stored.bindings), ['preset', 'character'])
    assert.doesNotMatch(JSON.stringify(stored), /prompts|character_book|description/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('resource relation cleanup is scoped by owner and clears deleted world books across kinds', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-resource-world-book-cleanup-'))
  try {
    const bindings = new ResourceWorldBookBindingStore(directory)
    bindings.set('preset', 'preset-a', ['shared', 'preset-only'])
    bindings.set('character', 'character-a', ['shared', 'character-only'])
    assert.equal(bindings.clearWorldBook('shared'), true)
    assert.deepEqual(bindings.get('preset', 'preset-a'), ['preset-only'])
    assert.deepEqual(bindings.get('character', 'character-a'), ['character-only'])
    assert.equal(bindings.clearOwner('preset', 'preset-a'), true)
    assert.deepEqual(bindings.get('preset', 'preset-a'), [])
    assert.deepEqual(bindings.get('character', 'character-a'), ['character-only'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
