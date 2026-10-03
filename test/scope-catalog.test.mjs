import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createScopeCatalog, installScopeCatalog } from '../packages/scope-catalog/index.js'
import { UserStore } from '../packages/user/src/index.js'
import { CharacterStore } from '../packages/character/src/index.js'
import { PresetStore } from '../packages/preset/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(join(tmpdir(), 'scope-catalog-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const users = new UserStore(dir), characters = new CharacterStore(dir), presets = new PresetStore(dir)
  const persona = users.create({ id: 'persona', name: 'RP Persona', description: 'PRIVATE BODY' })
  const card = characters.create({ id: 'card', name: 'Character' }), preset = presets.create({ id: 'preset', name: 'ST Preset' })
  const sessions = new Map([['s', {}]])
  const selections = new SessionSelectionStore(dir, { defaultSelection: () => ({ presetId: presets.state.selectedId }) })
  selections.set('s', { characterCardId: card.id, presetId: preset.id, userId: persona.id })
  const catalog = createScopeCatalog({ sources: { characterId: characters, presetId: presets, userId: users }, getSelection: id => selections.get(id),
    getSelectionRevision: id => `${selections.selectionRevision(id)}:${presets.selectionEpoch}`, getSession: id => sessions.get(id), ...options })
  t.after(() => catalog.dispose())
  return { dir, users, characters, presets, persona, card, preset, sessions, selections, catalog }
}

test('all three public scope directories return only stable IDs and names', async t => {
  const f = fixture(t)
  for (const [field, id, name] of [['characterId', f.card.id, 'Character'], ['presetId', f.preset.id, 'ST Preset'], ['userId', 'persona', 'RP Persona']]) {
    assert.deepEqual(await f.catalog.searchScopes({ field }), { items: [{ id, name }], nextCursor: null })
  }
  assert.deepEqual((await f.catalog.resolveScopeContext({ sessionId: 's' })).scope, { sessionId: 's', characterId: f.card.id, presetId: f.preset.id, userId: 'persona' })
})

test('pagination and scope facts never call resource list/get or read resource bodies', async t => {
  const f = fixture(t)
  for (let i = 0; i < 103; i++) f.users.create({ id: `person-${String(i).padStart(3, '0')}`, name: `Reader ${i}`, description: 'PRIVATE'.repeat(100) })
  for (const store of [f.users, f.characters, f.presets]) {
    t.mock.method(store, 'list', () => { throw Error('Full source list forbidden') })
    t.mock.method(store, 'get', () => { throw Error('Source content read forbidden') })
  }
  const original = fs.readFileSync
  t.mock.method(fs, 'readFileSync', () => { throw Error('Body read during metadata query') })
  syncBuiltinESMExports()
  try {
    const found = [], params = { field: 'userId', query: 'Reader', limit: 50 }
    let cursor = null
    do { const page = await f.catalog.searchScopes({ ...params, cursor }); assert(page.items.length <= 50); found.push(...page.items); cursor = page.nextCursor } while (cursor)
    assert.equal(found.length, 103); assert.equal(new Set(found.map(row => row.id)).size, 103)
    assert((await f.catalog.resolveScopeContext({ sessionId: 's' })).checkCurrent())
  } finally { fs.readFileSync = original; syncBuiltinESMExports() }
})

test('signed cursors bind field, query, session boundary and source generation', async t => {
  const f = fixture(t)
  f.users.create({ id: 'other', name: 'Other' })
  const page = await f.catalog.searchScopes({ field: 'userId', limit: 1 })
  assert(page.nextCursor)
  for (const change of [{ field: 'characterId' }, { query: 'changed' }, { scope: { sessionId: 's' } }, { cursor: page.nextCursor.slice(0, -1) + (page.nextCursor.endsWith('x') ? 'y' : 'x') }]) {
    await assert.rejects(f.catalog.searchScopes({ field: 'userId', cursor: page.nextCursor, ...change }), { code: 'SCOPE_CATALOG_CURSOR' })
  }
  f.users.update('other', { name: 'Renamed' })
  f.users.update('other', { name: 'Other' })
  await assert.rejects(f.catalog.searchScopes({ field: 'userId', cursor: page.nextCursor }), { code: 'SCOPE_CATALOG_CURSOR' })
})

test('source visibility is reapplied per page and revokes scope facts', async t => {
  let revision = 1, hide = false
  const f = fixture(t, { isVisible: (field, row) => !(hide && field === 'userId' && row.id === 'persona'), getVisibilityRevision: () => revision })
  f.users.create({ id: 'other', name: 'Other' })
  const page = await f.catalog.searchScopes({ field: 'userId', limit: 1 }), lease = await f.catalog.resolveScopeContext({ sessionId: 's' })
  hide = true; revision++
  await assert.rejects(f.catalog.searchScopes({ field: 'userId', cursor: page.nextCursor }), { code: 'SCOPE_CATALOG_CURSOR' })
  assert.equal(lease.checkCurrent(), false)
  assert.deepEqual((await f.catalog.searchScopes({ field: 'userId' })).items, [{ id: 'other', name: 'Other' }])
  assert.equal((await f.catalog.resolveScopeContext({ sessionId: 's' })).scope.userId, null)
})

test('scope leases reject selection ABA, metadata changes, session replacement and unload', async t => {
  const f = fixture(t)
  let lease = await f.catalog.resolveScopeContext({ sessionId: 's' })
  f.selections.set('s', { userId: null }); f.selections.set('s', { userId: 'persona' })
  assert.equal(lease.checkCurrent(), false)
  lease = await f.catalog.resolveScopeContext({ sessionId: 's' }); f.users.update('persona', { description: 'body changed' })
  assert.equal(lease.checkCurrent(), false)
  lease = await f.catalog.resolveScopeContext({ sessionId: 's' }); f.sessions.set('s', {})
  assert.equal(lease.checkCurrent(), false)
  lease = await f.catalog.resolveScopeContext({ sessionId: 's' }); f.catalog.dispose()
  assert.equal(lease.checkCurrent(), false)
  await assert.rejects(f.catalog.searchScopes({ field: 'userId' }), { code: 'SCOPE_CATALOG_UNAVAILABLE' })
})

test('lease facts and result are deeply immutable; caller clones cannot change covered facts', async t => {
  const f = fixture(t), lease = await f.catalog.resolveScopeContext({ sessionId: 's' })
  assert(Object.isFrozen(lease)); assert(Object.isFrozen(lease.scope))
  for (const key of ['sessionId', 'characterId', 'presetId', 'userId']) assert.throws(() => { lease.scope[key] = 'forged' }, TypeError)
  assert.throws(() => { lease.scope = { sessionId: 'forged' } }, TypeError)
  assert.throws(() => { lease.revision = 'forged' }, TypeError)
  assert.throws(() => { lease.checkCurrent = () => true }, TypeError)
  const copy = structuredClone(lease.scope); copy.characterId = 'forged'; copy.sessionId = 'another'
  assert.equal(lease.scope.characterId, f.card.id); assert.equal(lease.scope.sessionId, 's'); assert.equal(lease.checkCurrent(), true)
  f.selections.set('s', { characterCardId: null })
  assert.equal(lease.checkCurrent(), false)
})

test('index survives restart, follows source mutations and fails closed on external edits', async t => {
  const f = fixture(t)
  assert.deepEqual(new UserStore(f.dir).scopeMetadata().items, [{ id: 'persona', name: 'RP Persona' }])
  f.users.delete('persona')
  assert.deepEqual((await f.catalog.searchScopes({ field: 'userId' })).items, [])
  fs.writeFileSync(join(f.dir, 'users/external.json'), JSON.stringify({ id: 'external', name: 'External', description: 'BODY' }))
  await assert.rejects(f.catalog.searchScopes({ field: 'userId' }), { code: 'SCOPE_CATALOG_STALE' })
  const reopened = new UserStore(f.dir)
  assert.deepEqual(reopened.scopeMetadata().items, [{ id: 'external', name: 'External' }])
  const index = JSON.parse(fs.readFileSync(join(f.dir, 'user-scope-index.json'), 'utf8'))
  assert.equal(JSON.stringify(index).includes('BODY'), false)
})

test('bounds, absent session and cancellation reject; global search does not invent a session', async t => {
  const f = fixture(t)
  for (const args of [{ field: 'unknown' }, { field: 'userId', limit: 0 }, { field: 'userId', limit: 51 }, { field: 'userId', query: 'x'.repeat(201) }, { field: 'userId', scope: { principal: 'claim' } }]) await assert.rejects(f.catalog.searchScopes(args), { code: 'SCOPE_CATALOG_INVALID' })
  await assert.rejects(f.catalog.resolveScopeContext({ sessionId: 'absent' }), { code: 'SCOPE_CATALOG_NOT_FOUND' })
  await assert.rejects(f.catalog.resolveScopeContext({}), { code: 'SCOPE_CATALOG_INVALID' })
  await assert.rejects(f.catalog.searchScopes({ field: 'userId', signal: AbortSignal.abort() }))
  const effects = [], provided = new Map()
  installScopeCatalog({ provide: (key, value) => provided.set(key, value), effect: callback => effects.push(callback()) }, f.catalog)
  assert.equal(provided.get('tavernScopeCatalog'), f.catalog)
  effects[0]()
  await assert.rejects(f.catalog.searchScopes({ field: 'userId' }), { code: 'SCOPE_CATALOG_UNAVAILABLE' })
})
