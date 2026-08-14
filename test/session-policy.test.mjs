import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'

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
      worldBookIds: [],
      character: {},
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
      worldBookIds: [],
      character: {},
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
