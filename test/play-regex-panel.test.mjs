import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  activeRegexBindings,
  activeResourceRegexRules,
  reorderRegexRules,
  reorderRegexRulesAtBoundary,
  reorderRegexScope,
  reorderRegexScopeAtBoundary,
  stageLegacyScopedRegexRules,
} from '../packages/client/src/play/regex-panel.js'

test('regex ordering moves only within the selected source inventory', () => {
  const rule = (id, kind) => ({ id, scope: { kind } })
  assert.deepEqual(
    reorderRegexRules([rule('a', 'preset'), rule('b', 'preset'), rule('c', 'preset')], 0, 2).map(item => item.id),
    ['b', 'c', 'a'],
  )
  assert.deepEqual(
    reorderRegexScope([
      rule('global-a', 'global'), rule('inactive', 'preset'), rule('global-b', 'global'), rule('global-c', 'global'),
    ], 'global', 2, 0).map(item => item.id),
    ['global-c', 'inactive', 'global-a', 'global-b'],
  )
  assert.deepEqual(
    reorderRegexRulesAtBoundary([rule('a', 'preset'), rule('b', 'preset'), rule('c', 'preset')], 0, 3).map(item => item.id),
    ['b', 'c', 'a'],
  )
  assert.deepEqual(
    reorderRegexScopeAtBoundary([
      rule('global-a', 'global'), rule('inactive', 'preset'), rule('global-b', 'global'), rule('global-c', 'global'),
    ], 'global', 2, 0).map(item => item.id),
    ['global-c', 'inactive', 'global-a', 'global-b'],
  )
})

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
    async getPresetRegexScripts(id) {
      calls.push(['preset', id])
      return { regexScripts: [{
        id: 'preset-rule', scriptName: 'Preset rule', findRegex: '/<正文>|<\\/正文>/g',
        replaceString: '', placement: [2], disabled: false, markdownOnly: true,
      }, {
        id: 'prompt-rule', scriptName: 'Prompt-only rule', findRegex: '/prompt/g',
        replaceString: '', placement: [2], disabled: false, promptOnly: true, markdownOnly: false,
      }] }
    },
    async getCharacterRegexScripts(id) {
      calls.push(['character', id])
      return { regexScripts: [{
        id: 'character-rule', scriptName: 'Character rule', findRegex: '/x/g',
        replaceString: 'y', placement: [2], disabled: true, markdownOnly: true,
      }] }
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
  assert.equal(rules.character[0].sourceRaw.findRegex, '/x/g')
})

test('legacy Tavern-local resource scopes stage into native preset and character inventories', () => {
  const rule = (id, kind, resourceId) => ({
    id,
    name: id,
    enabled: true,
    find: id,
    replace: '',
    flags: 'g',
    target: 'assistant',
    scope: { kind, resourceId },
  })
  const global = rule('global-rule', 'global', null)
  const preset = rule('preset-rule', 'preset', 'preset-a')
  const duplicatePreset = rule('already-native', 'preset', 'preset-a')
  const inactivePreset = rule('inactive-preset', 'preset', 'preset-b')
  const character = rule('character-rule', 'character', 'character-a')
  const existing = { ...duplicatePreset, sourceRaw: { id: 'already-native' } }
  const result = stageLegacyScopedRegexRules({
    schemaVersion: 1,
    rules: [global, preset, duplicatePreset, inactivePreset, character],
  }, {
    preset: [existing],
    character: [],
  }, {
    presetId: 'preset-a',
    characterId: 'character-a',
  })

  assert.deepEqual(result.document.rules.map(item => item.id), ['global-rule', 'inactive-preset'])
  assert.deepEqual(result.resourceRules.preset.map(item => item.id), ['already-native', 'preset-rule'])
  assert.deepEqual(result.resourceRules.character.map(item => item.id), ['character-rule'])
  assert.equal(result.resourceRules.preset[1].sourceDisplayEligible, true)
  assert.equal(result.migrated, 3)
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
  assert.match(source, /downloadRegexScripts\(rules, kind\)/)
  assert.match(source, /exportNativeRegexScripts\(rules\)/)
  assert.match(source, /onClick: \(\) => exportJson\(rules\)/)
  assert.match(source, /putPresetRegexScripts/)
  assert.match(source, /putCharacterRegexScripts/)
  assert.match(source, /kind === 'global'/)
  assert.match(source, /setResourceRules/)
  assert.match(source, /stageLegacyScopedRegexRules/)
  assert.match(source, /removeSourceRule/)
  assert.match(source, /setPointerCapture/)
  assert.match(source, /regexInsertionBoundary/)
  assert.match(source, /RegexDropPlaceholder/)
  assert.match(source, /data-dragging/)
  assert.match(source, /reorderRegexScope/)
  assert.match(source, /reorderRegexRules/)
  assert.doesNotMatch(source, /busy \|\|= sourceOwned/)
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

test('regex panel remains the wheel scrollport over disabled source-owned controls', () => {
  const source = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  assert.match(source, /\.dtv-regex-panel \.dtv-body\{flex:1 1 auto;overscroll-behavior:contain\}/)
  assert.match(source, /\.dtv-regex-rule \.dtv-textarea:disabled\{pointer-events:none\}/)
})
