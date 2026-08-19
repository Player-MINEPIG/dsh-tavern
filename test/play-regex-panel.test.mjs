import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { activeRegexBindings } from '../packages/client/src/play/regex-panel.js'

test('regex panel resolves only active preset and character bindings', () => {
  assert.deepEqual(activeRegexBindings({ selection: {
    presetId: 'preset-a',
    characterCardId: 'character-a',
    worldBookIds: ['ignored'],
  } }), { presetId: 'preset-a', characterId: 'character-a' })
  assert.deepEqual(activeRegexBindings(null), { presetId: null, characterId: null })
})

test('Mowan regex panel exposes scoped CRUD and import/export without an AI request seam', () => {
  const source = readFileSync(new URL('../packages/client/src/play/regex-panel.js', import.meta.url), 'utf8')
  for (const symbol of [
    'getRegexDocument',
    'putRegexDocument',
    'importRegexDocument',
    'normalizeRegexRule',
    'CLIENT_REFRESH_EVENT',
  ]) assert.match(source, new RegExp(symbol))
  for (const kind of ['global', 'preset', 'character']) assert.match(source, new RegExp(`['"]${kind}['"]`))
  assert.match(source, /fileInput\.current\?\.click\(\)/)
  assert.match(source, /downloadJson\(document\)/)
  assert.doesNotMatch(source, /postUserMessage|agent\/request|systemPrompt|putTimeline|getMessages/)
})
