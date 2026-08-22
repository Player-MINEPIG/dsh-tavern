import test from 'node:test'
import assert from 'node:assert/strict'
import { API_V2 } from '../packages/identity.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'

const catalog = { playthroughs: [] }
const timeline = { nodes: [] }
const playthrough = { path: 'character-1/playthrough-1/timeline.json' }
const revisionA = 'a'.repeat(64)
const revisionB = 'b'.repeat(64)
const revisionC = 'c'.repeat(64)

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

function managedResponse(path, content, revision) {
  return response({ ok: true, path, content: JSON.stringify(content), revision })
}

function filePath(url) {
  return new URL(url).searchParams.get('path')
}

test('managed GET caches revision and PUT sends the cached revision, then adopts the new one', async () => {
  const calls = []
  let currentRevision = revisionA
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if ((options.method ?? 'GET') === 'GET') {
        return managedResponse('catalog.json', catalog, currentRevision)
      }
      const body = JSON.parse(options.body)
      assert.equal(body.expectedRevision, currentRevision)
      currentRevision = revisionB
      return response({ ok: true, path: 'catalog.json', revision: currentRevision })
    },
  })

  assert.deepEqual(await client.getCatalog(), catalog)
  await client.putCatalog(catalog)
  await client.putCatalog(catalog)
  const puts = calls.filter(call => call.options.method === 'PUT').map(call => JSON.parse(call.options.body).expectedRevision)
  assert.deepEqual(puts, [revisionA, revisionB])
})

test('managed revision responses are required and must be lowercase SHA-256 hex', async () => {
  for (const revision of [undefined, 'A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)]) {
    const client = createLivePlayClient({
      fetchImpl: async () => managedResponse('catalog.json', catalog, revision),
    })
    await assert.rejects(client.getCatalog(), error => {
      assert.equal(error.name, 'TypeError')
      assert.match(error.message, /revision/)
      return true
    })
  }
})

test('catalog 404 is cached as create-only and updateCatalog can initialize it', async () => {
  const calls = []
  let missing = true
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if ((options.method ?? 'GET') === 'GET' && missing) {
        return response({ ok: false, code: 'PLAY_PATH_NOT_FOUND', error: 'missing' }, { ok: false, status: 404 })
      }
      if ((options.method ?? 'GET') === 'GET') return managedResponse('catalog.json', catalog, revisionA)
      const body = JSON.parse(options.body)
      assert.equal(body.expectedRevision, null)
      missing = false
      return response({ ok: true, path: 'catalog.json', revision: revisionB })
    },
  })

  await assert.rejects(client.getCatalog(), error => error.code === 'PLAY_PATH_NOT_FOUND')
  const saved = await client.updateCatalog(current => ({
    ...current,
    playthroughs: [{ id: 'created', path: 'character-1/created/timeline.json' }],
  }))
  assert.equal(saved.playthroughs[0].id, 'created')
  assert.equal(calls.filter(call => call.options.method === 'PUT').length, 1)
})

test('409 invalidates stale cache and direct next PUT does not reuse it', async () => {
  const expected = []
  let putCount = 0
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      if ((options.method ?? 'GET') === 'GET') return managedResponse('catalog.json', catalog, revisionA)
      const body = JSON.parse(options.body)
      expected.push(body.expectedRevision)
      putCount += 1
      if (putCount === 1) {
        return response({ ok: false, code: 'PLAY_FILE_REVISION_CONFLICT', error: 'stale' }, { ok: false, status: 409 })
      }
      return response({ ok: true, path: 'catalog.json', revision: revisionC })
    },
  })

  await client.getCatalog()
  await assert.rejects(client.putCatalog(catalog), error => error.code === 'PLAY_FILE_REVISION_CONFLICT')
  await client.putCatalog(catalog)
  assert.deepEqual(expected, [revisionA, null])
})

test('updateTimeline rereads and reruns the mutator after a revision conflict', async () => {
  let currentRevision = revisionA
  let conflict = true
  const calls = []
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if ((options.method ?? 'GET') === 'GET') return managedResponse(playthrough.path, timeline, currentRevision)
      const body = JSON.parse(options.body)
      if (conflict) {
        conflict = false
        currentRevision = revisionB
        return response({ ok: false, code: 'PLAY_FILE_REVISION_CONFLICT', error: 'stale' }, { ok: false, status: 409 })
      }
      assert.equal(body.expectedRevision, revisionB)
      assert.equal(JSON.parse(body.content).nodes[0].id, 'second-run')
      return response({ ok: true, path: playthrough.path, revision: revisionC })
    },
  })
  const seen = []
  const saved = await client.updateTimeline(playthrough, current => {
    seen.push(current)
    return { nodes: [{ id: 'second-run', kind: 'qa', adoptedVariantId: 'v', variants: [{ id: 'v', sessionId: 's', startEventId: 0, endEventId: 0 }] }] }
  })
  assert.equal(saved.nodes[0].id, 'second-run')
  assert.equal(seen.length, 2)
  assert.equal(calls.filter(call => (call.options.method ?? 'GET') === 'GET').length, 2)
})

test('update primitives stop at configured retry limit and do not retry non-conflicts', async () => {
  let timelineGets = 0
  let timelinePuts = 0
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      if ((options.method ?? 'GET') === 'GET') {
        timelineGets += 1
        return managedResponse(playthrough.path, timeline, revisionA)
      }
      timelinePuts += 1
      return response({ ok: false, code: 'PLAY_FILE_REVISION_CONFLICT', error: 'stale' }, { ok: false, status: 409 })
    },
  })
  let calls = 0
  await assert.rejects(client.updateTimeline(playthrough, value => {
    calls += 1
    return value
  }, { maxRetries: 1 }), error => error.code === 'PLAY_FILE_REVISION_CONFLICT')
  assert.equal(calls, 2)
  assert.equal(timelineGets, 2)
  assert.equal(timelinePuts, 2)

  let nonConflictGets = 0
  let nonConflictPuts = 0
  const nonConflict = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      if ((options.method ?? 'GET') === 'GET') {
        nonConflictGets += 1
        return managedResponse(playthrough.path, timeline, revisionA)
      }
      nonConflictPuts += 1
      return response({ ok: false, code: 'PLAY_FILE_WRITE_FAILED', error: 'disk' }, { ok: false, status: 500 })
    },
  })
  let nonConflictMutations = 0
  await assert.rejects(nonConflict.updateTimeline(playthrough, value => {
    nonConflictMutations += 1
    return value
  }), error => error.code === 'PLAY_FILE_WRITE_FAILED')
  assert.equal(nonConflictMutations, 1)
  assert.equal(nonConflictGets, 1)
  assert.equal(nonConflictPuts, 1)
})

test('ordinary files remain revision-agnostic but preserve optional revision fields', async () => {
  const calls = []
  const client = createLivePlayClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if ((options.method ?? 'GET') === 'GET') return response({ ok: true, path: 'regex.json', content: '{}', revision: revisionA })
      return response({ ok: true, path: 'regex.json', revision: revisionB })
    },
  })
  assert.deepEqual(await client.getFile('regex.json'), { path: 'regex.json', content: '{}', revision: revisionA })
  await client.putFile('regex.json', '{}')
  await client.putFile('regex.json', '{}', { expectedRevision: revisionA })
  assert.deepEqual(JSON.parse(calls[1].options.body), { content: '{}' })
  assert.deepEqual(JSON.parse(calls[2].options.body), { content: '{}', expectedRevision: revisionA })
})