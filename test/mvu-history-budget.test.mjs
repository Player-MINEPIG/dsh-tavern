import { MODULE_ORDER } from './fixtures/assembly-references.mjs'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { MvuService, normalizeVariables, applyMvuUpdate } from '../packages/mvu-adapter/src/index.js'
import { snapshotMvuSession } from '../packages/mvu-adapter/src/history.js'

function fixture(t, pad = 80 * 1024, resources) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-history-budget-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const sessions = new Map(), options = { storageDir, resources: resources ?? [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100, pad: 'x'.repeat(pad) } } }],
    inspect: async id => sessions.get(id), captureSessionLease: id => { const live = sessions.get(id), observed = JSON.stringify(live); return () => sessions.get(id) === live && JSON.stringify(live) === observed } }
  let service
  const restart = () => { service?.dispose(); service = new MvuService(options); service.registerUsage(() => ({ enabled: true, checkCurrent: () => true })) }
  restart(); t.after(() => service.dispose())
  const create = (id, parent, prefix = []) => { const session = { id, header: { id, version: 4, createdAt: sessions.size + 1, ...(parent ? { parentSession: parent } : {}) }, events: structuredClone(prefix), inheritedEventCount: prefix.length, snapshotEvents() { return this.events } }; sessions.set(id, session); return session }
  const append = (s, type, data) => { const event = { seq: s.events.length, type, data }; s.events.push(event); return event }
  const row = async id => (await service.list({ scope: { sessionId: id } }))[0]
  const turn = async (id, n) => {
    const s = sessions.get(id), start = append(s, 'turn/start', { turn: n })
    await service.checkpoint(s, start)
    append(s, 'user/message', { turn: n, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Irrelevant user body.' }] } })
    append(s, 'request/assembly', { turn: n, messages: [{ content: [{ type: 'text', text: 'trace'.repeat(120 * 1024) }] }] })
    const reply = append(s, 'assistant/message', { turn: n, step: 1, message: { id: `${id}-${n}`, content: [{ type: 'text', text: "_.add('hp', -1);" }] } })
    append(s, 'turn/end', { turn: n, reason: { kind: 'completed' } }); await service.ingest(s)
    return reply.seq
  }
  const fork = async (from, to, at, ticket) => {
    ticket ??= await service.captureSessionSeed({ sessionId: from, kind: 'fork', atEventId: at })
    const source = sessions.get(from), child = create(to, from, source.events.filter(e => e.seq <= at))
    append(child, 'session/end-seed', {}); append(child, 'turn/end', { turn: child.events.findLast(e => e.type === 'assistant/message').data.turn, reason: { kind: 'forked' } })
    await service.installSessionSeed({ ticket, sessionId: to }); return child
  }
  return { get service() { return service }, storageDir, options, sessions, create, append, row, turn, fork, restart }
}

test('DSH request/assembly and media bodies do not spend MVU state budgets, even without resources', async t => {
  const f = fixture(t, 0, []), s = f.create('none')
  f.append(s, 'request/assembly', { messages: [{ content: [{ type: 'text', text: 't'.repeat(3 * 1024 * 1024) }] }] })
  f.append(s, 'user/message', { turn: 1, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'u'.repeat(3 * 1024 * 1024) }] } })
  const start = f.append(s, 'turn/start', { turn: 1 })
  await f.service.checkpoint(s, start)
  f.append(s, 'assistant/message', { turn: 1, message: { id: 'answer', content: [{ type: 'image', data: 'i'.repeat(3 * 1024 * 1024) }, { type: 'text', text: 'ANSWER' }] } })
  f.append(s, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  await f.service.ingest(s); await f.service.flush()
  assert.deepEqual(await f.service.list({ scope: { sessionId: s.id } }), [])
  assert(s.snapshotEvents()[0].data.messages[0].content[0].text.length > 2 * 1024 * 1024)
})

test('MVU projection detaches consumed facts and retains text fingerprints, tool-call and interrupted checks', () => {
  const events = [
    { seq: 0, type: 'request/assembly', data: { messages: [{ text: 'kept by DSH' }] } },
    { seq: 1, type: 'user/message', data: { turn: 1, message: { source: { kind: 'user' } } } },
    { seq: 2, type: 'assistant/message', data: { turn: 1, step: 2, interrupted: true, message: { id: 'reply', content: [{ type: 'text', text: 'first' }, { type: 'tool-call', args: { large: 'body' } }, { type: 'text', text: 'second' }] } } },
    { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed', other: 'not needed' } } },
  ]
  const s = { id: 's', header: { id: 's', version: 4, createdAt: 1 }, snapshotEvents: () => events }, copy = snapshotMvuSession(s)
  events[2].data.message.content[0].text = 'changed'; events[1].data.message.source.kind = 'automatic'; events[3].data.reason.kind = 'cancelled'; s.header.createdAt = 2
  assert.deepEqual(copy.events[0], { seq: 0, type: 'request/assembly' })
  assert.equal(copy.header.createdAt, 1); assert.equal(copy.events[1].data.message.source.kind, 'user')
  assert.equal(copy.events[2].data.message.content[0].text, 'first\nsecond')
  assert.equal(copy.events[2].data.message.content[1].type, 'tool-call'); assert.equal(copy.events[2].data.interrupted, true)
  assert.equal(copy.events[3].data.reason.kind, 'completed')
})

test('multi-turn history above one-state budget survives reads, frozen forks, cold restore and source audit', async t => {
  const f = fixture(t), s = f.create('parent'); const replies = []
  for (let turn = 1; turn <= 7; turn++) replies.push(await f.turn(s.id, turn))
  const before = await f.row(s.id), history = await f.service.history({ id: before.id, scope: { sessionId: s.id } })
  assert.equal(history.length, 7); assert(Buffer.byteLength(JSON.stringify(history)) > 2 * 1024 * 1024)
  assert.equal(before.content.stat_data.hp, 93)
  history[0].variables.stat_data.hp = -100; assert.equal((await f.row(s.id)).content.stat_data.hp, 93)
  const ticket = await f.service.captureSessionSeed({ sessionId: s.id, kind: 'fork', atEventId: replies.at(-1) })
  const edit = { id: before.id, scope: { sessionId: s.id }, operationId: 'advance-after-capture', expectedRevision: before.revision, content: { stat_data: { hp: 50, pad: before.content.stat_data.pad } } }
  await f.service.update(edit); await f.fork(s.id, 'child', replies.at(-1), ticket)
  assert.equal((await f.row('child')).content.stat_data.hp, 93); assert.equal((await f.row(s.id)).content.stat_data.hp, 50)
  f.restart(); assert.equal((await f.row('child')).content.stat_data.hp, 93)
  await f.turn('child', 8); assert.equal((await f.row('child')).content.stat_data.hp, 92)
  assert.equal((await f.service.history({ id: before.id, scope: { sessionId: s.id } })).length, 8)
  const ledger = JSON.parse(readFileSync(join(f.storageDir, 'mvu-instances.json')))
  assert.equal(ledger.resources[before.id].checkpoints.length, 7); assert.equal(ledger.resources[before.id].versions.length, 8)
  assert.deepEqual(await f.service.update(edit), ledger.resources[before.id].versions.at(-1).result)
  s.events.find(e => e.seq === replies[0]).data.message.content[0].text = 'changed at existing coordinates'
  await assert.rejects(f.service.read({ id: before.id, scope: { sessionId: s.id } }), { code: 'MVU_HISTORY_UNAVAILABLE' })
})

test('large legal state and duplicate receipt remain individually bounded; oversized edits cannot change persistence', async t => {
  const f = fixture(t, 700 * 1024), s = f.create('large'), before = await f.row(s.id)
  const input = { id: before.id, scope: { sessionId: s.id }, expectedRevision: before.revision, operationId: 'large-edit', content: { stat_data: { hp: 80, pad: before.content.stat_data.pad } } }
  const result = await f.service.update(input)
  assert.deepEqual(await f.service.update(input), result)
  const versions = await f.service.history({ id: before.id, scope: { sessionId: s.id } })
  assert.equal(versions.length, 1); assert(Buffer.byteLength(JSON.stringify(versions)) > 2 * 1024 * 1024)
  f.restart(); assert.equal((await f.row(s.id)).content.stat_data.hp, 80)
  const path = join(f.storageDir, 'mvu-instances.json'), bytes = readFileSync(path)
  await assert.rejects(f.service.update({ ...input, expectedRevision: result.revision, operationId: 'too-large', content: { stat_data: { hp: 0, pad: 'x'.repeat(1100 * 1024) } } }), { code: 'MVU_LIMIT' })
  assert.deepEqual(readFileSync(path), bytes); assert.equal((await f.row(s.id)).revision, result.revision)
})

test('envelope normalization and command outputs retain the original per-state budget after derived display data', () => {
  assert.throws(() => normalizeVariables({ stat_data: { pad: 'x'.repeat(1100 * 1024) } }), { code: 'MVU_LIMIT' })
  const base = normalizeVariables({ stat_data: { pad: '', hp: 1 } })
  assert.throws(() => applyMvuUpdate(base, [{ op: 'set', path: ['pad'], value: 'x'.repeat(1100 * 1024) }]), { code: 'MVU_LIMIT' })
})


test('aggregate ledger budget refuses a new version atomically and cold restore keeps all prior history', async t => {
  const f = fixture(t, 700 * 1024), s = f.create('bounded'), first = await f.row(s.id)
  const path = join(f.storageDir, 'mvu-instances.json')
  let committed = first, count = 0, refused = false
  for (let attempt = 1; attempt <= 20; attempt++) {
    const bytes = readFileSync(path)
    try {
      committed = await f.service.update({ id: first.id, scope: { sessionId: s.id }, operationId: `bounded-${attempt}`, expectedRevision: committed.revision,
        content: { stat_data: { hp: 100 - attempt, pad: first.content.stat_data.pad } } })
      count++
    } catch (error) {
      assert.equal(error.code, 'PLAY_STORAGE_LIMIT'); assert.deepEqual(readFileSync(path), bytes)
      assert.equal((await f.row(s.id)).revision, committed.revision)
      refused = true; break
    }
  }
  assert(refused); assert(count > 1)
  f.restart()
  assert.equal((await f.row(s.id)).content.stat_data.hp, committed.content.stat_data.hp)
  assert.equal((await f.service.history({ id: first.id, scope: { sessionId: s.id } })).length, count)
  assert(readFileSync(path).length <= 32 * 1024 * 1024)
})


test('schema-expanded management and card candidates respect the complete state budget before saving', async t => {
  const f = fixture(t, 0, [{ sharing: 'shared', id: 'mvu:expanded', managementMode: 'managed', characterId: 'c', sessionIds: ['s'], initial: { stat_data: { pad: '' } },
    schemaSource: 'const Schema=z.object({pad:z.string(),copy:z.string().prefault("")}).transform(v=>({...v,copy:v.pad}));' }])
  f.create('s'); const before = await f.row('s'), content = { stat_data: { pad: 'x'.repeat(600 * 1024) } }
  const path = join(f.storageDir, 'mvu-instances.json'), bytes = readFileSync(path)
  await assert.rejects(f.service.update({ id: before.id, scope: { sessionId: 's' }, content, expectedRevision: 0, operationId: 'schema-expanded' }), { code: 'MVU_LIMIT' })
  assert.deepEqual(readFileSync(path), bytes)
  const scope = { mode: 'initial', playthroughId: 'p', sessionId: 's', characterId: 'c' }
  const sourceIdentity = { version: 1, sha256: 'a'.repeat(64), scope }
  f.service.isActive = () => true
  f.service.resolveScope = async () => ({ mode: 'initial', writableHead: true, checkCurrent: () => true, initialSource: { sessionId: 's', playthroughId: 'p', characterId: 'c', sessionFormatVersion: 4 } })
  f.service.authorizeCardWrite = async () => ({ valid: true, write: true, scope, checkCurrent: () => true })
  const { capability } = await f.service.createCardBinding({ scope, sourceIdentity, grantId: 'synthetic-grant' })
  await assert.rejects(f.service.cardWrite({ capability, operation: 'replace', value: content, expectedRevision: 0, operationId: 'schema-expanded-card', cause: 'user-interaction' }), { code: 'MVU_LIMIT' })
  assert.deepEqual(readFileSync(path), bytes); assert.equal((await f.row('s')).revision, 0)
})

const runtimeRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT ?? process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('official AgentLoop eight-turn state history and large assembly bodies survive detached Session and source restore', { skip: !runtimeRoot, timeout: 20000 }, async t => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const llm = await load('@deepseek-ai/dsh-llm'), sessions = await load('@deepseek-ai/dsh-session')
  const tavern = await import('../packages/tavern-loader/src/index.js')
  const ctx = new Context(), storageDir = mkdtempSync(join(tmpdir(), 'mvu-history-official-')), errors = [], requests = []
  const resources = [{ id: 'mvu:official-template', sessionIds: ['*'], initial: { stat_data: { hp: 100, pad: 'x'.repeat(80 * 1024) } } }]
  t.after(async () => { await ctx.fiber.dispose(); rmSync(storageDir, { recursive: true, force: true }) })
  for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
  await ctx.plugin(SystemPrompt, { personaPrefix: 'SYNTHETIC\n' + 'n'.repeat(96 * 1024) })
  for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
  class Adapter extends llm.LlmAdapter {
    async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
    async *stream(request) {
      requests.push(request); const text = "_.add('hp', -1);"
      yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['history-fixture'], new Adapter()); ctx.on('agent/error', event => errors.push(event.error))
  let store
  await installIndependentAssembler(ctx, storageDir)
  const plugin = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { store = tavern.apply(context, { storageDir, mvu: { resources } }) } }); await plugin
  const service = ctx.get('tavernMvu'), handle = await ctx.agents.create({ sessionId: 'eight-turn-history', agentOptions: { provider: 'history-fixture', model: 'synthetic' } })
  const { agent } = handle
  const preset = store.assemblyPresets.save({ ...MODULE_ORDER, rules: [...MODULE_ORDER.rules, { id: 'mvu', kind: 'tavern.mvu/state', role: 'system', lifetime: 'request' }] })
  store.assemblyPresets.apply(agent.id, preset.id)
  for (let turn = 1; turn <= 8; turn++) {
    agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: `Synthetic turn ${turn}` }], source: { kind: 'user' } }))
    await agent.whenIdle(); await service.flush(); assert.deepEqual(errors, [])
    assert.equal(agent.session.snapshotEvents().findLast(event => event.type === 'turn/end').data.reason.kind, 'completed')
  }
  assert.equal(requests.length, 8)
  const row = (await service.list({ scope: { sessionId: agent.id } }))[0], history = await service.history({ id: row.id, scope: { sessionId: agent.id } })
  assert.equal(row.content.stat_data.hp, 92); assert.equal(history.length, 8)
  assert(Buffer.byteLength(JSON.stringify(history)) > 2 * 1024 * 1024)
  const events = structuredClone(agent.session.snapshotEvents())
  assert(Buffer.byteLength(JSON.stringify(events)) > 2 * 1024 * 1024)
  const restored = sessions.Session.fromRestore(agent.id, structuredClone(events), agent.session.header, sessions.SessionLogOffset(0), 'detached')
  assert.deepEqual(restored.deriveMessages(), agent.session.deriveMessages())
  const cold = new MvuService({ storageDir, resources, inspect: async () => ({ header: restored.header, events: restored.snapshotEvents() }) }); t.after(() => cold.dispose())
  await cold.ingest(restored)
  assert.equal((await cold.read({ id: row.id, scope: { sessionId: agent.id } })).content.stat_data.hp, 92)
  assert.deepEqual(await cold.history({ id: row.id, scope: { sessionId: agent.id } }), history)
  await plugin.dispose(); assert.deepEqual(agent.session.snapshotEvents(), events)
  await handle.dispose()
})
