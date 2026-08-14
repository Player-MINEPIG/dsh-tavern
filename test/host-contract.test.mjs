import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../packages/preset/src/index.js'

test('selected preset enters system prompt and model call config seams', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-'))
  const sections = []
  const listeners = new Map()
  const emitted = []
  const ctx = {
    systemPrompt: { section: (section) => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: (name) => emitted.push(name),
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }

  try {
    const store = apply(ctx, { storageDir: directory })
    const preset = store.create({ id: 'active', name: 'Active preset' })
    store.update(preset.id, {
      sampling: { temperature: 0.25, maxTokens: 1024, reasoningEffort: 'low' },
      prompts: [{ ...preset.prompts[0], content: 'Contract marker' }],
    })
    store.select(preset.id)

    assert.match(sections[0].text({}), /Contract marker/)
    const callConfig = await listeners.get('agent/request')({}, async () => ({ provider: 'test', model: 'model' }))
    assert.deepEqual(callConfig, {
      provider: 'test',
      model: 'model',
      temperature: 0.25,
      maxTokens: 1024,
      reasoningEffort: 'low',
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

