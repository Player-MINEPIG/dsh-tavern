import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { RequestAssembler } from '../packages/request-assembler/runtime.js'
import { createAssemblyApi } from '../packages/request-assembler/server.js'
import { BUILTINS } from '../packages/request-assembler/model.js'

const text = result => result.messages.flatMap(message => message.content.map(block => block.text)).join('\n')
async function preview(handler, sessionId = 'cold') {
  const req = Readable.from([Buffer.from(JSON.stringify({ sessionId, preset: BUILTINS[0] }))])
  Object.assign(req, { method: 'POST', url: '/pmp-dsh-tavern/api/v1/assembly-presets/preview' })
  let answer
  await handler(req, { setHeader() {}, end(body) { answer = { status: this.statusCode, ...JSON.parse(body) } } })
  return answer
}
const resources = { compile: () => ({ assemblyInput: {} }) }

test('cold preview reads selection metadata without mutating the facade; live scoped Agents remain intact', async () => {
  const pending = { provider: 'pending', model: 'next', reasoningEffort: 'high' }
  const previous = { provider: 'history', model: 'previous', credential: 'must-not-copy' }
  const defaults = { provider: 'default', model: 'base' }
  let state = { pending }, header = { config: previous }, assembledAgent, defaultReads = 0
  const session = { deriveMessages: () => [], requestHeader: () => header }, cold = { id: 'cold', session }
  const systemPrompt = { async assemble({ agent }) {
    assembledAgent = agent
    // Official AgentLoop providers dereference options when agent is present.
    return { sections: [{ name: 'core', text: '{{provider}}/{{model}}' }], variables: { provider: agent?.options.provider, model: agent?.options.model } }
  } }
  const ctx = { get: key => ({ systemPrompt, sessionProjections: { stateOf: () => state }, agentDefaultModel: { currentSelection() { defaultReads++; return defaults } } })[key] }
  const runtime = new RequestAssembler({ ctx, store: {}, resources })
  assert.equal(text(await runtime.preview({ preset: BUILTINS[0], agent: cold })), 'pending/next')
  assert.deepEqual(assembledAgent.options, { provider: 'pending', model: 'next' })
  assert.equal(assembledAgent.session, session); assert.equal(cold.options, undefined); assert.equal(defaultReads, 0)
  state = { pending: null }
  assert.equal(text(await runtime.preview({ preset: BUILTINS[0], agent: cold })), 'history/previous')
  assert.deepEqual(assembledAgent.options, { provider: 'history', model: 'previous' }); assert.equal(defaultReads, 0)
  header = undefined
  assert.equal(text(await runtime.preview({ preset: BUILTINS[0], agent: cold })), 'default/base'); assert.equal(defaultReads, 1)
  const live = { id: 'live', session, options: { provider: 'live', model: 'scoped' }, ctx: {} }
  assert.equal(text(await runtime.preview({ preset: BUILTINS[0], agent: live })), 'live/scoped')
  assert.equal(assembledAgent, live); assert.equal(defaultReads, 1)
  assert.deepEqual(pending, { provider: 'pending', model: 'next', reasoningEffort: 'high' }); assert.equal(previous.credential, 'must-not-copy')
})

test('absent model metadata reports a native-variable error, and unrelated assembly failures are not swallowed', async () => {
  let failure = null
  const systemPrompt = { async assemble({ agent }) {
    if (failure) throw failure
    return { sections: [{ name: 'core', text: '{{provider}}/{{model}}' }], variables: { provider: agent?.options.provider, model: agent?.options.model } }
  } }
  const runtime = new RequestAssembler({ ctx: { get: key => key === 'systemPrompt' ? systemPrompt : undefined }, store: {}, resources })
  const handler = createAssemblyApi({ store: {}, runtime, agents: () => new Map(), sessions: () => ({ get: () => ({ deriveMessages: () => [] }) }) })
  const absent = await preview(handler)
  assert.equal(absent.status, 409); assert.equal(absent.code, 'NATIVE_PREVIEW_VARIABLE_UNAVAILABLE'); assert.match(absent.error, /provider/); assert.equal(absent.preview, undefined)
  failure = Object.assign(new Error('source policy rejected preview'), { code: 'WORLD_BOOK_VARIABLE_DENIED', status: 403 })
  const denied = await preview(handler)
  assert.equal(denied.status, 403); assert.equal(denied.code, 'WORLD_BOOK_VARIABLE_DENIED'); assert.equal(denied.preview, undefined)
})

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('official rc.2 cold preview runs AgentLoop variables and SessionController model projection without loading an Agent or calling a provider', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const ctx = new Context()
  let requests = 0, events = 0, modelReads = 0, prepared, preparedEvents
  try {
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: '{{provider}}/{{model}} at {{cwd}}' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('workspaceRegistry', { list: () => [], get: () => undefined, archivedSessionIds: [] })
    const defaults = { provider: 'default', model: 'base' }
    ctx.provide('agentDefaultModel', { currentSelection: () => defaults })
    new (await load('@deepseek-ai/dsh-api-session-controller')).SessionController(ctx, { nativeOpen: false })
    ctx.on('llm/stream', () => { requests++; throw Error('preview must not send a request') }, { global: true, prepend: true })
    ctx.on('session/event', () => events++)
    // Even adapter preparation/catalog reads are outside preview's contract.
    for (const name of ['prepareCall', 'resolveCallConfig', 'modelInfo']) ctx.llm[name] = () => { modelReads++; throw Error('preview must not resolve a model') }
    const meta = { version: 4, id: 'cold', createdAt: 1, isSeeded: false, cwd: '/tmp' }
    const historical = { type: 'request/header', seq: 0, time: 1, data: { header: { config: { provider: 'history', model: 'previous' } }, reason: 'initial' } }
    const picked = { type: 'model/selection', seq: 1, time: 2, data: { provider: 'pending', model: 'next' } }
    let seed = []
    const inspect = async () => ({ meta: structuredClone(meta), events: structuredClone(seed), inheritedEventCount: 0 })
    const runtime = new RequestAssembler({ ctx, store: {}, resources })
    const handler = createAssemblyApi({ store: {}, runtime, agents: () => ctx.agents, sessions: () => ({
      get: id => ctx.sessions.get(id), prepare(id, options) { prepared = ctx.sessions.prepare(id, options); preparedEvents = structuredClone(prepared.snapshotEvents()); return prepared }
    }), inspect })
    for (const [records, expected] of [[[], 'default/base'], [[historical], 'history/previous'], [[historical, picked], 'pending/next']]) {
      seed = records
      const original = JSON.stringify(seed), result = await preview(handler)
      assert.equal(result.status, 200, JSON.stringify(result)); assert.match(text(result.preview), new RegExp(expected))
      assert.equal(result.preview.pendingInputsIncluded, false); assert.equal(result.preview.systemProjection.capability, 'unverified')
      assert.equal(JSON.stringify(seed), original); assert.deepEqual(prepared.snapshotEvents(), preparedEvents)
      assert.deepEqual(preparedEvents.slice(0, records.length), records)
      assert.equal(ctx.sessions.get('cold'), undefined); assert.equal(ctx.agents.get('cold'), undefined)
    }
    seed = []; defaults.provider = undefined; defaults.model = undefined
    const unavailable = await preview(handler)
    assert.equal(unavailable.status, 409); assert.equal(unavailable.code, 'NATIVE_PREVIEW_VARIABLE_UNAVAILABLE'); assert.equal(unavailable.preview, undefined)
    assert.equal(requests, 0); assert.equal(modelReads, 0); assert.equal(events, 0)
  } finally { await ctx.fiber.dispose() }
})
