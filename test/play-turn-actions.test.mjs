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
    hide: true,
  })
})

test('context-triggered parent output cannot be retried or swiped as a human prompt', () => {
  assert.deepEqual(turnActionCapabilities({ triggerKind: 'context' }), {
    copy: true,
    variants: false,
    generateReply: false,
    fork: true,
    editDisplay: true,
    hide: true,
  })
})

test('display editing uses an in-conversation multiline editor instead of browser prompt', () => {
  const source = readFileSync(new URL('../packages/client/src/play/turn-actions.js', import.meta.url), 'utf8')
  assert.match(source, /dtv-play-display-editor/)
  assert.match(source, /h\('textarea'/)
  assert.match(source, /setDisplayOverride\(playthrough, turn\.id, value\)/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.doesNotMatch(source, /window\.prompt/)
})
