import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionSelectionStore, sessionPolicyConstants } from '../packages/tavern-loader/src/session-policy.js'

function agent(id, header = {}) {
  return { id, session: { header } }
}

test('session selections persist and regular forks snapshot their parent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-selection-'))
  try {
    const selections = new SessionSelectionStore(directory, {
      defaultSelection: () => ({ presetId: 'default' }),
    })
    selections.set('parent', { presetId: 'parent-preset', characterCardId: 'character-a' })
    assert.deepEqual(selections.ensureAgent(agent('child', { parentSession: 'parent', delegationDepth: 0 })), {
      presetId: 'parent-preset',
      characterCardId: 'character-a',
      userId: null,
      worldBookIds: [],
      character: {},
      rp: { active: false, source: null, followSuppressed: false, sandboxBefore: null },
    })

    selections.set('parent', { presetId: 'changed' })
    assert.equal(selections.get('child').presetId, 'parent-preset')
    assert.equal(new SessionSelectionStore(directory).get('child').characterCardId, 'character-a')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('delegated subagents start without parent or global Tavern resources', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-subagent-'))
  try {
    const selections = new SessionSelectionStore(directory, {
      defaultSelection: () => ({ presetId: 'default', worldBookIds: ['global-book'] }),
    })
    selections.set('parent', { presetId: 'parent-preset', characterCardId: 'character-a' })
    const selected = selections.ensureAgent(agent('subagent', { parentSession: 'parent', delegationDepth: 1 }))
    assert.deepEqual(selected, {
      presetId: null,
      characterCardId: null,
      userId: null,
      worldBookIds: [],
      character: {},
      rp: { active: false, source: null, followSuppressed: false, sandboxBefore: null },
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('session selection rejects unsafe or unbounded ids', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-id-'))
  try {
    const selections = new SessionSelectionStore(directory)
    assert.throws(() => selections.set('__proto__', { presetId: 'preset' }), /Invalid session id/)
    assert.throws(() => selections.set('x'.repeat(201), { presetId: 'preset' }), /Invalid session id/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('session selections migrate legacy state and discard unbounded option fields', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-migrate-'))
  const path = join(directory, 'session-selections.json')
  try {
    writeFileSync(path, JSON.stringify({
      schemaVersion: 1,
      sessions: {
        legacy: {
          presetId: 'preset-a',
          characterCardId: 'character-a',
          character: { greetingIndex: 2, injected: 'not persisted' },
        },
      },
    }))
    const selections = new SessionSelectionStore(directory, { now: () => '2026-08-15T00:00:00.000Z' })
    assert.deepEqual(selections.get('legacy').character, { greetingIndex: 2 })
    const stored = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(stored.schemaVersion, 2)
    assert.equal(stored.sessions.legacy.updatedAt, '2026-08-15T00:00:00.000Z')
    assert.equal(stored.sessions.legacy.selection.character.injected, undefined)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('session selections fail explicitly at capacity and support lifecycle deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-limit-'))
  try {
    const selections = new SessionSelectionStore(directory, { maxSessions: 2 })
    selections.set('one', { presetId: 'a' })
    selections.set('two', { presetId: 'b' })
    assert.throws(
      () => selections.set('three', { presetId: 'c' }),
      error => error?.code === 'SESSION_SELECTION_LIMIT_REACHED',
    )
    assert.equal(selections.has('three'), false)
    assert.equal(selections.deleteSession('one'), true)
    selections.set('three', { presetId: 'c' })
    assert.equal(selections.get('three').presetId, 'c')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('session selection persistence is transactional when its byte budget is exceeded', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-bytes-'))
  try {
    const selections = new SessionSelectionStore(directory, { maxStateBytes: 256 })
    assert.throws(
      () => selections.set('session-a', { worldBookIds: Array.from({ length: 100 }, (_, index) => `book-${index}`) }),
      error => error?.code === 'SESSION_SELECTION_STORAGE_LIMIT_REACHED',
    )
    assert.equal(selections.has('session-a'), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('oversized legacy session files are rejected before JSON parsing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-read-limit-'))
  try {
    writeFileSync(
      join(directory, 'session-selections.json'),
      Buffer.alloc(sessionPolicyConstants.hardMaxReadBytes + 1, 0x20),
    )
    assert.throws(
      () => new SessionSelectionStore(directory),
      error => error?.code === 'SESSION_SELECTION_FILE_TOO_LARGE',
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
