import { CoreRequestBackend } from 'dsh-prompt-assembler/core-backend'
import test from 'node:test'
import assert from 'node:assert/strict'
import { RequestSourceRegistry, createDefaultRegistry, registerBuiltinSources, assembleRequestAsync, assembleRequest, BUILTINS, normalizePreset, textOf } from '../packages/request-assembler/index.js'
import { RequestAssembler } from '../packages/request-assembler/runtime.js'
const native = [{ id: 's', role: 'system', content: [{ type: 'text', text: 'CORE' }] }, { id: 'u', role: 'user', content: [{ type: 'text', text: 'INPUT' }], source: { kind: 'user' } }]
const withRule = (kind, extra = {}) => ({ ...BUILTINS[1], rules: [...BUILTINS[1].rules, { id: 'plugin', kind, ...extra }] })
const memory = resolve => ({ id: 'example.memory/recalled', pluginId: 'example.memory', name: 'Retrieved memory', resolve })
const blocks = value => ({ blocks: [{ type: 'text', id: 'memory', text: value }] })

test('all native and Tavern modules use the same public registry, with no implicit fallback', () => {
  const registry = new RequestSourceRegistry(), remove = registerBuiltinSources(registry)
  assert.equal(registry.list().length, 11)
  const options = { registry, preset: BUILTINS[1], nativeMessages: native, assets: { character: { data: { description: 'CHARACTER' } } } }
  assert.deepEqual(assembleRequest(options).messages.map(textOf), ['CORE', 'CHARACTER', 'INPUT'])
  remove()
  const missing = assembleRequest(options)
  assert.deepEqual(missing.messages, [])
  assert.ok(missing.diagnostics.some(d => d.sourceId === 'native-system'))
  registry.register({ id: 'native-system', pluginId: 'example.adapter', name: 'Alternative native adapter', roles: ['preserve'], resolve: () => ({ blocks: [{ id: 'core', type: 'native', messageIds: ['s'] }] }) })
  assert.deepEqual(assembleRequest(options).messages.map(textOf), ['CORE'])
})
test('async source is evaluated for preview and each actual step with detached immutable inputs', async () => {
  const registry = createDefaultRegistry(), calls = [], preset = withRule('example.memory/recalled', { role: 'user', depth: 0 })
  registry.register(memory(async (context, rule) => {
    assert.ok(Object.isFrozen(context.nativeMessages)); assert.ok(Object.isFrozen(rule))
    assert.throws(() => context.nativeMessages.push({}))
    calls.push({ preview: context.preview, step: context.step, input: context.inputIds })
    return blocks(`MEMORY ${context.step}`)
  }))
  const events = [{ seq: 1, type: 'step/start' }, { seq: 2, type: 'user/message', data: native[1] }]
  const agent = { id: 'session', session: { snapshotEvents: () => events, deriveMessages: () => native } }
  const runtime = new RequestAssembler({ registry, ctx: { get: name => name === 'agentLoop' ? { requestAssemblyVersion: 1 } : null }, store: { selection: () => preset }, resources: { assembledFor: () => ({ assemblyInput: {} }), compile: () => ({ assemblyInput: {} }) } })
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  await runtime.preview({ preset, agent, sessionId: agent.id })
  for (const step of [1, 2, 3]) {
    const result = await runtime.execute({ agent, turn: 1, step }, async () => ({ messages: native, metadata: { from: 'other-middleware' } }))
    assert.equal(result.messages.at(-1).content[0].text, `MEMORY ${step}`)
    assert.equal(result.messages.at(-1).role, 'user')
    assert.equal(result.metadata.assembly.nodes.at(-1).source.plugin, 'example.memory')
    assert.deepEqual(result.metadata.upstream, { from: 'other-middleware' })
  }
  assert.deepEqual(calls.map(c => [c.preview, c.step]), [[true, null], [false, 1], [false, 2], [false, 3]])
  assert.deepEqual(calls[1].input, ['u']); assert.equal(events.length, 2)
})
test('unload removes generated content and retained snapshots, but preserves imported strategy', async () => {
  const registry = createDefaultRegistry(), preset = withRule('example.memory/recalled', { lifetime: 'snapshot' })
  const stop = registry.register(memory(() => blocks('OLD MEMORY')))
  const first = await assembleRequestAsync({ registry, preset, nativeMessages: native })
  assert.equal(first.snapshots.length, 1)
  stop()
  const next = await assembleRequestAsync({ registry, preset, nativeMessages: native, snapshots: first.snapshots })
  assert.deepEqual(next.messages.map(textOf), ['CORE', 'INPUT']); assert.equal(next.snapshots.length, 0)
  assert.equal(normalizePreset(preset).rules.at(-1).kind, 'example.memory/recalled')
  assert.ok(next.diagnostics.some(d => d.code === 'ASSEMBLY_SOURCE_UNAVAILABLE'))
})
test('third-party macros and references consume their source and use the same locks/provenance', async () => {
  const registry = createDefaultRegistry()
  registry.register(memory(() => ({ blocks: [{ type: 'text', id: 'memory', text: 'REMEMBER' }], macros: { recalled: 'memory' } })))
  registry.register({ id: 'example.template', pluginId: 'example.template', name: 'Template', dependencies: ['example.memory/recalled'], resolve: () => ({ blocks: [{ type: 'text', id: 'prompt', text: 'PREFIX {{recalled}}' }] }) })
  const preset = { ...BUILTINS[1], rules: [...BUILTINS[1].rules, { id: 'template', kind: 'example.template' }] }
  const result = await assembleRequestAsync({ registry, preset })
  assert.deepEqual(result.messages.map(textOf), ['PREFIX REMEMBER'])
  assert.equal(result.nodes[0].children[0].source.plugin, 'example.memory')
  assert.ok(result.nodes[0].children[0].locked)
})
test('disabled sources are not resolved; failures and cancellation prevent sending partial content', async () => {
  const registry = createDefaultRegistry(); let calls = 0
  registry.register(memory(() => { calls++; throw new Error('retrieval unavailable') }))
  await assembleRequestAsync({ registry, preset: withRule('example.memory/recalled', { enabled: false }) })
  assert.equal(calls, 0)
  await assert.rejects(assembleRequestAsync({ registry, preset: withRule('example.memory/recalled') }), /retrieval unavailable/)
  const controller = new AbortController(), hanging = createDefaultRegistry()
  hanging.register(memory(() => new Promise(() => {})))
  const pending = assembleRequestAsync({ registry: hanging, preset: withRule('example.memory/recalled'), signal: controller.signal })
  controller.abort(new Error('cancel test'))
  await assert.rejects(pending, /cancel test/)
})
test('duplicate registrations, source constraints, dependency cycles and source output spoofing are handled', async () => {
  const registry = createDefaultRegistry()
  registry.register({ ...memory(() => ({ ...blocks('X'), descriptor: { pluginId: 'DSH' } })), roles: ['preserve'], lifetimes: ['request'], depth: false })
  assert.throws(() => registry.register(memory(() => blocks('Y'))), /Duplicate/)
  await assert.rejects(assembleRequestAsync({ registry, preset: withRule('example.memory/recalled', { role: 'user' }) }), /Unsupported/)
  const result = await assembleRequestAsync({ registry, preset: withRule('example.memory/recalled') })
  assert.equal(result.nodes[0].source.plugin, 'example.memory')
  const loop = createDefaultRegistry()
  loop.register({ ...memory(() => blocks('X')), dependencies: ['example.memory/recalled'] })
  await assert.rejects(assembleRequestAsync({ registry: loop, preset: withRule('example.memory/recalled') }), /Cyclic/)
})


test('async resolution and final assembly share one captured native input snapshot', async () => {
  const registry = createDefaultRegistry(), messages = structuredClone(native)
  let release, entered
  const started = new Promise(resolve => { entered = resolve })
  registry.register(memory(async () => { entered(); await new Promise(resolve => { release = resolve }); return blocks('MEMORY') }))
  const pending = assembleRequestAsync({ registry, preset: withRule('example.memory/recalled'), nativeMessages: messages })
  await started
  messages[1].content[0].text = 'MUTATED OUTSIDE REQUEST'
  release()
  assert.deepEqual((await pending).messages.map(textOf), ['CORE', 'INPUT', 'MEMORY'])
})
