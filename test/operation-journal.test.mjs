import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync, readdirSync, appendFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { OperationJournal, operationJournalLimits } from '../packages/play/src/operation-journal.js'
import { createOperationContext } from '../packages/play/src/operation-log.js'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { ChromeStore } from '../packages/play/src/chrome.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { API_V2 } from '../packages/identity.js'

function fixture(t, options) {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-journal-'))
  const journal = new OperationJournal(dir, options)
  t.after(() => { journal.close(); rmSync(dir, { force: true, recursive: true }) })
  return { dir, journal }
}
function invoke(handler, path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    req.url = API_V2 + path; req.method = method
    const headers = {}
    const res = { setHeader(key, value) { headers[key] = value }, end(text) { resolve({ status: res.statusCode, headers, text, body: headers['Content-Type']?.includes('application/json') ? JSON.parse(text) : null }) } }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('staged logs survive restart, whitelist persistence and export, and keep context correlation', async t => {
  const { dir, journal } = fixture(t)
  const operation = createOperationContext({ journal, operation: 'session.create', logger: { info() { throw new Error('logger down') } } })
  operation.start({ sessionId: 's1', path: '/SECRET/root', content: 'SECRET-BODY' })
  operation.failure(Object.assign(new Error('SECRET-ERROR'), { code: 'PLAY_CONFLICT', stack: 'SECRET-STACK' }), { status: 409 })
  journal.close()
  const restarted = new OperationJournal(dir); t.after(() => restarted.close())
  const page = restarted.query({ operationId: operation.operationId })
  assert.equal(page.records.length, 2)
  assert.deepEqual(page.records.map(row => row.stage), ['failure', 'start'])
  assert.equal(page.records[0].status, 409)
  assert.notEqual(page.records[0].runId, restarted.runId)
  assert.equal(page.storage.available, true)
  assert.doesNotMatch(readFileSync(journal.path(0), 'utf8'), /SECRET|path|stack|content/)
  if (process.platform !== 'win32') assert.equal(statSync(journal.path(0)).mode & 0o777, 0o600)
})

test('bounded rotation and pagination report expired cursors; disk injection is sanitized on read', t => {
  const limits = { ...operationJournalLimits, segmentBytes: 1200, segments: 3 }
  const { journal } = fixture(t, { limits })
  for (let i = 0; i < 6; i++) journal.append('info', { operationId: 'same', stage: `s${i}` })
  const first = journal.query({ limit: 2 })
  const older = journal.query({ limit: 2, before: first.nextCursor })
  assert.deepEqual(first.records.map(row => row.stage), ['s5', 's4'])
  assert.deepEqual(older.records.map(row => row.stage), ['s3', 's2'])
  const original = first.records[0]
  writeFileSync(journal.path(0), JSON.stringify({ ...original, body: 'SECRET', path: 'SECRET', stack: 'SECRET' }) + '\n')
  assert.doesNotMatch(JSON.stringify(journal.query()), /SECRET/)
  for (let i = 0; i < 80; i++) journal.append('info', { operationId: 'same', stage: `new${i}` })
  for (const file of readdirSync(journal.directory).filter(name => name.endsWith('.jsonl'))) assert.ok(statSync(join(journal.directory, file)).size <= limits.segmentBytes)
  assert.ok(readdirSync(journal.directory).filter(name => name.endsWith('.jsonl')).length <= limits.segments)
  assert.throws(() => journal.query({ before: first.nextCursor }), { code: 'LOG_CURSOR_EXPIRED' })
})

test('concurrent requests serialize and second owner fails closed without damaging first writer', async t => {
  const { dir, journal } = fixture(t)
  const other = new OperationJournal(dir); t.after(() => other.close())
  assert.equal(other.code, 'LOG_WRITER_BUSY')
  assert.equal(other.append('info', { operation: 'other' }), false)
  await Promise.all(Array.from({ length: 100 }, async (_, i) => {
    const operation = createOperationContext({ journal, operation: 'test.concurrent' })
    operation.start(); await Promise.resolve(); operation.success(i)
  }))
  const records = journal.query({ limit: 1000 }).records
  assert.equal(records.length, 200)
  assert.equal(new Set(records.map(row => row.operationId)).size, 100)
  assert.equal(new Set(records.map(row => row.id)).size, 200)
})

test('unclean process exit recovers ownership and partial tail; corrupt lines are reported', t => {
  const { dir, journal } = fixture(t)
  journal.close()
  const moduleUrl = new URL('../packages/play/src/operation-journal.js', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { OperationJournal } from ${JSON.stringify(moduleUrl)}; const j = new OperationJournal(${JSON.stringify(dir)}); j.append('info', { operation:'child', stage:'start' }); process.exit(0)`])
  assert.equal(child.status, 0, child.stderr.toString())
  appendFileSync(journal.path(0), '{"partial":')
  const restarted = new OperationJournal(dir); t.after(() => restarted.close())
  assert.equal(restarted.code, null)
  restarted.append('info', { operation: 'after-restart' })
  appendFileSync(journal.path(0), 'not-json\n')
  const page = restarted.query()
  assert.equal(page.records.length, 2)
  assert.equal(page.storage.skippedRecords, 1)
  assert.equal(page.records[1].stage, 'start', 'an interrupted operation is never synthesized as successful')
})

test('storage faults, disabled logs, orphan guards and symlinks fail soft', async t => {
  const { dir, journal } = fixture(t)
  const target = join(dir, 'outside.txt'); writeFileSync(target, 'KEEP')
  symlinkSync(target, journal.path(0))
  assert.equal(journal.append('info', { operation: 'test' }), false)
  assert.equal(readFileSync(target, 'utf8'), 'KEEP')
  assert.equal(journal.query().storage.code, 'LOG_STORAGE_UNAVAILABLE')
  assert.doesNotThrow(() => createOperationContext({ journal }).success())
  const disabled = new OperationJournal(dir, { enabled: false })
  assert.equal(disabled.query().storage.code, 'LOG_DISABLED')
  journal.close(); mkdirSync(join(journal.directory, '.guard'))
  const guarded = new OperationJournal(dir)
  assert.equal(guarded.code, 'LOG_LOCK_RECOVERY_REQUIRED')
  const api = createPlayApiHandler({ chromeStore: new ChromeStore(dir), workspaceStore: new PlayWorkspaceStore(dir), operationJournal: journal })
  const result = await invoke(api, '/workspace/dirs', 'POST', { path: 'test' })
  assert.equal(result.status, 409, 'business error remains workspace-not-selected, not logging failure')
  assert.equal(result.body.code, 'PLAY_WORKSPACE_UNBOUND')
  assert.equal((await invoke(api, '/workspace', 'PUT', { path: dir })).status, 200, 'a successful mutation also survives storage failure')
})

test('HTTP query/export are quiet, bounded, correlated and backward compatible', async t => {
  const { dir, journal } = fixture(t)
  const api = createPlayApiHandler({ chromeStore: new ChromeStore(dir), workspaceStore: new PlayWorkspaceStore(dir), operationJournal: journal })
  const failed = await invoke(api, '/workspace', 'PUT', { path: join(dir, 'missing') })
  assert.equal(failed.status, 400)
  assert.equal(failed.body.operationId, failed.headers['X-Tavern-Operation-Id'])
  const filter = `?operationId=${failed.body.operationId}`
  const page = await invoke(api, `/operation-logs${filter}`)
  assert.equal(page.headers['Cache-Control'], 'no-store')
  assert.equal(page.body.records[0].stage, 'failure')
  assert.equal(page.body.records[0].errorCode, failed.body.code)
  const exported = await invoke(api, `/operation-logs${filter}&format=jsonl`)
  const lines = exported.text.trim().split('\n').map(JSON.parse)
  assert.equal(lines[0].type, 'metadata')
  assert.deepEqual(lines.slice(1), page.body.records)
  assert.equal(journal.query().records.length, page.body.records.length)
  for (const query of ['limit=0', 'limit=1001', 'limit=1&limit=2', 'foo=bar', 'level=debug', 'before=bad', 'format=html', 'sessionId=']) {
    assert.equal((await invoke(api, `/operation-logs?${query}`)).body.code, 'LOG_QUERY_INVALID')
  }
  assert.equal((await invoke(api, '/operation-logs', 'POST', {})).status, 405)
  const old = createPlayApiHandler({ chromeStore: new ChromeStore(dir) })
  assert.equal((await invoke(old, '/operation-logs')).status, 404)
})
