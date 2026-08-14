import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeWorldBookCandidates,
  evaluateWorldBookEntry,
  matchWorldBookKey,
  rankWorldBookEntries,
} from '../packages/world-book/src/index.js'

function entry(uid, patch = {}) {
  return {
    uid,
    keys: [String(uid)],
    secondaryKeys: [],
    content: `content-${uid}`,
    enabled: true,
    constant: false,
    selective: true,
    vectorized: false,
    insertionOrder: 100,
    probability: 100,
    useProbability: true,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    ignoreBudget: false,
    group: { name: '', override: false, weight: 100 },
    source: { key: String(uid) },
    ...patch,
  }
}

test('matches literal keys and requires explicit unsafe opt-in for JavaScript regex keys', () => {
  assert.equal(matchWorldBookKey('A Harbor', 'harbor').matched, true)
  assert.equal(matchWorldBookKey('harborside', 'harbor', { matchWholeWords: true }).matched, false)
  assert.equal(matchWorldBookKey('Harbor', 'harbor', { caseSensitive: true }).matched, false)
  const blocked = matchWorldBookKey('moon   gate', '/moon\\s+gate/i')
  assert.equal(blocked.matched, false)
  assert.equal(blocked.code, 'unsafe-regex-disabled')
  assert.equal(matchWorldBookKey('moon   gate', '/moon\\s+gate/i', { allowUnsafeRegex: true }).matched, true)
  assert.match(matchWorldBookKey('anything', '/[bad/', { allowUnsafeRegex: true }).error, /Invalid regular expression/)
  assert.equal(matchWorldBookKey('x', `/${'x'.repeat(257)}/`, { allowUnsafeRegex: true }).code, 'regex-too-long')
})

test('evaluates all four secondary-key logic modes and reports invalid regexes', () => {
  const base = entry('primary', { secondaryKeys: ['rain', 'wind'] })
  assert.equal(evaluateWorldBookEntry({ ...base, selectiveLogic: 'and_any' }, 'primary rain').eligible, true)
  assert.equal(evaluateWorldBookEntry({ ...base, selectiveLogic: 'and_all' }, 'primary rain').eligible, false)
  assert.equal(evaluateWorldBookEntry({ ...base, selectiveLogic: 'not_any' }, 'primary clear').eligible, true)
  assert.equal(evaluateWorldBookEntry({ ...base, selectiveLogic: 'not_all' }, 'primary rain').eligible, true)

  const invalid = evaluateWorldBookEntry(entry('x', { keys: ['/[bad/'] }), 'x', { allowUnsafeRegex: true })
  assert.equal(invalid.eligible, false)
  assert.equal(invalid.invalidKeys[0].set, 'primary')
})

test('keeps ranking stable after insertion-order sorting', () => {
  const ranked = rankWorldBookEntries([
    entry('a', { insertionOrder: 50 }),
    entry('b', { insertionOrder: 200 }),
    entry('c', { insertionOrder: 200 }),
  ])
  assert.deepEqual(ranked.map(item => item.uid), ['b', 'c', 'a'])
})

test('computes deterministic group, probability and budget advice from explicit rolls and costs', () => {
  const entries = [
    entry('alpha', { keys: ['signal'], insertionOrder: 300, group: { name: 'choice', override: false, weight: 25 } }),
    entry('beta', { keys: ['signal'], insertionOrder: 200, group: { name: 'choice', override: false, weight: 75 } }),
    entry('gamma', { keys: ['signal'], insertionOrder: 100, probability: 40 }),
    entry('always', { constant: true, insertionOrder: 50, ignoreBudget: true }),
  ]
  const result = computeWorldBookCandidates(entries, {
    text: 'signal',
    groupRolls: { choice: 0.5 },
    probabilityRolls: { gamma: 0.2 },
    tokenCosts: { beta: 3, gamma: 4, always: 99 },
    tokenBudget: 5,
  })

  assert.deepEqual(result.accepted.map(item => item.entry.uid), ['beta', 'always'])
  assert.deepEqual(result.rejected.map(item => [item.entry.uid, item.reason]), [
    ['alpha', 'inclusion-group-loser'],
    ['gamma', 'budget-exceeded'],
  ])
  assert.deepEqual(result.budget, { limit: 5, used: 3, remaining: 2 })
})

test('requires an explicit external vector match and never generates randomness', () => {
  const vector = entry('vector', { keys: [], vectorized: true })
  assert.equal(computeWorldBookCandidates([vector], { text: '' }).rejected[0].reason, 'external-vector-match-required')
  assert.equal(computeWorldBookCandidates([vector], { text: '', vectorMatches: { vector: true } }).accepted[0].reason, 'vector-match')

  const probability = entry('chance', { keys: ['hit'], probability: 10 })
  assert.equal(computeWorldBookCandidates([probability], { text: 'hit', probabilityRolls: { chance: 0.9 } }).rejected[0].reason, 'probability-failed')
})
