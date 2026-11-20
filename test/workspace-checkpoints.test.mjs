import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import test from 'node:test'
import { API_V2 } from '../packages/identity.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'

test('an independent caller checkpoints a native session and writes a bookmark without changing the playthrough', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-checkpoint-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const root = join(directory, 'rp')
  mkdirSync(root)
  const storage = join(directory, 'storage')
  const row = { id: 'story', path: 'story/timeline.json' }
  let creations = 0
  const host = { createSession: async () => ({ sessionId: 'bookmark-' + ++creations }) }
  function connect() {
    const store = new PlayWorkspaceStore(storage)
    const api = createPlayApiHandler({ chromeStore: {}, workspaceStore: store, host })
    const fetchImpl = async (url, options) => {
      const req = Readable.from(options.body ? [Buffer.from(options.body)] : [])
      Object.assign(req, { method: options.method, url })
      const res = { setHeader() {}, end(body) { this.body = body } }
      await api(req, res)
      return new Response(res.body, { status: res.statusCode })
    }
    return { store, fetchImpl, client: createLivePlayClient({fetchImpl}) }
  }
  const first = connect()
  await first.store.bindRoot(root)
  const scope = JSON.stringify([first.store.get().workspaceId, root])
  const timeline = { nodes: [] }
  await first.client.putFile('catalog.json', JSON.stringify({ playthroughs: [row] }), { expectedRevision: null })
  await first.client.putFile(row.path, JSON.stringify(timeline), { expectedRevision: null })
  const source = await first.client.getFile(row.path)
  const intent = { owner: 'example.bookmark', key: 'bookmark-key', data: { file: 'bookmark.json' },
    expectedWorkspaceScope: scope, expectedRevision: null, expectedTimelineRevision: source.revision }
  await assert.rejects(first.client.putCheckpoint(row, { ...intent,
    expectedBinding: { path: row.path, rootSessionId: 'stale-session', characterId: null } }), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  const acquired = await first.client.putCheckpoint(row, intent)
  const fence = { checkpointId: row.id, checkpointKey: intent.key, expectedWorkspaceScope: scope }
  const args = { ...fence, operationKey: 'create-bookmark-session' }
  const created = await first.client.postSession(null, undefined, undefined, args)

  const { client, fetchImpl } = connect()
  assert.deepEqual(await client.getCheckpoint(row, scope), acquired)
  assert.deepEqual((await client.getSessionReceipt(args.operationKey, scope)).result, created)
  assert.deepEqual(await client.postSession(null, undefined, undefined, args), created)
  assert.equal(creations, 1)
  await assert.rejects(client.putCheckpoint(row, { ...intent, key: 'other' }), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  await assert.rejects(client.putCheckpoint(row, { ...intent, expectedRevision: acquired.revision + 1 }), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  await assert.rejects(client.putFile('catalog.json', '{"playthroughs":[]}', {
    expectedRevision: (await client.getFile('catalog.json')).revision }), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  await client.putFile(intent.data.file, JSON.stringify({ sessionId: created.sessionId }), fence)
  const released = await client.putCheckpoint(row, { ...intent, expectedRevision: acquired.revision, released: true })
  assert.deepEqual(JSON.parse((await client.getFile(intent.data.file)).content), { sessionId: created.sessionId })
  assert.equal((await client.getFile(row.path)).revision, source.revision)
  await client.putCheckpoint(row, { ...intent, key: 'second-key' })
  assert.deepEqual(await client.getCheckpoint(row, scope, intent.key), released)
  await assert.rejects(client.putFile('late.json', '{}', fence), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  await assert.rejects(client.postSession(null, undefined, undefined, { ...args, operationKey: 'late-create' }), { code: 'PLAY_CHECKPOINT_CONFLICT' })
  assert.equal(creations, 1)
  for (const path of ['rollback', 'fork', 'generation']) {
    const response = await fetchImpl(API_V2 + '/playthroughs/story/' + path, { method: 'POST', body: '{}' })
    assert.equal(response.status, 404)
  }
})
