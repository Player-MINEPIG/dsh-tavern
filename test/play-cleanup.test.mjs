import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { PlayMaintenanceService } from '../packages/play/src/maintenance.js'
import { PlayCleanupService } from '../packages/play/src/cleanup.js'
import { createMaintenanceTool } from '../packages/tavern-loader/src/maintenance-tools.js'
import { ImportContextRuntime } from '../packages/tavern-loader/src/import-context-runtime.js'

async function fixture(t, inspectSession = async () => { throw Object.assign(new Error('missing'), { code: 'PLAY_SESSION_NOT_FOUND' }) }) {
  const root = mkdtempSync(join(tmpdir(), 'play-cleanup-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const rp = join(root, 'rp'); mkdirSync(rp)
  const store = new PlayWorkspaceStore(join(root, 'plugin'))
  await store.bindRoot(rp)
  const rows = ['a', 'b'].map(name => ({ id: `playthrough-${name}`, path: `card/playthrough-${name}/timeline.json`, title: name,
    ext: { external: { retained: true }, pmpDshTavern: { rootSessionId: name, playthroughNumber: name === 'a' ? 3 : 4 } } }))
  for (const row of rows) store.writeFile(row.path, JSON.stringify({ nodes: [] }), { expectedRevision: null, expectedRevisionPresent: true })
  store.writeFile('catalog.json', JSON.stringify({ playthroughs: rows, ext: { external: 'keep' } }), { expectedRevision: null, expectedRevisionPresent: true })
  store.writeFile('card/playthrough-a/import-context.json', '{"original":"retained"}')
  const maintenance = new PlayMaintenanceService({ workspaceStore: store, inspectSession, isDraftProtected: () => false })
  const cleanup = new PlayCleanupService({ workspaceStore: store, maintenance })
  const tool = createMaintenanceTool({ workspaceStore: store, maintenance, cleanup })
  return { root, rp, store, rows, maintenance, cleanup, tool, catalog: () => JSON.parse(store.readFile('catalog.json').content) }
}

test('tool preview is read-only, clean exact targets and restore preserve original Tavern files and catalog extensions', async t => {
  const f = await fixture(t)
  const before = f.store.readFile('catalog.json').content
  const timeline = f.store.readFile(f.rows[0].path).content
  const preview = await f.tool.execute({})
  assert.equal(preview.items.filter(item => item.status === 'invalid').length, 2)
  assert.equal(f.store.readFile('catalog.json').content, before)
  const result = await f.tool.execute({ action: 'clean', ids: [f.rows[0].id], workspaceScope: preview.workspaceScope })
  const backupId = result.results[0].backupId
  assert.equal(result.results[0].status, 'cleaned')
  assert.deepEqual(f.catalog(), { playthroughs: [f.rows[1]], ext: { external: 'keep' } })
  assert.equal(existsSync(join(f.rp, f.rows[0].path)), false)
  assert.equal(readFileSync(join(f.rp, '.tavern-trash', backupId, 'files/import-context.json'), 'utf8'), '{"original":"retained"}')
  assert.equal((await f.cleanup.clean(f.rows[0].id)).status, 'cleaned')
  const reloaded = new PlayCleanupService({ workspaceStore: f.store, maintenance: f.maintenance })
  assert.equal(reloaded.restore(backupId).status, 'restored')
  assert.equal(reloaded.restore(backupId).status, 'restored')
  assert.deepEqual(f.catalog().playthroughs.find(row => row.id === f.rows[0].id), f.rows[0])
  assert.equal(f.store.readFile(f.rows[0].path).content, timeline)
  assert.equal(reloaded.list().length, 1)
})

test('cleanup protects live sessions and can clean already archived invalid runs', async t => {
  const f = await fixture(t, async id => {
    if (id === 'b') return { meta: { version: 4 } }
    throw Object.assign(new Error('missing'), { code: 'PLAY_SESSION_NOT_FOUND' })
  })
  assert.equal((await f.cleanup.clean(f.rows[1].id)).status, 'available')
  const file = f.store.readFile('catalog.json'), catalog = JSON.parse(file.content)
  catalog.playthroughs[0].ext.pmpDshTavern.archivedAt = '2026-10-21T00:00:00.000Z'
  f.store.writeFile('catalog.json', JSON.stringify(catalog), { expectedRevision: file.revision, expectedRevisionPresent: true })
  assert.equal((await f.cleanup.clean(f.rows[0].id)).status, 'cleaned')
  assert.equal(f.catalog().playthroughs.length, 1)
})

test('cleanup still preserves corrupt or unreadable sessions even when their runs can be archived', async t => {
  const f = await fixture(t, async () => { throw Object.assign(new Error('corrupt'), { code: 'SESSION_QUERY_CORRUPT_SESSION' }) })
  const before = f.store.readFile('catalog.json').content
  assert.equal((await f.cleanup.clean(f.rows[0].id)).status, 'unavailable')
  assert.equal(f.store.readFile('catalog.json').content, before)
  assert.deepEqual(f.cleanup.list(), [])
})

test('cleanup rejects shared directories and symlinks before removing a row', async t => {
  const f = await fixture(t)
  const file = f.store.readFile('catalog.json'), catalog = JSON.parse(file.content)
  catalog.playthroughs.push({ id: 'nested', path: 'card/playthrough-a/nested/timeline.json' })
  f.store.writeFile('catalog.json', JSON.stringify(catalog), { expectedRevision: file.revision, expectedRevisionPresent: true })
  await assert.rejects(f.cleanup.clean(f.rows[0].id), { code: 'PLAY_CLEANUP_CONFLICT' })
  assert.equal(f.catalog().playthroughs.length, 3)
  symlinkSync(join(f.rp, 'card/playthrough-a'), join(f.rp, 'card/playthrough-b/link'))
  await assert.rejects(f.cleanup.clean(f.rows[1].id), { code: 'PLAY_CLEANUP_CONFLICT' })
  assert.equal(f.cleanup.list().length, 0)
})

test('cleanup preserves a live row that aliases the same directory on a case-insensitive filesystem', async t => {
  const f = await fixture(t)
  if (!existsSync(join(f.rp, 'card/playthrough-A/timeline.json'))) return t.skip('Case-sensitive filesystem')
  const file = f.store.readFile('catalog.json'), catalog = JSON.parse(file.content)
  catalog.playthroughs.push({ id: 'playthrough-A', path: 'card/playthrough-A/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'live' } } })
  f.store.writeFile('catalog.json', JSON.stringify(catalog), { expectedRevision: file.revision, expectedRevisionPresent: true })
  await assert.rejects(f.cleanup.clean(f.rows[0].id), { code: 'PLAY_CLEANUP_CONFLICT' })
  assert.equal(existsSync(join(f.rp, 'card/playthrough-A/timeline.json')), true)
  assert.equal(f.catalog().playthroughs.length, 3)
})

test('cleanup preserves import-context files shared by native branch lineage', async t => {
  const f = await fixture(t)
  const path = 'card/playthrough-a/import-context.json'
  f.store.writeFile(path, JSON.stringify({ schemaVersion: 1, qa: [{ user: 'question', assistant: 'answer' }] }))
  const imports = new ImportContextRuntime(join(f.root, 'plugin'), f.store)
  imports.bind('a', imports.prepare({ path }))
  imports.contextFor('a', { claimEventSeqs: [10] })
  imports.consumeAfterTurn('a', { type: 'turn/end', seq: 20 })
  imports.copyLineageForBranch('a', 'live-child', 19)
  f.cleanup.protectedPaths = ({ sessionIds }) => Object.entries(imports.state.sessions)
    .filter(([id]) => !sessionIds.includes(id)).map(([, binding]) => binding.path)
  await assert.rejects(f.cleanup.clean(f.rows[0].id), { code: 'PLAY_CLEANUP_CONFLICT' })
  assert.match(imports.contextFor('live-child', { claimEventSeqs: [21] }), /question/)
  assert.equal(f.catalog().playthroughs.length, 2)
})

test('recovery record survives catalog write failure and failed move without losing original data', async t => {
  const f = await fixture(t)
  const save = f.cleanup.saveCatalog.bind(f.cleanup)
  f.cleanup.saveCatalog = () => { throw Object.assign(new Error('conflict'), { code: 'PLAY_FILE_REVISION_CONFLICT' }) }
  await assert.rejects(f.cleanup.clean(f.rows[0].id), { code: 'PLAY_FILE_REVISION_CONFLICT' })
  assert.equal(f.catalog().playthroughs.length, 2)
  assert.equal(f.cleanup.restore(f.cleanup.list()[0].backupId).status, 'restored')
  f.cleanup.saveCatalog = save
  const finish = f.cleanup.finishMove.bind(f.cleanup)
  f.cleanup.finishMove = () => { throw new Error('simulated interrupted move') }
  await assert.rejects(f.cleanup.clean(f.rows[1].id), /interrupted move/)
  assert.equal(f.catalog().playthroughs.length, 1)
  assert.equal(existsSync(join(f.rp, f.rows[1].path)), true)
  f.cleanup.finishMove = finish
  const backup = f.cleanup.list().find(row => row.id === f.rows[1].id)
  assert.equal((await f.cleanup.clean(f.rows[1].id)).status, 'recovery-required')
  assert.equal(f.cleanup.restore(backup.backupId).status, 'restored')
  assert.equal(f.catalog().playthroughs.length, 2)
})

test('restore refuses collisions, changed timeline and missing files without replacing catalog data', async t => {
  const f = await fixture(t)
  const result = await f.cleanup.clean(f.rows[0].id)
  f.store.writeFile(f.rows[0].path, JSON.stringify({ nodes: [], ext: { changed: true } }), { expectedRevision: null, expectedRevisionPresent: true })
  assert.throws(() => f.cleanup.restore(result.backupId), { code: 'PLAY_CLEANUP_CONFLICT' })
  assert.equal(f.catalog().playthroughs.length, 1)
  assert.equal(existsSync(join(f.rp, '.tavern-trash', result.backupId, 'files/timeline.json')), true)
})

test('tool validates explicit mutation scope, exact targets and cancellation', async t => {
  const f = await fixture(t)
  await assert.rejects(f.tool.execute({ action: 'clean' }), TypeError)
  await assert.rejects(f.tool.execute({ action: 'preview', ids: ['playthrough-a'] }), TypeError)
  await assert.rejects(f.tool.execute({ action: 'clean', ids: ['playthrough-a'], workspaceScope: 'old' }), { code: 'PLAY_CLEANUP_CONFLICT' })
  const signal = AbortSignal.abort()
  await assert.rejects(f.tool.execute({}, { signal }), { name: 'AbortError' })
  assert.equal(f.catalog().playthroughs.length, 2)
})
