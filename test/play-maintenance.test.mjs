import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { PlayMaintenanceService, PlayWorkspaceStore, ChromeStore, createPlayApiHandler } from '../packages/play/src/index.js'
import { API_V2 } from '../packages/identity.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'
import { archiveInvalidPlaythroughs } from '../packages/client/src/play/maintenance.js'
import { createWorkspaceDiagnostics } from '../packages/client/src/play/diagnostics-state.js'
import { withPlaythroughArchive } from '../packages/play/src/playthrough-state.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'

const at = '2026-10-21T00:00:00.000Z'
const row = { id: 'run', path: 'card/run/timeline.json', title: 'Keep me', ext: { thirdParty: { value: 1 }, pmpDshTavern: { rootSessionId: 'root' } } }
const timeline = { nodes: [{ id: 'n', kind: 'qa', adoptedVariantId: 'v', variants: [
  { id: 'v', sessionId: 'root', startEventId: 1, endEventId: 2 },
  { id: 'sibling', sessionId: 'sibling', startEventId: 1, endEventId: 2 },
] }], head: { sessionId: 'head', nodeId: 'n', variantId: 'v' }, ext: { pmpDshTavern: { branchHeads: [
  { branchVariantId: 'v', nodeId: 'n', variantId: 'sibling', sessionId: 'remembered' },
] } } }
const missing = () => { throw Object.assign(new Error('missing'), { code: 'PLAY_SESSION_NOT_FOUND' }) }
async function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tavern-maintenance-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const store = new PlayWorkspaceStore(join(root, 'plugin'))
  mkdirSync(join(root, 'rp')); mkdirSync(join(root, 'other'))
  await store.bindRoot(join(root, 'rp'))
  const write = (path, value) => store.writeFile(path, JSON.stringify(value), { expectedRevision: (() => { try { return store.readFile(path).revision } catch { return null } })(), expectedRevisionPresent: true })
  write(row.path, timeline); write('catalog.json', { playthroughs: [row], ext: { thirdParty: 'preserve' } })
  const service = new PlayMaintenanceService({ workspaceStore: store, inspectSession: missing, isDraftProtected: () => false, now: () => at, ...options })
  return { root, store, write, service }
}

test('strict cleanup inspection includes root, explicit head, every variant and raw remembered head once without mutation', async t => {
  const calls = []
  const { service, store, write } = await fixture(t, { inspectSession(id) { calls.push(id); return missing() } })
  const before = store.readFile('catalog.json').content
  assert.equal((await service.inspect('run')).status, 'invalid')
  assert.deepEqual(calls, ['root', 'head', 'sibling', 'remembered'])
  assert.equal(store.readFile('catalog.json').content, before)
  write('catalog.json', { playthroughs: [withPlaythroughArchive(row, at)] })
  assert.equal((await service.inspect('run')).reason, 'archived')
  assert.equal((await service.inspect('run', { includeArchived: true })).status, 'invalid')
})

for (const surviving of ['root', 'sibling', 'head', 'remembered']) test(`preserves surviving ${surviving} session even outside the active branch`, async t => {
  const { service, store } = await fixture(t, { inspectSession: id => id === surviving ? { sessionId: id } : missing() })
  const before = store.readFile('catalog.json').content
  assert.equal((await service.inspect('run')).status, 'available')
  assert.equal(store.readFile('catalog.json').content, before)
})

for (const error of [{ code: 'EACCES' }, { status: 404 }, { code: 'PLAY_SESSION_FORMAT_MIGRATION_REQUIRED' }]) test(`preserves unknown inspection ${error.code ?? error.status}`, async t => {
  const { service, store } = await fixture(t, { inspectSession: () => { throw error } })
  const before = store.readFile('catalog.json').content
  assert.equal((await service.inspect('run')).status, 'unavailable')
  assert.equal(store.readFile('catalog.json').content, before)
})

test('preserves empty, protected, malformed, unreadable and opaque metadata', async t => {
  const { service, store, write, root } = await fixture(t)
  write('catalog.json', { playthroughs: [{ id: 'run', path: row.path }] }); write(row.path, { nodes: [] })
  assert.equal((await service.inspect('run')).status, 'empty')
  service.isDraftProtected = () => true
  assert.equal((await service.inspect('run')).status, 'protected')
  service.isDraftProtected = () => false
  for (const value of [{ ...timeline, ext: { pmpDshTavern: { branchHeads: {} } } }, { ...timeline, unknown: 1 }]) {
    write(row.path, value)
    assert.equal((await service.inspect('run')).status, 'unavailable')
  }
  writeFileSync(join(root, 'rp', row.path), '{broken')
  assert.equal((await service.inspect('run')).status, 'unavailable')
  rmSync(join(root, 'rp', row.path))
  assert.equal((await service.inspect('run')).status, 'unavailable')
  assert.equal(JSON.parse(store.readFile('catalog.json').content).playthroughs[0].ext, undefined)
})

for (const mutation of ['timeline', 'catalog-aba', 'workspace', 'draft', 'cancel', 'external']) test(`rechecks ${mutation} after Host awaits before guarded cleanup`, async t => {
  const f = await fixture(t)
  const controller = new AbortController()
  const before = f.store.readFile('catalog.json').content
  let first = true
  f.service.inspectSession = async () => {
    if (first) {
      first = false
      if (mutation === 'timeline') f.write(row.path, { nodes: [] })
      if (mutation === 'catalog-aba') { f.write('catalog.json', { playthroughs: [] }); f.write('catalog.json', JSON.parse(before)) }
      if (mutation === 'workspace') await f.store.bindRoot(join(f.root, 'other'))
      if (mutation === 'draft') f.service.isDraftProtected = () => true
      if (mutation === 'cancel') controller.abort()
      if (mutation === 'external') writeFileSync(join(f.root, 'rp', row.path), JSON.stringify({ nodes: [] }))
    }
    missing()
  }
  if (mutation === 'cancel') await assert.rejects(f.service.withInvalid('run', () => assert.fail('stale callback'), { signal: controller.signal }), { name: 'AbortError' })
  else assert.equal((await f.service.withInvalid('run', () => assert.fail('stale callback'))).status, 'unavailable')
  assert.equal(JSON.parse(readFileSync(join(f.root, 'rp/catalog.json'), 'utf8')).playthroughs[0].ext.pmpDshTavern.archivedAt, undefined)
})

test('strict cleanup uses fresh existence evidence and rejects earlier workspace targets', async t => {
  const { service, store, root } = await fixture(t)
  const preview = await service.inspect('run')
  service.inspectSession = () => ({ sessionId: 'restored' })
  assert.equal((await service.inspect('run')).status, 'available')
  await store.bindRoot(join(root, 'other'))
  assert.equal((await service.withInvalid('run', () => assert.fail('workspace changed'), { expectedWorkspaceScope: preview.workspaceScope })).reason, 'changed')
})

function invoke(handler, url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(options.body === undefined ? [] : [Buffer.from(options.body)])
    req.url = url; req.method = options.method ?? 'GET'
    const headers = {}
    const res = { statusCode: 200, setHeader(k, v) { headers[k] = v }, end(payload) {
      const body = JSON.parse(String(payload)); resolve({ ok: res.statusCode < 400, status: res.statusCode, headers: { get: key => headers[key] }, json: async () => body })
    } }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('HTTP strict availability remains a quiet read and old archive workflow endpoint is removed', async t => {
  const { service, store, root } = await fixture(t)
  const logs = []
  const handler = createPlayApiHandler({ chromeStore: new ChromeStore(join(root, 'chrome')), workspaceStore: store, maintenanceService: service, logger: { info: record => logs.push(record) } })
  const read = await invoke(handler, `${API_V2}/playthroughs/run/availability`)
  assert.equal(read.status, 200)
  assert.equal((await read.json()).status, 'invalid')
  assert.equal(read.headers.get('X-Tavern-Operation-Id'), undefined)
  assert.equal(logs.length, 0)
  assert.equal((await invoke(handler, `${API_V2}/playthroughs/run/availability`, { method: 'POST' })).status, 405)
  assert.equal((await invoke(handler, `${API_V2}/playthroughs/run/archive-invalid`, { method: 'POST', body: '{}' })).status, 404)
  assert.equal((await invoke(handler, `${API_V2}/playthroughs/%QQ/availability`)).status, 400)
})

test('Host inspection maps only public missing-session failures and never reads cached sessions', async () => {
  const host = createPlayHost({ sessionController: { inspect: async () => { throw { code: 'session/not-found', status: 404 } } }, sessions: { get() { throw new Error('cache must not be used') } } })
  await assert.rejects(host.inspectSession('root'), { code: 'PLAY_SESSION_NOT_FOUND' })
  await assert.rejects(createPlayHost().inspectSession('root'), { code: 'PLAY_HOST_UNAVAILABLE' })
})

async function archiveFixture(t, { onPut } = {}) {
  const f = await fixture(t)
  const rows = ['corrupt', 'unreadable', 'missing', 'moved', 'no-session', 'healthy', 'draft'].map(id => ({
    id, path: `card/${id}/timeline.json`, ext: { pmpDshTavern: { characterId: 'card', ...(id === 'draft' ? { draftId: id } : { rootSessionId: `session-${id}` }) }, thirdParty: { keep: id } },
  }))
  f.write('catalog.json', { playthroughs: rows, ext: { thirdParty: 'keep' } })
  for (const item of rows) if (item.id !== 'missing') f.write(item.path, { nodes: [] })
  writeFileSync(join(f.root, 'rp/card/corrupt/timeline.json'), '{broken')
  const handler = createPlayApiHandler({ chromeStore: new ChromeStore(join(f.root, 'chrome')), workspaceStore: f.store })
  const puts = []
  const client = createLivePlayClient({ fetchImpl: async (url, options = {}) => {
    if (options.method === 'GET' && url.includes(encodeURIComponent('card/unreadable/timeline.json'))) throw Object.assign(new Error('Cannot read'), { code: 'EACCES' })
    if (options.method === 'PUT') { puts.push(JSON.parse(options.body)); await onPut?.(f, puts.length) }
    return invoke(handler, url, options)
  } })
  client.getCharacters = async () => ({ characters: [{ id: 'card', name: 'Card' }] })
  const controller = createWorkspaceDiagnostics(client)
  controller.setSessionAvailability({ sessionsPhase: 'ready', workspacesPhase: 'ready', sessions: { 'session-healthy': { id: 'session-healthy', cwd: join(f.root, 'rp') }, 'session-moved': { id: 'session-moved', cwd: join(f.root, 'other') } }, workspaceItems: [{ workspaceId: null, sessionIds: ['session-healthy'] }], archivedSessionIds: [] })
  return { ...f, client, controller, rows, puts }
}

test('one catalog CAS archives every currently diagnosed unopenable run while healthy drafts and runs remain usable', async t => {
  const f = await archiveFixture(t)
  const report = await archiveInvalidPlaythroughs(f.client, { controller: f.controller, now: () => new Date(at) })
  assert.deepEqual(report, { archived: 5, preserved: 2, failed: 0 })
  assert.equal(f.puts.length, 1)
  const saved = JSON.parse(f.store.readFile('catalog.json').content)
  assert.deepEqual(saved.playthroughs.filter(item => item.ext.pmpDshTavern.archivedAt).map(item => item.id), ['corrupt', 'unreadable', 'missing', 'moved', 'no-session'])
  assert.deepEqual(saved.ext, { thirdParty: 'keep' })
  assert.ok(saved.playthroughs.every(item => item.ext.thirdParty.keep === item.id))
  assert.equal(readFileSync(join(f.root, 'rp/card/corrupt/timeline.json'), 'utf8'), '{broken')
})

test('CAS retry archives the exact diagnosed id and path while preserving concurrent metadata and repathed rows', async t => {
  const f = await archiveFixture(t, { onPut(f, count) {
    if (count !== 1) return
    const catalog = JSON.parse(f.store.readFile('catalog.json').content)
    catalog.ext.concurrent = 'preserved'
    catalog.playthroughs.find(row => row.id === 'moved').path = 'card/moved-repaired/timeline.json'
    catalog.playthroughs.find(row => row.id === 'healthy').title = 'Changed concurrently'
    f.write('catalog.json', catalog)
  } })
  const report = await archiveInvalidPlaythroughs(f.client, { controller: f.controller, now: () => new Date(at) })
  assert.deepEqual(report, { archived: 4, preserved: 2, failed: 1 })
  assert.equal(f.puts.length, 2)
  const saved = JSON.parse(f.store.readFile('catalog.json').content)
  assert.equal(saved.ext.concurrent, 'preserved')
  assert.equal(saved.playthroughs.find(row => row.id === 'healthy').title, 'Changed concurrently')
  assert.equal(saved.playthroughs.find(row => row.id === 'moved').ext.pmpDshTavern.archivedAt, undefined)
})

test('workspace read failure refuses all archive writes', async t => {
  const f = await archiveFixture(t)
  f.client.getCharacters = async () => { throw new Error('Workspace resources unavailable') }
  assert.equal(await archiveInvalidPlaythroughs(f.client, { controller: f.controller }), null)
  assert.equal(f.puts.length, 0)
})

test('identical catalog bytes in another workspace cannot satisfy an archive request for the original root', async t => {
  let switched = false
  const f = await archiveFixture(t, { async onPut(f) {
    const bytes = f.store.readFile('catalog.json').content
    await f.store.bindRoot(join(f.root, 'other'))
    f.store.writeFile('catalog.json', bytes, { expectedRevision: null, expectedRevisionPresent: true })
    switched = true
  } })
  await assert.rejects(archiveInvalidPlaythroughs(f.client, { controller: f.controller }), { code: 'PLAY_WORKSPACE_CHANGED' })
  assert.equal(switched, true)
  assert.equal(f.puts.length, 1)
  assert.ok(JSON.parse(f.store.readFile('catalog.json').content).playthroughs.every(row => !row.ext.pmpDshTavern.archivedAt))
  assert.ok(JSON.parse(readFileSync(join(f.root, 'rp/catalog.json'), 'utf8')).playthroughs.every(row => !row.ext.pmpDshTavern.archivedAt))
})

test('generic live file writes forward workspace identity and validate its input', async t => {
  const f = await archiveFixture(t)
  const scope = JSON.stringify([f.store.get().workspaceId, f.store.get().rootPath])
  await f.client.putFile('note.txt', 'kept', { expectedWorkspaceScope: scope })
  assert.equal(f.store.readFile('note.txt').content, 'kept')
  await assert.rejects(f.client.putFile('note.txt', 'wrong', { expectedWorkspaceScope: 7 }), { status: 400, code: 'PLAY_WORKSPACE_SCOPE_INVALID' })
  await assert.rejects(f.client.putFile('note.txt', 'wrong', { expectedWorkspaceScope: 'another-root' }), { status: 409, code: 'PLAY_WORKSPACE_CHANGED' })
  assert.equal(f.store.readFile('note.txt').content, 'kept')
})

test('workspace guard rechecks identity after a synchronous rename hook', async t => {
  const f = await fixture(t)
  const catalog = f.store.readFile('catalog.json')
  const scope = JSON.stringify([f.store.get().workspaceId, f.store.get().rootPath])
  f.store.beforeRename = () => f.store.persist({ ...f.store.get(), rootPath: join(f.root, 'other') })
  assert.throws(() => f.store.writeFile('catalog.json', JSON.stringify({ playthroughs: [] }), { expectedRevision: catalog.revision, expectedRevisionPresent: true, expectedWorkspaceScope: scope }), { code: 'PLAY_WORKSPACE_CHANGED' })
  assert.equal(readFileSync(join(f.root, 'rp/catalog.json'), 'utf8'), catalog.content)
})

test('archive waits for ready session and workspace mirrors, then archives the same missing root', async t => {
  const f = await archiveFixture(t)
  f.write('catalog.json', { playthroughs: [{ ...row, ext: { pmpDshTavern: { rootSessionId: 'missing-root' } } }] })
  f.write(row.path, { nodes: [] })
  for (const [sessionsPhase, workspacesPhase] of [['pending', 'ready'], ['ready', 'pending'], ['error', 'ready'], ['ready', 'error']]) {
    f.controller.setSessionAvailability({ sessionsPhase, workspacesPhase, sessions: {}, workspaceItems: [] })
    assert.equal(await archiveInvalidPlaythroughs(f.client, { controller: f.controller }), null)
    assert.equal(f.controller.getSnapshot().availabilityReady, false)
    assert.equal(f.puts.length, 0)
  }
  f.controller.setSessionAvailability({ sessionsPhase: 'ready', workspacesPhase: 'ready', sessions: {}, workspaceItems: [] })
  assert.equal(f.controller.getSnapshot().availabilityReady, true)
  assert.deepEqual(await archiveInvalidPlaythroughs(f.client, { controller: f.controller }), { archived: 1, preserved: 0, failed: 0 })
  assert.equal(f.puts.length, 1)
  assert.ok(JSON.parse(f.store.readFile('catalog.json').content).playthroughs[0].ext.pmpDshTavern.archivedAt)
})

test('diagnostics publish mirror readiness changes during a pending resource read', async () => {
  let finish
  const controller = createWorkspaceDiagnostics({}, { load: () => new Promise(resolve => { finish = resolve }) })
  const snapshots = []
  controller.subscribe(() => snapshots.push(controller.getSnapshot()))
  const refresh = controller.refresh()
  controller.setSessionAvailability({ sessionsPhase: 'ready', workspacesPhase: 'ready' })
  assert.equal(controller.getSnapshot().loading, true)
  assert.equal(controller.getSnapshot().availabilityReady, true)
  controller.setSessionAvailability({ sessionsPhase: 'error', workspacesPhase: 'ready' })
  assert.equal(controller.getSnapshot().availabilityReady, false)
  assert.ok(snapshots.some(snapshot => snapshot.loading && snapshot.availabilityReady))
  finish({ workspace: { selected: false }, catalog: { playthroughs: [] }, diagnostics: [] })
  await refresh
  assert.equal(controller.getSnapshot().availabilityReady, false)
})
