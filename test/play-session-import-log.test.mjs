import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import { ChromeStore, createPlayApiHandler } from '../packages/tavern-loader/src/index.js'
import { operationLogConstants } from '../packages/play/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = url
    const res = { statusCode: 200, setHeader() {}, end: payload => resolve({ status: res.statusCode, body: payload === '' ? null : JSON.parse(String(payload)) }) }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function fixture({ ids = [], overrides = {} } = {}) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-log-plugin-'))
  const calls = []
  const records = []
  let idIndex = 0
  let binding = null
  const host = {
    calls,
    async createSession() { calls.push(['create']); return { sessionId: 'new-session' } },
    async forkSession() { calls.push(['fork']); return { sessionId: 'child-session' } },
    async promptSession(args) { calls.push(['prompt', args]); return { accepted: true } },
    async prepareImportContext(reference) { calls.push(['prepare', reference]); return { path: reference.path, hash: 'secret-hash', qaCount: 4 } },
    async bindImportContext(sessionId, prepared) { calls.push(['bind', sessionId, prepared]); binding = { path: prepared.path, state: 'pending' }; return binding },
    async unbindImportContext(sessionId) { calls.push(['unbind', sessionId]); binding = null },
    async getImportContextBinding() { return binding },
    async history() { return { events: [], hasMore: false } },
    async deriveMessages() { return [] },
    async copySelection(source, child) { calls.push(['selection', source, child]) },
    async copyImportContextLineage(source, child, atEventId) { calls.push(['lineage', source, child, atEventId]) },
    ...overrides,
  }
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(pluginDir),
    workspaceStore: { get: () => ({ rootPath: 'D:/rp', workspaceId: 'workspace-rp' }) },
    host,
    logger: { info(line) { records.push(['info', line]) }, warn(line) { records.push(['warn', line]) } },
    operationOptions: { idFactory: () => ids[idIndex++] || ('op-' + idIndex), clock: () => 1 },
  })
  return { pluginDir, handler, host, records, cleanup() { rmSync(pluginDir, { recursive: true, force: true }) } }
}

function payloads(records) { return records.map(([, line]) => JSON.parse(line.slice(operationLogConstants.prefix.length))) }
function opRecords(fixture, operationId) { return payloads(fixture.records).filter(item => item.operationId === operationId) }
function assertOneTerminal(entries) { assert.equal(entries.filter(item => ['success', 'failure'].includes(item.stage)).length, 1) }
function flush() { return new Promise(resolve => setImmediate(resolve)) }

test('session create logs staged import/selection work without content or hash', async () => {
  const f = fixture({ ids: ['create'] })
  try {
    const result = await invoke(f.handler, { method: 'POST', url: API_V2 + '/sessions', body: { selectionFromSessionId: 'source', importContextRef: { path: 'card/run/import-context.json', expectedHash: 'secret-expected' } } })
    assert.equal(result.status, 201)
    await flush()
    const entries = opRecords(f, 'create')
    assert.ok(entries.some(item => item.stage === 'request.validated' && item.sessionId === 'source'))
    assert.ok(entries.some(item => item.stage === 'import.prepare.begin' && item.path === 'card/run/import-context.json'))
    assert.ok(entries.some(item => item.stage === 'host.session.create.begin'))
    assert.ok(entries.some(item => item.stage === 'host.session.created' && item.sessionId === 'new-session'))
    assert.ok(entries.some(item => item.stage === 'import.bind.committed' && item.sessionId === 'new-session'))
    assert.ok(entries.some(item => item.stage === 'selection.copy.committed' && item.sessionId === 'new-session'))
    assert.equal(entries.at(-1).stage, 'success')
    assertOneTerminal(entries)
    assert.doesNotMatch(f.records.map(([, line]) => line).join('\n'), /secret-hash|secret-expected|expectedHash|qaCount/)
  } finally { f.cleanup() }
})

test('session create bind failure retains HTTP failure and one terminal', async () => {
  const failure = Object.assign(new Error('private bind detail'), { code: 'HOST_IMPORT_BIND_FAILED', status: 503 })
  const f = fixture({ ids: ['create-fail'], overrides: { async bindImportContext() { throw failure } } })
  try {
    const result = await invoke(f.handler, { method: 'POST', url: API_V2 + '/sessions', body: { importContextRef: { path: 'card/run/import-context.json' } } })
    assert.equal(result.status, 503)
    await flush()
    assert.equal(opRecords(f, 'create-fail').at(-1).errorCode, 'HOST_IMPORT_BIND_FAILED')
    assertOneTerminal(opRecords(f, 'create-fail'))
  } finally { f.cleanup() }
})

test('branch logs source and child phases, and copy failure preserves stable code', async () => {
  const f = fixture({ ids: ['branch'] })
  try {
    const result = await invoke(f.handler, { method: 'POST', url: API_V2 + '/sessions/source/branch', body: { atEventId: 7 } })
    assert.equal(result.status, 201)
    await flush()
    const entries = opRecords(f, 'branch')
    assert.ok(entries.some(item => item.stage === 'request.validated' && item.sessionId === 'source'))
    assert.ok(entries.some(item => item.stage === 'host.forked' && item.sessionId === 'child-session'))
    assert.ok(entries.some(item => item.stage === 'selection.copy.committed' && item.sessionId === 'child-session'))
    assert.ok(entries.some(item => item.stage === 'import.lineage.copy.committed' && item.sessionId === 'child-session'))
    assert.equal(entries.at(-1).stage, 'success')
    assertOneTerminal(entries)
  } finally { f.cleanup() }
  const failed = fixture({ ids: ['branch-fail'], overrides: { async copySelection() { throw Object.assign(new Error('private selection detail'), { code: 'COPY_PRIVATE' }) } } })
  try {
    const failedResult = await invoke(failed.handler, { method: 'POST', url: API_V2 + '/sessions/source/branch', body: { atEventId: 7 } })
    assert.equal(failedResult.status, 502)
    assert.equal(failedResult.body.code, 'PLAY_BRANCH_COPY_FAILED')
    await flush()
    const failedEntries = opRecords(failed, 'branch-fail')
    assert.equal(failedEntries.at(-1).errorCode, 'PLAY_BRANCH_COPY_FAILED')
    assertOneTerminal(failedEntries)
    assert.doesNotMatch(failed.records.map(([, line]) => line).join('\n'), /private selection detail|cause|stack/)
  } finally { failed.cleanup() }
})

test('user-message logs host acceptance but never logs text', async () => {
  const failure = Object.assign(new Error('private prompt detail'), { code: 'HOST_PROMPT_FAILED', status: 502 })
  const f = fixture({ ids: ['message'], overrides: { async promptSession() { throw failure } } })
  try {
    const result = await invoke(f.handler, { method: 'POST', url: API_V2 + '/sessions/s/user-message', body: { text: 'VERY-SECRET-PROMPT' } })
    assert.equal(result.status, 502)
    await flush()
    const entries = opRecords(f, 'message')
    assert.ok(entries.some(item => item.stage === 'request.validated' && item.sessionId === 's'))
    assert.ok(entries.some(item => item.stage === 'host.prompt.begin' && item.sessionId === 's'))
    assert.equal(entries.at(-1).errorCode, 'HOST_PROMPT_FAILED')
    assertOneTerminal(entries)
    assert.doesNotMatch(f.records.map(([, line]) => line).join('\n'), /VERY-SECRET-PROMPT|prompt detail|body|content|text/)
  } finally { f.cleanup() }
})

test('import PUT/DELETE log mutations while GET stays quiet and lock failure is stable', async () => {
  const f = fixture({ ids: ['put', 'delete'] })
  try {
    assert.equal((await invoke(f.handler, { method: 'GET', url: API_V2 + '/sessions/s/import-context' })).status, 200)
    assert.equal(f.records.length, 0)
    assert.equal((await invoke(f.handler, { method: 'PUT', url: API_V2 + '/sessions/s/import-context', body: { reference: { path: 'card/run/import-context.json' } } })).status, 200)
    await flush()
    let entries = opRecords(f, 'put')
    assert.ok(entries.some(item => item.stage === 'authority.checked'))
    assert.ok(entries.some(item => item.stage === 'history.lock.checked'))
    assert.ok(entries.some(item => item.stage === 'prepare.begin' && item.path === 'card/run/import-context.json'))
    assert.ok(entries.some(item => item.stage === 'bind.committed' && item.sessionId === 's'))
    assertOneTerminal(entries)
    assert.equal((await invoke(f.handler, { method: 'DELETE', url: API_V2 + '/sessions/s/import-context' })).status, 200)
    await flush()
    entries = opRecords(f, 'delete')
    assert.ok(entries.some(item => item.stage === 'unbind.committed' && item.sessionId === 's'))
    assertOneTerminal(entries)
  } finally { f.cleanup() }
  const locked = fixture({ ids: ['locked'], overrides: { async history() { return { events: [{ type: 'user/message', seq: 1, data: { role: 'user' } }], hasMore: false } }, async deriveMessages() { return [{ role: 'user' }] } } })
  try {
    const result = await invoke(locked.handler, { method: 'PUT', url: API_V2 + '/sessions/s/import-context', body: { reference: { path: 'card/run/import-context.json' } } })
    assert.equal(result.status, 409)
    assert.equal(result.body.code, 'PLAY_IMPORT_CONTEXT_LOCKED')
    await flush()
    const lockedEntries = opRecords(locked, 'locked')
    assert.equal(lockedEntries.at(-1).errorCode, 'PLAY_IMPORT_CONTEXT_LOCKED')
    assertOneTerminal(lockedEntries)
  } finally { locked.cleanup() }
})

test('logger failures do not change session HTTP result', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-session-log-fail-'))
  try {
    const handler = createPlayApiHandler({ chromeStore: new ChromeStore(pluginDir), workspaceStore: { get: () => ({ rootPath: 'D:/rp', workspaceId: 'ws' }) }, host: { async createSession() { return { sessionId: 's' } } }, logger: { info() { throw new Error('logger down') }, warn() { throw new Error('logger down') } } })
    assert.equal((await invoke(handler, { method: 'POST', url: API_V2 + '/sessions', body: {} })).status, 201)
  } finally { rmSync(pluginDir, { recursive: true, force: true }) }
})
