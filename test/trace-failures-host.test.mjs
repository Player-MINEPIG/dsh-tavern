import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { createAssemblyBodyReader } from '../packages/tavern-trace/src/body-references.js'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
const scenarios = ['provider-terminal', 'provider-retry-success', 'stream-middleware-throw',
  'assemble-throw', 'request-throw', 'retry-request-throw', 'next-step-assemble-throw']

test('real AgentLoop failure references preserve attempt identity and cold-read errors without body copies',
  { skip: !runtimeRoot, timeout: 30000 }, async t => {
    const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
    const load = name => import(pathToFileURL(require.resolve(name)).href)
    const { Context } = await load('@deepseek-ai/cordis')
    const { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
    const llm = await load('@deepseek-ai/dsh-llm')
    for (const scenario of scenarios) await t.test(scenario, async () => {
      const root = new Context()
      const directory = mkdtempSync(join(tmpdir(), 'trace-failure-host-'))
      let store, handle, calls = 0, retried = false, requestCalls = 0, assemblyCalls = 0, steered = false
      try {
        for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) root.provide(name, {})
        await root.plugin(SystemPrompt, { personaPrefix: 'SYNTHETIC_ONLY' })
        for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) {
          const module = await load(`@deepseek-ai/dsh-${name}`)
          await root.plugin(module.default, name === 'agent-loop' ? { agents: [] } : {})
        }
        class Adapter extends llm.LlmAdapter {
          async *stream() {
            calls++
            if (scenario === 'provider-terminal' || (scenario.startsWith('provider-retry') || scenario === 'retry-request-throw') && calls === 1) {
              yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'SYNTHETIC_ERROR_BODY' } } }
              return
            }
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text: 'ok' }
            yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ok' } }
            yield { type: 'finish', reason: { kind: 'stop' } }
          }
        }
        root.llm.registerAdapter(['synthetic'], new Adapter())
        await root.plugin({ name: tavern.name, inject: tavern.inject,
          apply(ctx) { store = tavern.apply(ctx, { storageDir: directory }) } })
        root.on('agent/request-error', async (_payload, next) => {
          if (['provider-retry-success', 'retry-request-throw'].includes(scenario) && !retried) {
            retried = true
            return { kind: 'retry' }
          }
          return next()
        })
        if (scenario === 'stream-middleware-throw') root.on('llm/stream', async function* () { throw new Error('SYNTHETIC_MIDDLEWARE_ERROR') })
        if (scenario === 'assemble-throw') root.on('system-prompt/assemble', async () => { throw new Error('SYNTHETIC_ASSEMBLY_ERROR') })
        if (scenario === 'request-throw') root.on('agent/request', async () => { throw new Error('SYNTHETIC_REQUEST_ERROR') })
        if (scenario === 'retry-request-throw') root.on('agent/request', async (_payload, next) => {
          if (++requestCalls > 1) throw new Error('SYNTHETIC_RETRY_REQUEST_ERROR')
          return next()
        })
        if (scenario === 'next-step-assemble-throw') {
          root.on('system-prompt/assemble', async (_input, _context, next) => {
            if (++assemblyCalls > 1) throw new Error('SYNTHETIC_NEXT_ASSEMBLY_ERROR')
            return next()
          })
          root.on('agent/turn-stopping', ({ agent }) => {
            if (!steered) { steered = true; agent.steer(llm.createUserMessage({ content: [{ type: 'text', text: 'next' }], source: { kind: 'user' } })) }
          })
        }
        handle = await root.agents.create({ sessionId: scenario, agentOptions: { provider: 'synthetic', model: 'test' } })
        handle.agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
        await handle.agent.whenIdle()
        const inspection = { meta: handle.agent.session.header, events: handle.agent.session.snapshotEvents() }
        assert.equal(inspection.meta.version, 4)
        const end = inspection.events.findLast(e => e.type === 'turn/end')
        assert.equal(end.data.reason.kind, scenario === 'provider-retry-success' ? 'completed' : 'error')
        const restored = new AssemblyStore(directory)
        const summaries = restored.list(scenario)
        let inspections = 0
        const read = createAssemblyBodyReader({ inspect: async () => { inspections++; return inspection } })
        const records = await Promise.all(summaries.map(row => read(restored.get(scenario, row.id))))
        assert.equal(inspections, records.length)
        const messages = records.map(row => row.failure?.message ?? null)
        const expected = {
          'provider-terminal': ['SYNTHETIC_ERROR_BODY'],
          'provider-retry-success': ['SYNTHETIC_ERROR_BODY', null],
          'stream-middleware-throw': ['SYNTHETIC_MIDDLEWARE_ERROR'],
          'assemble-throw': ['SYNTHETIC_ASSEMBLY_ERROR'],
          'request-throw': ['SYNTHETIC_REQUEST_ERROR'],
          'retry-request-throw': ['SYNTHETIC_ERROR_BODY', 'SYNTHETIC_RETRY_REQUEST_ERROR'],
          'next-step-assemble-throw': [null, 'SYNTHETIC_NEXT_ASSEMBLY_ERROR'],
        }
        assert.deepEqual(messages, expected[scenario])
        for (const row of records.filter(row => row.failure)) {
          assert.equal(row.failureStatus, 'available')
          assert.equal(row.failureRef.eventType, row.failure.message === 'SYNTHETIC_ERROR_BODY' ? 'assistant/attempt' : 'turn/end')
          if (row.sessionRef) assert.ok(row.sessionRef.logCutSeq < row.failureRef.sessionRef.logCutSeq)
          assert.equal(restored.get(scenario, row.id).failure, undefined)
        }
        if (records.length > 1) assert.deepEqual(records.map(row => row.attempt), [1, 2])
        const persisted = readFileSync(restored.path, 'utf8')
        for (const message of messages.filter(Boolean)) assert.ok(!persisted.includes(message))
        assert.equal(calls, scenario === 'provider-retry-success' ? 2 : ['assemble-throw', 'request-throw', 'stream-middleware-throw'].includes(scenario) ? 0 : 1)
      } finally {
        if (handle) await handle.dispose()
        await root.fiber.dispose()
        rmSync(directory, { recursive: true, force: true })
      }
    })
  })
