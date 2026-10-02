import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MvuService, createCharacterDiscovery, characterMvuId } from '../packages/mvu-adapter/src/index.js'

test('character discovery exposes stable managed resources without enabling or cross-session grants', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-discovery-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const entries = new Map([['card', { data: { character_book: { entries: [{ comment: '[initvar]', content: 'hp: 100' }] } } }]])
  const characters = { list: () => [...entries.keys()].map(id => ({ id, name: id })), get: id => entries.get(id) }
  const selected = new Map(), selections = { get: id => ({ characterCardId: selected.get(id) ?? null }) }
  let service
  const refresh = createCharacterDiscovery({ characters, selections, service: () => service })
  service = new MvuService({ storageDir, refresh, isActive: (r, sid) => selected.get(sid) === r.characterId })
  const rows = await service.list({ scope: { authority: 'local' } }), id = characterMvuId('card')
  assert.equal(rows.length, 1); assert.equal(rows[0].id, id); assert.equal(rows[0].managementMode, 'managed')
  await assert.rejects(service.read({ id, scope: { sessionId: 'unselected' } }), { code: 'SCOPE_MISMATCH' })
  selected.set('A', 'card')
  assert.equal((await service.read({ id, scope: { sessionId: 'A' } })).content.stat_data.hp, 100)
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 0)
  const stop = service.registerUsage(() => ({ enabled: true }))
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 1)
  const current = await service.read({ id, scope: { authority: 'local' } })
  current.content.stat_data.hp = 70
  await service.update({ id, scope: { authority: 'local' }, content: current.content, operationId: 'edit', expectedRevision: 0 })
  selected.set('B', 'card')
  assert.equal((await service.read({ id, scope: { sessionId: 'B' } })).content.stat_data.hp, 70)
  entries.get('card').data.character_book.entries[0].content = 'hp: 999'
  await refresh('A')
  assert.equal((await service.read({ id, scope: { sessionId: 'A' } })).content.stat_data.hp, 70)
  selected.delete('A')
  assert.equal((await service.resolveRequest({ sessionId: 'A' })).blocks.length, 0)
  stop(); assert.equal((await service.resolveRequest({ sessionId: 'B' })).blocks.length, 0)
  service.dispose()
  const restored = new MvuService({ storageDir })
  const record = await restored.read({ id, scope: { authority: 'local' } })
  assert.equal(record.content.stat_data.hp, 70); assert.equal(record.managementMode, 'managed')
})

test('selection activation boundaries survive restart and never replay another character history', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-switch-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let selected = 'a', service
  const characters = { list: () => ['a', 'b'].map(id => ({ id, name: id })), get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content: 'hp: 100' }] } } }) }
  const selections = { get: () => ({ characterCardId: selected }) }, events = []
  const session = { id: 's', header: { id: 's', version: 4 }, inheritedEventCount: 0, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections, service: () => service })
  const options = { storageDir, refresh, isActive: r => r.characterId === selected, inspect: async () => ({ header: session.header, events }) }
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true }))
  const turn = async n => { const seq = events.length; events.push({ seq, type: 'turn/start', data: { turn: n } }, { seq: seq + 1, type: 'assistant/message', data: { turn: n, message: { id: `m${n}`, content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: seq + 2, type: 'turn/end', data: { turn: n, reason: { kind: 'completed' } } }); await service.ingest(session) }
  await refresh('s'); await turn(1)
  selected = 'b'; await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: characterMvuId('b'), scope: { sessionId: 's' } })).content.stat_data.hp, 100)
  await turn(2)
  assert.equal((await service.snapshot({ sessionId: 's', endEventId: 4 })).resourceId, characterMvuId('b'))
  assert.equal((await service.snapshot({ sessionId: 's', endEventId: 1 })).resourceId, characterMvuId('a'))
  selected = 'a'; await refresh('s'); service.dispose()
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true })); await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: characterMvuId('a'), scope: { sessionId: 's' } })).content.stat_data.hp, 80)
  await turn(3)
  assert.equal((await service.read({ id: characterMvuId('a'), scope: { sessionId: 's' } })).content.stat_data.hp, 60)
})

test('repairing invalid initialization starts after the failure interval instead of replaying it', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-repair-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let content = 'hp: [', service
  const characters = { list: () => [{ id: 'a', name: 'a' }], get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content }] } } }) }
  const events = [], session = { id: 's', header: { id: 's', version: 4 }, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections: { get: () => ({ characterCardId: 'a' }) }, service: () => service })
  service = new MvuService({ storageDir, refresh, inspect: async () => ({ header: session.header, events }) })
  service.registerUsage(() => ({ enabled: true })); await refresh('s')
  events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }, { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'old', content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  await service.ingest(session)
  content = 'hp: 100'; await refresh('s'); await service.ingest(session)
  const row = await service.read({ id: characterMvuId('a'), scope: { sessionId: 's' } })
  assert.equal(row.content.stat_data.hp, 100); assert.equal(row.sourceError, undefined)
})

test('missing history during initialization repair stays closed until a real boundary is available', async t => {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-repair-missing-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  let content = 'hp: [', available = true, service
  const characters = { list: () => [{ id: 'a', name: 'a' }], get: () => ({ data: { character_book: { entries: [{ comment: '[initvar]', content }] } } }) }
  const events = [], session = { id: 's', header: { id: 's', version: 4 }, snapshotEvents: () => events }
  const refresh = createCharacterDiscovery({ characters, selections: { get: () => ({ characterCardId: 'a' }) }, service: () => service })
  const options = { storageDir, refresh, inspect: async () => available ? { header: session.header, events } : null }
  service = new MvuService(options); await refresh('s')
  events.push({ seq: 0, type: 'turn/start', data: { turn: 1 } }, { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'old', content: [{ type: 'text', text: "_.add('hp',-20);" }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
  service.dispose(); available = false; content = 'hp: 100'
  service = new MvuService(options); service.registerUsage(() => ({ enabled: true })); await refresh('s')
  assert.equal(service.resources[0].activationSeqs.s, Number.MAX_SAFE_INTEGER)
  available = true; await refresh('s'); await service.ingest(session)
  assert.equal((await service.read({ id: characterMvuId('a'), scope: { sessionId: 's' } })).content.stat_data.hp, 100)
})
