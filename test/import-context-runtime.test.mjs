import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  IMPORT_CONTEXT_SECTION,
  ImportContextRuntime,
} from '../packages/tavern-loader/src/import-context-runtime.js'
import { TavernProfileLoader } from '../packages/tavern-loader/src/profile-loader.js'

function makeDocument(qa = [{ user: 'old & question', assistant: 'old <answer>' }]) {
  return JSON.stringify({ schemaVersion: 1, greeting: '<hello>', qa })
}

function makeRuntime(directory, content = makeDocument()) {
  return new ImportContextRuntime(directory, { readFile: path => ({ path, content }) })
}

test('import context claims from public input event seqs and is repeatable for the same claim', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-'))
  const content = makeDocument()
  try {
    const runtime = makeRuntime(directory, content)
    const hash = createHash('sha256').update(content).digest('hex')
    const prepared = runtime.prepare({ path: 'card/play/import-context.json', expectedHash: hash })
    assert.equal(prepared.qaCount, 1)
    runtime.bind('session-new', prepared)
    assert.equal(runtime.contextFor('session-new'), '')
    assert.equal(runtime.consumeAfterTurn('session-new'), false)
    const claim = { claimEventSeqs: [12, 12, -1, 13] }
    const prompt = runtime.contextFor('session-new', claim)
    assert.equal(IMPORT_CONTEXT_SECTION, 'pmp-dsh-tavern-import-context')
    assert.match(prompt, /imported-playthrough-context/)
    assert.match(prompt, /trust="untrusted"/)
    assert.match(prompt, /old &amp; question/)
    assert.match(prompt, /old &lt;answer&gt;/)
    assert.deepEqual(runtime.binding('session-new').claim, {
      eventSeqs: [12, 13],
      identity: 'event-seqs:12,13',
    })
    const reloaded = makeRuntime(directory, content)
    assert.match(reloaded.contextFor('session-new', { claimEventSeqs: [12, 13] }), /old &amp; question/)
    assert.equal(reloaded.contextFor('session-new', { claimEventSeqs: [14] }), '')
    assert.equal(reloaded.consumeAfterTurn('session-new', { type: 'turn/end', seq: 20, data: { turn: 1, reason: { kind: 'completed' } } }), true)
    assert.equal(reloaded.contextFor('session-new', { claimEventSeqs: [12, 13] }), '')
    assert.equal(reloaded.binding('session-new').state, 'consumed')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('import context expands Tavern macros before DSH prompt assembly', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-macros-'))
  const content = JSON.stringify({
    schemaVersion: 1,
    greeting: 'Hello {{user}} from {{char}}',
    qa: [{
      user: '{{user}} asks & waits',
      assistant: '{{char}} answers <now> {{unsupported}}',
    }],
  })
  try {
    const runtime = makeRuntime(directory, content)
    runtime.bind('macro-session', runtime.prepare('context.json'))
    const prompt = runtime.contextFor(
      'macro-session',
      { claimEventSeqs: [1] },
      { user: 'Reader', character: 'Ally' },
    )
    assert.match(prompt, /Hello Reader from Ally/)
    assert.match(prompt, /Reader asks &amp; waits/)
    assert.match(prompt, /Ally answers &lt;now&gt;/)
    assert.doesNotMatch(prompt, /\{\{/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('pending terminal events do not consume and terminal metadata closes a claim', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-terminal-'))
  try {
    const runtime = makeRuntime(directory)
    runtime.bind('pending', runtime.prepare('context.json'))
    assert.equal(runtime.consumeAfterTurn('pending', { type: 'turn/end', seq: 4, data: { turn: 1, reason: { kind: 'completed' } } }), false)
    assert.equal(runtime.binding('pending').state, 'pending')
    runtime.contextFor('pending', { claimEventSeqs: [10] })
    assert.equal(runtime.consumeAfterTurn('pending', { type: 'turn/end', seq: 5, data: { turn: 2, reason: { kind: 'aborted' } } }), true)
    assert.deepEqual(runtime.binding('pending').terminal, {
      endEventSeq: 5,
      turn: 2,
      reason: { kind: 'aborted' },
    })
    assert.equal(runtime.contextFor('pending', { claimEventSeqs: [11] }), '')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('branch lineage is pending, preserves only metadata, and rejects the old claim', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-lineage-'))
  const content = makeDocument([])
  try {
    const runtime = makeRuntime(directory, content)
    runtime.bind('source', runtime.prepare('context.json'))
    runtime.contextFor('source', { claimEventSeqs: [10] })
    runtime.consumeAfterTurn('source', { type: 'turn/end', seq: 20, data: { turn: 1, reason: { kind: 'error' } } })
    const child = runtime.copyLineageForBranch('source', 'child', 19)
    assert.equal(child.state, 'pending')
    assert.equal(child.path, 'context.json')
    assert.deepEqual(child.lineage, {
      sourceSessionId: 'source',
      sourceEndEventSeq: 20,
      sourceClaimIdentity: 'event-seqs:10',
      forkEventSeq: 19,
    })
    assert.equal(runtime.contextFor('child', { claimEventSeqs: [10] }), '')
    assert.match(runtime.contextFor('child', { claimEventSeqs: [21] }), /imported-playthrough-context/)
    assert.equal(Object.hasOwn(runtime.binding('child'), 'qa'), false)
    const reloaded = makeRuntime(directory, content)
    assert.equal(reloaded.binding('child').state, 'claimed')
    assert.equal(reloaded.binding('child').lineage.sourceSessionId, 'source')
    assert.equal(runtime.copyLineageForBranch('source', 'late', 20), null)
    assert.equal(runtime.copyLineageForBranch('source', 'too-late', 99), null)
    assert.equal(runtime.copyLineageForBranch('missing', 'missing-child', 1), null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('import context rejects changed hashes but does not impose QA/context parser limits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-bounds-'))
  try {
    const mismatch = makeRuntime(directory, JSON.stringify({ schemaVersion: 1, qa: [] }))
    assert.throws(
      () => mismatch.prepare({ path: 'import-context.json', expectedHash: 'wrong' }),
      error => error.code === 'PLAY_IMPORT_CONTEXT_HASH_MISMATCH',
    )
    const largeQa = Array.from({ length: 2_001 }, (_, index) => ({ user: `u${index}`, assistant: 'a' }))
    const oversized = makeRuntime(directory, makeDocument(largeQa))
    assert.equal(oversized.prepare('import-context.json').qaCount, 2_001)
    const huge = makeRuntime(directory, makeDocument([{ user: 'x'.repeat(300_000), assistant: '' }]))
    assert.equal(huge.prepare('import-context.json').characters > 256 * 1024, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('old pending bindings migrate when the first public claim arrives', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-migrate-'))
  const content = makeDocument([])
  try {
    writeFileSync(join(directory, 'import-context-bindings.json'), JSON.stringify({
      schemaVersion: 1,
      sessions: {
        legacy: { path: 'legacy.json', hash: createHash('sha256').update(content).digest('hex'), qaCount: 0, characters: content.length, state: 'pending' },
      },
    }))
    const runtime = makeRuntime(directory, content)
    assert.equal(runtime.contextFor('legacy'), '')
    assert.equal(runtime.binding('legacy').state, 'pending')
    assert.match(runtime.contextFor('legacy', { claimEventSeqs: [7] }), /imported-playthrough-context/)
    assert.equal(runtime.binding('legacy').state, 'claimed')
    assert.equal(runtime.binding('legacy').path, 'legacy.json')
    assert.equal(runtime.binding('legacy').hash.length, 64)
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


test('loader snapshot supplies claim metadata once to import context runtime', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-import-context-loader-'))
  const content = makeDocument([])
  let providerCalls = 0
  try {
    const runtime = makeRuntime(directory, content)
    const profile = new TavernProfileLoader({
      presetStore: { get() { throw new Error('preset should not be read') } },
      selections: { ensureAgent: () => ({ presetId: null, worldBookIds: [] }) },
    })
    profile.registerActivationContextProvider(() => {
      providerCalls += 1
      return { text: 'claimed input', metadata: { claimEventSeqs: [21] } }
    })
    runtime.bind('loader-session', runtime.prepare('context.json'))
    const snapshot = profile.forAssembleContext({ agent: { id: 'loader-session', session: { deriveMessages: () => [] } } })
    assert.deepEqual(snapshot.audit.activation.claimEventSeqs, [21])
    assert.deepEqual(snapshot.macroContext, { user: 'User', character: 'Assistant' })
    assert.match(runtime.contextFor('loader-session', snapshot.audit.activation, snapshot.macroContext), /imported-playthrough-context/)
    assert.equal(providerCalls, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
