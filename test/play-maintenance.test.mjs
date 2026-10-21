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

test('inspects root, explicit head, every variant and raw remembered head once; archive preserves unrelated bytes and extensions', async t => {
  const calls = []
  const { service, store } = await fixture(t, { inspectSession(id) { calls.push(id); return missing() } })
  const before = store.readFile(row.path).content
  assert.equal((await service.inspect('run')).status, 'invalid')
  assert.deepEqual(calls, ['root', 'head', 'sibling', 'remembered'])
  assert.equal((await service.archiveInvalid('run')).status, 'archived')
  const catalog = JSON.parse(store.readFile('catalog.json').content)
  assert.equal(catalog.playthroughs[0].ext.pmpDshTavern.archivedAt, at)
  assert.deepEqual(catalog.ext, { thirdParty: 'preserve' })
  assert.deepEqual(catalog.playthroughs[0].ext.thirdParty, { value: 1 })
  assert.equal(store.readFile(row.path).content, before)
  assert.equal((await service.archiveInvalid('run')).reason, 'archived')
  assert.equal((await service.inspect('run', { includeArchived: true })).status, 'invalid')
  assert.equal(JSON.parse(store.readFile('catalog.json').content).playthroughs[0].ext.pmpDshTavern.archivedAt, at)
})

for (const surviving of ['root', 'sibling', 'head', 'remembered']) test(`preserves surviving ${surviving} session even outside the active branch`, async t => {
  const { service, store } = await fixture(t, { inspectSession: id => id === surviving ? { sessionId: id } : missing() })
  const before = store.readFile('catalog.json').content
  assert.equal((await service.archiveInvalid('run')).status, 'available')
  assert.equal(store.readFile('catalog.json').content, before)
})

for (const error of [{ code: 'EACCES' }, { status: 404 }, { code: 'PLAY_SESSION_FORMAT_MIGRATION_REQUIRED' }]) test(`preserves unknown inspection ${error.code ?? error.status}`, async t => {
  const { service, store } = await fixture(t, { inspectSession: () => { throw error } })
  const before = store.readFile('catalog.json').content
  assert.equal((await service.archiveInvalid('run')).status, 'unavailable')
  assert.equal(store.readFile('catalog.json').content, before)
})

test('preserves empty, protected, malformed, unreadable and opaque metadata', async t => {
  const { service, store, write, root } = await fixture(t)
  write('catalog.json', { playthroughs: [{ id: 'run', path: row.path }] }); write(row.path, { nodes: [] })
  assert.equal((await service.archiveInvalid('run')).status, 'empty')
  service.isDraftProtected = () => true
  assert.equal((await service.archiveInvalid('run')).status, 'protected')
  service.isDraftProtected = () => false
  for (const value of [{ ...timeline, ext: { pmpDshTavern: { branchHeads: {} } } }, { ...timeline, unknown: 1 }]) {
    write(row.path, value)
    assert.equal((await service.archiveInvalid('run')).status, 'unavailable')
  }
  writeFileSync(join(root, 'rp', row.path), '{broken')
  assert.equal((await service.archiveInvalid('run')).status, 'unavailable')
  rmSync(join(root, 'rp', row.path))
  assert.equal((await service.archiveInvalid('run')).status, 'unavailable')
  assert.equal(JSON.parse(store.readFile('catalog.json').content).playthroughs[0].ext, undefined)
})

for (const mutation of ['timeline', 'catalog-aba', 'workspace', 'draft', 'cancel', 'external']) test(`rechecks ${mutation} after Host awaits before archive`, async t => {
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
  if (mutation === 'cancel') await assert.rejects(f.service.archiveInvalid('run', { signal: controller.signal }), { name: 'AbortError' })
  else assert.equal((await f.service.archiveInvalid('run')).status, 'unavailable')
  assert.equal(JSON.parse(readFileSync(join(f.root, 'rp/catalog.json'), 'utf8')).playthroughs[0].ext.pmpDshTavern.archivedAt, undefined)
})

test('archive uses fresh existence evidence and rejects earlier workspace targets', async t => {
  const { service, store, root } = await fixture(t)
  const preview = await service.inspect('run')
  service.inspectSession = () => ({ sessionId: 'restored' })
  assert.equal((await service.archiveInvalid('run')).status, 'available')
  await store.bindRoot(join(root, 'other'))
  assert.equal((await service.archiveInvalid('run', { expectedWorkspaceScope: preview.workspaceScope })).reason, 'changed')
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

test('HTTP availability is quiet, archive operation identifies only its exact target and caller batch archives multiple rows', async t => {
  const { service, store, write, root } = await fixture(t)
  const second = { ...row, id: 'second', path: 'card/second/timeline.json' }
  write(second.path, timeline); write('catalog.json', { playthroughs: [row, second] })
  const logs = []
  const handler = createPlayApiHandler({ chromeStore: new ChromeStore(join(root, 'chrome')), workspaceStore: store, maintenanceService: service, logger: { info: record => logs.push(JSON.parse(record.slice(record.indexOf('{')))), warn() {}, error() {} } })
  const client = createLivePlayClient({ fetchImpl: (url, options) => invoke(handler, url, options) })
  const read = await invoke(handler, `${API_V2}/playthroughs/run/availability`)
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('X-Tavern-Operation-Id'), undefined)
  assert.equal(logs.length, 0)
  const report = await archiveInvalidPlaythroughs(client)
  assert.deepEqual(report, { archived: 2, preserved: 0, failed: 0 })
  assert.deepEqual(logs.filter(log => log.event === 'operation.completed').map(log => [log.route, log.playthroughId]), [['/playthroughs/:id/archive-invalid', 'run'], ['/playthroughs/:id/archive-invalid', 'second']])
  assert.ok(JSON.parse(store.readFile('catalog.json').content).playthroughs.every(item => item.ext.pmpDshTavern.archivedAt === at))
  assert.equal((await invoke(handler, `${API_V2}/playthroughs/run/archive-invalid`, { method: 'GET' })).status, 405)
  const bad = await invoke(handler, `${API_V2}/playthroughs/run/archive-invalid`, { method: 'POST', body: JSON.stringify({ playthroughIds: ['second'] }) })
  assert.equal(bad.status, 400)
  assert.ok(bad.headers.get('X-Tavern-Operation-Id'))
  assert.equal((await invoke(handler, `${API_V2}/playthroughs/%QQ/availability`)).status, 400)
})

test('Host inspection maps only public missing-session failures and never reads cached sessions', async () => {
  const host = createPlayHost({ sessionController: { inspect: async () => { throw { code: 'session/not-found', status: 404 } } }, sessions: { get() { throw new Error('cache must not be used') } } })
  await assert.rejects(host.inspectSession('root'), { code: 'PLAY_SESSION_NOT_FOUND' })
  await assert.rejects(createPlayHost().inspectSession('root'), { code: 'PLAY_HOST_UNAVAILABLE' })
})
