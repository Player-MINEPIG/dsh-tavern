import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compilePreset,
  parseSillyTavernPreset,
  renderSillyTavernMacros,
  supportedCallConfig,
} from '../packages/tavern-format/src/index.js'

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
  assert.deepEqual(supportedCallConfig(preset), {
    temperature: 0.7,
    maxTokens: 2048,
    reasoningEffort: 'medium',
  })
})

test('compiles enabled non-marker prompts and removes dsh-conflicting macros', () => {
  const preset = parseSillyTavernPreset(sample(), { id: 'fixture', name: 'Fixture' })
  const text = compilePreset(preset, { user: 'Reviewer', random: () => 0 })
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

