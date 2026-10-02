import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { MvuService } from '../packages/mvu-adapter/src/index.js'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
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
