import test from 'node:test'
import assert from 'node:assert/strict'
import { operationLabel, operationResult, operationObjects, operationPageJsonl, operationLocator } from '../packages/client/src/play/operation-log-view.js'
import { setClientUiSettings } from '../packages/client/src/i18n.js'
import { OperationJournal } from '../packages/play/src/operation-journal.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('readable events preserve accepted, checkpoint and optional failure meanings', () => {
  setClientUiSettings({ locale: 'en' })
  assert.equal(String(operationLabel({ eventVersion: 1, operation: 'session.create' })), 'Create session')
  assert.match(String(operationResult({ eventVersion: 1, event: 'operation.completed', result: 'accepted' }).label), /Input accepted.*not confirmed complete/)
  assert.match(String(operationResult({ eventVersion: 1, event: 'session.created' }).label), /checkpoint confirmed/)
  assert.match(String(operationResult({ eventVersion: 1, event: 'diagnostic.failed' }).label), /does not establish request failure/)
  assert.match(String(operationResult({ eventVersion: 1, event: 'operation.failed' }).label), /completed writes may remain/)
  for (const eventVersion of [undefined, 2]) {
    assert.equal(String(operationLabel({ eventVersion, operation: 'session.create' })), 'session.create')
    assert.match(String(operationResult({ eventVersion, event: 'operation.completed', result: 'accepted' }).label), /^Raw status:/)
  }
  assert.equal(String(operationLabel({ eventVersion: 1, operation: 'future.operation' })), 'future.operation')
  const objects = operationObjects({ sessionId: 'session-synthetic', playthroughId: 'play-synthetic' })
  assert.deepEqual(objects.map(({ key, value }) => [key, value]), [['sessionId', 'session-synthetic'], ['playthroughId', 'play-synthetic']])
})

test('current-page export preserves actual journal IDs and metadata, excludes disallowed fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-log-view-'))
  const journal = new OperationJournal(dir)
  try {
    for (let i = 0; i < 3; i++) journal.append('info', {
      eventVersion: 1, event: 'operation.completed', operation: 'session.create', operationId: `synthetic-${i}`,
      sessionId: 'session-synthetic', playthroughId: 'play-synthetic', route: '/sessions', result: 'completed',
      path: '/synthetic/private/path', message: 'synthetic body', password: 'synthetic-password', apiKey: 'synthetic-key', stack: 'synthetic-stack',
    })
    const page = journal.query({ limit: 2 })
    const rows = operationPageJsonl(page).trim().split('\n').map(JSON.parse)
    assert.deepEqual(rows.slice(1), page.records)
    assert.equal(rows.length, 3)
    assert.equal(rows[0].nextCursor, page.nextCursor)
    assert.deepEqual(rows[0].storage, page.storage)
    assert.deepEqual(rows[0].limits, page.limits)
    assert.equal(rows[1].sessionId, 'session-synthetic')
    assert.equal(rows[1].runId, journal.runId)
    assert.equal(rows[1].operationId, 'synthetic-2')
    for (const key of ['path', 'message', 'password', 'apiKey', 'stack']) assert.equal(key in rows[1], false)
    assert.equal(operationPageJsonl({ ...page, records: [] }).trim().split('\n').length, 1)
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('locator copies only existing metadata, separates plugin identity and does not invent a run', () => {
  const row = { schemaVersion: 1, eventVersion: 1, id: 'plugin-instance:2', stage: 'success', timestamp: '2026-10-03T08:00:00Z', operationId: 'op-1', sessionId: 'session/one?x', runId: 'plugin-instance',
    operation: 'session.user-message', event: 'operation.completed', status: 200, result: 'accepted',
    body: 'PRIVATE_PROMPT', message: 'PRIVATE_ERROR', apiKey: 'PRIVATE_KEY', run: 'not-a-public-field' }
  const locator = JSON.parse(operationLocator(row))
  assert.equal(locator.schemaVersion, 1)
  assert.equal(locator.eventVersion, 1)
  assert.equal(locator.stage, 'success')
  assert.equal(locator.result, 'accepted')
  assert.equal(locator.recordId, 'plugin-instance:2')
  assert.equal(locator.sessionId, row.sessionId)
  assert.equal(locator.timestamp, row.timestamp)
  assert.equal(locator.correlation, 'session-and-time-only')
  assert.equal(locator.pluginInstanceId, 'plugin-instance')
  assert.equal(locator.traceIndexApiPath, '/pmp-dsh-tavern/api/v3/sessions/session%2Fone%3Fx/assemblies')
  for (const key of ['body', 'message', 'apiKey', 'run', 'runId', 'turn', 'attempt', 'dshRunId']) assert.equal(key in locator, false)
  assert.equal(JSON.stringify(locator).includes('PRIVATE_'), false)
  const unlinked = JSON.parse(operationLocator({ operationId: 'startup' }))
  assert.equal('traceIndexApiPath' in unlinked, false)
  assert.equal('sessionId' in unlinked, false)
})
