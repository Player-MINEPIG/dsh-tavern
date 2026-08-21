import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { turnActionCapabilities } from '../packages/client/src/play/turn-actions.js'

test('human-triggered replies expose the complete RP action set', () => {
  assert.deepEqual(turnActionCapabilities({ triggerKind: 'user' }), {
    copy: true,
    variants: true,
    generateReply: true,
    fork: true,
    editDisplay: true,
  })
})

test('context-triggered output exposes retry through its nearest human ancestor', () => {
  assert.deepEqual(turnActionCapabilities({ triggerKind: 'context' }), {
    copy: true,
    variants: true,
    generateReply: true,
    fork: true,
    editDisplay: true,
  })
})

test('display editing uses an in-conversation multiline editor instead of browser prompt', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /dtv-play-display-editor/)
  assert.match(source, /h\('textarea'/)
  assert.match(source, /setDisplayOverride\(playthrough, turn\.id, value\)/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.doesNotMatch(source, /window\.prompt/)
  assert.match(source, /turn\.displayOverridden \? h\(Action/)
})

test('right swipe adopts the next variant or generates one at the end', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /const hasPreviousVariant = position > 0/)
  assert.match(source, /const hasNextVariant = position \+ 1 < turn\.variants\.length/)
  assert.match(source, /hasNextVariant \? \(\) => adopt\(position \+ 1\) : generate/)
  assert.match(source, /hasNextVariant \? 'play\.chat\.nextReply' : 'play\.chat\.generateReply'/)
  assert.match(source, /queueSwipeTransition\(result\.sessionId, targetPosition < position \? 'previous' : 'next', turn\.id\)/)
  assert.match(source, /queueSwipeTransition\(result\.sessionId, 'next', result\.nodeId \?\? turn\.id\)/)
  assert.doesNotMatch(source, /icon: '✦'/)
  assert.doesNotMatch(source, /play\.chat\.hideNode/)
  assert.doesNotMatch(source, /turn\.hidden/)
})

test('forking a playthrough refreshes shared sidebar classification before navigation', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /CLIENT_REFRESH_EVENT/)
  assert.match(source, /forkPlaythrough\(playthrough, turn\.id\)[\s\S]*dispatchEvent\(new Event\(CLIENT_REFRESH_EVENT\)\)[\s\S]*openSession\(result\.sessionId\)/)
})

test('a generated swipe refreshes sidebar classification after opening its session', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /createReplySwipe\(playthrough, turn\.id\)[\s\S]*openSession\(result\.sessionId\)[\s\S]*dispatchEvent\(new Event\(CLIENT_REFRESH_EVENT\)\)/)
})

test('same-playthrough rollback shares the message action row and navigates its branch session', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /rollbackPlaythrough\(playthrough, turn\.id\)/)
  assert.match(source, /play\.chat\.rollbackPlaythrough/)
  assert.match(source, /rollbackPlaythrough\(playthrough, turn\.id\)[\s\S]*openSession\(result\.sessionId\)/)
})
