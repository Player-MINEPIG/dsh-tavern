import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { installMvu } from '../packages/mvu-adapter/src/host.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { PlayWorkspaceStore, createWorkspaceApiHandler } from '../packages/play/src/workspace.js'
import { PlayMembershipService } from '../packages/play/src/membership.js'
import { validatePlayDocument } from '../packages/play/src/timeline.js'

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mvu-membership-lease-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const storageDir = join(directory, 'storage'), root = join(directory, 'play'), other = join(directory, 'other')
  mkdirSync(root); mkdirSync(other)
  const store = new PlayWorkspaceStore(storageDir); await store.bindRoot(root)
  const api = createWorkspaceApiHandler(store, { validateFile: validatePlayDocument }), memberships = new PlayMembershipService(store)
  const put = async (path, content, expectedRevision) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ content, expectedRevision }))]); let result
    const res = { setHeader() {}, end(text) { result = JSON.parse(text) } }
    await api.files(req, res, { method: 'PUT', searchParams: new URLSearchParams({ path }) })
    assert.equal(res.statusCode, 200); return result
  }
  const catalog = JSON.stringify({ playthroughs: [{ id: 'p', path: 'p/timeline.json', ext: { pmpDshTavern: { rootSessionId: 's', characterId: 'c' } } }] })
  await put('p/timeline.json', JSON.stringify({ nodes: [] }), null)
  const original = await put('catalog.json', catalog, null)
  const selections = new SessionSelectionStore(storageDir); selections.set('s', { characterCardId: 'c' })
  const scope = { mode: 'initial', sessionId: 's', playthroughId: 'p', characterId: 'c', sessionFormatVersion: 4 }
  const session = { id: 's', header: { id: 's', version: 4, createdAt: 'stable' }, snapshotEvents: () => [] }
  const services = new Map([['sessions', new Map([['s', session]])], ['tavernRenderingAuthority', { resolve: async () => ({ valid: true, write: true, scope }), isCurrent: () => true }]])
  const ctx = { get: name => services.get(name), provide: (name, value) => services.set(name, value), on() {}, effect: fn => fn() }
  const service = installMvu(ctx, { storageDir, resources: [{ id: 'mvu:initial', characterId: 'c', sessionIds: ['s'], initial: { stat_data: { hp: 10 } } }],
    sources: { register: () => () => {} }, memberships, getSelection: id => selections.get(id), getSelectionToken: id => selections.selectionRevision(id),
    isActive: (resource, id) => resource.characterId === selections.get(id).characterCardId })
  t.after(() => service.dispose())
  service.registerUsage(request => request.on === 'card_variable_update' ? { enabled: true, configRevision: 1, checkCurrent: () => true } : undefined)
  const bind = () => service.createCardBinding({ scope, sourceIdentity: { version: 1, sha256: 'a'.repeat(64), scope }, grantId: 'synthetic' })
  const input = (capability, operationId) => ({ capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -3 }], expectedRevision: 0, operationId, cause: 'script' })
  const restore = () => put('catalog.json', catalog, store.readFile('catalog.json').revision)
  const row = () => service.read({ id: 'mvu:initial', scope: { sessionId: 's' } })
  return { service, memberships, store, put, restore, bind, input, row, root, other, original }
}

test('public detach and exact catalog restoration never revive old initial capabilities, even without an intervening read', async t => {
  for (const checkWhileDetached of [true, false]) {
    const f = await fixture(t), old = await f.bind()
    assert.equal(f.memberships.detach('p', 's').detached, true)
    if (checkWhileDetached) await assert.rejects(f.service.cardWrite(f.input(old.capability, 'detached')), { code: 'MVU_READ_ONLY' })
    assert.equal((await f.restore()).revision, f.original.revision)
    await assert.rejects(f.service.cardWrite(f.input(old.capability, 'restored')), { code: 'MVU_READ_ONLY' })
    assert.equal((await f.row()).revision, 0)
    const fresh = await f.bind()
    assert.equal((await f.service.cardWrite(f.input(fresh.capability, 'fresh'))).variables.stat_data.hp, 7)
  }
})

test('membership ABA during final async scope check is denied before atomic persistence', async t => {
  const f = await fixture(t), { capability } = await f.bind(), resolveScope = f.service.resolveScope
  let calls = 0
  f.service.resolveScope = async scope => {
    const evidence = await resolveScope(scope)
    if (++calls === 2) { f.memberships.detach('p', 's'); await f.restore() }
    return evidence
  }
  await assert.rejects(f.service.cardWrite(f.input(capability, 'racing')), { code: 'MVU_READ_ONLY' })
  assert.equal((await f.row()).revision, 0)
})

test('workspace identity away-and-back invalidates leases, unrelated files and failed CAS do not', async t => {
  const f = await fixture(t), { capability } = await f.bind()
  const lease = f.memberships.captureLease('p')
  await f.put('unrelated.txt', 'unrelated', null)
  assert.equal(lease(), true)
  assert.throws(() => f.store.writeFile('catalog.json', '{}', { expectedRevision: '0'.repeat(64), expectedRevisionPresent: true }), { code: 'PLAY_FILE_REVISION_CONFLICT' })
  assert.equal(lease(), true)
  await f.store.bindRoot(f.other); await f.store.bindRoot(f.root)
  assert.equal(lease(), false)
  await assert.rejects(f.service.cardWrite(f.input(capability, 'workspace-restored')), { code: 'MVU_READ_ONLY' })
  assert.ok((await f.bind()).capability)
})

test('restoring an identical timeline still requires a new membership lease', async t => {
  const f = await fixture(t), { capability } = await f.bind(), timeline = f.store.readFile('p/timeline.json')
  await f.put('p/timeline.json', timeline.content, timeline.revision)
  await assert.rejects(f.service.cardWrite(f.input(capability, 'timeline-restored')), { code: 'MVU_READ_ONLY' })
  assert.ok((await f.bind()).capability)
})


test('case aliases track actual file identity without conflating distinct files on case-sensitive volumes', async t => {
  const f = await fixture(t), { capability } = await f.bind(), original = f.store.readFile('catalog.json')
  const aliases = existsSync(join(f.root, 'CATALOG.JSON'))
  const lease = f.memberships.captureLease('p')
  const away = JSON.parse(original.content); delete away.playthroughs[0].ext.pmpDshTavern.rootSessionId
  await f.put('CATALOG.JSON', JSON.stringify(away), original.revision)
  await f.put('CATALOG.JSON', original.content, null)
  assert.equal(lease(), !aliases)
  if (aliases) {
    await assert.rejects(f.service.cardWrite(f.input(capability, 'case-restored')), { code: 'MVU_READ_ONLY' })
    const next = await f.bind(), timeline = f.store.readFile('p/timeline.json')
    await f.put('P/timeline.json', timeline.content, timeline.revision)
    await assert.rejects(f.service.cardWrite(f.input(next.capability, 'directory-case-restored')), { code: 'MVU_READ_ONLY' })
  } else {
    assert.equal((await f.service.cardWrite(f.input(capability, 'separate-file'))).revision, 1)
  }
})
