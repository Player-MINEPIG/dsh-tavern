import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assembler from 'dsh-prompt-assembler/plugin'
import { textOf } from 'dsh-prompt-assembler'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createNativeRequestReader } from '../packages/tavern-trace/src/native-request-reader.js'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
const root = process.env.DSH_ASSEMBLER_STOCK_ROOT
const managerRoot = process.env.DSH_ASSEMBLER_MANAGER_ROOT
for (const inHistory of [false, true]) test(`stock rc.2 standard Tavern + optional Manager + durable Trace (${inHistory ? 'in-history' : 'head'})`, { skip: !root || !managerRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm'), sessions = await load('dsh-session')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'standard-tavern-')), requests = [], errors = []
  let store, tools = false
  try {
    for (const id of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(id, {})
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'OFFICIAL' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.on('agent/error', e => errors.push(e.error))
    ctx.tools.register({ name: 'probe', description: 'Offline probe', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] }, execute: async () => 'TOOL RESULT' })
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, ...inHistory ? { systemPromptUpdate: 'in-history' } : {} } }
      async *stream(request) {
        assert.ok(Object.isFrozen(request)); assert.deepEqual(request.messages, ctx.sessions.get(request.sessionId).deriveMessages()); requests.push(structuredClone(request.messages))
        if (tools) { tools = false; const block = { type: 'tool-call', id: 'probe-1', name: 'probe', arguments: '{}' }; yield { type: 'block-start', index: 0, blockType: 'tool-call' }; yield { type: 'block-end', index: 0, block }; yield { type: 'finish', reason: { kind: 'tool-calls' } }; return }
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    const assemblyHandle = ctx.plugin(assembler, { storageDir: join(directory, 'assembler') }); await assemblyHandle
    const face = ctx.get('dshPromptAssembler')
    const tavernHandle = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) { store = tavern.apply(scope, { storageDir: join(directory, 'tavern') }) } }); await tavernHandle
    assert.equal(face.store.defaultPresetId, 'builtin-native-st'); assert.equal(face.runtime.capabilities().core, false)
    const resource = store.create({ name: 'Native fixture' }); store.update(resource.id, { prompts: [{ identifier: 'main', name: 'Main Original', enabled: true, role: 'system', content: 'MAIN' }, { identifier: 'jailbreak', name: 'PHI Original', enabled: true, role: 'system', content: 'PHI' }] }); store.select(resource.id)
    const configPath = join(directory, 'manager.json')
    writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, revision: 1, entries: [{ id: 'example:resource', adapterId: 'example', type: 'text', whitelist: [{ global: true }], blacklist: [], retrieve: { on: 'before_model_request', rule: true, strategy: [{ operation: 'memory.read_content' }, { operation: 'memory.to_text' }] } }], presets: {} }))
    const managerPlugin = await import(pathToFileURL(join(resolve(managerRoot), 'src/index.js')))
    const managerHandle = ctx.plugin(managerPlugin, { storageDir: join(directory, 'manager'), configPath }); await managerHandle
    const manager = ctx.get('dshMemoryManager'); manager.registerAdapter({ id: 'example', authority: 'example', list: async () => [], read: async () => ({ id: 'example:resource', type: 'text', content: 'REMEMBER', revision: 4 }) })
    const agent = (await ctx.agents.create({ sessionId: 'native-combination', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
    for (const id of ['builtin-native-st', 'builtin-native-cache', 'builtin-native-phi']) {
      const preset = face.store.get(id), rules = [...preset.rules]
      const phi = rules.findIndex(r => r.kind === 'phi' && r.role === 'user')
      rules.splice(phi < 0 ? rules.findIndex(r => r.kind === 'history') : phi, 0, { id: 'memory', kind: 'memory-manager.resources', role: phi < 0 ? 'system' : 'user', delivery: 'context' })
      const strategy = face.store.save({ ...preset, rules }); face.runtime.requireAvailable(strategy); face.store.apply(agent.id, strategy.id)
      await turn(id)
      assert.ok(requests.at(-1).some(m => textOf(m).includes('MAIN')))
      assert.ok(requests.at(-1).some(m => textOf(m).includes('REMEMBER')))
      if (phi >= 0) assert.equal(textOf(requests.at(-1).at(-1)), 'PHI')
    }
    tools = true; await turn('TOOLS')
    assert.equal(requests.length, 5, 'one follow-up and one tool continuation; no manufactured third call')
    for (const messages of requests.slice(-2)) assert.equal(textOf(messages.at(-1)), 'PHI')
    assert.equal(agent.session.snapshotEvents().filter(e => e.type === 'request/assembly').length, 0)
    assert.equal(manager.traces.filter(t => t.phase === 'applied').length, 5)
    const restored = sessions.Session.fromRestore(agent.id, structuredClone(agent.session.snapshotEvents()), agent.session.header, sessions.SessionLogOffset(0), 'detached')
    const reader = createAssemblyBodyReader({ inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) })
    const records = store.assemblyStore.list(agent.id)
    assert.equal(records.length, 5)
    const nativeReader = createNativeRequestReader({ assemblies: store.assemblyStore,
      resolveSourceName: source => source.module === 'preset' ? store.get(source.resourceId).prompts.find(p => p.identifier === source.field)?.name : null,
      sessionController: { inspect: async () => ({ meta: agent.session.header, events: agent.session.snapshotEvents() }) }, sessions: () => ctx.sessions })
    store.update(resource.id, { prompts: [{ identifier: 'main', name: 'Main Renamed', enabled: true, role: 'system', content: 'NEW MAIN' }] })
    const beforeSeq = agent.session.seq
    const beforeEvents = structuredClone(agent.session.snapshotEvents())
    const latest = await nativeReader.readActual(agent.id)
    assert.deepEqual(latest.request.messages, requests.at(-1))
    const actualNodes = latest.request.metadata.assembly.nodes
    assert.ok(actualNodes.some(n => n.name === 'Main Original' && n.text === 'MAIN' && n.source.field === 'main'))
    assert.ok(actualNodes.some(n => n.name === 'PHI Original' && n.text === 'PHI' && n.role === 'user' && n.source.field === 'jailbreak'))
    assert.ok(actualNodes.some(n => n.text === 'REMEMBER' && n.role === 'user' && n.source.plugin === 'dsh-memory-manager'))
    assert.ok(!actualNodes.some(n => n.name === 'Main Renamed' || n.text.includes('NEW MAIN')))
    assert.deepEqual(actualNodes.map(n => n.messageIndex), [...actualNodes.map(n => n.messageIndex)].sort((a,b) => a-b))
    for (const [index, summary] of records.entries()) {
      const read = await nativeReader.readBodies(store.assemblyStore.get(agent.id, summary.id))
      assert.deepEqual(read.nativeRequest.messages, requests[index], 'replay excludes later answers and later context replacements')
    }
    const legacy = store.assemblyStore.get(agent.id, records[0].id)
    delete legacy.nativeSourceRefs
    const legacyRead = await nativeReader.readBodies(legacy)
    const renamed = legacyRead.nativeProvenance.nodes.find(n => n.source.field === 'main')
    assert.equal(renamed.name, 'Main Renamed'); assert.equal(renamed.sourceStatus, 'current-name')
    assert.equal(renamed.text, 'MAIN'); assert.deepEqual(legacyRead.nativeRequest.messages, requests[0])
    const coldReader = createNativeRequestReader({ assemblies: store.assemblyStore,
      sessionController: { inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) },
      sessions: () => ({ get: () => undefined, messageProjections: ctx.sessions.messageProjections,
        prepare: (id, options) => sessions.Session.fromRestore(id, options.seed, options.meta, 0, 'detached', ctx.sessions.messageProjections) }) })
    assert.deepEqual((await coldReader.readActual(agent.id)).request.messages, requests.at(-1))
    assert.equal(agent.session.seq, beforeSeq); assert.deepEqual(agent.session.snapshotEvents(), beforeEvents)
    for (const summary of records) {
      const record = await reader(store.assemblyStore.get(agent.id, summary.id))
      assert.equal(record.status, 'request-observed'); assert.equal(record.delivery.historyVerified, true)
      assert.equal(record.requestAssemblyRef, undefined, 'native traces use durable native refs')
      assert.ok(record.sections.some(s => s.sources?.some(source => source.sourceId === 'preset')))
    }
    // New native policies retain exact source names/roles in actual-request reads.
    store.update(resource.id, { prompts: [
      { identifier: 'opening', name: 'Opening wrapper', enabled: true, role: 'user', content: 'OPEN{{history}}BETWEEN{{input}}CLOSE' },
      { identifier: 'system', name: 'System entry', enabled: true, role: 'system', content: 'SYSTEM ENTRY' },
    ] })
    for (const mode of ['native-roles', 'native-slots']) {
      face.store.apply(agent.id, `builtin-${mode}`)
      await turn(mode)
      const actual = await nativeReader.readActual(agent.id)
      assert.deepEqual(actual.request.messages, requests.at(-1))
      const nodes = actual.request.metadata.assembly.nodes
      assert.ok(nodes.some(n => n.name === 'Opening wrapper' && n.text === 'OPEN' && n.role === (mode === 'native-slots' ? 'system' : 'user')))
      assert.ok(nodes.some(n => n.name === 'System entry' && n.text === 'SYSTEM ENTRY' && n.role === (mode === 'native-slots' ? 'user' : 'system')))
      if (mode === 'native-slots') assert.deepEqual(requests.at(-1).filter(m => m.source?.kind !== 'runtime-context').slice(-4).map(textOf), ['BETWEEN', mode, 'CLOSE', 'SYSTEM ENTRY'])
    }
    await managerHandle.dispose(); await tavernHandle.dispose(); await turn('WITHOUT TAVERN')
    assert.ok(!face.registry.list().some(s => s.pluginId === 'pmp-dsh-tavern' || s.id === 'memory-manager.resources'))
    assert.ok(requests.at(-1).some(m => textOf(m).includes('REMEMBER')), 'prior user context remains historical')
    await assemblyHandle.dispose(); await turn('WITHOUT ASSEMBLER')
    assert.equal(textOf(requests.at(-1).filter(m => m.role === 'system').at(-1)), 'OFFICIAL')
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
