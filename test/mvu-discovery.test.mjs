import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MvuService, createCharacterDiscovery, characterMvuId, stateInstanceId } from '../packages/mvu-adapter/src/index.js'

test('character discovery exposes native session instances; templates never alias current state', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-discovery-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const entries = new Map([['card', { data: { character_book: { entries: [{ comment: '[initvar]', content: 'hp: 100' }] } } }]])
  const characters = { list: () => [...entries.keys()].map(id => ({ id, name: id })), get: id => entries.get(id) }
  const selected = new Map(), selections = { get: id => ({ characterCardId: selected.get(id) ?? null }) }
  let service
  const refresh = createCharacterDiscovery({ characters, selections, service: () => service })
  const sessions = new Map()
  const inspect = async id => { if (!sessions.has(id)) sessions.set(id, { header: { id, version: 4, createdAt: id }, events: [] }); return sessions.get(id) }
  const captureSessionLease = async id => { const observed = await inspect(id), key = JSON.stringify(observed); return () => sessions.get(id) === observed && JSON.stringify(observed) === key }
  service = new MvuService({ storageDir, refresh, inspect, captureSessionLease, isActive: (r, sid) => selected.get(sid) === r.characterId })
  const rows = await service.list({ scope: { authority: 'local' } }), templateId = characterMvuId('card'), id = stateInstanceId(templateId, { sessionId: 'A', createdAt: 'A' })
  assert.equal(rows.length, 0); assert.equal(service.templates[0].id, templateId)
  assert.equal(await service.read({ id: templateId, scope: { sessionId: 'unselected' } }), null)
  selected.set('A', 'card')
  assert.equal((await service.read({ id, scope: { sessionId: 'A' } })).content.stat_data.hp, 100)
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 1)
  const stop = service.registerUsage(() => ({ enabled: true }))
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 1)
  const current = await service.read({ id, scope: { authority: 'local' } })
  current.content.stat_data.hp = 70
  await service.update({ id, scope: { sessionId: 'A' }, content: current.content, operationId: 'edit', expectedRevision: 0 })
  selected.set('B', 'card')
  const [b] = await service.list({ scope: { sessionId: 'B' } }); assert.notEqual(b.id, id); assert.equal(b.content.stat_data.hp, 100)
  entries.get('card').data.character_book.entries[0].content = 'hp: 999'
  await refresh('A')
  assert.equal((await service.read({ id, scope: { sessionId: 'A' } })).content.stat_data.hp, 70)
  selected.delete('A')
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 0)
  stop(); assert.equal((await service.resolveRequest({ sessionId: 'B' })).blocks.length, 1)
  service.dispose()
  const restored = new MvuService({ storageDir, inspect })
  const record = await restored.read({ id, scope: { authority: 'local' } })
  assert.equal(record.content.stat_data.hp, 70); assert.equal(record.managementMode, 'native')
  restored.dispose()
})

test('discovered cards apply committed JSONPatch without manager configuration and keep explicit policy decisions', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-native-discovery-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const events = [], session = { id: 's', header: { id: 's', version: 4, createdAt: 1 }, snapshotEvents: () => events }
  const card = { data: { character_book: { entries: [{ comment: '[initvar]', content: 'world:\n  time: before\ncharacter:\n  thought: before' }] } } }
  let service
  const refresh = createCharacterDiscovery({ characters: { list: () => [{ id: 'card', name: 'Synthetic card' }], get: () => card }, selections: { get: () => ({ characterCardId: 'card' }) }, service: () => service })
  service = new MvuService({ storageDir, refresh, inspect: async () => ({ header: session.header, events }), captureSessionLease: async () => () => true })
  t.after(() => service.dispose())
  await refresh('s')
  const facts = []; service.observe(fact => facts.push(fact))
  const row = async () => (await service.list({ scope: { sessionId: 's' } }))[0]
  const turn = async n => {
    const start = { seq: events.length, type: 'turn/start', data: { turn: n } }; events.push(start); await service.checkpoint(session, start)
    const text = `<UpdateVariable><JSONPatch>[{"op":"replace","path":"/world/time","value":"time-${n}"},{"op":"replace","path":"/character/thought","value":"thought-${n}"}]</JSONPatch></UpdateVariable>`
    events.push({ seq: events.length, type: 'assistant/message', data: { turn: n, message: { id: `reply-${n}`, content: [{ type: 'text', text }] } } })
    events.push({ seq: events.length, type: 'turn/end', data: { turn: n, reason: { kind: 'completed' } } })
    await service.ingest(session)
  }
  await turn(1)
  assert.deepEqual((await row()).content.stat_data, { world: { time: 'time-1' }, character: { thought: 'thought-1' } })
  // An installed optional manager can abstain for unconfigured native state.
  const stop = service.registerUsage(() => undefined)
  await turn(2)
  assert.equal((await row()).content.stat_data.world.time, 'time-2')
  stop()
  const deny = service.registerUsage(() => ({ enabled: false, reason: 'rule', checkCurrent: () => true }))
  await turn(3)
  assert.equal((await row()).content.stat_data.world.time, 'time-2')
  assert(facts.some(fact => fact.turn === 3 && fact.phase === 'skipped' && fact.reason === 'rule'))
  deny()
  const current = await row()
  await service.setManagementMode({ id: current.id, mode: 'managed', scope: { sessionId: 's' }, expectedRevision: current.revision, operationId: 'explicit-delegation' })
  await turn(4)
  assert.equal((await row()).managementMode, 'managed')
  assert.equal((await row()).content.stat_data.world.time, 'time-2')
  assert(facts.some(fact => fact.turn === 4 && fact.phase === 'skipped' && fact.reason === 'usage-policy'))
  const revision = (await row()).revision
  await service.ingest(session)
  assert.equal((await row()).revision, revision)
})

test('old automatic template defaults change only future instances, preserving every existing ownership record', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-default-migration-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const templateId = characterMvuId('card'), explicitId = 'mvu:explicit-template'
  const template = { id: templateId, characterId: 'card', discovered: true, managementMode: 'managed', sessionIds: ['old'], initial: { stat_data: { hp: 100 } } }
  const records = Object.fromEntries(['automatic', 'explicit', 'forked', 'copied'].map((kind, index) => {
    const sessionId = `old-${kind}`, instance = { sessionId, createdAt: sessionId }, id = stateInstanceId(templateId, instance)
    return [id, { revision: index, currentKey: null, versions: [], managementMode: 'managed', definition: { ...template, id, templateId, instance, sessionIds: [sessionId] },
      ...(kind === 'explicit' ? { managementOperations: [{ id: 'manage', fingerprint: 'synthetic', result: { id, revision: index, managementMode: 'managed' } }] } : {}),
      ...(kind === 'forked' ? { seed: { kind: 'fork', source: { id: 'mvu:parent' } } } : {}),
      ...(kind === 'copied' ? { copiedFrom: { id: 'mvu:parent', revision: 1 } } : {}) }]
  }))
  const explicit = { ...template, id: explicitId }
  const path = join(storageDir, 'mvu-instances.json'), original = { version: 1, resources: records, templates: { [templateId]: template, [explicitId]: explicit } }
  writeFileSync(path, JSON.stringify(original))
  const options = { storageDir, resources: [explicit], inspect: async id => ({ header: { id, version: 4, createdAt: id }, events: [] }), isActive: () => true }
  let service = new MvuService(options)
  assert.equal(service.templates.find(item => item.id === templateId).managementMode, 'native')
  assert.equal(service.templates.find(item => item.id === explicitId).managementMode, 'managed')
  const migrated = JSON.parse(readFileSync(path, 'utf8'))
  assert.deepEqual(migrated.resources, original.resources)
  assert.deepEqual(migrated.templates[explicitId], original.templates[explicitId])
  assert.deepEqual(migrated.templates[templateId], { ...template, managementMode: 'native' })
  const fresh = (await service.list({ scope: { sessionId: 'fresh' } })).find(item => item.templateId === templateId)
  assert.equal(fresh.managementMode, 'native'); assert.equal(fresh.content.stat_data.hp, 100)
  const after = readFileSync(path, 'utf8')
  service.dispose(); service = new MvuService(options)
  assert.equal(readFileSync(path, 'utf8'), after)
  assert.deepEqual(JSON.parse(after).resources[Object.keys(records)[0]], records[Object.keys(records)[0]])
  service.dispose()
})

test('selection activation boundaries survive restart and never replay another character history', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-switch-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let selected = 'a', service
  const characters = { list: () => ['a', 'b'].map(id => ({ id, name: id })), get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content: 'hp: 100' }] } } }) }
  const selections = { get: () => ({ characterCardId: selected }) }, events = []
  const session = { id: 's', header: { id: 's', version: 4, createdAt: 1 }, inheritedEventCount: 0, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections, service: () => service })
  const options = { storageDir, refresh, isActive: r => r.characterId === selected, inspect: async () => ({ header: session.header, events }) }
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true }))
  const turn = async n => { const seq = events.length; const start = { seq, type: 'turn/start', data: { turn: n } }; events.push(start); await service.checkpoint(session, start); events.push({ seq: seq + 1, type: 'assistant/message', data: { turn: n, message: { id: `m${n}`, content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: seq + 2, type: 'turn/end', data: { turn: n, reason: { kind: 'completed' } } }); await service.ingest(session) }
  await refresh('s'); await turn(1)
  selected = 'b'; await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: stateInstanceId(characterMvuId('b'), { sessionId: 's', createdAt: 1 }), scope: { sessionId: 's' } })).content.stat_data.hp, 100)
  await turn(2)
  assert.equal((await service.snapshot({ sessionId: 's', endEventId: 4 })).resourceId, stateInstanceId(characterMvuId('b'), { sessionId: 's', createdAt: 1 }))
  assert.equal((await service.snapshot({ sessionId: 's', endEventId: 1 })).resourceId, stateInstanceId(characterMvuId('a'), { sessionId: 's', createdAt: 1 }))
  selected = 'a'; await refresh('s'); service.dispose()
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true })); await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: stateInstanceId(characterMvuId('a'), { sessionId: 's', createdAt: 1 }), scope: { sessionId: 's' } })).content.stat_data.hp, 80)
  await turn(3)
  assert.equal((await service.read({ id: stateInstanceId(characterMvuId('a'), { sessionId: 's', createdAt: 1 }), scope: { sessionId: 's' } })).content.stat_data.hp, 60)
})

test('repairing invalid initialization starts after the failure interval instead of replaying it', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-repair-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let content = 'hp: [', service
  const characters = { list: () => [{ id: 'a', name: 'a' }], get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content }] } } }) }
  const events = [], session = { id: 's', header: { id: 's', version: 4, createdAt: 1 }, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections: { get: () => ({ characterCardId: 'a' }) }, service: () => service })
  service = new MvuService({ storageDir, refresh, inspect: async () => ({ header: session.header, events }) })
  service.registerUsage(() => ({ enabled: true })); await refresh('s')
  events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }, { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'old', content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  await service.ingest(session)
  content = 'hp: 100'; await refresh('s'); await service.ingest(session)
  const row = await service.read({ id: stateInstanceId(characterMvuId('a'), { sessionId: 's', createdAt: 1 }), scope: { sessionId: 's' } })
  assert.equal(row.content.stat_data.hp, 100); assert.equal(row.sourceError, undefined)
})

test('missing history during initialization repair stays closed until a real boundary is available', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-repair-missing-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let content = 'hp: [', available = true, service
  const characters = { list: () => [{ id: 'a', name: 'a' }], get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content }] } } }) }
  const events = [], session = { id: 's', header: { id: 's', version: 4, createdAt: 1 }, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections: { get: () => ({ characterCardId: 'a' }) }, service: () => service })
  const options = { storageDir, refresh, inspect: async () => available ? { header: session.header, events } : null }
  service = new MvuService(options); await refresh('s')
  events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }, { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'old', content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  service.dispose(); available = false; content = 'hp: 100'
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true })); await assert.rejects(refresh('s'), { code: 'MVU_SESSION_IDENTITY' })
  available = true; await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: stateInstanceId(characterMvuId('a'), { sessionId: 's', createdAt: 1 }), scope: { sessionId: 's' } })).content.stat_data.hp, 100)
})
