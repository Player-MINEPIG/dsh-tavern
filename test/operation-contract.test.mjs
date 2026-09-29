import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createContractOperation } from '../packages/play/src/operation-contract.js'
import { OperationJournal } from '../packages/play/src/operation-journal.js'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
import { API_V2 } from '../packages/identity.js'

async function invoke(handler, method, path, body = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, url: API_V2 + path })
  const headers = {}
  const res = { statusCode: 200, setHeader(key, value) { headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
  await handler(req, res)
  return { ...res, headers }
}
function fixture(host) {
  const records = []
  const handler = createPlayApiHandler({
    chromeStore: {}, workspaceStore: { get: () => ({ rootPath: '/fixture', workspaceId: 'ws' }) }, host,
    operationJournal: { append(level, payload) { records.push({ level, ...payload }) } },
  })
  return { handler, records }
}

test('existing adapter records created session before subsequent workspace failure', async () => {
  const host = createPlayHost({ sessionController: { create: async () => ({ sessionId: 'created' }) },
    workspaceController: { insertSessionBefore: async () => { throw Object.assign(new Error('secret'), { status: 502, code: 'INSERT_FAILED' }) } } })
  const { handler, records } = fixture(host)
  const res = await invoke(handler, 'POST', '/sessions')
  assert.equal(res.statusCode, 502)
  assert.deepEqual(records.map(row => row.event), ['operation.started', 'session.created', 'operation.failed'])
  assert.equal(records.at(-1).sessionId, 'created')
  assert.equal(records.at(-1).operationId, res.body.operationId)
  assert.equal(res.headers['X-Tavern-Operation-Id'], res.body.operationId)
  assert.doesNotMatch(JSON.stringify(records), /secret|fixture/)
})

test('existing adapter preserves child identity when public inbox cleanup fails', async () => {
  const host = createPlayHost({ sessionController: {
    inspect: async () => ({ meta: { version: 4 } }), fork: async () => ({ sessionId: 'child' }),
    resolveAgent: async () => { throw new Error('secret inbox error') },
  } })
  const { handler, records } = fixture(host)
  const res = await invoke(handler, 'POST', '/sessions/source/branch', { atEventId: 3, sessionFormatVersion: 4 })
  assert.equal(res.statusCode, 502)
  assert.equal(res.body.code, 'PLAY_BRANCH_INPUT_RESET_FAILED')
  assert.deepEqual(records.map(row => row.event), ['operation.started', 'session.created', 'operation.failed'])
  assert.equal(records.at(-1).sessionId, 'child')
  assert.equal(records.at(-1).route, '/sessions/:id/branch')
  assert.doesNotMatch(JSON.stringify(records), /secret|inbox/)
})

test('adapter and API fallback emit creation once and do not change controller arguments', async () => {
  let args
  const host = createPlayHost({ sessionController: { create: async (...value) => { args = value; return { sessionId: 'created' } } } })
  const { handler, records } = fixture(host)
  assert.equal((await invoke(handler, 'POST', '/sessions')).statusCode, 201)
  assert.deepEqual(args, [{ workspaceId: 'ws' }])
  assert.deepEqual(records.map(row => row.event), ['operation.started', 'session.created', 'operation.completed'])
  assert.equal(records.at(-1).status, 201)
})

test('every declared mutation gets correlated validation failures; read/method/route rejection stays quiet', async () => {
  const records = []
  const fail = () => { throw Object.assign(new Error('private'), { status: 409, code: 'EXPECTED_FAILURE' }) }
  const handler = createPlayApiHandler({ chromeStore: {}, workspaceStore: { get: fail, bindRoot: fail, createDir: fail, writeFile: fail },
    host: { forkSession: fail, promptSession: fail, getImportContextBinding: fail }, membershipService: { detach: fail }, resolveCharacter: fail, relinkPlaythrough: fail,
    operationJournal: { append(level, row) { records.push(row) } },
  })
  for (const [method, path, body, operation] of [
    ['PUT', '/workspace', {}, 'workspace.bind'],
    ['POST', '/workspace/dirs', {}, 'workspace.dir.create'],
    ['PUT', '/workspace/files?path=secret.txt', {}, 'workspace.file.write'],
    ['POST', '/sessions', {}, 'session.create'],
    ['POST', '/sessions/s/branch', { atEventId: 0 }, 'session.branch'],
    ['POST', '/sessions/s/user-message', { text: 'SECRET' }, 'session.user-message'],
    ['PUT', '/sessions/s/import-context', {}, 'session.import-context.bind'],
    ['DELETE', '/sessions/s/import-context', {}, 'session.import-context.unbind'],
    ['POST', '/playthroughs/p/detach-session', { sessionId: 's' }, 'playthrough.session.detach'],
    ['POST', '/playthroughs/p/relink-character', { characterId: 'c' }, 'playthrough.character.relink'],
  ]) {
    records.length = 0
    const res = await invoke(handler, method, path, body)
    assert.ok(res.statusCode >= 400)
    assert.deepEqual(records.map(row => row.event), ['operation.started', 'operation.failed'], operation)
    assert.ok(records.every(row => row.operation === operation && row.eventVersion === 1 && row.operationId === res.body.operationId))
    assert.equal(records.at(-1).status, res.statusCode)
    assert.doesNotMatch(JSON.stringify(records), /secret.txt|SECRET|private/)
  }
  records.length = 0
  await invoke(handler, 'GET', '/sessions/s/import-context')
  await invoke(handler, 'DELETE', '/workspace')
  await invoke(handler, 'POST', '/missing')
  assert.equal(records.length, 0)
})

test('record envelope survives restart with both legacy and versioned events', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-contract-'))
  let journal = new OperationJournal(dir)
  try {
    journal.append('info', { operationId: 'legacy', operation: 'session.create', stage: 'host.session.created' })
    const operation = createContractOperation({ journal, operation: 'session.create', meta: { route: '/sessions', path: 'PRIVATE' } })
    operation.start()
    operation.checkpoint('internal.changed', { sessionId: 'wrong' })
    operation.checkpoint('session.created', { sessionId: 'created', path: 'PRIVATE', body: 'SECRET' })
    operation.failure({ code: 'FOLLOWUP_FAILED', message: 'SECRET' }, { status: 502 })
    operation.success()
    journal.close()
    journal = new OperationJournal(dir)
    const rows = journal.query().records
    assert.equal(rows.length, 4)
    assert.equal(rows.at(-1).eventVersion, undefined)
    assert.equal(rows[0].eventVersion, 1)
    assert.equal(rows[0].schemaVersion, 1)
    assert.equal(rows[0].sessionId, 'created')
    assert.equal(rows[0].errorCode, 'FOLLOWUP_FAILED')
    assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|SECRET|internal.changed|wrong/)
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('journal and event contract have no DSH runtime or HTTP dependency', () => {
  for (const file of ['operation-contract.js', 'operation-log.js', 'operation-journal.js']) {
    const source = readFileSync(new URL('../packages/play/src/' + file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(?:@deepseek|tavern-loader|http\.js|play-host)/)
    assert.doesNotMatch(source, /(?:agent|session)\/event|\.on\(/)
  }
})

test('relink records catalog compensation only when the compensating write succeeds', async () => {
  const { PlayMembershipService } = await import('../packages/play/src/membership.js')
  for (const rollbackFails of [false, true]) {
    const records = []
    let writes = 0
    const catalog = { playthroughs: [{ id: 'p', path: 'card/p/timeline.json', ext: { pmpDshTavern: { characterId: 'old', rootSessionId: 's' } } }] }
    const service = new PlayMembershipService({
      readFile(path) { return { content: JSON.stringify(path === 'catalog.json' ? catalog : { nodes: [] }), revision: 'a'.repeat(64) } },
      writeFile() { if (++writes === 2 && rollbackFails) throw new Error('disk'); return { revision: 'b'.repeat(64) } },
    })
    const handler = createPlayApiHandler({ chromeStore: {}, resolveCharacter: () => ({ id: 'new', name: 'N' }),
      relinkPlaythrough: (id, character, { operation }) => service.relinkPlaythrough(id, character, { operation, selectionPolicy: { selectMany() { throw new Error('selection') } } }),
      operationJournal: { append(level, row) { records.push(row) } },
    })
    assert.equal((await invoke(handler, 'POST', '/playthroughs/p/relink-character', { characterId: 'new' })).statusCode, 500)
    assert.deepEqual(records.map(row => row.event), [
      'operation.started', 'playthrough.catalog.updated', ...(!rollbackFails ? ['playthrough.catalog.restored'] : []), 'operation.failed',
    ])
    assert.equal(records.at(-1).playthroughId, 'p')
  }
})
