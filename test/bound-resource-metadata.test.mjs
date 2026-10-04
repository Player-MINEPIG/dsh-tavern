import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemorySources } from '../packages/memory-sources/index.js'
import { CharacterStore } from '../packages/character/src/index.js'
import { WorldBookStore } from '../packages/world-book-library/src/index.js'
import { MvuService } from '../packages/mvu-adapter/src/index.js'
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'bound-resources-')); t.after(() => rmSync(dir, { recursive: true, force: true }))
  const characters = new CharacterStore(dir), books = new WorldBookStore(dir)
  for (const id of ['A', 'B']) characters.import({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: id, first_mes: 'HELLO', character_book: { entries: [{ id: 0, keys: [], content: `PRIVATE_${id}`, enabled: true, constant: true }] } } }, { id })
  const current = books.import({ entries: { 0: { uid: 0, content: 'PRIVATE_SELECTED', constant: true } } }, { id: 'selected', name: 'Selected book' })
  books.import({ entries: { 0: { uid: 0, content: 'PRIVATE_UNBOUND', constant: true } } }, { id: 'unbound', name: 'Other card book' })
  let selected = { characterId: 'A', worldBookIds: [current.id], selectionRevision: 1 }, mvu
  const sessions = new Map([['s', { header: { id: 's', version: 4, createdAt: 1 }, events: [] }], ['other', { header: { id: 'other', version: 4, createdAt: 2 }, events: [] }]])
  const sources = createMemorySources({ storageDir: dir, characters, store: books, getSession: id => sessions.get(id), getSelection: () => structuredClone(selected), getMvu: () => mvu,
    resources: [{ id: 'prompt-template:bound', name: 'Bound', content: 'PRIVATE_TEMPLATE', enabled: false, sessionIds: ['s'] }, { id: 'prompt-template:other', name: 'Other', content: 'PRIVATE_OTHER_TEMPLATE', enabled: true, sessionIds: ['other'] }] })
  t.after(() => sources.dispose())
  const scope = { authority: 'local', sessionId: 's' }
  return { dir, characters, books, sources, sessions, scope, select: patch => selected = { ...selected, ...patch, selectionRevision: selected.selectionRevision + 1 }, getSelected: () => selected, setMvu: value => mvu = value }
}
test('bound directory contains current embedded/selected/session template only; no global scan or source read', async t => {
  const f = fixture(t)
  for (const source of [f.characters, f.books, f.sources.worldBooks, f.sources.templates]) t.mock.method(source, 'list', () => { throw Error('Global scan forbidden') })
  for (const source of [f.sources.worldBooks, f.sources.templates]) t.mock.method(source, 'read', () => { throw Error('Source body API forbidden') })
  const get = f.characters.get.bind(f.characters); t.mock.method(f.characters, 'get', id => { assert.equal(id, 'A'); return get(id) })
  const result = await f.sources.listBound({ scope: f.scope })
  assert.deepEqual(result.items.map(r => r.id), ['world-book:character:A:embedded-world-book', 'world-book:selected', 'prompt-template:bound'])
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false); assert.equal(result.checkCurrent(), true)
  assert(Object.isFrozen(result)); assert(Object.isFrozen(result.items)); assert(Object.isFrozen(result.items[0].binding))
  assert.throws(() => { result.items[0].id = 'forged' }, TypeError)
})
test('binding changes, ABA, added/removed source, source mode, session replacement and unload revoke metadata', async t => {
  const f = fixture(t); let lease = await f.sources.listBound({ scope: f.scope })
  f.select({ characterId: 'B' }); f.select({ characterId: 'A' }); assert.equal(lease.checkCurrent(), false)
  lease = await f.sources.listBound({ scope: f.scope }); f.books.update('selected', { name: 'Changed' }); assert.equal(lease.checkCurrent(), false)
  lease = await f.sources.listBound({ scope: f.scope }); f.characters.delete('A'); assert.equal(lease.checkCurrent(), false)
  lease = await f.sources.listBound({ scope: f.scope }); f.sessions.set('s', {}); assert.equal(lease.checkCurrent(), false)
  lease = await f.sources.listBound({ scope: f.scope }); f.sources.dispose(); assert.equal(lease.checkCurrent(), false)
  await assert.rejects(f.sources.listBound({ scope: f.scope }), { code: 'SOURCE_BOUND_UNAVAILABLE' })
})
test('new selected card excludes previous card resources and observes preset-bound book origins', async t => {
  const f = fixture(t)
  f.select({ characterId: 'B', worldBookIds: ['unbound'], presetId: 'preset-B', worldBookBindings: { unbound: ['preset'] } })
  const result = await f.sources.listBound({ scope: f.scope })
  assert.equal(result.items.some(r => r.id.includes('character:A') || r.id === 'world-book:selected'), false)
  assert.equal(result.items.find(r => r.id === 'world-book:unbound').binding.presetId, 'preset-B')
  assert.deepEqual(result.items.find(r => r.id === 'world-book:unbound').binding.origins, ['preset'])
  // Global reads keep the existing public contract.
  assert(f.sources.worldBooks.read({ id: 'world-book:unbound' }).content)
})
test('MVU directory returns existing scoped state IDs/revision and never allocates or reads variable snapshots', async t => {
  const f = fixture(t), resources = ['A', 'B'].map(id => ({ id: `mvu:template-${id}`, characterId: id, sessionIds: ['s'], initial: { stat_data: { secret: 'PRIVATE_MVU' } } }))
  const mvu = new MvuService({ storageDir: f.dir, resources, inspect: async id => f.sessions.get(id), isActive: resource => resource.characterId === f.getSelected().characterId }); t.after(() => mvu.dispose()); f.setMvu(mvu)
  assert.equal((await f.sources.listBound({ scope: f.scope })).items.some(r => r.adapterId === 'tavern.mvu'), false, 'metadata query does not allocate a state')
  const states = await mvu.list({ scope: f.scope }), before = readFileSync(join(f.dir, 'mvu-instances.json'), 'utf8')
  t.mock.method(mvu, 'list', () => { throw Error('Variable snapshots forbidden') }); t.mock.method(mvu, 'read', () => { throw Error('Variables forbidden') })
  let result = await f.sources.listBound({ scope: f.scope })
  assert.deepEqual(result.items.filter(r => r.adapterId === 'tavern.mvu').map(r => r.id), states.filter(r => r.instance && r.source?.characterId !== 'B').filter(r => r.templateId === 'mvu:template-A').map(r => r.id))
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false); assert.equal(readFileSync(join(f.dir, 'mvu-instances.json'), 'utf8'), before)
  f.sessions.get('s').header.createdAt = 3; assert.equal(result.checkCurrent(), false)
  await assert.rejects(f.sources.listBound({ scope: f.scope }), { code: 'SOURCE_BOUND_CHANGED' }); f.sessions.get('s').header.createdAt = 1
  result = await f.sources.listBound({ scope: f.scope })
  f.setMvu(undefined); assert.equal(result.checkCurrent(), false); assert.equal((await f.sources.listBound({ scope: f.scope })).items.some(r => r.adapterId === 'tavern.mvu'), false)
})
test('strict current local scope, absent session and cancellation never fall back to global catalog', async t => {
  const f = fixture(t)
  for (const scope of [undefined, {}, { sessionId: 's', authority: 'remote' }, { sessionId: 's', characterId: 'claim' }]) await assert.rejects(f.sources.listBound({ scope }), { code: 'SOURCE_BOUND_SCOPE' })
  await assert.rejects(f.sources.listBound({ scope: { sessionId: 'absent' } }), { code: 'SOURCE_BOUND_UNAVAILABLE' })
  await assert.rejects(f.sources.listBound({ scope: f.scope, signal: AbortSignal.abort() }))
  let release; f.setMvu({ listBound: () => new Promise(resolve => { release = resolve }) }); const pending = f.sources.listBound({ scope: f.scope })
  f.select({ characterId: 'B' }); release({ items: [], revision: '1', checkCurrent: () => true }); await assert.rejects(pending, { code: 'SOURCE_BOUND_CHANGED' })
})
