import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  announceImportFailure,
  importFailureMessage,
} from '../packages/client/src/import-failure.js'
import { CLIENT_IMPORT_FAILURE_EVENT } from '../packages/identity.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('complete import failures dispatch one bounded visible error event', () => {
  const events = []
  const target = { dispatchEvent: event => events.push(event) }
  const message = announceImportFailure(new Error('invalid import document'), target)
  assert.equal(message, 'invalid import document')
  assert.equal(events.length, 1)
  assert.equal(events[0].type, CLIENT_IMPORT_FAILURE_EVENT)
  assert.deepEqual(events[0].detail, { message: 'invalid import document' })
  assert.equal(importFailureMessage(null), 'Unknown import error')
})

test('file import entrypoints report thrown failures while regex persistence rethrows only for import', () => {
  for (const path of [
    '../packages/preset/src/client.js',
    '../packages/character/src/client.js',
    '../packages/world-book-library/src/client.js',
    '../packages/client/src/play/chat.js',
    '../packages/client/src/play/regex-panel.js',
  ]) {
    assert.match(read(path), /announceImportFailure\(/, path)
  }
  const regexPanel = read('../packages/client/src/play/regex-panel.js')
  assert.match(regexPanel, /persist\([\s\S]*?\{ rethrow: true \}\)/)
  assert.match(regexPanel, /if \(rethrow\) throw reason/)
})
