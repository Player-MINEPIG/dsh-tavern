import test from 'node:test'
import assert from 'node:assert/strict'
import {
  latestTurnFailed,
  sessionFailed,
  submissionInProgress,
} from '../packages/client/src/play/chat-failure.js'

const chat = (...reasons) => ({ timeline: {
  turnOrder: reasons.map((_, index) => index),
  turns: new Map(reasons.map((reason, turn) => [turn, {
    turn,
    end: reason === null ? undefined : { data: { reason } },
  }])),
} })

test('terminal errors do not depend on provider code or message', () => {
  for (const error of [
    { code: 'authentication', message: 'Invalid key' },
    { code: 'rate-limit' }, { code: 'timeout' }, { code: 'future-error' }, {},
  ]) assert.equal(latestTurnFailed(chat({ kind: 'error', error })), true)
})

test('only the latest turn can raise a terminal notice', () => {
  const failure = { kind: 'error', error: {} }
  for (const next of [null, { kind: 'completed' }, { kind: 'aborted' }]) {
    assert.equal(latestTurnFailed(chat(failure, next)), false)
  }
  assert.equal(latestTurnFailed(chat()), false)
  assert.equal(latestTurnFailed(chat(failure, { kind: 'completed' }, failure)), true)
})

test('retry and tool failure nodes alone are not terminal failures', () => {
  const snapshot = chat(null)
  snapshot.legacy = { nodes: [{ kind: 'model-retry' }, { kind: 'tool-result', error: true }] }
  assert.equal(latestTurnFailed(snapshot), false)
})

test('all public Session error outlets are recognized and clear with the source', () => {
  assert.equal(sessionFailed({}), false)
  for (const field of ['promptError', 'lastAgentError', 'openError']) {
    for (const value of field === 'lastAgentError' ? ['', 'failure'] : [{ error: {} }]) {
      assert.equal(sessionFailed({ [field]: value }), true)
      assert.equal(sessionFailed({ [field]: null }), false)
    }
  }
})

test('a new submission hides the old terminal failure during admission and generation', () => {
  for (const state of [
    { running: true }, { awaitingFirstTurn: true }, { pendingSubmissions: [{}] },
  ]) assert.equal(submissionInProgress(state), true)
  assert.equal(submissionInProgress({ running: false, awaitingFirstTurn: false, pendingSubmissions: [] }), false)
})
