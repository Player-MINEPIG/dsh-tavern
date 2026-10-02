import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { MvuService } from '../packages/mvu-adapter/src/index.js'

const runtimeRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT ?? process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('real DSH AgentLoop final replies, fork seed, restart snapshots and native unload', { skip: !runtimeRoot, timeout: 20000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'mvu-host-')), failures = [], requests = [], facts = []
  let store
  const resources = [{ id: 'mvu:host', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }]
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    let broken = false
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        requests.push(request)
        const text = "_.add('hp', -5);"
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text }
        if (broken) throw new Error('synthetic failure')
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['mvu-test'], new Adapter())
    const plugin = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory, mvu: { resources } }) } }); await plugin
    ctx.on('agent/error', e => failures.push(e.error))
    const service = ctx.get('tavernMvu'), handle = await ctx.agents.create({ sessionId: 'mvu-host', agentOptions: { provider: 'mvu-test', model: 'test' } })
    const { agent } = handle
    service.observe(fact => facts.push(fact))
    const preset = store.assemblyPresets.save({ ...store.assemblyPresets.get('builtin-cache'), rules: [...store.assemblyPresets.get('builtin-cache').rules, { id: 'mvu', kind: 'tavern.mvu/state', role: 'system', lifetime: 'request' }] })
    store.assemblyPresets.apply(agent.id, preset.id)
    async function turn() {
      let timer
      const completed = new Promise((resolve, reject) => {
        const stop = ctx.on('session/event', (session, event) => { if (session.id === agent.id && event.type === 'turn/end') { stop(); clearTimeout(timer); resolve(event) } })
        timer = setTimeout(() => { stop(); reject(new Error('timeout')) }, 5000)
      })
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
      const end = await completed; await service.flush(); return end
    }
    const firstEnd = await turn(); assert.deepEqual(failures, []); assert.equal(firstEnd.data.reason.kind, 'completed', JSON.stringify(firstEnd.data.reason))
    const first = await service.read({ id: 'mvu:host', scope: { sessionId: agent.id } })
    assert.equal(first.content.stat_data.hp, 95)
    assert.ok(requests[0].messages.some(m => m.content.some(b => b.text?.startsWith('{"hp":100}'))))
    assert.ok(facts.some(f => f.phase === 'applied' && f.detail === 'dsh-request-observed' && f.revision === 0), JSON.stringify(agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly')))
    assert.ok(facts.some(f => f.phase === 'applied' && f.detail === 'state-committed' && f.revision === 1))
    const boundary = agent.session.snapshotEvents().findLast(e => e.type === 'assistant/message').seq
    const child = ctx.sessions.fork(agent.session, boundary, 'mvu-child')
    await service.ingest(child)
    assert.equal((await service.read({ id: 'mvu:host', scope: { sessionId: child.id } })).content.stat_data.hp, 95)
    broken = true
    assert.notEqual((await turn()).data.reason.kind, 'completed')
    assert.equal((await service.read({ id: 'mvu:host', scope: { sessionId: agent.id } })).content.stat_data.hp, 95)
    const restored = new MvuService({ storageDir: directory, resources })
    await restored.ingest(agent.session)
    assert.equal((await restored.read({ id: 'mvu:host', scope: { sessionId: agent.id } })).content.stat_data.hp, 95)
    const events = agent.session.snapshotEvents()
    await plugin.dispose()
    assert.deepEqual(agent.session.snapshotEvents(), events)
    assert.equal(ctx.get('tavernMvu'), undefined)
    await handle.dispose()
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('real Host empty greeting binding writes state used by the first model request and expires on turn start', { skip: !runtimeRoot, timeout: 20000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const { mkdirSync } = await import('node:fs')
  const { validatePlayDocument } = await import('../packages/play/src/timeline.js')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'mvu-initial-host-')), requests = [], facts = []
  let store
  try {
    ctx.provide('directoryPickerController', {})
    ctx.provide('workspaceController', { create: async () => ({ workspace: { workspaceId: 'synthetic-workspace' } }) })
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    // Use the official controller and permission-preset creation path, not agents.create alone.
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'initial-test', model: 'test' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    new (await load('@deepseek-ai/dsh-api-session-controller')).SessionController(ctx, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default, { defaultPreset: 'workspace-write' })
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        requests.push(request)
        const text = "_.add('hp', -1);"
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['initial-test'], new Adapter())
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory, mvu: { resources: [
      { id: 'mvu:opening', characterId: 'opening-card', sessionIds: ['*'], initial: { stat_data: { hp: 10 } } },
    ] } }) } })
    store.characterStore.create({ id: 'opening-card', name: 'Synthetic opening' })
    const created = await ctx.sessionController.create({ cwd: directory })
    const agent = ctx.agents.get(created.sessionId)
    assert.ok(agent)
    store.sessionSelections.set(agent.id, { characterCardId: 'opening-card' })
    store.rpMode.followCharacterChange(agent.id, { previousId: null, nextId: 'opening-card' })
    const workspace = join(directory, 'play'); mkdirSync(workspace)
    await store.playWorkspaceStore.bindRoot(workspace)
    const write = (path, value) => store.playWorkspaceStore.writeFile(path, JSON.stringify(value), { expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument })
    write('opening/timeline.json', { nodes: [] })
    write('catalog.json', { playthroughs: [{ id: 'opening', path: 'opening/timeline.json', ext: { pmpDshTavern: { rootSessionId: agent.id, characterId: 'opening-card' } } }] })
    const service = ctx.get('tavernMvu')
    assert.deepEqual(agent.session.snapshotEvents().map(event => ({ type: event.type, data: event.data })), [
      { type: 'permission/preset', data: { preset: 'workspace-write' } },
      { type: 'sandbox/mode', data: { mode: 'workspace-write' } },
      { type: 'approval/policy', data: { policy: 'ask' } },
      { type: 'sandbox/mode', data: { mode: 'read-only' } },
    ])
    await service.flush()
    const scope = { mode: 'initial', playthroughId: 'opening', sessionId: agent.id, characterId: 'opening-card', sessionFormatVersion: agent.session.header.version }
    const source = JSON.stringify({ version: 1, scope, runs: [], modules: {}, html: '<div>Synthetic opening</div>' })
    const sourceIdentity = { version: 1, sha256: createHash('sha256').update(source).digest('hex'), scope }
    const { grantId } = ctx.get('tavernRenderingAuthority').grant({ source, sourceIdentity, reviewed: true, write: true })
    service.registerUsage(request => request.on === 'card_variable_update' ? { enabled: true, configRevision: 1, checkCurrent: () => true } : undefined)
    service.observe(fact => facts.push(fact))
    assert.equal((await service.snapshot(scope)).variables.stat_data.hp, 10)
    const binding = await service.createCardBinding({ scope, sourceIdentity, grantId })
    await service.cardWrite({ capability: binding.capability, operation: 'replace', value: { stat_data: { hp: 7 } }, expectedRevision: 0, operationId: 'opening-config', cause: 'user-interaction' })
    const preset = store.assemblyPresets.save({ ...store.assemblyPresets.get('builtin-cache'), rules: [...store.assemblyPresets.get('builtin-cache').rules, { id: 'mvu', kind: 'tavern.mvu/state', role: 'system', lifetime: 'request' }] })
    store.assemblyPresets.apply(agent.id, preset.id)
    let timer
    const completed = new Promise((resolve, reject) => {
      const stop = ctx.on('session/event', (session, event) => { if (session.id === agent.id && event.type === 'turn/end') { stop(); clearTimeout(timer); resolve(event) } })
      timer = setTimeout(() => { stop(); reject(new Error('timeout')) }, 5000)
    })
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'Begin the synthetic scene.' }], source: { kind: 'user' } }))
    assert.equal((await completed).data.reason.kind, 'completed')
    await service.flush()
    assert.ok(requests[0].messages.some(m => m.content.some(b => b.text?.startsWith('{"hp":7}'))))
    assert.ok(facts.some(f => f.phase === 'applied' && f.detail === 'dsh-request-observed' && f.revision === 1))
    assert.equal((await service.read({ id: 'mvu:opening', scope: { sessionId: agent.id } })).content.stat_data.hp, 6)
    await assert.rejects(service.createCardBinding({ scope, sourceIdentity, grantId }), { code: 'MVU_READ_ONLY' })
    await assert.rejects(service.cardWrite({ capability: binding.capability, operation: 'patch', value: [], expectedRevision: 2, operationId: 'late', cause: 'script' }), { code: 'MVU_READ_ONLY' })
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
