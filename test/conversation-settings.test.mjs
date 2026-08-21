import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  ConversationSettingsStore,
  conversationSettingsConstants,
  createConversationSettingsApiHandler,
  normalizeConversationSettings,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', body, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const content = rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = '/pmp-dsh-tavern/api/v1/conversation-settings'
    const res = {
      statusCode: 200,
      setHeader() {},
      end: payload => resolve({ status: res.statusCode, body: JSON.parse(String(payload)) }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('conversation display settings persist independently from UI settings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-conversation-settings-'))
  try {
    const store = new ConversationSettingsStore(directory)
    assert.deepEqual(store.get(), conversationSettingsConstants.defaults)
    assert.deepEqual(store.set({ textScale: 1.25, actionScale: 0.85 }), {
      schemaVersion: 1,
      textScale: 1.25,
      actionScale: 0.85,
    })
    assert.deepEqual(new ConversationSettingsStore(directory).get(), store.get())
    assert.match(readFileSync(join(directory, 'conversation-settings.json'), 'utf8'), /"textScale": 1\.25/)
    assert.equal(store.reset().actionScale, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('conversation display settings are bounded and whitelist fields', () => {
  assert.throws(() => normalizeConversationSettings({ textScale: 2, actionScale: 1 }), /textScale/)
  assert.throws(() => normalizeConversationSettings({ textScale: 1, actionScale: 1.03 }), /increments/)
  assert.throws(() => normalizeConversationSettings({ textScale: 1, actionScale: 1, locale: 'en' }), /Unsupported/)
})

test('conversation settings API reads, replaces, resets, and rejects bad input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-conversation-settings-api-'))
  try {
    const handler = createConversationSettingsApiHandler(new ConversationSettingsStore(directory))
    assert.deepEqual((await invoke(handler)).body.settings, conversationSettingsConstants.defaults)
    const saved = await invoke(handler, { method: 'PUT', body: { textScale: 1.5, actionScale: 0.75 } })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.settings.textScale, 1.5)
    assert.equal((await invoke(handler, { method: 'PUT', body: { textScale: 1, actionScale: 1, extra: true } })).status, 400)
    assert.equal((await invoke(handler, { method: 'PUT', rawBody: '{bad' })).status, 400)
    assert.deepEqual((await invoke(handler, { method: 'DELETE' })).body.settings, conversationSettingsConstants.defaults)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Mowan conversation components consume separate display variables', () => {
  const root = new URL('../packages/client/src/', import.meta.url)
  const shell = readFileSync(new URL('index.js', root), 'utf8')
  const chat = readFileSync(new URL('play/chat.js', root), 'utf8')
  const notice = readFileSync(new URL('play/notice.js', root), 'utf8')
  const actions = readFileSync(new URL('play/turn-actions.js', root), 'utf8')
  assert.match(shell, /surface === 'conversation-settings'/)
  assert.match(shell, /conversationSettingsRequest\('PUT'/)
  assert.match(chat, /--dtv-rp-text-scale/)
  assert.match(notice, /--dtv-rp-text-scale/)
  assert.match(actions, /--dtv-rp-action-scale/)
  assert.doesNotMatch(chat, /--dtv-ui-scale/)
})
