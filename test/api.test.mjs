import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PresetStore, createApiHandler } from '../packages/tavern-loader/src/index.js'
import { createApiHandler as createPresetApiHandler } from '../packages/preset/src/server.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => resolve({
        status: res.statusCode,
        headers,
        body: payload === '' ? null : JSON.parse(payload),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('HTTP API imports, selects, reads, updates, and creates presets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-api-'))
  const store = new PresetStore(directory)
  let changes = 0
  const handler = createApiHandler(store, () => { changes += 1 })
  try {
    const imported = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/import',
      body: {
        name: 'Imported API preset',
        content: JSON.stringify({
          prompts: [{ identifier: 'main', content: 'API marker', role: 'system' }],
          prompt_order: [{ character_id: 100001, order: [{ identifier: 'main', enabled: true }] }],
        }),
      },
    })
    assert.equal(imported.status, 201)
    const id = imported.body.preset.id

    const selected = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/select',
      body: { id },
    })
    assert.equal(selected.body.selected.id, id)

    const active = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/active' })
    assert.equal(active.body.selected.id, id)
    assert.equal(Object.hasOwn(active.body, 'compiledPrompt'), false)

    const created = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/presets',
      body: { name: 'Created API preset' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.preset.source.format, 'dsh-tavern')
    assert.equal(changes, 3)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('HTTP API keeps preset selection isolated by DSH session id', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-api-session-'))
  const store = new PresetStore(directory)
  const first = store.create({ id: 'first', name: 'First' })
  const second = store.create({ id: 'second', name: 'Second' })
  store.select(first.id)
  const handler = createApiHandler(store)
  try {
    await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/select',
      body: { id: second.id, sessionId: 'session-a' },
    })
    await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/select',
      body: { id: null, sessionId: 'session-b' },
    })

    const sessionA = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/presets?sessionId=session-a' })
    const sessionB = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/presets?sessionId=session-b' })
    const legacy = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/presets' })
    assert.equal(sessionA.body.selectedId, second.id)
    assert.equal(sessionB.body.selectedId, null)
    assert.equal(legacy.body.selectedId, first.id)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('preset selection policy can reject binding while the session agent is running', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-api-preset-guard-'))
  const store = new PresetStore(directory)
  const preset = store.create({ id: 'guarded', name: 'Guarded preset' })
  let selected = false
  const handler = createPresetApiHandler(store, () => {}, undefined, {
    beforeSelectionChange: ({ sessionId, presetId }) => {
      assert.equal(sessionId, 'session-running')
      assert.equal(presetId, preset.id)
      const error = new Error('agent running')
      error.status = 409
      throw error
    },
    selectPreset: () => { selected = true },
  })
  try {
    const response = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/select',
      body: { id: preset.id, sessionId: 'session-running' },
    })
    assert.equal(response.status, 409)
    assert.equal(selected, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
