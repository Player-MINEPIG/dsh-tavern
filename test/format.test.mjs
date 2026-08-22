import test from 'node:test'
import assert from 'node:assert/strict'
import {
  exportSillyTavernPreset,
  parseSillyTavernPreset,
  renderSillyTavernMacros,
} from '../packages/tavern-format/src/index.js'
import {
  compilePresetForDsh,
  projectPresetCallConfig,
} from '../packages/tavern-loader/src/profile-compiler.js'

function sample() {
  return {
    temperature: 0.7,
    openai_max_tokens: 2048,
    reasoning_effort: 'medium',
    top_p: 0.9,
    prompts: [
      { identifier: 'unused', name: 'Unused', role: 'system', content: 'do not include' },
      { identifier: 'main', name: 'Main', role: 'system', content: 'Hello {{user}}' },
      { identifier: 'vars', name: 'Variables', role: 'user', content: '{{setvar::tone::warm}}{{getvar::tone}}' },
      { identifier: 'marker', name: 'Marker', marker: true, role: 'system', content: 'marker text' },
    ],
    prompt_order: [
      { character_id: 100000, order: [{ identifier: 'unused', enabled: true }] },
      {
        character_id: 100001,
        order: [
          { identifier: 'main', enabled: true },
          { identifier: 'vars', enabled: true },
          { identifier: 'marker', enabled: true },
          { identifier: 'unused', enabled: false },
        ],
      },
    ],
    extensions: { future: { retained: true } },
  }
}
test('exports the current normalized preset as ST JSON while preserving unknown fields', () => {

  const imported = parseSillyTavernPreset(sample(), {
    id: 'export-fixture',
    name: 'Before edit',
    now: '2026-08-14T00:00:00.000Z',
  })
  const edited = {
    ...imported,
    name: 'After edit',
    sampling: {
      ...imported.sampling,
      temperature: 1.1,
      maxTokens: 4096,
      reasoningEffort: 'high',
      stop: ['STOP'],
      st: { ...imported.sampling.st, top_p: 0.8 },
    },
    prompts: [
      {
        ...imported.prompts.find(prompt => prompt.identifier === 'vars'),
        name: 'Variables edited',
        content: 'Edited content',
        enabled: false,
      },
      {
        identifier: 'added',
        name: 'Added',
        role: 'assistant',
        content: 'New prompt',
        enabled: true,
        marker: false,
        systemPrompt: false,
        st: { future_prompt_field: true },
      },
    ],
  }

  const exported = JSON.parse(exportSillyTavernPreset(edited))
  assert.equal(exported.name, 'After edit')
  assert.equal(exported.temperature, 1.1)
  assert.equal(exported.openai_max_tokens, 4096)
  assert.equal(exported.reasoning_effort, 'high')
  assert.equal(exported.top_p, 0.8)
  assert.deepEqual(exported.stop, ['STOP'])
  assert.equal(exported.extensions.future.retained, true)
  assert.deepEqual(exported.prompts.map(prompt => prompt.identifier), ['vars', 'added'])
  assert.equal(exported.prompts[0].content, 'Edited content')
  assert.equal(exported.prompts[1].future_prompt_field, true)
  assert.deepEqual(exported.prompt_order.find(order => order.character_id === 100001).order, [
    { identifier: 'vars', enabled: false },
    { identifier: 'added', enabled: true },
  ])
  assert.deepEqual(exported.prompt_order.find(order => order.character_id === 100000).order, [{ identifier: 'unused', enabled: true }])
})

test('imports ST Chat Completion order and preserves unknown data', () => {
  const preset = parseSillyTavernPreset(sample(), {
    id: 'fixture',
    name: 'Fixture',
    now: '2026-08-14T00:00:00.000Z',
  })
  assert.equal(preset.source.selectedOrderCharacterId, 100001)
  assert.equal(preset.prompts[0].identifier, 'main')
  assert.equal(preset.prompts.find((prompt) => prompt.identifier === 'unused').enabled, false)
  assert.equal(preset.source.raw.extensions.future.retained, true)
  assert.deepEqual(projectPresetCallConfig(preset), {
    temperature: 0.7,
    maxTokens: 2048,
    reasoningEffort: 'medium',
  })
})

test('compiles enabled non-marker prompts and removes dsh-conflicting macros', () => {
  const preset = parseSillyTavernPreset(sample(), { id: 'fixture', name: 'Fixture' })
  const text = compilePresetForDsh(preset, { user: 'Reviewer', random: () => 0 })
  assert.match(text, /dsh-tavern selected preset/)
  assert.match(text, /Hello Reviewer/)
  assert.match(text, /warm/)
  assert.doesNotMatch(text, /do not include|marker text/)
  assert.doesNotMatch(text, /\{\{[\s\S]*?\}\}/)
})

test('supports deterministic ST random and roll macros', () => {
  assert.equal(renderSillyTavernMacros('{{random::a,b,c}} {{roll 2d6}}', { random: () => 0 }), 'a 2')
  assert.equal(renderSillyTavernMacros('before {{unknown::value}} after'), 'before  after')
})

test('rejects non-preset JSON', () => {
  assert.throws(() => parseSillyTavernPreset('{}'), /prompts array/)
  assert.throws(() => parseSillyTavernPreset('{'), /Invalid JSON/)
})

test('system prompt replacement is opt-in and editable', async () => {
  const { createBlankPreset, editPreset } = await import('../packages/tavern-format/src/index.js')
  const preset = createBlankPreset({ id: 'mode' })
  assert.equal(preset.systemPromptMode, 'append')
  assert.equal(editPreset(preset, { systemPromptMode: 'replace' }).systemPromptMode, 'replace')
  assert.equal(editPreset(preset, { systemPromptMode: 'invalid' }).systemPromptMode, 'append')
})
