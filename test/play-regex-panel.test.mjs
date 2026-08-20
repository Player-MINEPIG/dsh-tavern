import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  activeRegexBindings,
  activeResourceRegexRules,
} from '../packages/client/src/play/regex-panel.js'

test('regex panel resolves only active preset and character bindings', () => {
  assert.deepEqual(activeRegexBindings({ selection: {
    presetId: 'preset-a',
    characterCardId: 'character-a',
    worldBookIds: ['ignored'],
  } }), { presetId: 'preset-a', characterId: 'character-a' })
  assert.deepEqual(activeRegexBindings(null), { presetId: null, characterId: null })
})

test('regex panel loads source-owned rules from the active preset and character', async () => {
  const calls = []
  const rules = await activeResourceRegexRules({
    async getPreset(id) {
      calls.push(['preset', id])
      return { preset: { source: { raw: { extensions: { regex_scripts: [{
        id: 'preset-rule', scriptName: 'Preset rule', findRegex: '/<正文>|<\\/正文>/g',
        replaceString: '', placement: [2], disabled: false, markdownOnly: true,
      }, {
        id: 'prompt-rule', scriptName: 'Prompt-only rule', findRegex: '/prompt/g',
        replaceString: '', placement: [2], disabled: false, promptOnly: true, markdownOnly: false,
      }] } } } } }
    },
    async getCharacter(id) {
      calls.push(['character', id])
      return { character: { source: { raw: { data: { extensions: { regex_scripts: [{
        id: 'character-rule', scriptName: 'Character rule', findRegex: '/x/g',
        replaceString: 'y', placement: [2], disabled: true, markdownOnly: true,
      }] } } } } } }
    },
  }, { presetId: 'preset-a', characterId: 'character-a' })

  assert.deepEqual(calls, [['preset', 'preset-a'], ['character', 'character-a']])
  assert.equal(rules.preset[0].name, 'Preset rule')
  assert.equal(rules.preset[0].enabled, true)
  assert.equal(rules.preset[0].sourceDisplayEligible, true)
  assert.equal(rules.preset[1].name, 'Prompt-only rule')
  assert.equal(rules.preset[1].sourceDisplayEligible, false)
  assert.equal(rules.character[0].name, 'Character rule')
  assert.equal(rules.character[0].enabled, false)
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

test('regex panel renders global, preset-bound and character-bound sections without scope tabs', () => {
  const source = readFileSync(new URL('../packages/client/src/play/regex-panel.js', import.meta.url), 'utf8')
  assert.match(source, /SCOPE_KINDS\.map\(kind => h\(RegexScopeSection/)
  assert.match(source, /className: 'dtv-resource dtv-regex-section'/)
  assert.match(source, /importScope\.current = kind/)
  assert.match(source, /scopeFor\(importScope\.current, bindings\)/)
  assert.doesNotMatch(source, /role: 'tab'/)
  assert.doesNotMatch(source, /setScopeKind|scopeKind/)
})
