import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PresetStore, createApiHandler } from '../packages/tavern-loader/src/index.js'

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
      url: '/dsh-tavern/api/import',
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
      url: '/dsh-tavern/api/select',
      body: { id },
    })
    assert.equal(selected.body.selected.id, id)

    const active = await invoke(handler, { url: '/dsh-tavern/api/active' })
    assert.equal(active.body.selected.id, id)
    assert.equal(Object.hasOwn(active.body, 'compiledPrompt'), false)

    const created = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/presets',
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
      url: '/dsh-tavern/api/select',
      body: { id: second.id, sessionId: 'session-a' },
    })
    await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/select',
      body: { id: null, sessionId: 'session-b' },
    })

    const sessionA = await invoke(handler, { url: '/dsh-tavern/api/presets?sessionId=session-a' })
    const sessionB = await invoke(handler, { url: '/dsh-tavern/api/presets?sessionId=session-b' })
    const legacy = await invoke(handler, { url: '/dsh-tavern/api/presets' })
    assert.equal(sessionA.body.selectedId, second.id)
    assert.equal(sessionB.body.selectedId, null)
    assert.equal(legacy.body.selectedId, first.id)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
