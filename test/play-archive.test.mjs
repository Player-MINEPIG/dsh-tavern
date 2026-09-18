import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { ChromeStore, PlayWorkspaceStore, createPlayApiHandler, parseCatalogJson, validatePlayDocument } from '../packages/play/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'
import { normalizeCatalog } from '../packages/client/src/play/schema.js'
import { setPlaythroughArchived } from '../packages/client/src/play/archive.js'
import { isPlaythroughArchived } from '../packages/play/src/playthrough-state.js'
import { projectPlaySidebar } from '../packages/client/src/play/sidebar-model.js'
import { currentWorkspaceIssues } from '../packages/client/src/play/diagnostics-state.js'
import { playthroughIsReusable } from '../packages/client/src/play/create.js'

const at = '2026-09-19T00:00:00.000Z'
const now = () => new Date(at)
const playthrough = {
  id: 'pt', path: 'card/pt/timeline.json', title: 'A custom title',
  ext: { thirdParty: { keep: true }, pmpDshTavern: { characterId: 'card', characterName: 'Alice', rootSessionId: 'root', playthroughNumber: 4 } },
}
const timeline = {
  nodes: [{ id: 'qa', kind: 'qa', displayOverride: 'Edited display', adoptedVariantId: 'v1', variants: [
    { id: 'v1', sessionId: 'root', startEventId: 1, endEventId: 3 },
    { id: 'v2', sessionId: 'swipe', startEventId: 1, endEventId: 3 },
  ] }],
  head: { sessionId: 'continuation', nodeId: 'qa', variantId: 'v1' },
  ext: { pmpDshTavern: { branchHeads: [{ branchVariantId: 'v2', sessionId: 'saved-branch', nodeId: 'qa', variantId: 'v2' }] } },
}

function invoke(handler, url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(options.body === undefined ? [] : [Buffer.from(options.body)])
    req.url = url
    req.method = options.method ?? 'GET'
    const res = {
      statusCode: 200, setHeader() {},
      end(payload) {
        const body = JSON.parse(String(payload))
        resolve({ ok: res.statusCode < 400, status: res.statusCode, json: async () => body })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('archive and restore cross the live CAS/API boundary and preserve files, history and selections across reload', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tavern-archive-'))
  try {
    const store = new PlayWorkspaceStore(join(root, 'plugin'))
    const workspace = join(root, 'rp')
    mkdirSync(workspace)
    await store.bindRoot(workspace)
    const write = (path, value) => store.writeFile(path, JSON.stringify(value), {
      expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument,
    })
    write(playthrough.path, timeline)
    write('catalog.json', { playthroughs: [playthrough], ext: { thirdParty: 'keep' } })
    const timelineBytes = readFileSync(join(workspace, playthrough.path))
    const selections = new SessionSelectionStore(join(root, 'plugin'))
    selections.set('root', { characterCardId: 'card', presetId: 'preset', userId: 'user', worldBookIds: ['lore'], rp: { active: true } })
    const selectionBytes = readFileSync(selections.statePath)
    const historyPath = join(root, 'dsh-history.jsonl')
    writeFileSync(historyPath, '{"history":"unchanged"}\n')
    const historyBytes = readFileSync(historyPath)
    const handler = createPlayApiHandler({ chromeStore: new ChromeStore(join(root, 'plugin')), workspaceStore: store })
    const calls = []
    let concurrent = false
    const client = createLivePlayClient({ fetchImpl: async (url, options) => {
      const path = new URL(url, 'http://localhost').searchParams.get('path')
      calls.push([options.method, path])
      // A second tab renames the same row and appends another before our first PUT.
      if (options.method === 'PUT' && !concurrent) {
        concurrent = true
        const file = store.readFile('catalog.json')
        const catalog = JSON.parse(file.content)
        catalog.playthroughs[0].title = 'Concurrent rename'
        catalog.playthroughs.push({ id: 'other', path: 'card/other/timeline.json' })
        store.writeFile('catalog.json', JSON.stringify(catalog), { expectedRevision: file.revision, expectedRevisionPresent: true, validate: validatePlayDocument })
      }
      return invoke(handler, url, options)
    } })
    const archived = await setPlaythroughArchived(client, playthrough, true, { now })
    assert.equal(archived.title, 'Concurrent rename')
    assert.equal(archived.ext.pmpDshTavern.archivedAt, at)
    assert.deepEqual(archived.ext.thirdParty, playthrough.ext.thirdParty)
    assert.equal(calls.filter(([method]) => method === 'PUT').length, 2)
    assert.ok(calls.every(([method, path]) => ['GET', 'PUT'].includes(method) && path === 'catalog.json'))

    const reloaded = new PlayWorkspaceStore(join(root, 'plugin'))
    const persisted = parseCatalogJson(reloaded.readFile('catalog.json').content)
    assert.equal(persisted.playthroughs.length, 2)
    assert.equal(isPlaythroughArchived(persisted.playthroughs[0]), true)
    assert.deepEqual(readFileSync(join(workspace, playthrough.path)), timelineBytes)
    assert.deepEqual(readFileSync(selections.statePath), selectionBytes)
    assert.deepEqual(readFileSync(historyPath), historyBytes)

    // An old menu's repeated archive must not reset the original timestamp.
    await setPlaythroughArchived(client, playthrough, true, { now: () => new Date('2026-09-20T00:00:00.000Z') })
    assert.equal((await client.getCatalog()).playthroughs[0].ext.pmpDshTavern.archivedAt, at)
    const restored = await setPlaythroughArchived(client, archived, false)
    assert.deepEqual(restored, { ...playthrough, title: 'Concurrent rename' })
    assert.deepEqual(readFileSync(join(workspace, playthrough.path)), timelineBytes)
    assert.deepEqual(readFileSync(selections.statePath), selectionBytes)
    assert.deepEqual(readFileSync(historyPath), historyBytes)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('sidebar archives whole membership including pending branch heads without hiding another active playthrough', () => {
  const archived = { ...playthrough, ext: { ...playthrough.ext, pmpDshTavern: { ...playthrough.ext.pmpDshTavern, archivedAt: at } } }
  const shared = { id: 'shared', path: 'card/shared/timeline.json', ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'root' } } }
  const ids = ['root', 'swipe', 'continuation', 'saved-branch', 'loose']
  const args = {
    workspace: { selected: true, workspaceId: 'rp' }, workspaceItems: [{ workspaceId: 'rp', sessionIds: ids }],
    characters: [{ id: 'card', name: 'Alice' }],
    catalog: { playthroughs: [archived, shared] }, timelines: { [archived.path]: timeline, [shared.path]: { nodes: [] } },
    sessions: Object.fromEntries(ids.map(id => [id, { id, title: id }])),
    sessionCharacters: Object.fromEntries(ids.map(id => [id, 'card'])),
  }
  const projected = projectPlaySidebar(args)
  assert.deepEqual(projected.characters[0].playthroughs.map(item => item.id), ['shared'])
  assert.deepEqual(projected.characters[0].unassigned.map(item => item.id), ['loose'])
  assert.deepEqual(projected.otherSessions, [])
  assert.deepEqual(new Set(projected.archivedPlaythroughs[0].sessionIds), new Set(ids.slice(0, 4)))
  const missingCard = projectPlaySidebar({ ...args, characters: [], catalog: { playthroughs: [archived] }, sessionCharacters: {} })
  assert.deepEqual(missingCard.missingCharacters, [])
  assert.equal(missingCard.archivedPlaythroughs[0].characterName, 'Alice')
  const restored = projectPlaySidebar({ ...args, catalog: { playthroughs: [playthrough, shared] } })
  assert.equal(restored.archivedPlaythroughs.length, 0)
  assert.deepEqual(restored.characters[0].playthroughs.map(item => item.id), ['pt', 'shared'])
})

test('archived empty playthroughs cannot be reused and do not produce everyday missing-session diagnostics', async () => {
  const archived = { ...playthrough, ext: { ...playthrough.ext, pmpDshTavern: { ...playthrough.ext.pmpDshTavern, archivedAt: at } } }
  assert.equal(await playthroughIsReusable({}, archived), false)
  const resources = {
    workspace: { selected: true }, catalog: { playthroughs: [archived] }, characters: [],
    diagnostics: [{ playthroughId: archived.id, code: 'PLAY_PATH_NOT_FOUND', path: archived.path }],
  }
  assert.deepEqual(currentWorkspaceIssues(resources, { sessionsPhase: 'ready', workspacesPhase: 'ready' }), [])
  resources.catalog.playthroughs[0] = playthrough
  assert.equal(currentWorkspaceIssues(resources).length, 1)
})

test('archive metadata is validated on both sides and old catalogs remain valid', () => {
  for (const archivedAt of [null, true, '', 'yesterday', '2026-02-30T00:00:00.000Z', '2026-09-19']) {
    const catalog = { playthroughs: [{ ...playthrough, ext: { pmpDshTavern: { archivedAt } } }] }
    assert.throws(() => parseCatalogJson(JSON.stringify(catalog)), error => error.code === 'PLAY_CATALOG_INVALID')
    assert.throws(() => normalizeCatalog(catalog), /archivedAt/)
  }
  const catalog = { playthroughs: [playthrough] }
  assert.deepEqual(normalizeCatalog(catalog), parseCatalogJson(JSON.stringify(catalog)))
})

test('stale archive and restore actions cannot recreate a missing or repathed playthrough', async () => {
  for (const archived of [true, false]) {
    for (const playthroughs of [[], [{ ...playthrough, path: 'moved/timeline.json' }]]) {
      const client = {
        async getCatalog() { return { playthroughs } },
        async putCatalog() { assert.fail('a stale row must not be written') },
      }
      await assert.rejects(setPlaythroughArchived(client, playthrough, archived), /play.archive.missing/)
    }
  }
})
