import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
import { withDeepSeekWire } from './helpers/deepseek-wire.mjs'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'

const runtimeRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
for (const largeProfile of [false, true]) test(`default assembly reaches the official DeepSeek wire through AgentLoop and durable Trace with ${largeProfile ? 'expanded snapshots through three turns' : 'small complete snapshots'}`, { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm'), sessions = await load('@deepseek-ai/dsh-session')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembly-deepseek-host-')), requests = [], errors = []
  let store
  const text = m => m.content.filter(b => b.type === 'text').map(b => b.text).join('')
  try {
    // In-memory Host services cannot create a real profile/workspace.
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'OFFICIAL_ONE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-invariants')).default, {})
    await ctx.plugin(await load('@deepseek-ai/dsh-agent-loop/invariant'))
    ctx.on('agent/error', e => errors.push(e.error))
    ctx.on('llm/stream', (request, next) => {
      if (llm.isAgentLoopRequest(request)) {
        assert.ok(Object.isFrozen(request) && Object.isFrozen(request.messages))
        const recorded = ctx.sessions.get(request.sessionId).snapshotEvents().findLast(e => e.type === 'request/assembly')
        assert.deepEqual(recorded.data.messages, request.messages)
        assert.equal(request.options?.system, undefined)
        requests.push(structuredClone(request.messages))
      }
      return next()
    })
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory }) } })
    const synthetic = defaultAssemblyFailureInput()
    if (largeProfile) for (const [i, entry] of synthetic.assets.loreEntries.entries()) {
      const marker = `SYNTHETIC_LORE_${i}:`
      entry.content = marker + 'x'.repeat((i < 3 ? 82 : 12) * 1024 - marker.length)
    }
    const preset = store.create({ name: 'Synthetic default shape' })
    store.update(preset.id, { prompts: synthetic.assets.preset.prompts }); store.select(preset.id)
    store.characterStore.import(Buffer.from(JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Synthetic', first_mes: 'GREETING',
      character_book: { entries: synthetic.assets.loreEntries.map((e, i) => ({ id: i, keys: [], content: e.content, enabled: true, constant: true,
        insertion_order: i, position: e.requestedPosition ? 'after_char' : 'before_char', extensions: { position: e.requestedPosition ? 4 : 0, depth: 0, ignore_budget: true } })) } } })), { id: 'synthetic' })
    await withDeepSeekWire(runtimeRoot, async ({ adapter, bodies }) => {
      ctx.llm.registerAdapter(['offline'], adapter)
      const handle = await ctx.agents.create({ sessionId: 'offline-default-shape', agentOptions: { provider: 'offline', model: 'offline' } }), agent = handle.agent
      store.sessionSelections.set(agent.id, { characterCardId: 'synthetic' })
      store.assemblyPresets.apply(agent.id, 'builtin-st')
      for (const input of ['ONE', 'TWO', 'THREE']) {
        agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: input }], source: { kind: 'user' } })); await agent.whenIdle()
        assert.deepEqual(errors, [])
      }
      assert.equal(bodies.length, 3)
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i]
        assert.match(body.system, /OFFICIAL_ONE\n\nMAIN$/)
        assert.equal(body.messages.at(-1).role, 'system')
        const effective = body.messages.at(-1).content[0].text
        for (const marker of ['OFFICIAL_ONE', 'MAIN', ...synthetic.assets.loreEntries.map(e => e.content)]) assert.equal(effective.split(marker).length - 1, 1)
        assert.equal(requests[i].filter(m => text(m) === 'GREETING').length, i === 0 ? 1 : 0)
      }
      const before = agent.session.deriveMessages()
      assert.ok(!before.some(m => /MAIN|LORE_|GREETING/.test(text(m))))
      let section = () => {}
      if (!largeProfile) {
        section = agent.ctx.systemPrompt.section({ name: 'offline:replacement', order: 0, complete: true, text: 'OFFICIAL_TWO' })
        agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'FOUR' }], source: { kind: 'user' } })); await agent.whenIdle()
        assert.deepEqual(errors, []); assert.equal(bodies.length, 4)
        const final = bodies.at(-1).messages.at(-1).content[0].text
        assert.match(final, /^OFFICIAL_TWO\n\nMAIN\n\n/); assert.ok(!final.includes('OFFICIAL_ONE'))
      }
      const native = agent.session.deriveMessages()
      assert.deepEqual(native.slice(0, before.length), before)
      const restored = sessions.Session.fromRestore(agent.id, structuredClone(agent.session.snapshotEvents()), agent.session.header, sessions.SessionLogOffset(0), 'detached')
      assert.deepEqual(restored.deriveMessages(), native)
      const read = createAssemblyBodyReader({ inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) })
      for (const [i, summary] of store.assemblyStore.list(agent.id).entries()) {
        const record = await read(store.assemblyStore.get(agent.id, summary.id))
        assert.deepEqual(record.requestAssembly.messages, requests[i])
        assert.equal(record.requestContentStatus, 'available')
        const metadata = record.requestAssembly.metadata.assembly
        if (largeProfile) {
          assert.ok(metadata.logicalExtraBytes < 512 * 1024)
          assert.ok(metadata.extraBytes > 512 * 1024 && metadata.extraBytes < 2 * 1024 * 1024)
          assert.equal(metadata.systemProjection.maxBytes, 2 * 1024 * 1024)
        }
        const owners = new Map(metadata.nodes.flatMap(node => node.inputMessageIds.map(id => [id, node])))
        for (const snapshot of metadata.systemProjection.messages) {
          for (const id of snapshot.inputIds) assert.ok(owners.get(id).requestMessageIds.includes(snapshot.messageId))
          for (const id of snapshot.contributorIds) assert.ok(owners.has(id))
        }
      }
      section(); await handle.dispose()
    })
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('an empty native head followed by a visible update retains its boundary through AgentLoop and Trace', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm'), sessions = await load('@deepseek-ai/dsh-session')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembly-empty-head-')), requests = [], nativeRequests = [], errors = []
  let store, official = ''
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt)
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-invariants')).default, {})
    await ctx.plugin(await load('@deepseek-ai/dsh-agent-loop/invariant'))
    ctx.on('agent/error', e => errors.push(e.error))
    ctx.on('agent/assemble-request', (payload, next) => { nativeRequests.push(structuredClone(payload.messages)); return next() })
    ctx.on('llm/stream', (request, next) => {
      if (llm.isAgentLoopRequest(request)) {
        assert.ok(Object.isFrozen(request) && Object.isFrozen(request.messages))
        requests.push(structuredClone(request.messages))
      }
      return next()
    })
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory }) } })
    await withDeepSeekWire(runtimeRoot, async ({ adapter, bodies }) => {
      ctx.llm.registerAdapter(['offline'], adapter)
      const handle = await ctx.agents.create({ sessionId: 'empty-head-history', agentOptions: { provider: 'offline', model: 'offline' } }), agent = handle.agent
      store.assemblyPresets.apply(agent.id, 'builtin-st')
      const section = agent.ctx.systemPrompt.section({ name: 'offline:late-system', order: 0, complete: true, text: () => official })
      for (const value of ['', 'LATE_BASE']) {
        official = value
        agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: value ? 'TWO' : 'ONE' }], source: { kind: 'user' } })); await agent.whenIdle()
        assert.deepEqual(errors, [])
      }
      assert.deepEqual(nativeRequests.map(messages => messages.map(m => m.role)), [['user'], ['user', 'assistant', 'system', 'user']])
      assert.deepEqual(requests, nativeRequests)
      assert.equal(bodies[1].system, undefined)
      assert.deepEqual(bodies[1].messages.map(m => m.role), ['user', 'assistant', 'user', 'system'])
      assert.equal(bodies[1].messages.at(-1).content[0].text, 'LATE_BASE')
      const events = agent.session.snapshotEvents()
      assert.equal(events.find(e => e.type === 'system/message').data.message.content.length, 0)
      const restored = sessions.Session.fromRestore(agent.id, structuredClone(events), agent.session.header, sessions.SessionLogOffset(0), 'detached')
      const read = createAssemblyBodyReader({ inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) })
      const latest = store.assemblyStore.list(agent.id).at(-1)
      const record = await read(store.assemblyStore.get(agent.id, latest.id))
      assert.equal(record.requestContentStatus, 'available')
      assert.deepEqual(record.requestAssembly.messages, requests[1])
      const mapping = record.requestAssembly.metadata.assembly
      assert.equal(mapping.systemProjection.messages[0].index, 2)
      const node = mapping.nodes.find(n => n.module === 'native-system')
      assert.deepEqual(node.inputMessageIds, [nativeRequests[1][2].id])
      assert.deepEqual(node.requestMessageIds, [requests[1][2].id])
      section(); await handle.dispose()
    })
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('extended core sends the assembled request, records it, restores native history and unloads without a provider fork', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm'), sessions = await load('@deepseek-ai/dsh-session')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembly-host-')), requests = [], errors = []
  let store
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'OFFICIAL' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    assert.equal(ctx.agentLoop.requestAssemblyVersion, 1)
    await ctx.plugin((await load('@deepseek-ai/dsh-invariants')).default, {})
    await ctx.plugin(await load('@deepseek-ai/dsh-agent-loop/invariant'))
    // Metadata can legally arrive after assembly without invalidating the frozen request.
    ctx.on('llm/stream', (request, next) => {
      if (!llm.isAgentLoopRequest(request)) return next()
      ctx.sessions.get(request.sessionId).append('session/title', { title: 'Synthetic', messageSeqs: [], source: { kind: 'user' } })
      return next()
    }, { global: true, prepend: true })
    ctx.on('agent/error', e => errors.push(e.error))
    ctx.on('llm/stream', (request, next) => {
      if (!llm.isAgentLoopRequest(request)) return next()
      assert.ok(Object.isFrozen(request)); assert.ok(Object.isFrozen(request.messages))
      const recorded = ctx.sessions.get(request.sessionId).snapshotEvents().findLast(e => e.type === 'request/assembly')
      assert.deepEqual(recorded.data.messages, request.messages); assert.equal(recorded.ignorable, true)
      requests.push(structuredClone({ messages: request.messages })); return next()
    })
    class Adapter extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'ANSWER' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['test'], new Adapter())
    const plugin = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory }) } }); await plugin
    ctx.on('agent/assemble-request', async (payload, next) => {
      // A slow assembly hook lets automatic title generation arrive even before
      // the main request snapshot exists. It must leave the pending capture alone.
      for await (const frame of ctx.llm.stream({ provider: 'test', model: 'test', sessionId: payload.agent.id, messages: [{ id: 'early-title', role: 'system', content: [{ type: 'text', text: 'Early title' }], source: { kind: 'system-prompt' } }] })) {}
      return next()
    })
    ctx.on('llm/stream', async function* (request, next) {
      if (llm.isAgentLoopRequest(request)) {
        const auxiliary = { ...request, messages: [{ id: 'title', role: 'system', content: [{ type: 'text', text: 'Generate title' }], source: { kind: 'system-prompt' } }] }
        for await (const frame of ctx.llm.stream(auxiliary)) { /* same-session side call */ }
      }
      yield* next()
    }, { global: true, prepend: true })
    const resource = store.create({ name: 'Preset' }); store.update(resource.id, { prompts: [{ ...resource.prompts[0], content: 'BODY' }, { ...resource.prompts[0], identifier: 'jailbreak', content: 'TAIL' }] }); store.select(resource.id)
    const handle = await ctx.agents.create({ sessionId: 'assembly-test', agentOptions: { provider: 'test', model: 'test' } }), agent = handle.agent
    store.assemblyPresets.apply(agent.id, 'builtin-cache')
    async function turn(text) {
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
      await agent.whenIdle()
      assert.deepEqual(errors, [])
    }
    await turn('ONE'); await turn('TWO'); await turn('THREE')
    assert.equal(requests.length, 3)
    const text = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const fullSystem = 'You are an AI agent powered by DeepSeek Harness.\n\nOFFICIAL\n\nBODY\n\nTAIL'
    assert.equal(text(requests[0].messages.at(-1)), fullSystem)
    assert.equal(text(requests[2].messages.at(-1)), fullSystem)
    assert.equal(requests[2].messages.filter(m => text(m).endsWith('\n\nTAIL')).length, 1)
    assert.ok(!agent.session.deriveMessages().some(m => ['TAIL', 'BODY'].includes(text(m))))
    const events = structuredClone(agent.session.snapshotEvents())
    const restored = sessions.Session.fromRestore(agent.id, events, agent.session.header, sessions.SessionLogOffset(0), 'detached')
    assert.deepEqual(restored.deriveMessages(), agent.session.deriveMessages())
    assert.equal(restored.snapshotEvents().filter(e => e.type === 'request/assembly').length, 3)
    const readBodies = createAssemblyBodyReader({ inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) })
    for (const [index, summary] of store.assemblyStore.list(agent.id).entries()) {
      const captured = await readBodies(store.assemblyStore.get(agent.id, summary.id))
      assert.deepEqual(captured.requestAssembly.messages, requests[index].messages)
      assert.equal(captured.requestContentStatus, 'available')
    }
    const latest = store.assemblyStore.list(agent.id).at(-1)
    const stored = store.assemblyStore.get(agent.id, latest.id)
    assert.ok(stored.requestAssemblyRef)
    assert.equal(stored.requestAssembly, undefined)
    const record = await readBodies(stored)
    assert.equal(record.requestContentStatus, 'available')
    assert.deepEqual(record.requestAssembly.messages, requests.at(-1).messages)
    const fresh = store.assemblyPresets.get('builtin-st')
    for (const rule of fresh.rules) rule.enabled = false
    fresh.name = 'Fresh every request'
    fresh.rules.push({ id: 'fresh', kind: 'custom', text: 'FRESH', enabled: true })
    const savedFresh = store.assemblyPresets.save(fresh)
    store.assemblyPresets.apply(agent.id, savedFresh.id)
    await turn('FOUR'); await turn('FIVE'); await turn('SIX')
    for (const request of requests.slice(-3)) assert.deepEqual(request.messages.map(text), ['FRESH'])
    assert.ok(agent.session.deriveMessages().some(m => text(m) === 'ONE'))
    const inherited = structuredClone(agent.session.snapshotEvents())
    const childHandle = await ctx.agents.create({ sessionId: 'assembly-swipe-child', seed: inherited, inheritedEventCount: inherited.length, meta: { parentSession: agent.id, isSeeded: true }, agentOptions: { provider: 'test', model: 'test' } })
    const child = childHandle.agent.session
    assert.equal(store.assemblyPresets.selection(child.id).id, savedFresh.id)
    childHandle.agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'SWIPE' }], source: { kind: 'user' } }))
    await childHandle.agent.whenIdle()
    assert.deepEqual(errors, [])
    const childRecord = store.assemblyStore.list(child.id).at(-1)
    assert.ok(childRecord.requestAssemblyRef)
    const childReader = createAssemblyBodyReader({ inspect: async () => ({ meta: child.header, events: child.snapshotEvents() }) })
    const childActual = await childReader(store.assemblyStore.get(child.id, childRecord.id))
    assert.deepEqual(childActual.requestAssembly.messages.map(text), ['FRESH'])
    await childHandle.dispose()
    store.assemblyPresets.apply(agent.id, null)
    await turn('NATIVE_DEFAULT')
    assert.ok(requests.at(-1).messages.some(m => text(m).includes('OFFICIAL')))
    assert.ok(!requests.at(-1).messages.some(m => ['TAIL', 'BODY', 'FRESH'].includes(text(m))))
    const nativeCapture = store.assemblyStore.list(agent.id).at(-1)
    assert.ok(nativeCapture.requestAssemblyRef)
    assert.equal(agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata, null)
    await plugin.dispose()
    await turn('AFTER_UNLOAD')
    assert.ok(!requests.at(-1).messages.some(m => ['TAIL', 'BODY'].includes(text(m))))
    await handle.dispose()
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})


test('public sources run for tool continuations, steering, child requests and settlement notices, but not auxiliary LLM calls', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembly-source-host-')), calls = [], errors = [], requests = []
  let store, agent, nextAction = 'tool'
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'OFFICIAL' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-invariants')).default, {})
    await ctx.plugin(await load('@deepseek-ai/dsh-agent-loop/invariant'))
    ctx.on('agent/error', e => errors.push(e.error))
    ctx.tools.register({ name: 'probe', description: 'Synthetic probe', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] }, execute: async () => 'TOOL RESULT' })
    class Adapter extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) {
        if (llm.isAgentLoopRequest(request)) {
          requests.push(request)
          if (nextAction === 'tool') {
            nextAction = 'steer'
            const block = { type: 'tool-call', id: 'probe-1', name: 'probe', arguments: '{}' }
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }; yield { type: 'block-end', index: 0, block }; yield { type: 'finish', reason: { kind: 'tool-calls' } }; return
          }
          if (nextAction === 'steer') { nextAction = 'settled'; agent.steer(llm.createUserMessage({ content: [{ type: 'text', text: 'ADDED DURING RUN' }], source: { kind: 'user' } })) }
          else if (nextAction === 'settled') { nextAction = 'stop'; agent.steer(llm.createUserMessage({ content: [{ type: 'text', text: 'CHILD RESULT' }], source: { kind: 'subagent-settled', form: 'notice', summary: 'Child finished', senderSessionId: 'child-fixture' } })) }
        }
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['test'], new Adapter())
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory }) } })
    const sourcePlugin = ctx.plugin({ name: 'example-memory', inject: ['tavernRequestSources'], apply(context) {
      context.effect(() => context.get('tavernRequestSources').register({ id: 'example.memory', pluginId: 'example.memory', name: 'Memory', async resolve(input) { calls.push([input.sessionId, input.turn, input.step, input.preview]); return { blocks: [{ id: 'memory', type: 'text', text: `MEMORY ${input.turn}/${input.step}` }] } } }))
    } }); await sourcePlugin
    const preset = store.assemblyPresets.save({ ...store.assemblyPresets.get('builtin-cache'), rules: [...store.assemblyPresets.get('builtin-cache').rules, { id: 'memory', kind: 'example.memory' }] })
    const handle = await ctx.agents.create({ sessionId: 'source-parent', agentOptions: { provider: 'test', model: 'test' } }); agent = handle.agent
    store.assemblyPresets.apply(agent.id, preset.id)
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'START' }], source: { kind: 'user' } })); await agent.whenIdle()
    assert.deepEqual(errors, [])
    assert.equal(requests.length, 4)
    assert.deepEqual(calls.map(c => c.slice(1, 3)), [[1, 1], [1, 2], [1, 3], [1, 4]])
    assert.ok(requests[1].messages.some(m => m.role === 'tool'))
    assert.ok(requests[2].messages.some(m => m.content.some(b => b.text === 'ADDED DURING RUN')))
    assert.ok(requests[3].messages.some(m => m.source?.kind === 'subagent-settled'))
    for (let i = 0; i < requests.length; i++) assert.equal(requests[i].messages.at(-1).content[0].text, `You are an AI agent powered by DeepSeek Harness.\n\nOFFICIAL\n\nMEMORY 1/${i + 1}`)
    const child = await ctx.agents.create({ sessionId: 'source-child', meta: { parentSession: agent.id }, agentOptions: { provider: 'test', model: 'test' } })
    child.agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'CHILD TASK' }], source: { kind: 'user' } })); await child.agent.whenIdle()
    assert.deepEqual(errors, []); assert.equal(calls.at(-1)[0], child.agent.id)
    const count = calls.length
    for await (const _ of ctx.llm.stream({ provider: 'test', model: 'test', messages: [], sessionId: agent.id })) {}
    assert.equal(calls.length, count)
    await sourcePlugin.dispose()
    assert.ok(!ctx.get('tavernRequestSources').list().some(s => s.id === 'example.memory'))
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'AFTER SOURCE UNLOAD' }], source: { kind: 'user' } })); await agent.whenIdle()
    assert.deepEqual(errors, [])
    assert.ok(!requests.at(-1).messages.some(m => m.content.some(b => b.text?.includes('MEMORY'))))
    await child.dispose(); await handle.dispose()
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('official DeepSeek serializer receives a nonempty custom-only user request', { skip: !runtimeRoot, timeout: 10000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const { DeepSeekAdapter } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm-deepseek')).href)
  const { assembleRequest, BUILTINS } = await import('../packages/request-assembler/index.js')
  let wire
  const adapter = new DeepSeekAdapter({
    options: () => ({ baseURL: 'https://unused.invalid', models: [{ id: 'fixture' }], defaults: { thinking: 'disabled' }, maxTokens: 32, streamIdleTimeoutMs: 5000, filePolicy: {} }),
    resolveAuth: async () => ({ headers: {} }), resolveUserId: () => 'fixture',
    prepareExtensions: async ({ body }) => { wire = body; throw new Error('Stop before network: serialization verification only') },
  })
  const rules = [...BUILTINS[0].rules.map(r => ({ ...r, enabled: false })), { id: 'only', kind: 'custom', text: 'Reply OK' }]
  async function capture(preset) {
    wire = undefined
    const request = assembleRequest({ preset })
    await assert.rejects(async () => { for await (const _ of adapter.stream({ provider: 'fixture', model: 'fixture', messages: request.messages })) {} }, { code: 'REQUEST_EXTENSION' })
    assert.ok(wire, 'official serializer reached before any network I/O')
    return wire
  }
  const fixed = await capture({ ...BUILTINS[0], rules })
  assert.deepEqual(fixed.messages, [{ role: 'user', content: [{ type: 'text', text: 'Reply OK' }] }])
  const legacy = await capture({ ...BUILTINS[0], rules: rules.map(r => r.kind === 'custom' ? { ...r, role: 'preserve' } : r) })
  assert.equal(legacy.system, 'Reply OK')
  assert.deepEqual(legacy.messages, [])
})
