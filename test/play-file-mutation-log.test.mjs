import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import { ChromeStore, PlayWorkspaceStore, createPlayApiHandler } from '../packages/tavern-loader/src/index.js'
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
function fixture({ host, logger, ids } = {}) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-op-plugin-'))
  const root = mkdtempSync(join(tmpdir(), 'dsh-tavern-op-root-'))
  const calls = []
  const sink = logger ?? {
    info(line) { calls.push(['info', line]) },
    warn(line) { calls.push(['warn', line]) },
  }
  let index = 0
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(pluginDir),
    workspaceStore: new PlayWorkspaceStore(pluginDir, { host }),
    logger: sink,
    operationOptions: { idFactory: () => ids?.[index++] ?? `op-${index}`, clock: () => 1 },
  })
  return { pluginDir, root, handler, calls }
}
function records(calls) { return calls.map(([, line]) => JSON.parse(line.slice(operationLogConstants.prefix.length))) }
function cleanup(f) { rmSync(f.pluginDir, { recursive: true, force: true }); rmSync(f.root, { recursive: true, force: true }) }

test('workspace mutations emit safe staged operations while reads stay quiet', async () => {
  const f = fixture({ ids: ['bind', 'dir', 'file'] })
  try {
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: f.root } })).status, 200)
    assert.equal((await invoke(f.handler, { method: 'POST', url: `${API_V2}/workspace/dirs`, body: { path: 'card/run' } })).status, 200)
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace/files?path=card/run/note.txt`, body: { content: 'SECRET-BODY' } })).status, 200)
    await new Promise(resolve => setImmediate(resolve))
    const beforeRead = f.calls.length
    assert.equal((await invoke(f.handler, { url: `${API_V2}/workspace/files?path=card/run/note.txt` })).status, 200)
    assert.equal((await invoke(f.handler, { url: `${API_V2}/workspace/files?list=` })).status, 200)
    assert.equal(f.calls.length, beforeRead)
    const all = records(f.calls)
    assert.deepEqual([...new Set(all.map(item => item.operation))], ['workspace.bind', 'workspace.dir.create', 'workspace.file.write'])
    for (const id of ['bind', 'dir', 'file']) {
      const entries = all.filter(item => item.operationId === id)
      assert.equal(entries.at(-1).stage, 'success')
      assert.ok(entries.some(item => item.stage === 'start'))
      assert.ok(entries.some(item => item.stage === 'request.validated'))
      assert.ok(entries.some(item => item.stage === 'mutation.begin'))
      assert.ok(entries.some(item => item.stage === 'mutation.committed'))
    }
    const joined = f.calls.map(([, line]) => line).join('\n')
    assert.doesNotMatch(joined, /SECRET-BODY|expectedRevision|hash|stack|cause/)
    for (const [, line] of f.calls) assert.doesNotMatch(line, /\r|\n/)
  } finally { cleanup(f) }
})

test('mutation failure keeps HTTP response and records one failure terminal', async () => {
  const f = fixture({ ids: ['bind-fail'] })
  try {
    const response = await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: join(f.root, 'missing') } })
    assert.equal(response.status, 400)
    const entries = records(f.calls)
    assert.equal(entries.at(-1).stage, 'failure')
    assert.equal(entries.at(-1).errorCode, 'PLAY_WORKSPACE_INVALID')
    assert.equal(entries.at(-1).status, 400)
    assert.equal(entries.filter(item => ['success', 'failure'].includes(item.stage)).length, 1)
  } finally { cleanup(f) }
})

test('logger failures are fail-soft and operations get distinct ids', async () => {
  const f = fixture({ logger: { info() { throw new Error('logger down') }, warn() { throw new Error('logger down') } }, ids: ['a', 'b'] })
  try {
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: f.root } })).status, 200)
    assert.equal((await invoke(f.handler, { method: 'POST', url: `${API_V2}/workspace/dirs`, body: { path: 'x' } })).status, 200)
  } finally { cleanup(f) }
})


test('managed document failures are logged without content or revision', async () => {
  const f = fixture({ ids: ['bind', 'timeline', 'catalog-bad', 'catalog', 'catalog-conflict'] })
  try {
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: f.root } })).status, 200)
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace/files?path=run/timeline.json`, body: { content: JSON.stringify({ nodes: [] }), expectedRevision: null } })).status, 200)
    assert.equal((await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace/files?path=catalog.json`, body: { content: 'BAD-CATALOG', expectedRevision: null } })).status, 400)
    const catalog = await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace/files?path=catalog.json`, body: { content: JSON.stringify({ playthroughs: [] }), expectedRevision: null } })
    assert.equal(catalog.status, 200)
    const conflict = await invoke(f.handler, { method: 'PUT', url: `${API_V2}/workspace/files?path=catalog.json`, body: { content: JSON.stringify({ playthroughs: [] }), expectedRevision: '0'.repeat(64) } })
    assert.equal(conflict.status, 409)
    const failed = records(f.calls).filter(item => item.stage === 'failure')
    assert.ok(failed.some(item => item.errorCode === 'PLAY_CATALOG_INVALID' && item.status === 400))
    assert.ok(failed.some(item => item.errorCode === 'PLAY_FILE_REVISION_CONFLICT' && item.status === 409))
    const joined = f.calls.map(([, line]) => line).join('\n')
    assert.doesNotMatch(joined, /BAD-CATALOG|0{64}/)
  } finally { cleanup(f) }
})



