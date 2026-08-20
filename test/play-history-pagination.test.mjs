import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { ChromeStore, createPlayApiHandler } from '../packages/play/src/index.js'
import { API_V2 } from '../packages/identity.js'

function invoke(handler, { method = 'GET', url } = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([])
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => resolve({
        status: res.statusCode,
        headers,
        body: payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function messageEvent(seq) {
  return {
    type: seq % 2 === 0 ? 'assistant/message' : 'user/message',
    seq,
    data: {
      id: `m${seq}`,
      role: seq % 2 === 0 ? 'assistant' : 'user',
      content: [{ type: 'text', text: `message-${seq}` }],
    },
  }
}

function makeHandler(history) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-history-pagination-'))
  const host = { async history(args) { return history(args) } }
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(pluginDir),
    workspaceStore: {},
    host,
  })
  return {
    handler,
    cleanup() { rmSync(pluginDir, { recursive: true, force: true }) },
  }
}

const messagesUrl = `${API_V2}/sessions/session-history/messages`

test('GET messages reads all history pages beyond the old 32-page limit in order', async () => {
  const calls = []
  const fixture = makeHandler(({ beforeSeq }) => {
    calls.push(beforeSeq)
    const seq = beforeSeq === undefined ? 40 : beforeSeq - 1
    return { events: [messageEvent(seq)], hasMore: seq > 1 }
  })
  try {
    const result = await invoke(fixture.handler, { url: messagesUrl })
    assert.equal(result.status, 200)
    assert.equal(result.body.messages.length, 40)
    assert.deepEqual(result.body.messages.map(message => message.seq), Array.from({ length: 40 }, (_, index) => index + 1))
    assert.deepEqual(calls, [undefined, ...Array.from({ length: 39 }, (_, index) => 40 - index)])
  } finally {
    fixture.cleanup()
  }
})

test('GET messages stops normally when Host returns hasMore=false', async () => {
  let calls = 0
  const fixture = makeHandler(() => {
    calls += 1
    return { events: [messageEvent(1)], hasMore: false }
  })
  try {
    const result = await invoke(fixture.handler, { url: messagesUrl })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.messages.map(message => message.seq), [1])
    assert.equal(calls, 1)
  } finally {
    fixture.cleanup()
  }
})

for (const [name, history] of [
  ['empty page', () => ({ events: [], hasMore: true })],
  ['non-integer oldest seq', () => ({ events: [messageEvent('oldest')], hasMore: true })],
]) {
  test(`GET messages rejects Host ${name} with an explicit cursor-stalled error`, async () => {
    const fixture = makeHandler(history)
    try {
      const result = await invoke(fixture.handler, { url: messagesUrl })
      assert.equal(result.status, 502)
      assert.equal(result.body.ok, false)
      assert.equal(result.body.code, 'PLAY_HISTORY_CURSOR_STALLED')
    } finally {
      fixture.cleanup()
    }
  })
}

test('GET messages rejects a repeated beforeSeq cursor instead of looping or returning partial history', async () => {
  const fixture = makeHandler(({ beforeSeq }) => beforeSeq === undefined
    ? { events: [messageEvent(2)], hasMore: true }
    : { events: [messageEvent(2)], hasMore: true })
  try {
    const result = await invoke(fixture.handler, { url: messagesUrl })
    assert.equal(result.status, 502)
    assert.equal(result.body.ok, false)
    assert.equal(result.body.code, 'PLAY_HISTORY_CURSOR_STALLED')
  } finally {
    fixture.cleanup()
  }
})