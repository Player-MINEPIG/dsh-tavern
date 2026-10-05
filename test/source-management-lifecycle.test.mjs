import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MvuService } from '../packages/mvu-adapter/src/service.js'
import { SourcePolicy } from '../packages/memory-sources/policy.js'
import { WorldBookStore } from '../packages/world-book-library/src/store.js'
import { WorldBookMemorySource } from '../packages/memory-sources/world-books.js'
import { PromptTemplateService } from '../packages/prompt-template/service.js'
const temp = t => { const p = mkdtempSync(join(tmpdir(), 'source-management-')); t.after(() => rmSync(p, { recursive: true, force: true })); return p }
const scope = { authority: 'local', sessionId: 's' }
const retrieval = ['read_content', 'render_state_and_update_instructions', 'provide_to_model'].map(operation => ({ operation }))
const dependency = { id: 'mvu:state', scope, event: { preview: true, usage: 'prompt-template-dependency', consumer: { adapterId: 'tavern.prompt-templates', id: 'prompt-template:fixture' } } }
function mvu(t) { let epoch = 0; const storageDir = temp(t), service = new MvuService({ storageDir, resources: [{ id: 'mvu:state', sharing: 'shared', sessionIds: ['s'], managementMode: 'managed', initial: { stat_data: { hp: 7 } } }], capturePromptScope: () => { const token = epoch; return () => token === epoch } }); t.after(() => service.dispose()); return { service, storageDir, change: () => epoch++ } }

test('MVU actual owner and execution share register/unload lifecycle; old stored modes and data remain untouched', async t => {
  const f = mvu(t), row = await f.service.read({ id: 'mvu:state', scope }), path = join(f.storageDir, 'mvu-instances.json')
  assert.equal(row.managementMode, 'native'); assert.equal(row.storedManagementMode, 'managed')
  const bytes = readFileSync(path), native = await f.service.resolvePromptDependency(dependency)
  assert.equal(native.checkCurrent(), true)
  let current = true
  const stop = f.service.registerUsage(() => ({ enabled: true, strategy: retrieval, configRevision: 4, checkCurrent: () => current }), { providerId: 'dsh-memory-manager' })
  assert.equal(native.checkCurrent(), false); assert.equal((await f.service.read({ id: row.id, scope })).managementMode, 'managed')
  const managed = await f.service.resolvePromptDependency(dependency); assert.equal(managed.configRevision, 4)
  current = false; assert.equal(managed.checkCurrent(), false); assert.equal(await f.service.resolvePromptDependency(dependency), null, 'invalid installed manager does not look unloaded')
  stop(); assert.equal((await f.service.read({ id: row.id, scope })).managementMode, 'native'); assert.equal((await f.service.resolvePromptDependency(dependency)).checkCurrent(), true)
  assert.deepEqual(readFileSync(path), bytes, 'registration/removal never migrates stored preferences or state')
  const stopAgain = f.service.registerUsage(() => ({ enabled: true, strategy: retrieval, checkCurrent: () => true }), { providerId: 'dsh-memory-manager' })
  assert.equal(managed.checkCurrent(), false, 'same handler registration cannot revive an old lease'); stopAgain()
})

test('manager abstention denies while delegated; generic source deny stays authoritative after manager removal', async t => {
  const f = mvu(t), stop = f.service.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  assert.equal(await f.service.resolvePromptDependency(dependency), null)
  const deny = f.service.registerUsage(() => ({ enabled: false, reason: 'source-rule' }))
  stop(); assert.equal((await f.service.read({ id: 'mvu:state', scope })).managementMode, 'native'); assert.equal(await f.service.resolvePromptDependency(dependency), null)
  deny(); assert.equal((await f.service.resolvePromptDependency(dependency)).content.stat_data.hp, 7)
  assert.throws(() => f.service.registerUsage(() => undefined, { providerId: 'guest' }))
})

test('defaults are source-bound fixed native policies, with detached scope and sync definition/lifecycle leases', async t => {
  const f = mvu(t), callerScope = { ...scope }, before = f.service.getManagementDefaults({ id: 'mvu:state', scope: callerScope })
  callerScope.sessionId = 'foreign'; assert.equal(before.checkCurrent(), true)
  assert.equal(before.protocolVersion, 1); assert.equal(before.scopePolicy, 'source-bound')
  assert.deepEqual(Object.keys(before.configuration).sort(), ['retrieve', 'store', 'type']); f.service.validateConfig(before.configuration)
  assert.equal(before.configuration.store.on, 'assistant_message_committed'); assert.equal(before.configuration.retrieve.on, 'before_model_request')
  assert.equal(JSON.stringify(before.configuration).includes('card_variable_update'), false, 'defaults grant no card writes')
  assert.throws(() => f.service.getManagementDefaults({ id: 'mvu:state', scope: { authority: 'local', sessionId: 'foreign' } }), { code: 'SCOPE_MISMATCH' })
  f.change(); assert.equal(before.checkCurrent(), false)
  const defaults = f.service.getManagementDefaults({ id: 'mvu:state', scope }); defaults.configuration.retrieve.rule = false
  assert.equal(defaults.checkCurrent(), false, 'caller mutation cannot retain a proof for the published base')
  const fresh = f.service.getManagementDefaults({ id: 'mvu:state', scope }), stop = f.service.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' })
  assert.equal(fresh.checkCurrent(), false); stop()
})

test('world-book and template ownership use the same lifecycle, preserving durable preferences and explicit denies', async t => {
  for (const type of ['world-book', 'prompt-template']) {
    const policy = new SourcePolicy(join(temp(t), 'ownership.json'), type), id = type + ':one', content = { own: true }
    policy.setMode({ id, mode: 'managed', expectedRevision: policy.revision(id, content), operationId: 'explicit' }, content)
    const get = () => ({ id, revision: policy.revision(id, content), managementMode: policy.mode(id) })
    assert.equal(policy.mode(id), 'native'); assert.equal(policy.storedMode(id), 'managed')
    const base = policy.defaults(id); policy.type === type && assert.equal(base.configuration.type, type)
    const native = await policy.decision(get(), { sessionId: 's' }, () => get().revision)
    let enabled = true
    const stop = policy.registerUsage(() => ({ enabled, strategy: base.configuration.retrieve.strategy, checkCurrent: () => enabled }), { providerId: 'dsh-memory-manager' })
    assert.equal(policy.mode(id), 'managed'); assert.equal(native.checkCurrent(), false); assert.equal(base.checkCurrent(), false)
    assert.equal((await policy.decision(get(), { sessionId: 's' }, () => get().revision)).enabled, true)
    enabled = false; assert.equal((await policy.decision(get(), { sessionId: 's' }, () => get().revision)).enabled, false)
    stop(); assert.equal(policy.mode(id), 'native'); assert.equal((await policy.decision(get(), { sessionId: 's' }, () => get().revision)).enabled, true)
    const deny = policy.registerUsage(() => ({ enabled: false, reason: 'explicit' })); assert.equal((await policy.decision(get(), { sessionId: 's' }, () => get().revision)).enabled, false)
    deny(); policy.dispose(); assert.equal(native.checkCurrent(), false)
  }
})

test('public world-book/template defaults reject foreign source scopes and expire on selection/content edits', t => {
  const storageDir = temp(t), store = new WorldBookStore(storageDir), book = store.import({ entries: { 0: { uid: 0, content: 'own', constant: true } } })
  let selection = { characterId: null, worldBookIds: [book.id] }
  const books = new WorldBookMemorySource({ storageDir, store, getSelection: () => selection }); t.after(() => books.dispose())
  const base = books.getManagementDefaults({ id: `world-book:${book.id}`, scope }); books.validateConfig(base.configuration)
  selection = { characterId: null, worldBookIds: [] }; assert.equal(base.checkCurrent(), false); assert.equal(books.getManagementDefaults({ id: `world-book:${book.id}`, scope }), null)
  const templates = new PromptTemplateService({ storageDir, resources: [{ id: 'prompt-template:own', name: 'Own', sessionIds: ['s'], content: 'own', enabled: true }] }); t.after(() => templates.dispose())
  const proof = templates.getManagementDefaults({ id: 'prompt-template:own', scope }); templates.validateConfig(proof.configuration)
  assert.throws(() => templates.getManagementDefaults({ id: 'prompt-template:own', scope: { sessionId: 'foreign' } }), { code: 'FORBIDDEN' })
  const row = templates.read({ id: 'prompt-template:own', scope }); templates.update({ id: row.id, scope, expectedRevision: row.revision, operationId: 'edit', content: 'changed' })
  assert.equal(proof.checkCurrent(), false)
})

test('an installed manager must decide independently of generic allows, and stale manager leases never commit or provide', async t => {
  for (const scenario of ['abstain', 'stale', 'stale-parse-error']) {
    const storageDir = temp(t), session = { id: 's', header: { id: 's', version: 4 }, events: [
      { seq: 0, type: 'turn/start', data: { turn: 1 } },
      { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'reply', content: [{ type: 'text', text: scenario === 'stale-parse-error' ? '<JSONPatch>[{"op":"invalid","path":"/hp"}]</JSONPatch>' : "_.add('hp', -1);" }] } } },
      { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ] }
    session.snapshotEvents = () => session.events
    const service = new MvuService({ storageDir, resources: [{ id: 'mvu:shared', sharing: 'shared', sessionIds: ['s'], initial: { stat_data: { hp: 10 } } }], inspect: async () => session })
    t.after(() => service.dispose())
    service.registerUsage(() => scenario === 'abstain' ? undefined : { enabled: true, checkCurrent: () => false }, { providerId: 'dsh-memory-manager' })
    service.registerUsage(() => ({ enabled: true, checkCurrent: () => true }))
    if (scenario !== 'abstain') {
      await assert.rejects(service.ingest(session), { code: 'MVU_USAGE_CANCELLED' })
      await assert.rejects(service.resolveRequest({ sessionId: 's' }), { code: 'MVU_USAGE_CANCELLED' })
      assert.equal((await service.read({ id: 'mvu:shared', scope })).revision, 0)
      assert.equal((await service.history({ id: 'mvu:shared', scope })).length, 0)
    } else {
      await service.ingest(session); assert.equal((await service.resolveRequest({ sessionId: 's' })).blocks.length, 0)
    }
    assert.equal((await service.read({ id: 'mvu:shared', scope })).content.stat_data.hp, 10)
    const policy = new SourcePolicy(join(storageDir, 'worldbook-policy.json'), 'world-book')
    policy.registerUsage(() => undefined, { providerId: 'dsh-memory-manager' }); policy.registerUsage(() => ({ enabled: true, strategy: policy.defaults('world-book:x').configuration.retrieve.strategy, checkCurrent: () => true }))
    assert.equal((await policy.decision({ id: 'world-book:x', revision: 'r' }, { sessionId: 's' }, () => 'r')).enabled, false)
    policy.dispose()
  }
})

test('explicit shared resources have per-session pre-send checkpoints instead of preview-only macro support', async t => {
  const storageDir = temp(t), session = { id: 's', header: { id: 's', version: 4 }, events: [{ seq: 0, type: 'turn/start', data: { turn: 1 } }] }
  session.snapshotEvents = () => session.events
  const service = new MvuService({ storageDir, resources: [{ id: 'mvu:shared', sharing: 'shared', sessionIds: ['s'], initial: { stat_data: { hp: 10 } } }], inspect: async () => session, captureSessionLease: async () => { const prefix = JSON.stringify(session.events); return () => JSON.stringify(session.events) === prefix }, capturePromptScope: () => { const identity = session.header; return () => session.header === identity } })
  t.after(() => service.dispose())
  await service.checkpoint(session, session.events[0])
  const request = { scope, event: { usage: 'world-book-variable', preview: false, turn: 1, consumer: { adapterId: 'tavern.world-books', id: 'world-book:own' } } }
  const result = await service.resolvePromptDependency(request)
  assert.equal(result.content.stat_data.hp, 10); assert.equal(result.checkCurrent(), true)
  assert.equal(await service.resolvePromptDependency({ ...request, event: { ...request.event, turn: 2 } }), null)
})

test('shared history compares against its own session checkpoint when turn numbers overlap', async t => {
  const sessions = new Map(['s', 'other'].map(id => [id, { id, header: { id, version: 4 }, events: [{ seq: 0, type: 'turn/start', data: { turn: 1 } }] }]))
  for (const session of sessions.values()) session.snapshotEvents = () => session.events
  const service = new MvuService({ storageDir: temp(t), resources: [{ id: 'mvu:shared', sharing: 'shared', sessionIds: ['s', 'other'], initial: { stat_data: { hp: 10 } } }], inspect: async id => sessions.get(id) })
  t.after(() => service.dispose())
  await service.checkpoint(sessions.get('s'), sessions.get('s').events[0])
  await service.update({ id: 'mvu:shared', scope, expectedRevision: 0, operationId: 'authored-edit', content: { stat_data: { hp: 20 } } })
  const session = sessions.get('other')
  await service.checkpoint(session, session.events[0])
  session.events.push({ seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'reply', content: [{ type: 'text', text: "_.add('hp', -3);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  await service.ingest(session)
  const [version] = await service.history({ id: 'mvu:shared', scope: { authority: 'local', sessionId: 'other' }, includeBefore: true })
  assert.equal(version.before.hp, 20); assert.equal(version.variables.stat_data.hp, 17)
})
