import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpeningWorldBookService, createOpeningWorldBookHandler } from '../packages/opening-worldbook/index.js'
import { createStaticOpeningRegistry, sha256 } from '../packages/opening-worldbook/static-registry.js'
import { OPENING_IDENTITY_SHA256 } from '../packages/opening-worldbook/manifest.js'
import { CharacterStore } from '../packages/character/src/index.js'
import { WorldBookStore } from '../packages/world-book-library/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { createWorldBookAdapter } from '../packages/tavern-loader/src/world-book-adapter.js'
import { WorldBookMemorySource } from '../packages/memory-sources/world-books.js'
import { Readable } from 'node:stream'

const helper = (name = 'Fixture entry', content = 'Authored complete content') => ({ name, enabled: true, strategy: { type: 'selective', keys: ['trigger'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' }, position: { type: 'at_depth', role: 'system', depth: 2, order: 92 }, content, probability: 100, recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null }, effect: { sticky: null, cooldown: null, delay: null }, extra: { comment: name } })
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'opening-books-')); t.after(() => rmSync(dir, { force: true, recursive: true }))
  const characters = new CharacterStore(dir), selections = new SessionSelectionStore(dir), sessions = new Map([['s', {}], ['other', {}]])
  const card = characters.create({ id: 'fixture-card', name: 'Fixture' }); characters.update(card.id, { firstMessage: 'AUTHORED ORIGINAL GREETING' })
  selections.set('s', { characterCardId: card.id }); selections.set('other', { characterCardId: card.id })
  let now = 1000, changes = 0
  const options = { storageDir: dir, characters, getSelection: id => selections.get(id), getSelectionRevision: id => selections.selectionRevision(id), getSession: id => sessions.get(id), now: () => now, ttlMs: 50, onChange: () => changes++, readRegistry: ({ openingId }) => ['default', 'alisa_party'].includes(openingId) ? [] : [helper()] }
  const service = new OpeningWorldBookService(options); t.after(() => service.dispose())
  const sourceIdentity = { version: 1, owner: 'pmp-dsh-tavern', sessionId: 's', characterId: card.id, greetingIndex: 0, greetingSha256: sha256('AUTHORED ORIGINAL GREETING'), identitySha256: OPENING_IDENTITY_SHA256 }
  const prepare = openingId => service.prepare({ openingId: openingId ?? 'police_done', sourceIdentity })
  const commit = (proposal, extra = {}) => service.commit({ proposalId: proposal.proposalId, expectedRevision: proposal.expectedRevision, sourceIdentity, operationId: 'op', reviewed: true, write: true, ...extra })
  return { dir, characters, card, selections, sessions, service, sourceIdentity, prepare, commit, options, expire: () => now += 100, changes: () => changes }
}
test('separate world-book confirmation, CAS and durable idempotent receipt preserve card/global resources', t => {
  const f = fixture(t), original = readFileSync(f.characters.characterPath(f.card.id), 'utf8'), globals = new WorldBookStore(f.dir)
  const p = f.prepare(), concurrent = f.prepare(); p.entries[0].content = 'Guest tamper'
  assert.throws(() => f.commit(p, { write: false }), { code: 'OPENING_CONFIRMATION_REQUIRED' })
  const receipt = f.commit(p); assert.equal(receipt.inserted, 1); assert.equal(receipt.revision, 1)
  assert.deepEqual(f.commit(p), receipt)
  assert.throws(() => f.commit(concurrent, { operationId: 'other' }), { code: 'OPENING_PROPOSAL_STALE' })
  assert.throws(() => f.commit(p, { expectedRevision: 99 }), { code: 'OPENING_OPERATION_CONFLICT' })
  assert.equal(f.service.get(receipt.resourceId.slice(11), 's').book.entries[0].content, 'Authored complete content')
  const row = f.service.get(receipt.resourceId.slice(11), 's')
  assert.deepEqual(row, JSON.parse(JSON.stringify(row)), 'public source rows must use their finite durable JSON representation')
  assert.equal(f.changes(), 1); assert.deepEqual(globals.list(), []); assert.equal(readFileSync(f.characters.characterPath(f.card.id), 'utf8'), original)
  const restarted = new OpeningWorldBookService(f.options); assert.deepEqual(restarted.commit({ proposalId: p.proposalId, expectedRevision: 0, operationId: 'op', sourceIdentity: f.sourceIdentity, reviewed: true, write: true }), receipt); restarted.dispose()
})
test('default and alisa are empty skips, create no book and do not claim insertion', t => {
  const f = fixture(t)
  for (const opening of ['default', 'alisa_party']) { const p = f.prepare(opening), r = f.commit(p, { operationId: opening }); assert.equal(r.skipped, true); assert.equal(r.inserted, 0); assert.equal(r.resourceId, null); assert.deepEqual(f.commit(p, { operationId: opening }), r) }
  assert.equal(existsSync(f.service.path), false); assert.deepEqual(f.service.selectedIds('s'), [])
})
test('proposals revoke on selection ABA, source edits, session replacement, expiry and unload', t => {
  const f = fixture(t); let p = f.prepare(); f.selections.set('s', { userId: 'other' }); f.selections.set('s', { userId: null }); assert.throws(() => f.commit(p), { code: 'OPENING_PROPOSAL_STALE' })
  p = f.prepare(); f.characters.update(f.card.id, { name: 'changed' }); assert.throws(() => f.commit(p), { code: 'OPENING_PROPOSAL_STALE' })
  p = f.prepare(); f.sessions.set('s', {}); assert.throws(() => f.commit(p), { code: 'OPENING_PROPOSAL_STALE' })
  p = f.prepare(); f.expire(); assert.throws(() => f.commit(p), { code: 'OPENING_PROPOSAL_STALE' })
  p = f.prepare(); f.service.dispose(); assert.throws(() => f.commit(p), { code: 'OPENING_UNAVAILABLE' })
})
test('session-local source cannot be read or selected in another session, and managed policy controls next assembly', async t => {
  const f = fixture(t), receipt = f.commit(f.prepare()), id = receipt.resourceId.slice(11), store = new WorldBookStore(f.dir)
  const source = new WorldBookMemorySource({ storageDir: f.dir, store, characters: f.characters, sessionBooks: f.service, getSelection: sessionId => ({ characterId: f.card.id, worldBookIds: f.service.selectedIds(sessionId), token: f.service.revision() }) }); t.after(() => source.dispose())
  assert.equal(source.read({ id: receipt.resourceId }), null); assert.equal(source.read({ id: receipt.resourceId, scope: { sessionId: 'other' } }), null)
  assert.equal(source.list().some(r => r.id === receipt.resourceId), false); assert.equal(source.list({ scope: { sessionId: 's' } }).some(r => r.id === receipt.resourceId), true)
  const adapter = createWorldBookAdapter(store, { resolveDocument: (id, { sessionId }) => f.service.get(id, sessionId), allowResource: (id, c) => source.allowNative(id, c.requestAssembly) })
  const activate = requestAssembly => adapter.resolve({ sessionId: 's', selection: { worldBookIds: [id] }, conversationText: 'trigger', requestAssembly })
  const native = activate(true); assert.equal(native.loreEntries.length, 1)
  const row = source.read({ id: receipt.resourceId, scope: { sessionId: 's' } }); source.setManagementMode({ id: receipt.resourceId, scope: { sessionId: 's' }, mode: 'managed', expectedRevision: row.revision, operationId: 'manage' })
  assert.equal(activate(false).loreEntries.length, 0)
  const context = { sessionId: 's', assets: { character: f.characters.get(f.card.id), worldBookIds: [id], worldBookRevisions: { [id]: native.resources[0].revision } } }, output = { blocks: [{ id: 'lore', source: { resourceId: id }, text: native.loreEntries[0].content }] }
  assert.equal((await source.filter(context, output)).blocks.length, 0)
  const dispose = source.registerUsage(() => ({ enabled: true, strategy: [{ operation: 'worldbook.activate' }, { operation: 'worldbook.emit' }], checkCurrent: () => true }))
  assert.equal((await source.filter(context, output)).blocks.length, 1); dispose(); assert.throws(() => source.validateResolved(context), { code: 'SOURCE_POLICY_CHANGED' })
})
test('protected HTTP requires DSH admission and rejects route/session mismatch', async t => {
  const f = fixture(t)
  const request = body => { const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.url = '/pmp-dsh-tavern/api/v1/sessions/other/opening-worldbook/prepare'; req.method = 'POST'; return req }
  const response = () => ({ setHeader() {}, end(text) { this.body = JSON.parse(text) } })
  let res = response(); await createOpeningWorldBookHandler(f.service)(request({ sourceIdentity: f.sourceIdentity }), res); assert.equal(res.statusCode, 401)
  res = response(); await createOpeningWorldBookHandler(f.service, { getConnection: () => ({ admit: () => ({}) }) })(request({ sourceIdentity: f.sourceIdentity }), res); assert.equal(res.body.code, 'OPENING_SCOPE')
})
test('external state mutation fails closed instead of silently overwriting persisted books', t => {
  const f = fixture(t), p = f.prepare(); writeFileSync(f.service.path, JSON.stringify({ version: 1, records: {} })); assert.throws(() => f.commit(p), { code: 'OPENING_STORAGE_CHANGED' })
})
test('fixed-source literal parser never evaluates executable array elements or unknown join calls', () => {
  const identity = 'AUTHORED', content = 'irrelevant', read = createStaticOpeningRegistry({ identitySha256: sha256(identity), sources: [{ url: 'fixture', sha256: sha256(content) }] })
  assert.deepEqual(read({ openingId: 'default', identitySource: identity }), [])
  assert.throws(() => read({ openingId: 'unknown', identitySource: identity }), { code: 'OPENING_ID' })
  assert.throws(() => read({ openingId: 'pool', identitySource: identity, source: { url: 'fixture', sha256: sha256(content), content: content + 'tamper' } }), { code: 'OPENING_SOURCE_HASH' })
  const exploit = 'const ST_POLICE_ATTENTION_PERSONA = [(()=>{globalThis.openingWasRun=true;return "bad"})()].join("\\n")', parse = createStaticOpeningRegistry({ identitySha256: sha256(identity), sources: [{ url: 'fixture', sha256: sha256(exploit) }] })
  assert.throws(() => parse({ openingId: 'police_done', identitySource: identity, source: { url: 'fixture', sha256: sha256(exploit), content: exploit } }), { code: 'OPENING_STATIC_SOURCE' }); assert.equal(globalThis.openingWasRun, undefined)
})
