import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayMembershipService,
  PlayWorkspaceStore,
  createPlayApiHandler,
  sessionIdsInTimeline,
  validatePlayDocument,
} from '../packages/play/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = url
    const res = {
      statusCode: 200,
      setHeader() {},
      end(payload = '') {
        resolve({ status: res.statusCode, body: payload === '' ? null : JSON.parse(String(payload)) })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function variant(id, sessionId) {
  return { id, sessionId, startEventId: 1, endEventId: 2 }
}

/** One playthrough with two adopted sessions, plus a durable file under it. */
function sampleTimeline() {
  return {
    nodes: [
      { id: 'n-root', kind: 'qa', displayOverride: null, parentVariantId: null, adoptedVariantId: 'v-root', variants: [variant('v-root', 'session-root')] },
      { id: 'n-swipe', kind: 'qa', displayOverride: null, parentVariantId: 'v-root', adoptedVariantId: 'v-target', variants: [variant('v-target', 'session-target')] },
    ],
  }
}

/** Every file under `dir`, keyed by POSIX relative path → content (for byte-equality checks). */
function snapshot(dir, base = dir, out = {}) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) snapshot(full, base, out)
    else out[full.slice(base.length + 1).split('\\').join('/')] = readFileSync(full, 'utf8')
  }
  return out
}

async function withWorkspace(run) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-root-'))
  try {
    const store = new PlayWorkspaceStore(pluginDir)
    await store.bindRoot(playRoot)
    store.createDir('card/pt')
    store.writeFile('card/pt/timeline.json', JSON.stringify(sampleTimeline()), {
      expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument,
    })
    store.writeFile('card/pt/archive/floors/0001.json', '{"_floor":1,"mes":"floor"}\n', { validate: validatePlayDocument })
    store.writeFile('catalog.json', JSON.stringify({
      playthroughs: [{
        id: 'pt',
        path: 'card/pt/timeline.json',
        title: '1周目',
        ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'session-root', playthroughNumber: 1 } },
      }],
    }), { expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument })
    await run({ store, service: new PlayMembershipService(store), playRoot })
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
}

test('removePlaythrough parks the tree, drops the catalog entry and leaves a tombstone', async () => {
  await withWorkspace(async ({ store, service, playRoot }) => {
    const before = snapshot(join(playRoot, 'card', 'pt'))
    assert.ok(Object.keys(before).length >= 2, 'fixture must have files to park')

    const result = service.removePlaythrough('pt', { now: () => '2026-09-14T00:00:00.000Z' })

    assert.equal(result.ok, true)
    assert.equal(result.removed, true)
    assert.equal(result.characterId, 'card')
    assert.equal(result.title, '1周目')
    assert.deepEqual(result.sessionIds.sort(), ['session-root', 'session-target'])

    // The original directory is gone, and the backup is byte-identical to it.
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), false)
    assert.equal(result.backupDir, '.dtavern-trash/2026-09-14T00-00-00Z-pt')
    assert.deepEqual(snapshot(join(playRoot, '.dtavern-trash', '2026-09-14T00-00-00Z-pt')), before)

    // The catalog entry is dropped and a tombstone records what disappeared.
    const catalog = JSON.parse(readFileSync(join(playRoot, 'catalog.json'), 'utf8'))
    assert.deepEqual(catalog.playthroughs, [])
    const tombstones = catalog.ext.pmpDshTavern.deletedPlaythroughs
    assert.equal(tombstones.length, 1)
    assert.deepEqual(Object.keys(tombstones[0]).sort(), ['backupDir', 'characterId', 'deletedAt', 'id', 'rootSessionId', 'sessionIds', 'title'])
    assert.equal(tombstones[0].id, 'pt')
    assert.equal(tombstones[0].rootSessionId, 'session-root')
    assert.equal(tombstones[0].deletedAt, '2026-09-14T00:00:00.000Z')

    // A second read of the same catalog still validates: the tombstone lives in ext.
    assert.doesNotThrow(() => validatePlayDocument('catalog.json', JSON.stringify(catalog)))
  })
})

test('removePlaythrough with backup:false deletes outright and records no backupDir', async () => {
  await withWorkspace(async ({ service, playRoot }) => {
    const result = service.removePlaythrough('pt', { backup: false })

    assert.equal(result.backupDir, null)
    assert.ok(result.removedFileCount >= 2, `expected files removed, got ${result.removedFileCount}`)
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), false)
    assert.equal(existsSync(join(playRoot, '.dtavern-trash')), false)
    const catalog = JSON.parse(readFileSync(join(playRoot, 'catalog.json'), 'utf8'))
    assert.equal(catalog.ext.pmpDshTavern.deletedPlaythroughs[0].backupDir, undefined)
  })
})

test('removePlaythrough rejects an unknown id and leaves the catalog untouched', async () => {
  await withWorkspace(async ({ service, playRoot }) => {
    const before = readFileSync(join(playRoot, 'catalog.json'), 'utf8')
    assert.throws(
      () => service.removePlaythrough('missing'),
      (error) => error.status === 404 && error.code === 'PLAYTHROUGH_NOT_FOUND',
    )
    assert.equal(readFileSync(join(playRoot, 'catalog.json'), 'utf8'), before)
    assert.equal(existsSync(join(playRoot, '.dtavern-trash')), false)
  })
})

test('removePlaythrough still drops a catalog entry whose directory is already gone', async () => {
  await withWorkspace(async ({ store, service, playRoot }) => {
    // Half-removed state: files deleted out from under the catalog.
    store.removeTree('card/pt')

    const result = service.removePlaythrough('pt')

    assert.equal(result.removed, true)
    assert.equal(result.directoryExisted, false)
    assert.equal(result.backupDir, null)
    assert.deepEqual(result.sessionIds.sort(), ['session-root'])
    const catalog = JSON.parse(readFileSync(join(playRoot, 'catalog.json'), 'utf8'))
    assert.deepEqual(catalog.playthroughs, [])
    assert.equal(catalog.ext.pmpDshTavern.deletedPlaythroughs.length, 1)
  })
})

test('removePlaythrough clears an activeTimelinePath that pointed into the deleted tree', async () => {
  await withWorkspace(async ({ store, service }) => {
    store.setActiveTimelinePath('card/pt/timeline.json')

    service.removePlaythrough('pt')

    assert.equal(store.get().activeTimelinePath, null)
  })
})

test('removePlaythrough keeps one tombstone per id and caps the trail', async () => {
  await withWorkspace(async ({ service }) => {
    service.removePlaythrough('pt', { now: () => '2026-09-14T00:00:00.000Z' })
    // Re-adding the same id cannot happen through the service (404), so write one back
    // to prove the tombstone list de-duplicates instead of growing.
    const service2 = new PlayMembershipService(service.workspaceStore)
    const catalog = service2.readCatalog().catalog
    catalog.playthroughs.push({
      id: 'pt', path: 'card/pt/timeline.json', title: '1周目',
      ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'session-root' } },
    })
    service2.workspaceStore.writeFile('catalog.json', JSON.stringify(catalog), {
      expectedRevision: service2.readCatalog().file.revision,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    service2.workspaceStore.createDir('card/pt')
    service2.removePlaythrough('pt', { backup: false, now: () => '2026-09-14T01:00:00.000Z' })

    const tombstones = service2.readCatalog().catalog.ext.pmpDshTavern.deletedPlaythroughs
    assert.equal(tombstones.length, 1, 'the same id must not accumulate tombstones')
    assert.equal(tombstones[0].deletedAt, '2026-09-14T01:00:00.000Z')
  })
})

test('sessionIdsInTimeline collects every variant session id', () => {
  assert.deepEqual([...sessionIdsInTimeline(sampleTimeline())].sort(), ['session-root', 'session-target'])
})

test('v2 playthrough delete route delegates one logged mutation and reports it as a 200', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-api-'))
  try {
    const calls = []
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      removePlaythrough(playthroughId, { operation }) {
        calls.push({ playthroughId, operation: operation.operation })
        return { ok: true, playthroughId, removed: true, backupDir: '.dtavern-trash/x-pt-a', sessionIds: [] }
      },
    })
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt-a` })
    assert.equal(response.status, 200)
    assert.equal(response.body.removed, true)
    assert.deepEqual(calls, [{ playthroughId: 'pt-a', operation: 'playthrough.delete' }])
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
  }
})

test('v2 playthrough delete route is absent when the host wires no remover', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-api-off-'))
  try {
    const handler = createPlayApiHandler({ chromeStore: new ChromeStore(pluginDir) })
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt-a` })
    assert.equal(response.status, 404)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
  }
})

test('workspace store move refuses an existing destination and refuses to escape the root', async () => {
  await withWorkspace(async ({ store, playRoot }) => {
    mkdirSync(join(playRoot, 'card', 'other'), { recursive: true })
    assert.throws(
      () => store.move('card/pt', 'card/other'),
      (error) => error.status === 409 && error.code === 'PLAY_PATH_CONFLICT',
    )
    assert.throws(
      () => store.move('card/pt', '../escape'),
      (error) => error.status === 400 && error.code === 'PLAY_PATH_ESCAPE',
    )
    // The failed attempts left the tree alone.
    assert.equal(existsSync(join(playRoot, 'card', 'pt', 'timeline.json')), true)
  })
})

test('workspace store removeTree reports every removed entry and tolerates a missing target', async () => {
  await withWorkspace(async ({ store, playRoot }) => {
    const result = store.removeTree('card/pt')
    assert.equal(result.ok, true)
    assert.ok(result.removedFiles.includes('card/pt/timeline.json'))
    assert.ok(result.removedDirectories.includes('card/pt'))
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), false)
    assert.throws(
      () => store.removeTree('card/pt'),
      (error) => error.status === 404 && error.code === 'PLAY_PATH_NOT_FOUND',
    )
  })
})

test('a parked backup can be restored by hand: moving it back rebuilds the playthrough directory', async () => {
  await withWorkspace(async ({ store, service, playRoot }) => {
    const before = snapshot(join(playRoot, 'card', 'pt'))
    const result = service.removePlaythrough('pt')
    store.move(result.backupDir, 'card/pt')
    assert.deepEqual(snapshot(join(playRoot, 'card', 'pt')), before)
  })
})
