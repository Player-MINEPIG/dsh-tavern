import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { MvuService } from '../packages/mvu-adapter/src/service.js'
import { WorldBookStore } from '../packages/world-book-library/src/store.js'
import { WorldBookMemorySource } from '../packages/memory-sources/world-books.js'
import { createWorldBookAdapter } from '../packages/tavern-loader/src/world-book-adapter.js'
import { compileTavernProfile } from '../packages/tavern-loader/src/profile-loader.js'
import { assembleRequestAsync, createDefaultRegistry, BUILTINS } from '../packages/request-assembler/index.js'
import { hash } from '../packages/memory-sources/policy.js'

const macro = '{{format_message_variable::stat_data}}'
const retrieval = ['read_content', 'render_state_and_update_instructions', 'provide_to_model'].map(operation => ({ operation }))
function fixture(t, content = macro) {
  const storageDir = mkdtempSync(join(tmpdir(), 'worldbook-mvu-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const sessions = new Map()
  const create = (id, parent, prefix = []) => { const s = { id, header: { id, version: 4, createdAt: sessions.size + 1, ...(parent ? { parentSession: parent } : {}) }, events: structuredClone(prefix), snapshotEvents() { return this.events } }; sessions.set(id, s); return s }
  create('A')
  const service = new MvuService({ storageDir, resources: [{ id: 'mvu:template', sessionIds: ['*'], initial: { stat_data: { hp: 100, text: '{{user}}\n{{secret}}', $internal: 'hidden', nested: { $private: 1, public: 'shown' } } } }],
    inspect: async id => sessions.get(id), captureSessionLease: async id => { const s = sessions.get(id), token = hash(s); return () => sessions.get(id) === s && hash(s) === token },
    capturePromptScope: (scope, resource) => { const s = sessions.get(scope.sessionId); return () => sessions.get(scope.sessionId) === s && !!s && resource.instance.sessionId === scope.sessionId } })
  t.after(() => service.dispose())
  let currentService = service
  const store = new WorldBookStore(storageDir), book = store.import({ entries: { 0: { uid: 0, content, constant: true }, 1: { uid: 1, content: 'UPDATE_GUIDANCE', constant: true } } })
  const source = new WorldBookMemorySource({ storageDir, store, getMvu: () => currentService, getSelection: () => ({ characterId: null, worldBookIds: [book.id] }) }); t.after(() => source.dispose())
  const lore = createWorldBookAdapter(store).resolve({ selection: { worldBookIds: [book.id] } }).loreEntries
  const input = (sessionId = 'A', event = {}) => ({ sessionId, preview: true, ...event, preset: structuredClone(BUILTINS[0]), assets: { loreEntries: lore, worldBookIds: [book.id], worldBookRevisions: { [book.id]: hash(book) }, context: { user: 'SHOULD_NOT_REPLACE_LITERAL' } }, nativeMessages: [] })
  const registry = createDefaultRegistry({ worldbookPolicy: (c, o) => source.filter(c, o), worldbookValidateResolved: source.validateResolved })
  const assemble = (id, event) => assembleRequestAsync({ ...input(id, event), registry })
  const read = async id => (await service.list({ scope: { sessionId: id } }))[0]
  const edit = async (id, hp) => { const row = await read(id); return service.update({ id: row.id, scope: { sessionId: id }, expectedRevision: row.revision, operationId: `${id}-${row.revision}`, content: { ...row.content, stat_data: { ...row.content.stat_data, hp } } }) }
  const start = async id => { const s = sessions.get(id), turn = Math.max(0, ...s.events.map(e => e.data?.turn ?? 0)) + 1, e = { seq: s.events.length, type: 'turn/start', data: { turn } }; s.events.push(e); await service.checkpoint(s, e); return turn }
  const finish = async (id, turn, hp) => { const s = sessions.get(id); s.events.push({ seq: s.events.length, type: 'assistant/message', data: { turn, message: { id: `${id}-${turn}`, content: [{ type: 'text', text: `<JSONPatch>[{"op":"replace","path":"/hp","value":${hp}}]</JSONPatch>` }] } } }); const seq = s.events.at(-1).seq; s.events.push({ seq: s.events.length, type: 'turn/end', data: { turn, reason: { kind: 'completed' } } }); await service.ingest(s); return seq }
  const child = async (id, atEventId, kind) => {
    const ticket = await service.captureSessionSeed({ sessionId: 'A', atEventId, kind, ...(kind === 'reply-swipe' ? { targetSessionId: id } : {}) })
    const prefix = kind === 'reply-swipe' ? [] : sessions.get('A').events.filter(e => e.seq <= atEventId)
    create(id, kind === 'reply-swipe' ? undefined : 'A', prefix)
    if (prefix.length) sessions.get(id).events.push({ seq: prefix.length, type: 'session/end-seed', data: {} }, { seq: prefix.length + 1, type: 'turn/end', data: { turn: prefix.at(-1).data.turn, reason: { kind: 'forked' } } })
    await service.installSessionSeed({ sessionId: id, ticket })
  }
  return { source, service, book, input, registry, assemble, read, edit, start, finish, child, sessions, replaceService: () => { currentService = {} } }
}
const stateNode = output => output.nodes.find(n => n.source?.field === '0')

test('activated world-book macro emits visible stat_data YAML at its own position, with literal braces and guidance once', async t => {
  const f = fixture(t), result = await f.assemble('A'), node = stateNode(result)
  assert.deepEqual(parse(node.text), { hp: 100, text: '{{user}}\n{{secret}}', nested: { public: 'shown' } })
  assert.equal(result.nodes.filter(n => n.text === 'UPDATE_GUIDANCE').length, 1)
  assert.equal(result.nodes.filter(n => n.module === 'tavern.mvu/state').length, 0)
  assert.equal(result.diagnostics.some(d => d.code === 'UNSUPPORTED_MACRO'), false)
  assert.equal(result.diagnostics.find(d => d.code === 'WORLD_BOOK_MVU_VARIABLE_VERSION').resourceId, (await f.read('A')).id)
  const context = f.input(), entries = await f.source.prepareNative(context)
  const native = compileTavernProfile({ ...context.assets, loreEntries: entries })
  assert.equal(native.sections[0].text, node.text)
  assert.equal(native.sections[1].text, 'UPDATE_GUIDANCE')
  f.source.validateResolved(context)
  const facts = []; f.service.observe(fact => facts.push(fact))
  const event = { seq: 50, type: 'request/assembly', data: { turn: 1, messages: result.messages, metadata: { owner: 'pmp-dsh-tavern', assembly: result } } }
  const session = { id: 'A', snapshotEvents: () => [event] }
  f.service.observeRequest({ messages: [] }, session); assert.equal(facts.length, 0)
  f.service.observeRequest({ messages: result.messages }, session)
  assert.equal(facts.filter(fact => fact.phase === 'applied').length, 1)
  assert.equal(facts[0].id, (await f.read('A')).id); assert.equal(facts[0].detail, 'dsh-request-observed')
})

test('only actual active variable references request MVU; source deny never leaks a fallback', async t => {
  const plain = fixture(t, 'plain'); let calls = 0; plain.source.getMvu = () => { calls++; throw Error('unexpected variable read') }
  assert.equal((await plain.assemble('A')).nodes[0].text, 'plain'); assert.equal(calls, 0)
  const f = fixture(t)
  let reads = 0; const get = f.source.getMvu; f.source.getMvu = () => { reads++; return get() }
  const stop = f.source.registerUsage(() => ({ enabled: false, reason: 'explicit-user-deny' }), { providerId: 'dsh-memory-manager' })
  assert.equal((await f.assemble('A')).nodes.length, 0); assert.equal(reads, 0)
  stop()
  const deny = f.service.registerUsage(() => ({ enabled: false, reason: 'source-deny' }))
  await assert.rejects(f.assemble('A'), { code: 'WORLD_BOOK_VARIABLE_DENIED' }); deny()
  const inactive = f.input(); inactive.assets.loreEntries = []; assert.equal((await assembleRequestAsync({ ...inactive, registry: f.registry })).nodes.length, 0)
})

test('pre-send checkpoint and current selected branch/swipe never borrow future or another session state', async t => {
  const f = fixture(t), first = await f.start('A'), reply = await f.finish('A', first, 90)
  const before = await f.service.captureSessionSeed({ sessionId: 'A', atEventId: reply, kind: 'fork' })
  await f.child('branch', reply, 'fork'); await f.child('swipe', reply, 'reply-swipe')
  await f.edit('A', 12); await f.edit('branch', 55)
  assert.equal(parse(stateNode(await f.assemble('A')).text).hp, 12)
  assert.equal(parse(stateNode(await f.assemble('branch')).text).hp, 55)
  assert.equal(parse(stateNode(await f.assemble('swipe')).text).hp, 100, 'swipe inherits immutable pre-turn baseline')
  const turn = await f.start('branch'); await f.finish('branch', turn, 7)
  assert.equal(parse(stateNode(await f.assemble('branch', { preview: false, turn })).text).hp, 55, 'send uses persisted pre-turn snapshot')
  await assert.rejects(f.assemble('branch', { preview: false, turn: 99 }), { code: 'WORLD_BOOK_VARIABLE_DENIED' })
  assert.equal(typeof before, 'string')
})

test('final async sources and native transforms cannot reuse state/policy/unload leases', async t => {
  for (const change of ['state', 'policy', 'unload']) {
    const f = fixture(t); let current = true
    f.service.registerUsage(() => ({ enabled: true, strategy: retrieval, checkCurrent: () => current }), { providerId: 'dsh-memory-manager' })
    f.registry.register({ id: 'late-change', pluginId: 'fixture', name: 'Late change', resolve: async () => { if (change === 'state') await f.edit('A', 1); if (change === 'policy') current = false; if (change === 'unload') f.replaceService(); return { blocks: [] } } })
    const input = f.input(); input.preset.rules.push({ id: 'late', kind: 'late-change', enabled: true, role: 'system', lifetime: 'request' })
    await assert.rejects(assembleRequestAsync({ ...input, registry: f.registry }), { code: 'SOURCE_POLICY_CHANGED' }, change)
    const native = fixture(t), context = native.input(); await native.source.prepareNative(context); await native.edit('A', 1)
    assert.throws(() => native.source.validateResolved(context), { code: 'SOURCE_POLICY_CHANGED' })
  }
})
