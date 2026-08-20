import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyDisplayRegex,
  importRegexDocument,
  normalizeRegexDocument,
  resourceRegexRules,
} from '../packages/client/src/play/regex.js'

test('ST regex import preserves each original switch without a safety override', () => {
  const rules = importRegexDocument({
    regex_scripts: [
      { script_name: 'enabled rule', findRegex: '/Alice/g', replaceString: 'A', disabled: false },
      { script_name: 'disabled rule', findRegex: '/secret/g', replaceString: 'x', disabled: true },
      { name: 'explicit enabled false', find: 'tool', replace: 'x', enabled: false },
    ],
  }, { scope: { kind: 'character', resourceId: 'character-a' } })
  assert.deepEqual(rules.map(rule => rule.enabled), [true, false, false])
  assert.deepEqual(rules.map(rule => rule.scope), [
    { kind: 'character', resourceId: 'character-a' },
    { kind: 'character', resourceId: 'character-a' },
    { kind: 'character', resourceId: 'character-a' },
  ])
})

test('ST native regex fields are normalized without losing display semantics', () => {
  const [rule] = importRegexDocument({
    extensions: { regex_scripts: [{
      id: 'native', scriptName: 'Native', findRegex: '/(——)/g', replaceString: '$1',
      trimStrings: ['—'], placement: [1, 2], disabled: false, markdownOnly: true,
      promptOnly: true, runOnEdit: true, substituteRegex: 2, minDepth: 1, maxDepth: 4,
    }] },
  })
  assert.deepEqual(rule, {
    id: 'native', name: 'Native', enabled: true, find: '/(——)/g', replace: '$1', flags: '',
    target: 'both', scope: { kind: 'global', resourceId: null }, placement: [1, 2],
    trimStrings: ['—'], markdownOnly: true, promptOnly: true, runOnEdit: true,
    substituteRegex: 2, minDepth: 1, maxDepth: 4, ext: {},
  })
})

test('ST deprecated MD display placement is migrated like SillyTavern', () => {
  const [rule] = importRegexDocument({ regex_scripts: [{
    id: 'legacy-display', findRegex: '/x/g', replaceString: 'y', placement: [0],
  }] })
  assert.deepEqual(rule.placement, [1, 2, 3, 5, 6])
  assert.equal(rule.markdownOnly, true)
  assert.equal(rule.promptOnly, true)
  assert.equal(rule.target, 'both')
})

test('display regex observes scope, target and order while invalid rules only diagnose', () => {
  const document = normalizeRegexDocument({ rules: [
    { id: 'global', name: 'global', enabled: true, find: '/Alice/g', replace: 'A', target: 'assistant', scope: { kind: 'global' } },
    { id: 'preset', name: 'preset', enabled: true, find: 'A', replace: 'B', target: 'assistant', scope: { kind: 'preset', resourceId: 'preset-a' } },
    { id: 'wrong-card', name: 'wrong', enabled: true, find: 'B', replace: 'C', target: 'assistant', scope: { kind: 'character', resourceId: 'character-b' } },
    { id: 'disabled', name: 'disabled', enabled: false, find: 'B', replace: 'X', target: 'assistant', scope: { kind: 'global' } },
    { id: 'invalid', name: 'invalid', enabled: true, find: '/[/', replace: 'X', target: 'assistant', scope: { kind: 'global' } },
  ] })
  const result = applyDisplayRegex('Alice', document.rules, { presetId: 'preset-a', characterId: 'character-a' })
  assert.equal(result.text, 'B')
  assert.equal(result.diagnostics.length, 1)
  assert.equal(applyDisplayRegex('Alice', document.rules, {}, 'user').text, 'Alice')
})

test('display regex is a pure projection and cannot mutate request or history data', () => {
  const request = { text: 'Alice', content: [{ type: 'text', text: 'Alice' }] }
  const before = structuredClone(request)
  const rules = normalizeRegexDocument({ rules: [{
    id: 'r', name: 'r', enabled: true, find: 'Alice', replace: 'A', scope: { kind: 'global' }, target: 'both',
  }] }).rules
  assert.equal(applyDisplayRegex(request.text, rules, {}, 'user').text, 'A')
  assert.deepEqual(request, before)
})

test('display regex supports ST match tokens, trim strings and depth bounds', () => {
  const rules = importRegexDocument({ regex_scripts: [{
    id: 'native-replace', scriptName: 'Native replace', findRegex: '/(?<dash>——)/g',
    replaceString: '$<dash>|{{match}}', trimStrings: ['—'], placement: [2],
    disabled: false, markdownOnly: true, minDepth: 1, maxDepth: 2,
  }] })
  assert.equal(applyDisplayRegex('A——B', rules, {}, 'assistant', { depth: 0 }).text, 'A——B')
  assert.equal(applyDisplayRegex('A——B', rules, {}, 'assistant', { depth: 1 }).text, 'A|B')
  assert.equal(applyDisplayRegex('A——B', rules, {}, 'assistant', { depth: 3 }).text, 'A——B')
})

test('resource regex import finds preserved V2 card and preset sources without reimporting', () => {
  const characterRules = resourceRegexRules({
    source: { raw: { data: { extensions: { regex_scripts: [
      { id: 'both', scriptName: 'Both', findRegex: '/Alice/g', replaceString: 'A', placement: [1, 2], disabled: false },
      { id: 'prompt', scriptName: 'Prompt only', findRegex: '/secret/g', replaceString: 'x', placement: [2], promptOnly: true },
      { id: 'disabled', scriptName: 'Disabled', findRegex: '/off/g', replaceString: 'x', placement: [2], disabled: true },
    ] } } } },
  }, { kind: 'character', resourceId: 'character-a' })
  assert.deepEqual(characterRules.map(rule => ({ id: rule.id, enabled: rule.enabled, target: rule.target })), [
    { id: 'both', enabled: true, target: 'both' },
    { id: 'disabled', enabled: false, target: 'assistant' },
  ])

  const presetRules = resourceRegexRules({
    source: { raw: { regex_scripts: [
      { id: 'user', script_name: 'User', findRegex: '/Alice/g', replaceString: 'U', placement: [1] },
    ] } },
  }, { kind: 'preset', resourceId: 'preset-a' })
  assert.equal(presetRules[0].target, 'user')
  assert.deepEqual(presetRules[0].scope, { kind: 'preset', resourceId: 'preset-a' })
  assert.deepEqual(resourceRegexRules({ source: { raw: { name: 'No scripts' } } }, {
    kind: 'preset', resourceId: 'preset-b',
  }), [])
})
