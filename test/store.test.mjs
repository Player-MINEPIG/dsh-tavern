import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PresetStore } from '../packages/preset/src/store.js'
import { PresetRuntime } from '../packages/tavern-loader/src/preset-runtime.js'

function temporaryStore() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-test-'))
  return { directory, store: new PresetStore(directory) }
}

test('creates, edits, selects, and reloads presets under the configured plugin directory', () => {
  const { directory, store } = temporaryStore()
  try {
    const created = store.create({ id: 'created', name: 'Created preset', now: '2026-08-14T00:00:00.000Z' })
    store.update(created.id, {
      sampling: { temperature: 0.4, maxTokens: 4096, reasoningEffort: 'high' },
      prompts: [{ ...created.prompts[0], content: 'Stored prompt' }],
    }, { now: '2026-08-14T01:00:00.000Z' })
    store.select(created.id)

    const reloaded = new PresetStore(directory)
    const runtime = new PresetRuntime(reloaded)
    assert.equal(reloaded.selected().name, 'Created preset')
    assert.match(runtime.compiledSelected(), /Stored prompt/)
    assert.deepEqual(runtime.selectedCallConfig(), {
      temperature: 0.4,
      maxTokens: 4096,
      reasoningEffort: 'high',
    })
    assert.equal(JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')).selectedId, 'created')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('imports without trusting ids as paths', () => {
  const { directory, store } = temporaryStore()
  try {
    const imported = store.importSillyTavern(JSON.stringify({
      prompts: [{ identifier: 'main', content: 'Imported', role: 'system' }],
      prompt_order: [{ character_id: 100001, order: [{ identifier: 'main', enabled: true }] }],
    }), { id: 'imported', name: 'Imported' })
    assert.equal(store.get(imported.id).source.format, 'sillytavern-chat-completion')
    assert.throws(() => store.get('../outside'), /Invalid preset id/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
