import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'
import * as tavern from '../packages/tavern-loader/src/index.js'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('DSH 0.1.7 real AgentLoop: official sections, LLM capture, durable system message, complete override, unload', { skip: !runtimeRoot, timeout: 20000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis')
  const { SystemPrompt, renderPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm')
  const root = new Context()
  const directory = mkdtempSync(join(tmpdir(), 'tavern-trace-host-'))
  let store
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) root.provide(name, {})
    await root.plugin(SystemPrompt, { personaPrefix: 'HOST_PERSONA' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) {
      const module = await load(`@deepseek-ai/dsh-${name}`)
      await root.plugin(module.default, name === 'agent-loop' ? { agents: [] } : {})
    }
    class SyntheticAdapter extends llm.LlmAdapter {
      async *stream() {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'Synthetic response' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Synthetic response' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    root.llm.registerAdapter(['synthetic'], new SyntheticAdapter())
    const plugin = root.plugin({ name: tavern.name, inject: tavern.inject, apply(ctx) { store = tavern.apply(ctx, { storageDir: directory }) } })
    await plugin
    const preset = store.create({ name: 'Synthetic preset' })
    store.update(preset.id, { prompts: [{ ...preset.prompts[0], content: 'BEFORE' }, { ...preset.prompts[0], identifier: 'tail', content: 'AFTER' }] })
    store.select(preset.id)
    const handle = await root.agents.create({ sessionId: 'trace-host', agentOptions: { provider: 'synthetic', model: 'test' } })
    const { agent } = handle
    assert.equal(agent.session.header.version, 4)
    assert.equal(store.sessionSelections.has(agent.id), true)
    assert.equal(store.pendingInputProjection.sessions.has(agent.session), true)
    const readBodies = createAssemblyBodyReader({ inspect: async () => ({ meta: agent.session.header, events: agent.session.snapshotEvents() }) })
    const readRecord = async id => readBodies(store.assemblyStore.get(agent.id, id))
    const observations = []
    root.on('system-prompt/assemble', async (_input, context, next) => { const result = await next(); observations.push(result.sections.map(s => s.name)); return result })
    async function turn() {
      let completedTimer
      const completed = new Promise((resolve, reject) => {
        const dispose = root.on('session/event', (session, event) => {
          if (session.id === agent.id && event.type === 'turn/end') { dispose(); resolve(event) }
        })
        const timer = setTimeout(() => { dispose(); reject(new Error('Turn timed out')) }, 5000)
        completedTimer = timer
      })
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
      const result = await completed
      clearTimeout(completedTimer)
      assert.equal(result.data.reason.kind, 'completed')
    }
    await turn()
    const firstSummary = store.assemblyStore.list(agent.id)[0]
    assert.ok(firstSummary, 'a real loop request must produce a reference-backed record')
    const stored = store.assemblyStore.get(agent.id, firstSummary.id)
    assert.equal(stored.sections.some(part => 'text' in part), false)
    assert.equal(stored.delivery.historyVerified, true)
    assert.equal(stored.sessionRef.sessionFormatVersion, 4)
    const first = await readRecord(firstSummary.id)
    assert.equal(first.contentStatus, 'available')
    assert.ok(!first.systemMessages.join('').includes('<st-prompt'))
    assert.equal(first.status, 'request-observed')
    assert.equal(first.delivery.assemblyVerified, true)
    assert.ok(first.sections.some(s => s.name.includes(':part:') && s.text.includes('BEFORE')))
    assert.ok(observations.some(names => names.some(name => name.includes(':part:'))))
    assert.ok(agent.session.snapshotEvents().some(e => e.type === 'system/message'))
    const removeTransform = root.on('system-prompt/assemble', async (_input, _context, next) => {
      const result = await next()
      result.sections.reverse()
      const part = result.sections.find(s => s.text.includes('BEFORE'))
      part.text = 'THIRD_PARTY_REPLACEMENT'
      return result
    })
    await turn()
    const transformed = await readRecord(store.assemblyStore.list(agent.id)[1].id)
    assert.equal(transformed.delivery.assemblyVerified, true)
    const replaced = transformed.sections.find(s => s.text === 'THIRD_PARTY_REPLACEMENT')
    assert.equal(replaced.provenance, 'unknown')
    assert.deepEqual(replaced.sources, [])
    assert.match(transformed.sections[0].text, /AFTER/)
    removeTransform()
    const removeComplete = agent.ctx.systemPrompt.section({ name: 'third-party:complete', order: 0, complete: true, text: 'ONLY_COMPLETE' })
    await turn()
    const second = await readRecord(store.assemblyStore.list(agent.id)[2].id)
    assert.equal(second.delivery.assemblyVerified, false)
    assert.deepEqual(second.systemMessages, ['ONLY_COMPLETE'])
    removeComplete()
    await plugin.dispose()
    const clean = await root.systemPrompt.assemble({ agent, scope: agent })
    assert.equal(clean.sections.some(s => s.name.startsWith('pmp-dsh-tavern:')), false)
    assert.match(renderPrompt(clean), /HOST_PERSONA/)
    await handle.dispose()
  } finally { await root.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
