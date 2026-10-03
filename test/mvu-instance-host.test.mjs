import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
import { MvuService } from '../packages/mvu-adapter/src/index.js'

const runtimeRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT ?? process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('official SessionController fork and root-swipe creation freeze isolated state before AgentLoop requests', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'mvu-instance-host-')), requests = [], failures = []
  let store, updateText = "_.add(\'hp\', -1);"
  try {
    ctx.provide('directoryPickerController', {}); ctx.provide('workspaceController', {})
    ctx.provide('workspaceRegistry', { list: () => [], get: () => undefined, archivedSessionIds: [] })
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-persistence-jsonl')).default, { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'instance-test', model: 'test' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    new (await load('@deepseek-ai/dsh-api-session-controller')).SessionController(ctx, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default, { defaultPreset: 'workspace-write' })
    class Adapter extends llm.LlmAdapter {
      async listModels(provider) { return [{ provider, id: 'test', name: 'Synthetic state instance' }] }
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) { requests.push(request); const text = updateText; yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }; yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'finish', reason: { kind: 'stop' } } }
    }
    ctx.llm.registerAdapter(['instance-test'], new Adapter())
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir: join(directory, 'tavern'), mvu: { resources: [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }] } }) } })
    ctx.on('agent/error', e => failures.push(e.error))
    const service = ctx.get('tavernMvu')
    const host = createPlayHost({ sessionController: ctx.sessionController }, { selections: store.sessionSelections, stateSeeds: () => service, onSelectionCopied: (id, from) => store.assemblyPresets.copySelection(from, id) })
    const root = await host.createSession({ cwd: directory }), rootId = root.sessionId
    const row = async id => (await service.list({ scope: { sessionId: id } })).find(r => r.templateId === 'mvu:template')
    await service.flush(); const initial = await row(rootId)
    await service.update({ id: initial.id, scope: { sessionId: rootId }, expectedRevision: initial.revision, operationId: 'opening', content: { stat_data: { hp: 70 } } })
    const preset = store.assemblyPresets.save({ ...store.assemblyPresets.get('builtin-cache'), rules: [...store.assemblyPresets.get('builtin-cache').rules, { id: 'mvu', kind: 'tavern.mvu/state', role: 'system', lifetime: 'request' }] })
    store.assemblyPresets.apply(rootId, preset.id)
    const turn = async id => {
      const done = new Promise((accept, reject) => { const stop = ctx.on('session/event', (session, event) => { if (session.id === id && event.type === 'turn/end') { stop(); clearTimeout(timer); accept(event) } }); const timer = setTimeout(() => { stop(); reject(Error('timeout')) }, 5000) })
      ctx.agents.get(id).followup(llm.createUserMessage({ content: [{ type: 'text', text: 'Synthetic turn.' }], source: { kind: 'user' } }))
      assert.equal((await done).data.reason.kind, 'completed', failures.map(e => e.stack ?? e.message).join('\n')); await service.flush()
      return ctx.agents.get(id).session.snapshotEvents().findLast(e => e.type === 'assistant/message').seq
    }
    const reply = await turn(rootId); assert.equal((await row(rootId)).content.stat_data.hp, 69)
    const rootRecord = ctx.sessions.get(rootId).snapshotEvents().findLast(e => e.type === 'request/assembly')
    assert(rootRecord.data.metadata.assembly.nodes.some(n => n.source?.resourceId === initial.id))
    const child = await host.forkSession({ sessionId: rootId, atSeq: reply, sessionFormatVersion: 4 })
    await host.copySelection(rootId, child.sessionId); await service.flush()
    assert.equal((await row(child.sessionId)).content.stat_data.hp, 69)
    assert.notEqual((await row(child.sessionId)).id, initial.id)
    await turn(child.sessionId); assert.equal((await row(child.sessionId)).content.stat_data.hp, 68); assert.equal((await row(rootId)).content.stat_data.hp, 69)
    const swipe = await host.createSession({ cwd: directory, stateSource: { sessionId: rootId, beforeReplyEventId: reply } })
    await host.copySelection(rootId, swipe.sessionId); await service.flush()
    const swipeRow = await row(swipe.sessionId); assert.notEqual(swipeRow.id, initial.id); assert.equal(swipeRow.content.stat_data.hp, 70)
    await turn(swipe.sessionId); assert.equal((await row(swipe.sessionId)).content.stat_data.hp, 69); assert.equal((await row(child.sessionId)).content.stat_data.hp, 68)
    updateText = "_.add('hp', 'invalid');"
    const failedReply = await turn(rootId); assert.equal((await row(rootId)).content.stat_data.hp, 69)
    const latestRoot = await row(rootId)
    await service.update({ id: latestRoot.id, scope: { sessionId: rootId }, expectedRevision: latestRoot.revision, operationId: 'after-failure', content: { stat_data: { hp: 50 } } })
    const ordinary = await host.forkSession({ sessionId: rootId, atSeq: reply, sessionFormatVersion: 4 })
    assert.equal((await row(ordinary.sessionId)).content.stat_data.hp, 50)
    const laterSwipe = await host.forkSession({ sessionId: rootId, atSeq: reply, sessionFormatVersion: 4, stateSource: { sessionId: rootId, beforeReplyEventId: failedReply } })
    await host.copySelection(rootId, laterSwipe.sessionId); await service.flush()
    assert.equal((await row(laterSwipe.sessionId)).content.stat_data.hp, 69)
    updateText = "_.add('hp', -1);"; await turn(laterSwipe.sessionId)
    assert.equal((await row(laterSwipe.sessionId)).content.stat_data.hp, 68); assert.equal((await row(rootId)).content.stat_data.hp, 50)
    for (const id of [rootId, child.sessionId, swipe.sessionId, laterSwipe.sessionId]) {
      const current = await row(id), assembly = ctx.sessions.get(id).snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.assembly
      assert(assembly.nodes.some(n => n.source?.resourceId === current.id))
      await ctx.sessions.flush(ctx.sessions.get(id))
    }
    const restored = new MvuService({ storageDir: join(directory, 'tavern'), inspect: id => ctx.sessionController.inspect(id) })
    assert.equal((await restored.read({ id: (await row(child.sessionId)).id, scope: { sessionId: child.sessionId } })).content.stat_data.hp, 68)
    restored.dispose()
    assert.equal(requests.length, 5); assert.deepEqual(failures, [])
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
