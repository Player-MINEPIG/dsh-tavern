import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  IMPORT_CONTEXT_SECTION,
  ImportContextRuntime,
} from '../packages/tavern-loader/src/import-context-runtime.js'

test('import context is hash-bound, request-only, escaped, and consumed after one turn', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-'))
  const content = JSON.stringify({
    schemaVersion: 1,
    greeting: '<hello>',
    qa: [{ user: 'old & question', assistant: 'old <answer>' }],
  })
  const workspace = { readFile: path => ({ path, content }) }
  try {
    const runtime = new ImportContextRuntime(directory, workspace)
    const hash = createHash('sha256').update(content).digest('hex')
    const prepared = runtime.prepare({ path: 'card/play/import-context.json', expectedHash: hash })
    assert.equal(prepared.qaCount, 1)
    runtime.bind('session-new', prepared)
    const prompt = runtime.contextFor('session-new')
    assert.equal(IMPORT_CONTEXT_SECTION, 'pmp-dsh-tavern-import-context')
    assert.match(prompt, /imported-playthrough-context/)
    assert.match(prompt, /trust="untrusted"/)
    assert.match(prompt, /old &amp; question/)
    assert.match(prompt, /old &lt;answer&gt;/)
    assert.equal(runtime.consumeAfterTurn('session-new'), true)
    assert.equal(runtime.contextFor('session-new'), '')
    assert.equal(runtime.binding('session-new').state, 'consumed')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('import context rejects changed hashes and conservative oversize input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-bounds-'))
  try {
    const mismatch = new ImportContextRuntime(directory, {
      readFile: path => ({ path, content: JSON.stringify({ schemaVersion: 1, qa: [] }) }),
    })
    assert.throws(
      () => mismatch.prepare({ path: 'import-context.json', expectedHash: 'wrong' }),
      error => error.code === 'PLAY_IMPORT_CONTEXT_HASH_MISMATCH',
    )
    const oversized = new ImportContextRuntime(directory, {
      readFile: path => ({ path, content: JSON.stringify({ schemaVersion: 1, qa: [{ user: 'x'.repeat(300_000), assistant: '' }] }) }),
    })
    assert.throws(
      () => oversized.prepare('import-context.json'),
      error => error.code === 'PLAY_IMPORT_CONTEXT_TOO_LARGE',
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('pending import context can be replaced and unbound before use', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-mutable-'))
  const workspace = { readFile: path => ({ path, content: JSON.stringify({ schemaVersion: 1, qa: [] }) }) }
  try {
    const runtime = new ImportContextRuntime(directory, workspace)
    runtime.bind('session-empty', runtime.prepare('first.json'))
    runtime.bind('session-empty', runtime.prepare('second.json'))
    assert.equal(runtime.binding('session-empty').path, 'second.json')
    assert.equal(runtime.unbind('session-empty'), true)
    assert.equal(runtime.binding('session-empty'), null)
    assert.equal(runtime.unbind('session-empty'), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
