import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import assembler from 'dsh-prompt-assembler/plugin'
import { installCoreExtension } from './helpers/assembler-host.mjs'
import * as tavern from '../packages/tavern-loader/src/index.js'
const root = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT

test('independent assembler remains mounted after Tavern removal and keeps session strategy and history', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'dual-assembler-')), requests = [], errors = []; let store
  try {
    for (const id of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(id, {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'NATIVE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.on('agent/error', e => errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await installCoreExtension(ctx)
    const core = ctx.get('dshPromptAssembler')
    const handle = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) { store = tavern.apply(scope, { storageDir: join(directory, 'tavern') }) } }); await handle
    assert.equal(core.store.defaultPresetId, 'builtin-native-slots', 'installing the advanced addon does not silently opt new RP sessions into core assembly')
    assert.ok(store); assert.equal(store.requestAssembler, core.runtime); assert.equal(store.assemblyPresets, core.store)
    const sources = core.registry.list()
    assert.deepEqual(sources.filter(s => s.pluginId === 'pmp-dsh-tavern').map(s => s.id).sort(), ['character', 'custom', 'persona', 'phi', 'preset', 'worldbook', 'tavern.text', 'pmp-dsh-tavern/prompt-template', 'tavern.mvu/state'].sort())
    assert.equal(new Set(sources.map(s => s.id)).size, sources.length)
    assert.deepEqual(sources.filter(s => s.acceptsText && !s.textParserAliasFor).map(s => s.id).sort(), ['dsh.text', 'tavern.text'])
    assert.ok(sources.filter(s => s.pluginId === 'pmp-dsh-tavern' && s.supportsModule).every(s => s.contentGuide))
    for (const id of ['builtin-st', 'builtin-cache']) assert.ok(core.store.list().some(p => p.id === id))
    const prompt = store.create({ name: 'Synthetic' }); store.update(prompt.id, { prompts: [{ identifier: 'main', name: 'Main Prompt', role: 'system', content: 'MAIN ONCE', enabled: true }] }); store.select(prompt.id)
    const strategy = core.store.save({ ...core.store.get('builtin-st'), name: 'Dual', rules: [...core.store.get('builtin-st').rules, { id: 'custom-dsh', kind: 'dsh.text', inputMode: 'text', text: 'DSH INDEPENDENT' }] })
    const agent = (await ctx.agents.create({ sessionId: 'dual', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    core.store.apply(agent.id, strategy.id)
    const edited = store.assemblyPresets.save({ ...strategy, name: 'Edited through Tavern', rules: strategy.rules.map(r => r.id === 'custom-dsh' ? { ...r, text: 'DSH INDEPENDENT FROM TAVERN' } : r) }, strategy.id)
    assert.deepEqual(core.store.selection(agent.id), strategy, 'a Tavern library edit leaves the sidebar-applied snapshot unchanged')
    const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
    await turn('ONE')
    assert.ok(requests[0].some(m => JSON.stringify(m).includes('MAIN ONCE'))); assert.ok(requests[0].some(m => JSON.stringify(m).includes('DSH INDEPENDENT')))
    assert.ok(!requests[0].some(m => JSON.stringify(m).includes('DSH INDEPENDENT FROM TAVERN')))
    const first = agent.session.snapshotEvents().filter(e => e.type === 'request/assembly'); assert.equal(first.length, 1); assert.equal(first[0].data.metadata.owner, 'dsh-prompt-assembler')
    store.assemblyPresets.apply(agent.id, edited.id)
    assert.deepEqual(core.store.selection(agent.id), edited, 'the last successful application from Tavern supersedes the sidebar snapshot')
    await handle.dispose()
    assert.equal(ctx.get('dshPromptAssembler'), core); assert.ok(!core.registry.list().some(s => s.pluginId === 'pmp-dsh-tavern')); assert.equal(core.store.selection(agent.id).id, strategy.id)
    assert.ok(!core.store.list().some(p => ['builtin-st', 'builtin-cache'].includes(p.id)))
    await turn('TWO')
    assert.ok(requests[1].some(m => JSON.stringify(m).includes('DSH INDEPENDENT')))
    assert.ok(requests[1].some(m => JSON.stringify(m).includes('DSH INDEPENDENT FROM TAVERN')))
    assert.ok(agent.session.deriveMessages().some(m => JSON.stringify(m).includes('ONE')))
    assert.equal(agent.session.snapshotEvents().filter(e => e.type === 'request/assembly').length, 2)
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
