import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assembler from 'dsh-prompt-assembler/plugin'
import { textOf } from 'dsh-prompt-assembler'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createNativeRequestReader } from '../packages/tavern-trace/src/native-request-reader.js'

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
for (const inHistory of [false, true]) test(`native first-turn greeting reaches actual request and recorded Trace (${inHistory ? 'in-history' : 'head'})`, { skip: !runtimeRoot, timeout: 15000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm'), sessions = await load('dsh-session')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'native-greeting-')), requests = [], errors = []
  let store
  try {
    ctx.provide('sessionController', { inspect: async id => ({ events: ctx.sessions.get(id).snapshotEvents(), meta: ctx.sessions.get(id).header }) })
    for (const name of ['workspaceController', 'directoryPickerController']) ctx.provide(name, {})
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'OFFICIAL' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.on('agent/error', event => errors.push(event.error))
    class Offline extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, ...inHistory ? { systemPromptUpdate: 'in-history' } : {} } }
      async *stream(request) {
        requests.push(structuredClone(request.messages))
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Offline())
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) { store = tavern.apply(scope, { storageDir: join(directory, 'tavern') }) } })
    const face = ctx.get('dshPromptAssembler')
    const character = store.characterStore.import({ spec: 'chara_card_v2', spec_version: '2.0', data: {
      name: 'Guide', description: 'CHARACTER', first_mes: 'OPENING_OPTION_5 for {{user}}', alternate_greetings: ['ALTERNATE_OPTION_7 from {{char}}'],
    } })
    const preset = store.create({ name: 'Greeting slots' })
    store.update(preset.id, { prompts: [{ identifier: 'charDescription', marker: true, role: 'user', enabled: true }, { identifier: 'chatHistory', marker: true, role: 'user', enabled: true }] })
    const reader = createNativeRequestReader({ assemblies: store.assemblyStore, sessionController: ctx.sessionController, sessions: () => ctx.sessions })
    for (const mode of ['native-slots', 'native-roles']) for (const greetingIndex of [0, 1]) {
      const agent = (await ctx.agents.create({ sessionId: `greeting-${mode}-${greetingIndex}`, agentOptions: { provider: 'offline', model: 'offline' } })).agent
      store.sessionSelections.set(agent.id, { presetId: preset.id, characterCardId: character.id, character: { greetingIndex } })
      face.store.apply(agent.id, `builtin-${mode}`)
      const turn = async text => {
        agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
        await agent.whenIdle()
        assert.deepEqual(errors, [])
      }
      await turn('Choose the opening option')
      const first = requests.at(-1), expected = greetingIndex ? 'ALTERNATE_OPTION_7 from Guide' : 'OPENING_OPTION_5 for User'
      assert.equal(first.map(textOf).join('\n').split(expected).length - 1, 1, `${mode} first request must carry selected opening once`)
      assert.equal(first.some(message => message.role === 'assistant'), false, 'greeting is not a synthetic conversation reply')
      const recorded = (await reader.readActual(agent.id)).request
      assert.deepEqual(recorded.messages, first)
      assert.ok(recorded.metadata.assembly.nodes.some(node => node.text === expected && node.role === 'system' && node.source.field === 'greeting' && node.source.resourceId === character.id))
      const firstRecord = store.assemblyStore.list(agent.id)[0]
      await turn('Continue')
      assert.equal(face.runtime.nativePlans.get(agent).logical.nodes.some(node => node.source?.field === 'greeting'), false, 'later turns do not reinject opening')
      const restored = sessions.Session.fromRestore(agent.id, structuredClone(agent.session.snapshotEvents()), agent.session.header, sessions.SessionLogOffset(0), 'detached')
      const cold = createNativeRequestReader({ assemblies: store.assemblyStore, sessionController: { inspect: async () => ({ meta: restored.header, events: restored.snapshotEvents() }) },
        sessions: () => ({ get: () => undefined, messageProjections: ctx.sessions.messageProjections, prepare: (id, options) => sessions.Session.fromRestore(id, options.seed, options.meta, 0, 'detached', ctx.sessions.messageProjections) }) })
      const historical = await cold.readBodies(store.assemblyStore.get(agent.id, firstRecord.id))
      assert.deepEqual(historical.nativeRequest.messages, first, 'cold history still resolves the first request with its greeting')
    }
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
