import { CoreRequestBackend } from 'dsh-prompt-assembler/core-backend'
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
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
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
    const catalog = await call('')
    assert.equal(catalog.sourceProtocolVersion, 1); assert.equal(catalog.capability, false)
    assert.equal(catalog.sources.length, 14)
    assert.equal(catalog.sources.find(s => s.id === 'native-system').pluginId, 'DSH')
    const unregister = runtime.registry.register({ id: 'example.memory', pluginId: 'example.memory', name: 'Memory', resolve: () => ({ blocks: [] }) })
    assert.ok((await call('')).sources.some(s => s.id === 'example.memory'))
    unregister()
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
    assert.equal((await call('', 'POST', { ...BUILTINS[1], rules: [] })).status, 201)
    assert.equal((await call('/selection', 'PUT', { sessionId: '__proto__', id })).status, 400)
    assert.equal(store.selection('__proto__'), null)
    core = null
    assert.equal((await call('/selection', 'PUT', { sessionId: 'session', id: null })).status, 200)
    assert.equal((await call(`/${id}`, 'DELETE')).status, 200)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('preview rebuilds current native instructions and never duplicates historical loader text', async () => {
  const events = [{ id: 'old', role: 'system', content: [{ type: 'text', text: 'OLD CHARACTER' }] }, { id: 'user', role: 'user', content: [{ type: 'text', text: 'hello' }] }]
  let previewContext
  const runtime = new RequestAssembler({ ctx: { get: key => key === 'systemPrompt' ? { async assemble(context) { previewContext = context; return { sections: [{ name: 'core', text: 'CURRENT {{name}}' }], variables: { name: 'CORE' } } } } : { requestAssemblyVersion: 1 } }, store: {}, resources: { compile: () => ({ assemblyInput: { character: { data: { description: 'CHARACTER' } } } }) } })
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  const result = await runtime.preview({ preset: BUILTINS[0], agent: { session: { deriveMessages: () => events } } })
  assert.equal(previewContext.tavernAssemblyPreview, true)
  assert.deepEqual(result.messages.map(m => m.content[0].text), ['CURRENT CORE\n\nCHARACTER', 'hello'])
  assert.equal(events[0].content[0].text, 'OLD CHARACTER')
})

test('empty runtime assembly fails locally with an actionable error', async () => {
  const preset = { ...BUILTINS[0], rules: BUILTINS[0].rules.map(r => ({ ...r, enabled: false })) }
  const runtime = new RequestAssembler({ ctx: { get: () => ({ requestAssemblyVersion: 1 }) }, store: { selection: () => preset }, resources: { assembledFor: () => ({ assemblyInput: {} }) } })
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  const payload = { agent: { id: 'empty', session: { snapshotEvents: () => [] } } }
  await assert.rejects(runtime.execute(payload, async () => ({ messages: [] })), { code: 'ASSEMBLY_EMPTY' })
})
