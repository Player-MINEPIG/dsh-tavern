import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, textOf } from '../packages/request-assembler/assemble.js'
import { BUILTINS } from '../packages/request-assembler/model.js'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'
import { withDeepSeekWire } from './helpers/deepseek-wire.mjs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { projectSystemSnapshots as project } from '../packages/request-assembler/system-snapshots.js'
const projectSystemSnapshots = (assembly, native) => project(assembly, native, undefined, { systemPromptUpdate: 'in-history' })

const root = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
test('official DeepSeek serializer rejects the reported greeting order and accepts the corrected request offline', { skip: !root }, async () => {
  const input = defaultAssemblyFailureInput()
  const assembled = assembleRequest({ ...input, preset: BUILTINS[0] })
  const reported = structuredClone(assembled.messages)
  const [greeting] = reported.splice(reported.findIndex(m => textOf(m) === 'GREETING'), 1)
  reported.splice(reported.length - 3, 0, greeting)
  await withDeepSeekWire(root, async ({ send, bodies }) => {
    await assert.rejects(send(reported), error => error.code === 'UNSUPPORTED_CONTENT' && /system update without/.test(error.message))
    assert.equal(bodies.length, 0)
    const body = await send(assembled.messages)
    assert.deepEqual(body.messages.map(m => m.role), ['user', 'system', 'system', 'system', 'assistant', 'user', 'system', 'system', 'system'])
    const wireTexts = body.messages.flatMap(m => m.content.filter(b => b.type === 'text').map(b => b.text))
    assert.equal(wireTexts.filter(t => t === 'GREETING').length, 1)
    assert.ok(wireTexts.indexOf('GREETING') < wireTexts.indexOf('input'))
    for (const text of assembled.messages.slice(2).map(textOf)) assert.equal(wireTexts.filter(t => t === text).length, 1)
  })
})

test('complete snapshots preserve all default source paragraphs through the official serializer', { skip: !root }, async () => {
  const input = defaultAssemblyFailureInput(), logical = assembleRequest({ ...input, preset: BUILTINS[0] })
  const result = projectSystemSnapshots(logical, input.nativeMessages)
  await withDeepSeekWire(root, async ({ send }) => {
    const body = await send(result.messages)
    assert.equal(body.system, 'official\n\nMAIN')
    assert.deepEqual(body.messages.map(m => m.role), ['user', 'system', 'assistant', 'user', 'system'])
    assert.equal(body.messages[1].content[0].text, 'official\n\nMAIN\n\nLORE_BEFORE_0\n\nLORE_BEFORE_1\n\nLORE_BEFORE_2')
    assert.equal(body.messages.at(-1).content[0].text, `${body.messages[1].content[0].text}\n\nLORE_DEPTH_0\n\nLORE_DEPTH_1\n\nLORE_DEPTH_2`)
    // Each effective snapshot contains each active contribution exactly once.
    for (const snapshot of result.systemProjection.messages) {
      const text = snapshot.index === 0 ? body.system : body.messages.find(m => m.role === 'system' && m.content[0].text === textOf(result.messages[snapshot.index]))?.content[0].text
      assert.equal(text, textOf(result.messages[snapshot.index]))
      for (const id of snapshot.contributorIds) assert.equal(text.split(textOf(logical.messages.find(m => m.id === id))).length - 1, 1)
    }
    const conversations = body.messages.filter(m => m.role !== 'system').flatMap(m => m.content.map(b => b.text))
    assert.deepEqual(conversations, logical.messages.filter(m => m.role !== 'system').map(textOf))
  })
  assert.throws(() => project(logical, input.nativeMessages), error => error.code === 'ASSEMBLY_SYSTEM_UPDATES_UNSUPPORTED')
})

test('official serializer retains tool results and refuses an unrepresentable update after empty input', { skip: !root }, async () => {
  const msg = (id, role = 'system', content = [{ type: 'text', text: id }]) => ({ id, role, content,
    source: role === 'assistant' ? { kind: 'model', provider: 'offline', model: 'offline' } : { kind: role === 'system' ? 'system-prompt' : 'user' } })
  const base = msg('BASE'), user = msg('USER', 'user'), call = msg('CALL', 'assistant', [{ type: 'tool-call', id: 'tool', name: 'probe', arguments: '{}' }])
  const tool = { ...msg('RESULT', 'tool', []), toolCallId: 'tool' }
  const logical = { messages: [base, msg('MAIN'), user, call, tool, msg('AFTER_TOOL')], nodes: [] }
  const result = projectSystemSnapshots(logical, [base, user, call, tool])
  await withDeepSeekWire(root, async ({ send, bodies }) => {
    const body = await send(result.messages)
    assert.deepEqual(body.messages.map(m => m.role), ['user', 'assistant', 'user', 'system'])
    assert.deepEqual(body.messages[2].content, [{ type: 'tool_result', tool_use_id: 'tool', content: [] }])
    assert.equal(body.messages.at(-1).content[0].text, 'BASE\n\nMAIN\n\nAFTER_TOOL')
    const empty = msg('EMPTY', 'user', []), answer = msg('ANSWER', 'assistant')
    const invalid = projectSystemSnapshots({ messages: [base, user, answer, msg('UPDATE'), empty], nodes: [] }, [base, user, answer, empty])
    await assert.rejects(send(invalid.messages), e => e.code === 'UNSUPPORTED_CONTENT')
    assert.equal(bodies.length, 1)
  })
})

test('official DSH pi-ai bridge keeps one complete leading system and refuses unsupported depth locally', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), llm = await load('@deepseek-ai/dsh-llm'), pi = await load('@deepseek-ai/dsh-llm-pi-ai')
  const ctx = new Context(), bodies = [], originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'http://offline.invalid/chat/completions')
    bodies.push(JSON.parse(init.body))
    const chunk = (delta, finish_reason) => ({ id: 'offline', object: 'chat.completion.chunk', created: 0, model: 'offline-model', choices: [{ index: 0, delta, finish_reason }] })
    return new Response([chunk({ role: 'assistant', content: 'ANSWER' }, null), chunk({}, 'stop')].map(x => `data: ${JSON.stringify(x)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  try {
    // The fixture owns the credential seam. No environment or key store reads.
    ctx.provide('credentials', { resolve: async () => ({ value: 'synthetic-fixture' }) })
    await ctx.plugin(llm.default)
    await ctx.plugin(pi, { providers: { offline: { api: 'openai-completions', apiKeyEnv: 'OFFLINE_FIXTURE', baseURL: 'http://offline.invalid', models: [{ id: 'offline-model' }] } } })
    const prepared = await ctx.llm.prepareCall({ provider: 'offline', model: 'offline-model' })
    assert.equal(prepared.systemPromptUpdate, undefined)
    const input = defaultAssemblyFailureInput()
    input.assets = { preset: { prompts: [{ identifier: 'main', enabled: true, role: 'system', content: 'MAIN' }, { identifier: 'second', enabled: true, role: 'system', content: 'SECOND' }] } }
    const logical = assembleRequest({ ...input, preset: BUILTINS[0] })
    const result = project(logical, input.nativeMessages, undefined, { systemPromptUpdate: prepared.systemPromptUpdate })
    for await (const _ of prepared.stream({ ...prepared.config, messages: result.messages })) {}
    assert.deepEqual(bodies[0].messages, [{ role: 'system', content: 'official\n\nMAIN\n\nSECOND' }, { role: 'user', content: 'input' }, { role: 'user', content: 'context' }])
    const tail = { ...logical, messages: [...logical.messages, { id: 'tail', role: 'system', content: [{ type: 'text', text: 'TAIL' }] }] }
    assert.throws(() => project(tail, input.nativeMessages, undefined, { systemPromptUpdate: prepared.systemPromptUpdate }), error => error.code === 'ASSEMBLY_SYSTEM_UPDATES_UNSUPPORTED')
    assert.equal(bodies.length, 1)
  } finally { globalThis.fetch = originalFetch; await ctx.fiber.dispose() }
})
