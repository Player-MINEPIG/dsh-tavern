import test from 'node:test'
import assert from 'node:assert/strict'
import { loadChatState } from '../packages/client/src/play/chat.js'
import { loadPlaythroughExport, playthroughExportDocument } from '../packages/client/src/play/export.js'
import { greetingDisplayFixture } from '../scripts/fixtures/greeting-display.js'

test('greeting composes display rules, folds variables and renders the status template without changing sources', async () => {
  const f = greetingDisplayFixture()
  const before = structuredClone({ character: f.character, timeline: f.timeline, messages: f.messages })
  const state = await loadChatState(f.client, 'session', f.playthrough)
  assert.match(state.greeting.text, /^Greetings Reader/)
  assert.match(state.greeting.text, /<details><summary>Variable updates<\/summary>/)
  assert.match(state.greeting.text, /<section class="greeting-status">/)
  assert.doesNotMatch(state.greeting.text, /StatusPlaceHolderImpl|UpdateVariable|PROMPT ONLY|DISABLED|USER ONLY|WRONG CARD/)
  assert.equal(state.turns.length, 0)
  assert.deepEqual(state.regexDiagnostics, [])
  assert.deepEqual({ character: f.character, timeline: f.timeline, messages: f.messages }, before)

  f.selection.character.greetingIndex = 1
  const alternate = await loadChatState(f.client, 'session', f.playthrough)
  assert.match(alternate.greeting.text, /^Alternate Guide/)
  assert.match(alternate.greeting.text, /Character status/)
  assert.equal(alternate.greeting.index, 1)
  assert.equal(alternate.greeting.options[1].text, f.character.data.alternateGreetings[0])
})

test('greeting respects depth, reports invalid rules and retains empty selected alternates', async () => {
  const f = greetingDisplayFixture()
  f.rules.push({ id: 'depth', find: 'Welcome', replace: 'DEPTH ZERO', maxDepth: 0 })
  let state = await loadChatState(f.client, 'session', f.playthrough)
  assert.match(state.greeting.text, /^DEPTH ZERO Reader/)
  f.timeline.nodes.push({ id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: 'session', startEventId: 1, endEventId: 2 }] })
  f.messages.messages.push({ role: 'user', seq: 1, text: 'Q' }, { role: 'assistant', seq: 2, text: 'A' })
  state = await loadChatState(f.client, 'session', f.playthrough)
  assert.match(state.greeting.text, /^Greetings Reader/)
  assert.equal((await loadPlaythroughExport(f.client, f.playthrough)).displayGreeting, state.greeting.text)
  f.rules.push({ id: 'invalid', find: '/(/g', replace: '', minDepth: 2 })
  state = await loadChatState(f.client, 'session', f.playthrough)
  assert.equal(state.regexDiagnostics.length, 1)
  assert.equal(state.regexDiagnostics[0].ruleId, 'invalid')
  f.selection.character.greetingIndex = 2
  f.rules.push({ id: 'insert', find: '^$', replace: 'Should stay empty' })
  state = await loadChatState(f.client, 'session', f.playthrough)
  assert.equal(state.greeting.text, '')
})

test('HTML exports rendered greeting while JSONL retains name-expanded source swipes', async () => {
  const f = greetingDisplayFixture()
  for (const index of [0, 1]) {
    f.selection.character.greetingIndex = index
    const state = await loadChatState(f.client, 'session', f.playthrough)
    const snapshot = await loadPlaythroughExport(f.client, f.playthrough)
    assert.equal(snapshot.displayGreeting, state.greeting.text)
    assert.match(playthroughExportDocument(snapshot, 'html').content, /Character status/)
    const rows = playthroughExportDocument(snapshot, 'st').content.trim().split('\n').map(JSON.parse)
    assert.match(rows[1].mes, /<StatusPlaceHolderImpl\/>/)
    assert.doesNotMatch(rows[1].mes, /Character status|\{\{(?:user|char)\}\}/)
    assert.equal(rows[1].swipe_id, index)
    assert.match(rows[1].swipes[0], /^Hello Reader/)
    assert.match(rows[1].swipes[1], /^Alternate Guide/)
  }
})
