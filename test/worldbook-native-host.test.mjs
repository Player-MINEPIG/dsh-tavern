import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assembler from 'dsh-prompt-assembler/plugin'
import * as tavern from '../packages/tavern-loader/src/index.js'

const root = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
test('native and ST assembly accept official request preparation with world-book MVU variables and no manager', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis')
  const { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'worldbook-native-host-')), requests = [], errors = []
  let store
  try {
    for (const id of ['sessionController', 'directoryPickerController']) ctx.provide(id, {})
    ctx.provide('workspaceController', { create: async ({ path }) => ({ workspace: { workspaceId: 'play', path }, created: true }) })
    await ctx.plugin(SystemPrompt, { personaPrefix: 'NATIVE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-session-title')).default, { fallbackMaxWords: 8, fallbackMaxBytes: 80, maxTitleBytes: 160 })
    ctx.on('agent/error', e => errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) {
        requests.push(structuredClone(request.messages))
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'ANSWER' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    ctx.on('agent/pre-step', async (_payload, next) => ({ ...await next(), startsRequestSeries: true }))
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) {
      store = tavern.apply(scope, { storageDir: join(directory, 'tavern'), mvu: { resources: [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100 } } }] } })
    } })
    const workspace = join(directory, 'play'); mkdirSync(workspace)
    await store.playWorkspaceStore.bindRoot(workspace)
    const book = store.worldBookStore.import({ entries: { 0: { uid: 0, content: '{{format_message_variable::stat_data}}', constant: true } } })
    for (const strategy of [null, 'builtin-st']) {
      const agent = (await ctx.agents.create({ sessionId: `worldbook-${strategy ?? 'native'}`, agentOptions: { provider: 'offline', model: 'test' } })).agent
      store.sessionSelections.set(agent.id, { worldBookIds: [book.id] })
      if (strategy) store.assemblyPresets.apply(agent.id, strategy)
      for (let turn = 0; turn < 2; turn++) {
        agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: `INPUT ${turn}` }], source: { kind: 'user' } }))
        await agent.whenIdle()
        assert.equal(agent.session.snapshotEvents().findLast(e => e.type === 'turn/end').data.reason.kind, 'completed', JSON.stringify(agent.session.snapshotEvents().map(e => ({ type: e.type, ...(e.type === 'session/title' ? { data: e.data } : {}) }))) + '\n' + errors.map(e => e.stack).join('\n'))
        assert.match(JSON.stringify(requests.at(-1)), /hp: 100/)
        await ctx.get('tavernMvu').flush()
      }
    }
    assert.equal(requests.length, 4)
    assert.deepEqual(errors, [])
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
