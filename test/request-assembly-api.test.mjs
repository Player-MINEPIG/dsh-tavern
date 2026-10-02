import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AssemblyPresetStore } from '../packages/request-assembler/store.js'
import { createAssemblyApi } from '../packages/request-assembler/server.js'
import { RequestAssembler } from '../packages/request-assembler/runtime.js'
import { BUILTINS } from '../packages/request-assembler/model.js'

test('assembly API keeps edits distinct from apply, rejects running/unsupported hosts, and cold-previews without attaching', async () => {
  const root = mkdtempSync(join(tmpdir(), 'assembly-api-'))
  try {
    const store = new AssemblyPresetStore(root)
    let core = null, running = false, prepared, notifications = 0
    const runtime = new RequestAssembler({ ctx: { get: () => core }, store, resources: { compile: () => ({ assemblyInput: {} }) } })
    const handler = createAssemblyApi({ store, runtime, agents: () => new Map(running ? [['session', { status: 'running' }]] : []),
      sessions: () => ({ get: () => null, prepare(id, options) { prepared = { id, options }; return { deriveMessages: () => [] } } }),
      inspect: async () => ({ events: [], meta: { id: 'session' }, inheritedEventCount: 0 }), notify: () => notifications++ })
    async function call(path, method = 'GET', body) {
      const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
      Object.assign(req, { url: `/pmp-dsh-tavern/api/v1/assembly-presets${path}`, method })
      let result
      const res = { setHeader() {}, end(text) { result = { status: this.statusCode, ...JSON.parse(text) } } }
      await handler(req, res); return result
    }
    const created = await call('', 'POST', BUILTINS[1]); assert.equal(created.status, 201)
    const id = created.preset.id
    assert.equal(store.selection('session'), null)
    assert.equal((await call('/selection', 'PUT', { sessionId: 'session', id })).status, 409)
    core = { requestAssemblyVersion: 1 }; running = true
    assert.equal((await call('/selection', 'PUT', { sessionId: 'session', id })).status, 409)
    running = false
    assert.equal((await call('/selection', 'PUT', { sessionId: 'session', id })).status, 200)
    assert.equal(notifications, 1)
    await call(`/${id}`, 'PUT', { ...created.preset, name: 'Edited' })
    assert.notEqual(store.selection('session').name, 'Edited')
    assert.equal((await call(`/${id}`, 'DELETE')).status, 409)
    const preview = await call('/preview', 'POST', { sessionId: 'session', presetId: id })
    assert.equal(preview.status, 200); assert.equal(prepared.options.eventState, 'detached')
    assert.equal(preview.preview.pendingInputsIncluded, false)
    assert.equal((await call('', 'POST', { ...BUILTINS[1], rules: [] })).status, 400)
    assert.equal((await call('/selection', 'PUT', { sessionId: '__proto__', id })).status, 400)
    assert.equal(store.selection('__proto__'), null)
    core = null
    assert.equal((await call('/selection', 'PUT', { sessionId: 'session', id: null })).status, 200)
    assert.equal((await call(`/${id}`, 'DELETE')).status, 200)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
