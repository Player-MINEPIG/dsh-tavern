import test from 'node:test'
import assert from 'node:assert/strict'
import { createLivePlayClient } from '../packages/client/src/play/live.js'

test('log queries encode filters; failed operations preserve correlation and old Host failure', async () => {
  const urls = []
  const client = createLivePlayClient({ fetchImpl: async (url) => {
    urls.push(url)
    return { ok: false, status: 409, headers: { get: () => 'header-id' }, json: async () => ({ ok: false, code: 'PLAY_CONFLICT', operationId: 'body-id' }) }
  } })
  await assert.rejects(() => client.getOperationLogs({ operationId: 'a&b', level: 'warn', before: undefined }), error => error.operationId === 'body-id' && error.code === 'PLAY_CONFLICT')
  await assert.rejects(() => client.getOperationLogs({ format: 'jsonl' }), TypeError)
  assert.match(urls[0], /operation-logs\?operationId=a%26b&level=warn$/)
  const old = createLivePlayClient({ fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ code: 'PLAY_NOT_FOUND' }) }) })
  await assert.rejects(() => old.getOperationLogs(), error => error.status === 404 && error.operationId === undefined)
})
