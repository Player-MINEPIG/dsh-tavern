import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import assembler from 'dsh-prompt-assembler/plugin'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'

const runtimeRoot = process.env.DSH_TAVERN_COMPAT_ROOT

test('stock DSH admission refresh records final literal context and restores its durable references', { skip: !runtimeRoot, timeout: 15000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'trace-refresh-')), errors = [], requests = []
  let current = 'ASSEMBLED {{literal}}', nextValue = 'ADMITTED {{literal}}', store, inspection, record
  try {
    ctx.provide('sessionController', { inspect: async id => { const session = ctx.sessions.get(id); return { meta: session.header, events: session.snapshotEvents() } } })
    for (const name of ['workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'HOST' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    assert.equal(ctx.agentLoop.requestAssemblyVersion, undefined)
    ctx.systemPrompt.context({ name: 'refresh:fact', order: 100, required: true, interpolate: false, text: () => current })
    ctx.on('agent/error', e => errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id } }
      async *stream(options) {
        requests.push(structuredClone(options.messages))
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) { store = tavern.apply(scope, { storageDir: join(directory, 'tavern') }) } })
    // The Host refreshes facts after all request middleware returns.
    ctx.on('agent/request', async (_payload, next) => { const config = await next(); current = nextValue; return config }, { prepend: true })
    const agent = (await ctx.agents.create({ sessionId: 'refresh', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'INPUT' }], source: { kind: 'user' } }))
    await agent.whenIdle(); assert.deepEqual(errors, []); assert.equal(requests.length, 1)
    record = store.assemblyStore.get(agent.id, store.assemblyStore.list(agent.id)[0].id)
    const part = record.contexts.find(part => part.name === 'refresh:fact')
    assert.ok(part.reference, 'refreshed fact must point to its admitted durable snapshot')
    assert.equal(part.text, undefined)
    assert.ok(!JSON.stringify(record).includes('ASSEMBLED'))
    inspection = structuredClone(await ctx.sessionController.inspect(agent.id))
    current = 'ASSEMBLED BEFORE CLEAR'; nextValue = ''
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'CLEAR' }], source: { kind: 'user' } }))
    await agent.whenIdle(); assert.deepEqual(errors, [])
    const cleared = store.assemblyStore.list(agent.id).find(summary => summary.id !== record.id)
    assert.deepEqual(store.assemblyStore.get(agent.id, cleared.id).contexts, [], 'cleared context cannot reuse an older snapshot')
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
  const reader = createAssemblyBodyReader({ inspect: async () => inspection })
  const hydrated = await reader(structuredClone(record))
  assert.equal(hydrated.contexts.find(part => part.name === 'refresh:fact').text, 'ADMITTED {{literal}}')
  const changed = structuredClone(inspection)
  const event = changed.events.find(e => e.seq === record.contexts[0].reference.eventSeq)
  event.data.content[0].text = 'TAMPERED'
  const invalid = await createAssemblyBodyReader({ inspect: async () => changed })(structuredClone(record))
  assert.equal(invalid.contexts[0].contentStatus, 'reference-unavailable')
})
