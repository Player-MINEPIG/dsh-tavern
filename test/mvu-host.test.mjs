import { installIndependentAssembler } from './helpers/assembler-host.mjs'
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

function assertMvuRequestContribution(request, session, resourceId, expectedState) {
  const recorded = session.snapshotEvents().findLast(event => event.type === 'request/assembly')
  assert.equal(recorded.data.metadata.owner, 'pmp-dsh-tavern')
  assert.deepEqual(recorded.data.messages, request.messages)
  const assembly = recorded.data.metadata.assembly
  const matches = assembly.nodes.filter(node => node.source?.sourceId === 'tavern.mvu/state' && node.source.resourceId === resourceId)
  assert.equal(matches.length, 1)
  const node = matches[0]
  const expectedText = `${JSON.stringify(expectedState)}\nReturn variable changes as <JSONPatch>[{"op":"replace","path":"/field","value":0}]</JSONPatch>. Use delta for numeric changes. Output literal values only.`
  assert.equal(node.text, expectedText)
  assert.equal(node.inputMessageIds.length, 1)
  const [inputId] = node.inputMessageIds
  const snapshots = assembly.systemProjection.messages.filter(snapshot => snapshot.contributorIds.includes(inputId))
  assert.equal(snapshots.length, 1)
  const [snapshot] = snapshots
  assert.equal(snapshot.inputIds.filter(id => id === inputId).length, 1)
  assert.equal(snapshot.contributorIds.filter(id => id === inputId).length, 1)
  assert.deepEqual(node.requestMessageIds, [snapshot.messageId])
  assert.equal(node.start, snapshot.index)
  assert.equal(node.count, 1)
  assert.equal(request.messages.filter(message => message.id === snapshot.messageId).length, 1)
  const carrier = request.messages[snapshot.index]
  assert.equal(carrier.id, snapshot.messageId)
  assert.equal(carrier.role, 'system')
  // Reconstruct the complete carrier from ordered logical contributors, rather
  // than accepting an MVU substring in an unrelated or duplicated message.
  const contributors = snapshot.contributorIds.map(id => {
    const owners = assembly.nodes.filter(candidate => candidate.inputMessageIds.includes(id))
    assert.equal(owners.length, 1)
    return owners[0].text
  })
  assert.deepEqual(carrier.content, [{ type: 'text', text: contributors.filter(Boolean).join('\n\n') }])
  assert.equal(carrier.content[0].text.split(expectedText).length - 1, 1)
}
test('real DSH AgentLoop final replies, fork seed, restart snapshots and native unload', { skip: !runtimeRoot, timeout: 20000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'mvu-host-')), failures = [], requests = [], facts = []
  let store
  const resources = [{ sharing: 'shared', id: 'mvu:host', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }]
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    let broken = false
    class Adapter extends llm.LlmAdapter {
      // This fixture selects a trailing MVU system source, which requires a capable route.
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
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
    await installIndependentAssembler(ctx, directory)
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
    assertMvuRequestContribution(requests[0], agent.session, 'mvu:host', { hp: 100 })
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
      // This fixture selects a trailing MVU system source, which requires a capable route.
      async listModels(provider) { return [{ provider, id: 'test', name: 'Synthetic test' }] }
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
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
    await installIndependentAssembler(ctx, directory)
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: directory, mvu: { resources: [
      { sharing: 'shared', id: 'mvu:opening', characterId: 'opening-card', sessionIds: ['*'], initial: { stat_data: { hp: 10 } } },
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
    await ctx.sessionController.selectModel({ sessionId: agent.id, provider: 'initial-test', model: 'test' })
    assert.deepEqual(agent.session.snapshotEvents().at(-1).data, { provider: 'initial-test', model: 'test' })
    assert.equal(agent.session.snapshotEvents().at(-1).type, 'model/selection')
    await service.flush()
    const scope = { mode: 'initial', playthroughId: 'opening', sessionId: agent.id, characterId: 'opening-card', sessionFormatVersion: agent.session.header.version }
    const source = JSON.stringify({ version: 1, scope, runs: [], modules: {}, html: '<div>Synthetic opening</div>' })
    const sourceIdentity = { version: 1, sha256: createHash('sha256').update(source).digest('hex'), scope }
    const { grantId } = ctx.get('tavernRenderingAuthority').grant({ source, sourceIdentity, downloaded: true, enabled: true })
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
    assertMvuRequestContribution(requests[0], agent.session, 'mvu:opening', { hp: 7 })
    assert.ok(facts.some(f => f.phase === 'applied' && f.detail === 'dsh-request-observed' && f.revision === 1))
    assert.equal((await service.read({ id: 'mvu:opening', scope: { sessionId: agent.id } })).content.stat_data.hp, 6)
    await assert.rejects(service.createCardBinding({ scope, sourceIdentity, grantId }), { code: 'MVU_READ_ONLY' })
    await assert.rejects(service.cardWrite({ capability: binding.capability, operation: 'patch', value: [], expectedRevision: 2, operationId: 'late', cause: 'script' }), { code: 'MVU_READ_ONLY' })
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('official persisted empty session resumes through resolveAgent, while resumed conversation stays closed', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const { mkdirSync } = await import('node:fs')
  const { validatePlayDocument } = await import('../packages/play/src/timeline.js')
  const directory = mkdtempSync(join(tmpdir(), 'mvu-resume-host-')), workspace = join(directory, 'play')
  const contexts = []; mkdirSync(workspace)
  async function boot() {
    const ctx = new Context(); contexts.push(ctx)
    ctx.provide('directoryPickerController', {})
    ctx.provide('workspaceController', { create: async () => ({ workspace: { workspaceId: 'synthetic-workspace' } }) })
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-persistence-jsonl')).default, { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'resume-test', model: 'test' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    new (await load('@deepseek-ai/dsh-api-session-controller')).SessionController(ctx, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default, { defaultPreset: 'workspace-write' })
    class Adapter extends llm.LlmAdapter {
      async listModels(provider) { return [{ provider, id: 'test', name: 'Synthetic resume' }] }
      async resolveModel(provider, id) { return { provider, id, name: id } }
      async *stream() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'Synthetic reply.' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Synthetic reply.' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['resume-test'], new Adapter())
    let store
    await installIndependentAssembler(ctx, directory)
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: join(directory, 'tavern'), mvu: { resources: [
      { sharing: 'shared', id: 'mvu:resume', characterId: 'resume-card', sessionIds: ['*'], initial: { stat_data: { hp: 10 } } },
    ] } }) } })
    await store.playWorkspaceStore.bindRoot(workspace)
    return { ctx, store, service: ctx.get('tavernMvu') }
  }
  try {
    const first = await boot()
    first.store.characterStore.create({ id: 'resume-card', name: 'Synthetic resume' })
    const { sessionId } = await first.ctx.sessionController.create({ cwd: directory })
    const original = first.ctx.agents.get(sessionId)
    first.store.sessionSelections.set(sessionId, { characterCardId: 'resume-card' })
    first.store.rpMode.followCharacterChange(sessionId, { previousId: null, nextId: 'resume-card' })
    const write = (path, value) => first.store.playWorkspaceStore.writeFile(path, JSON.stringify(value), { expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument })
    write('opening/timeline.json', { nodes: [] })
    write('catalog.json', { playthroughs: [{ id: 'opening', path: 'opening/timeline.json', ext: { pmpDshTavern: { rootSessionId: sessionId, characterId: 'resume-card' } } }] })
    const scope = { mode: 'initial', playthroughId: 'opening', sessionId, characterId: 'resume-card', sessionFormatVersion: 4 }
    assert.deepEqual(original.session.snapshotEvents().map(event => event.type), ['permission/preset', 'sandbox/mode', 'approval/policy', 'sandbox/mode'])
    await first.ctx.sessionController.selectModel({ sessionId, provider: 'resume-test', model: 'test' })
    assert.equal(original.session.snapshotEvents().at(-1).type, 'model/selection')
    assert.equal((await first.service.snapshot(scope)).variables.stat_data.hp, 10)
    await first.ctx.sessions.flush(original.session)
    await first.ctx.fiber.dispose()

    const second = await boot()
    assert.equal(second.ctx.sessions.get(sessionId), undefined)
    // snapshot must use the public resolveAgent cold path, including the official JSONL backend.
    assert.equal((await second.service.snapshot(scope)).variables.stat_data.hp, 10)
    const resumed = second.ctx.agents.get(sessionId)
    assert.notEqual(resumed.session, original.session)
    assert.deepEqual(resumed.session.snapshotEvents().map(event => ({ type: event.type, data: event.data })).at(-1), { type: 'session/end-seed', data: {} })
    assert.equal(resumed.session.header.isSeeded, false)
    assert.equal(resumed.session.snapshotEvents().length, 6)
    assert.deepEqual(resumed.session.snapshotEvents().find(event => event.type === 'model/selection').data, { provider: 'resume-test', model: 'test' })
    const source = JSON.stringify({ version: 1, scope, runs: [], modules: {}, html: '<div>Synthetic resume</div>' })
    const sourceIdentity = { version: 1, sha256: createHash('sha256').update(source).digest('hex'), scope }
    const { grantId } = second.ctx.get('tavernRenderingAuthority').grant({ source, sourceIdentity, downloaded: true, enabled: true })
    second.service.registerUsage(() => ({ enabled: true, checkCurrent: () => true }))
    const oldBinding = await second.service.createCardBinding({ scope, sourceIdentity, grantId })
    await second.ctx.sessionController.selectModel({ sessionId, provider: 'resume-test', model: 'test' })
    await assert.rejects(second.service.cardWrite({ capability: oldBinding.capability, operation: 'replace', value: { stat_data: { hp: 7 } }, expectedRevision: 0, operationId: 'stale-selection', cause: 'user-interaction' }), { code: 'MVU_READ_ONLY' })
    const binding = await second.service.createCardBinding({ scope, sourceIdentity, grantId })
    const request = { capability: binding.capability, operation: 'replace', value: { stat_data: { hp: 7 } }, expectedRevision: 0, operationId: 'resumed-opening', cause: 'user-interaction' }
    assert.equal((await second.service.cardWrite(request)).revision, 1)
    let timer
    const completed = new Promise((resolve, reject) => {
      const stop = second.ctx.on('session/event', (session, event) => { if (session.id === sessionId && event.type === 'turn/end') { stop(); clearTimeout(timer); resolve(event) } })
      timer = setTimeout(() => { stop(); reject(new Error('timeout')) }, 5000)
    })
    resumed.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'Begin.' }], source: { kind: 'user' } }))
    assert.equal((await completed).data.reason.kind, 'completed')
    await second.service.flush()
    await assert.rejects(second.service.cardWrite({ ...request, operationId: 'after-turn', expectedRevision: 1 }), { code: 'MVU_READ_ONLY' })
    await second.ctx.sessions.flush(resumed.session)
    await second.ctx.fiber.dispose()

    const third = await boot()
    await assert.rejects(third.service.snapshot(scope), { code: 'MVU_READ_ONLY' })
    const events = third.ctx.sessions.get(sessionId).snapshotEvents()
    assert.equal(events.at(-1).type, 'session/end-seed')
    assert.ok(events.some(event => event.type === 'turn/start'))
    assert.ok(events.some(event => event.type === 'assistant/message'))
  } finally { for (const ctx of contexts.reverse()) await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
