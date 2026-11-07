import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assembleRequest, configurePosition } from 'dsh-prompt-assembler'
import { NATIVE_BUILTINS, createDefaultRegistry } from 'dsh-prompt-assembler/adapters/tavern'
import { registerPersonalitySource, withPersonalityRule, orderNativePersonalitySections, orderPersonalityDynamicTail } from '../packages/tavern-loader/src/personality-source.js'
import { RequestAssembler } from 'dsh-prompt-assembler/runtime'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { TavernProfileLoader } from '../packages/tavern-loader/src/profile-loader.js'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'
import { withDeepSeekWire } from './helpers/deepseek-wire.mjs'

const textOf = m => m.content.map(b => b.text ?? '').join('')
const dynamic = n => n.source?.module === 'tavern.personality' && /^(mood|evolution\/)/.test(n.source.field)
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'personality-placement-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const cards = new PersonalityStore(directory), card = cards.import(JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Stable', personality: 'Stable traits' } }))
  cards.select('work', { characterCardId: card.id })
  const runtime = new TavernProfileLoader({ presetStore: {}, personalityStore: cards,
    personalityEvolution: { current: () => ({ revision: 1, after: 'SELF REVISION' }) },
    personalityMood: { read: () => ({ revision: 1, mood: { feeling: 'curious', intensity: 2, reason: 'MOOD REASON' } }) },
    selections: { get: () => ({ presetId: null, worldBookIds: [], character: {} }) } })
  const registry = createDefaultRegistry(); registerPersonalitySource(registry, cards)
  registry.register({ id: 'later-static', pluginId: 'fixture', name: 'Later static', resolve: () => ({ blocks: [{ type: 'text', id: 'static', role: 'system', text: 'LATER STATIC ROLE' }] }) })
  return { registry, assets: runtime.compile({ sessionId: 'work' }).assemblyInput, directory }
}
test('new native defaults put volatile personality last in system; old and manual positions retain their authority', t => {
  const { registry, assets } = fixture(t)
  const nativeMessages = [{ id: 'sys', role: 'system', content: [{ type: 'text', text: 'HOST' }] },
    { id: 'user', role: 'user', content: [{ type: 'text', text: 'TASK' }] }]
  for (const builtin of NATIVE_BUILTINS) {
    const base = withPersonalityRule(builtin), rules = [...base.rules]
    rules.splice(rules.findIndex(r => r.kind === 'tavern.personality') + 1, 0, { id: 'later-static', kind: 'later-static', enabled: true, role: 'system' })
    const preset = { ...base, rules }
    const assemble = preset => assembleRequest({ registry, assets: assets, nativeMessages, inputIds: ['user'], sessionId: 'work', preset, preview: true, afterAssembly: orderPersonalityDynamicTail })
    const result = assemble(preset), system = result.nodes.filter(n => n.role === 'system')
    assert.ok(system.slice(-2).every(dynamic))
    assert.ok(system.findIndex(n => n.text === 'LATER STATIC ROLE') < system.findIndex(dynamic))
    assert.ok(result.nodes.filter(dynamic).every(n => n.stability === 'assembly'))
    assert.equal(result.messages.filter(m => m.role === 'user').length, 1, 'no user/context mood injection')
    const old = { ...preset, layout: { ...preset.layout, positions: [], priority: ['preset', 'resource', 'default'] } }
    assert.ok(assemble(old).nodes.findIndex(dynamic) < assemble(old).nodes.findIndex(n => n.text === 'LATER STATIC ROLE'))
    const custom = configurePosition(preset, registry.list({ sessionId: 'work' }), 'tavern.personality#mood', {}, 'tavern.personality#name')
    const moved = assemble(custom)
    assert.ok(moved.nodes.findIndex(n => n.source?.field === 'mood') < moved.nodes.findIndex(n => n.source?.field === 'name'))
    assert.equal(moved.nodes.find(n => n.source?.field === 'mood').positionDecision, 'user')
    const anchored = configurePosition(preset, registry.list({ sessionId: 'work' }), 'later-static#content', {}, 'tavern.personality#mood')
    const anchoredResult = assemble(anchored)
    assert.equal(anchoredResult.nodes.findIndex(n => n.source?.field === 'mood') - anchoredResult.nodes.findIndex(n => n.text === 'LATER STATIC ROLE'), 1,
      'an explicit anchor on a dynamic field takes precedence over its default tail placement')
    const followSource = configurePosition(preset, registry.list({ sessionId: 'work' }), 'tavern.personality#mood', { placement: 'source' })
    assert.ok(assemble(followSource).nodes.findIndex(n => n.source?.field === 'mood') < assemble(followSource).nodes.findIndex(n => n.text === 'LATER STATIC ROLE'))
  }
  const sections = [{ name: 'host', text: 'HOST' }, ...assets.personalitySections, { name: 'later', text: 'LATER' }]
  const ordered = orderNativePersonalitySections(sections, assets.personalitySections)
  assert.ok(ordered.at(-1).sources[0].field === 'mood')
  assert.ok(ordered.findIndex(s => s.name === 'later') < ordered.findIndex(s => s.sources?.[0]?.field.startsWith('evolution/')))
})

test('saved native defaults remain usable after the personality source unloads', () => {
  const registry = createDefaultRegistry()
  const remove = registerPersonalitySource(registry, { binding() { return null } })
  const runtime = new RequestAssembler({ registry, ctx: { get: name => name === 'systemPrompt' ? { assemble() {} } : null } })
  const saved = NATIVE_BUILTINS.map(builtin => structuredClone(withPersonalityRule(builtin)))
  for (const preset of saved) runtime.requireAvailable(preset)
  remove()
  for (const preset of saved) {
    assert.doesNotThrow(() => runtime.requireAvailable(preset))
    const result = assembleRequest({ registry, assets: {}, nativeMessages: [
      { id: 'host', role: 'system', content: [{ type: 'text', text: 'HOST' }] },
      { id: 'user', role: 'user', content: [{ type: 'text', text: 'TASK' }] },
    ], inputIds: ['user'], preset, preview: true })
    assert.ok(result.messages.some(message => textOf(message) === 'HOST'))
    assert.ok(result.messages.some(message => textOf(message) === 'TASK'))
  }
})

test('tail placement preserves long native history and is a no-op once ordered', t => {
  const { registry, assets } = fixture(t)
  const preset = withPersonalityRule(NATIVE_BUILTINS[1])
  const nativeMessages = [{ id: 'host', role: 'system', content: [{ type: 'text', text: 'HOST' }] }]
  for (let turn = 0; turn < 250; turn++) nativeMessages.push(
    { id: `u${turn}`, role: 'user', content: [{ type: 'text', text: 'TASK' }] },
    { id: `a${turn}`, role: 'assistant', content: [{ type: 'tool-call', id: `call${turn}`, name: 'probe', arguments: '{}' }] },
    { id: `t${turn}`, role: 'tool', toolCallId: `call${turn}`, content: [{ type: 'text', text: 'RESULT' }] },
    { id: `r${turn}`, role: 'assistant', content: [{ type: 'text', text: 'ANSWER' }] },
  )
  nativeMessages.push({ id: 'current', role: 'user', content: [{ type: 'text', text: 'CURRENT' }] })
  const result = assembleRequest({ registry, assets, nativeMessages, inputIds: ['current'], sessionId: 'work', preset,
    preview: true, afterAssembly: orderPersonalityDynamicTail })
  const nativeIds = new Set(nativeMessages.map(message => message.id))
  assert.deepEqual(result.messages.filter(message => nativeIds.has(message.id)), nativeMessages)
  assert.equal(new Set(result.messages.map(message => message.id)).size, result.messages.length)
  const indices = new Map(result.messages.map((message, index) => [message.id, index]))
  for (const node of result.nodes) {
    assert.equal(node.start, indices.get(node.requestMessageIds[0]) ?? -1)
    assert.ok(node.requestMessageIds.every(id => indices.has(id)))
  }
  const { nodes, messages } = result
  orderPersonalityDynamicTail(result, { preset })
  assert.equal(result.nodes, nodes)
  assert.equal(result.messages, messages)
})

const compat = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('stock native multi-step requests preserve tool topology and official provider system placement', { skip: !compat, timeout: 30000 }, async t => {
  const require = createRequire(join(resolve(compat), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const { directory } = fixture(t), root = new Context(), requests = [], errors = []
  let tool = false, failNext = false
  try {
    for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) root.provide(name, {})
    await root.plugin(SystemPrompt, { personaPrefix: 'HOST BASE' })
    for (const suffix of ['session', 'agent', 'session-projection', 'llm', 'tools', 'tool-executor-native', 'agent-loop']) {
      const module = await load('dsh-' + suffix)
      await root.plugin(module.default ?? module, suffix === 'agent-loop' ? { agents: [] } : {})
    }
    root.on('agent/error', event => errors.push(event.error))
    root.on('agent/request-error', async (event, next) => event.failure?.message === 'OFFLINE RETRY' ? { kind: 'retry' } : next())
    root.tools.register({ name: 'probe', description: 'Offline probe', parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'string' }, render: (_, text) => [{ type: 'text', text }] }, execute: async () => 'PROBE RESULT' })
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        if (request.purpose) throw new Error('Unexpected background call')
        requests.push(request)
        if (failNext) { failNext = false; yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'OFFLINE RETRY' } } }; return }
        const block = tool ? { type: 'tool-call', id: 'probe-1', name: 'probe', arguments: '{}' } : { type: 'text', text: 'ANSWER' }
        const calls = tool; tool = false
        yield { type: 'block-start', index: 0, blockType: block.type }
        yield { type: 'block-end', index: 0, block }
        yield { type: 'finish', reason: { kind: calls ? 'tool-calls' : 'stop' } }
      }
      async resolveModel(provider, model) { return { provider, id: model, name: model, systemPromptUpdate: 'in-history' } }
    }
    root.llm.registerAdapter(['offline'], new Adapter())
    await installIndependentAssembler(root, directory)
    let store
    await root.plugin({ name: tavern.name, inject: tavern.inject, apply(ctx) { store = tavern.apply(ctx, { storageDir: directory }) } })
    const { agent } = await root.agents.create({ sessionId: 'native-placement', agentOptions: { provider: 'offline', model: 'offline' } })
    const card = store.personalityStore.import(JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Stable', personality: 'STABLE TRAITS' } }))
    store.personalityStore.select(agent.id, { characterCardId: card.id })
    store.personalityEvolution.mutate(card.id, 'config', { operationId: 'disable-learning', expectedRevision: 0, enabled: false })
    const face = root.get('dshPromptAssembler'); face.store.apply(agent.id, 'builtin-native-slots')
    const moods = store.personalityMood
    const setMood = feeling => moods.change(card.id, agent.id, { expectedRevision: moods.read(card.id, agent.id).revision,
      mood: { feeling, intensity: 3, reason: 'CURRENT REASON' } })
    const turn = async (prompt, callTool = false) => {
      tool = callTool
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }))
      await agent.whenIdle(); assert.deepEqual(errors, [])
    }
    setMood('curious'); await turn('Initial task')
    setMood('concerned'); await turn('Run probe', true)
    assert.equal(requests.length, 3)
    const replies = store.personalityMoodReply
    replies.change(agent.session, card.id, { skipNextReply: true, expectedReplyRevision: replies.view(agent.session, card.id).revision })
    await turn('Paused task', true)
    await turn('Restored task')
    assert.equal(requests.length, 6)
    for (const request of requests.slice(3, 5)) {
      const sys = textOf(request.messages.filter(m => m.role === 'system').at(-1))
      assert.ok(sys.includes('paused only when'))
      assert.ok(!sys.includes('careful and steady'))
      assert.ok(!sys.includes('CURRENT REASON'))
      assert.ok(sys.includes('ordinary voice'))
    }
    assert.ok(textOf(requests[5].messages.filter(m => m.role === 'system').at(-1)).includes('careful and steady'))
    for (const request of requests) {
      assert.ok(Object.isFrozen(request))
      const sys = request.messages.filter(m => m.role === 'system').at(-1)
      assert.ok(textOf(sys).includes('STABLE TRAITS'))
      assert.ok(textOf(sys).indexOf('STABLE TRAITS') < textOf(sys).indexOf('Current mood'))
      assert.ok(!request.messages.some(m => m.role === 'user' && /Current mood/.test(textOf(m))))
    }
    assert.ok(requests[4].messages.some(m => m.role === 'tool'))
    await withDeepSeekWire(compat, async ({ send }) => {
      const first = await send(requests[0].messages), changed = await send(requests[1].messages), continued = await send(requests[2].messages)
      assert.ok(first.system.includes('engaged and exploratory'))
      assert.ok(changed.system.includes('careful and steady'), 'adaptive native starts a new request series with the current system snapshot')
      assert.ok(!changed.messages.some(m => m.role === 'system'))
      assert.ok(continued.messages.some(m => m.role === 'user' && m.content.some(b => b.type === 'tool_result')))
    })
    await withDeepSeekWire(compat, async ({ send }) => {
      const wire = await send(requests[1].messages)
      assert.ok(wire.system.includes('careful and steady'))
      assert.ok(!wire.messages.some(m => m.role === 'system'))
    }, { inHistory: false })
    // With the assembler disabled, stock in-history updates retain earlier
    // snapshots. The newest explicit pause must supersede historical mood.
    replies.change(agent.session, card.id, { skipNextReply: true, expectedReplyRevision: replies.view(agent.session, card.id).revision })
    failNext = true
    await turn('Retry paused')
    assert.ok(requests.slice(-2).every(request => textOf(request.messages.filter(m => m.role === 'system').at(-1)).includes('paused only when')))
    assert.equal(replies.view(agent.session, card.id).status, 'idle')
    face.store.apply(agent.id, null)
    await turn('Native baseline')
    replies.change(agent.session, card.id, { skipNextReply: true, expectedReplyRevision: replies.view(agent.session, card.id).revision })
    await turn('Native paused')
    await withDeepSeekWire(compat, async ({ send }) => {
      const wire = await send(requests.at(-1).messages)
      assert.ok(JSON.stringify(wire).includes('careful and steady'), 'a previous native mood snapshot remains visible')
      assert.ok(wire.messages.some(m => m.role === 'system' && JSON.stringify(m).includes('paused only when')))
    })
    const stable = requests.slice(0, 6).map(request => textOf(request.messages.filter(m => m.role === 'system').at(-1)).split('Current mood')[0])
    assert.ok(stable.every(prefix => prefix === stable[0]))
    t.diagnostic(JSON.stringify({ stableSystemPrefixBytes: Buffer.byteLength(stable[0]), states: ['on', 'changed', 'tool-continuation', 'paused', 'paused-tool-continuation', 'restored'], includesProviderCacheEvidence: false }))
    const events = agent.session.snapshotEvents()
    assert.equal(events.filter(e => e.type === 'user/message').length, 7, 'only human turns are persisted as user messages')
    assert.ok(!events.some(e => e.type === 'request/assembly'), 'standard native path remains authoritative')
    const lastTrace = store.assemblyStore.get(agent.id, store.assemblyStore.list(agent.id).at(-1).id)
    assert.ok(lastTrace.nativeRequestRef, 'complete frozen native request remains replayable even if identical historical systems make offsets ambiguous')
    for (const row of store.assemblyStore.list(agent.id).slice(0, 6)) assert.equal(store.assemblyStore.get(agent.id, row.id).delivery.assemblyVerified, true)
  } finally { await root.fiber.dispose() }
})
