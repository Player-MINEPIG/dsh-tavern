import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import * as tavern from '../packages/tavern-loader/src/index.js'
const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official AgentLoop fallback preserves request evidence, defaults and retry boundaries', { skip: !runtimeRoot }, async t => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis')
  const { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  for (const scenario of ['recover', 'partial-output', 'auth', 'repeated-default', 'middleware']) await t.test(scenario, async () => {
    const root = new Context(), directory = mkdtempSync(join(tmpdir(), 'fallback-host-'))
    let handle, store
    const requests = []
    try {
      for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) root.provide(name, {})
      await root.plugin(SystemPrompt, {})
      for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) {
        const module = await load(`@deepseek-ai/dsh-${name}`)
        await root.plugin(module.default, name === 'agent-loop' ? { agents: [] } : {})
      }
      class Adapter extends llm.LlmAdapter {
        async resolveModel(provider, model) { return { provider, id: model, name: model, reasoning: { efforts: [{ id: 'standard', name: 'Standard' }], defaultEffort: 'standard' } } }
        async *stream(options) {
          requests.push({ temperature: options.temperature, reasoningEffort: options.reasoningEffort })
          if (scenario === 'partial-output') yield { type: 'block-start', index: 0, blockType: 'text' }
          if (options.temperature !== undefined || !['recover', 'middleware'].includes(scenario)) {
            yield { type: 'finish', reason: { kind: 'error', failure: { code: scenario === 'auth' ? 'AUTH_ERROR' : 'INVALID_REQUEST', status: scenario === 'auth' ? 401 : 400, message: 'temperature is not supported' } } }
            return
          }
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: 'ok' }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ok' } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        }
      }
      if (scenario === 'middleware') root.on('llm/stream', async function* (options) { yield* new Adapter().stream(options) })
      else root.llm.registerAdapter(['synthetic'], new Adapter())
      await root.plugin({ name: tavern.name, inject: tavern.inject, apply(ctx) { store = tavern.apply(ctx, { storageDir: directory }) } })
      const preset = store.create({ name: 'Fallback' })
      store.update(preset.id, { sampling: { temperature: 0.4, reasoningEffort: 'xhigh' } })
      store.select(preset.id)
      handle = await root.agents.create({ sessionId: scenario, agentOptions: { provider: 'synthetic', model: 'test' } })
      handle.agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
      await handle.agent.whenIdle()
      const events = handle.agent.session.snapshotEvents()
      assert.equal(events.findLast(e => e.type === 'turn/end').data.reason.kind, ['recover', 'middleware'].includes(scenario) ? 'completed' : 'error')
      assert.equal(requests.length, ['recover', 'repeated-default', 'middleware'].includes(scenario) ? 2 : 1)
      assert.equal(requests[0].reasoningEffort, scenario === 'middleware' ? 'xhigh' : 'standard')
      if (requests.length === 2) assert.equal(requests[1].temperature, undefined)
      assert.equal(store.get(preset.id).sampling.temperature, 0.4)
      assert.equal(store.get(preset.id).sampling.reasoningEffort, 'xhigh')
      const records = store.assemblyStore.list(scenario)
      assert.equal(records.length, requests.length)
      assert.deepEqual(records[0].parameters.requested, { temperature: 0.4, reasoningEffort: 'xhigh' })
      if (scenario !== 'middleware') assert.ok(records[0].parameters.fallbacks.some(f => f.parameter === 'reasoningEffort' && f.stage === 'preflight'))
      if (scenario === 'recover') {
        assert.deepEqual(records[1].parameters.effective, { reasoningEffort: 'standard' })
        assert.ok(records[1].parameters.fallbacks.some(f => f.parameter === 'temperature' && f.stage === 'provider'))
        assert.equal(events.filter(e => e.type === 'assistant/attempt').length, 1)
      }
    } finally { await handle?.dispose(); await root.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
  })
})
