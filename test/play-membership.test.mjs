import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayMembershipService,
  PlayWorkspaceStore,
  createPlayApiHandler,
  detachSessionFromTimeline,
  parseCatalogJson,
  parseTimelineJson,
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

function sampleTimeline() {
  return {
    nodes: [
      { id: 'n-root', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: null, adoptedVariantId: 'v-root', variants: [variant('v-root', 'root')] },
      { id: 'n-swipe', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-root', adoptedVariantId: 'v-target', variants: [variant('v-target', 'target'), variant('v-sibling', 'sibling')] },
      { id: 'n-child', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-target', adoptedVariantId: 'v-child', variants: [variant('v-child', 'child')] },
      { id: 'n-kept', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-sibling', adoptedVariantId: 'v-kept', variants: [variant('v-kept', 'kept')] },
    ],
    head: { sessionId: 'child', nodeId: 'n-child', variantId: 'v-child' },
    ext: {
      pmpDshTavern: {
        importContextPath: 'card/pt/import-context.json',
        branchHeads: [
          { branchVariantId: 'v-target', sessionId: 'child', nodeId: 'n-child', variantId: 'v-child' },
          { branchVariantId: 'v-sibling', sessionId: 'kept', nodeId: 'n-kept', variantId: 'v-kept' },
        ],
      },
    },
  }
}

test('detachSessionFromTimeline removes the target branch and descendants but preserves siblings', () => {
  const result = detachSessionFromTimeline(sampleTimeline(), 'target')
  assert.equal(result.changed, true)
  assert.deepEqual(new Set(result.detachedSessionIds), new Set(['target', 'child']))
  assert.deepEqual(result.timeline.nodes.map(node => node.id), ['n-root', 'n-swipe', 'n-kept'])
  assert.deepEqual(result.timeline.nodes[1].variants.map(item => item.id), ['v-sibling'])
  assert.equal(result.timeline.nodes[1].adoptedVariantId, 'v-sibling')
  assert.equal(result.timeline.head.variantId, 'v-kept')
  assert.deepEqual(result.timeline.ext.pmpDshTavern.branchHeads, [
    { branchVariantId: 'v-sibling', sessionId: 'kept', nodeId: 'n-kept', variantId: 'v-kept' },
  ])
})

test('detachSessionFromTimeline follows implicit legacy adopted parents', () => {
  const timeline = {
    nodes: [
      { id: 'n1', kind: 'qa', adoptedVariantId: 'v1', variants: [variant('v1', 'target')] },
      { id: 'n2', kind: 'qa', adoptedVariantId: 'v2', variants: [variant('v2', 'child')] },
    ],
  }
  const result = detachSessionFromTimeline(timeline, 'target')
  assert.deepEqual(result.timeline.nodes, [])
  assert.deepEqual(new Set(result.detachedSessionIds), new Set(['target', 'child']))
})

test('PlayMembershipService detects character mismatch and commits root detachment with CAS', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-root-'))
  try {
    const store = new PlayWorkspaceStore(pluginDir)
    await store.bindRoot(playRoot)
    store.createDir('card/pt')
    const timeline = sampleTimeline()
    const catalog = {
      playthroughs: [{
        id: 'pt',
        path: 'card/pt/timeline.json',
        title: '1周目',
        ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'root', importContextPath: 'card/pt/import-context.json' } },
      }],
    }
    store.writeFile('card/pt/timeline.json', JSON.stringify(timeline), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    store.writeFile('catalog.json', JSON.stringify(catalog), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    const service = new PlayMembershipService(store)
    assert.deepEqual(service.conflictsForSelection('root', 'other'), [{
      playthroughId: 'pt',
      playthroughTitle: '1周目',
      sessionId: 'root',
      expectedCharacterId: 'card',
      requestedCharacterId: 'other',
      descendantSessionCount: 4,
    }])
    assert.deepEqual(service.conflictsForSelection('root', 'card'), [])

    const result = service.detach('pt', 'root')
    assert.equal(result.detached, true)
    assert.deepEqual(new Set(result.detachedSessionIds), new Set(['root', 'target', 'sibling', 'child', 'kept']))
    const savedCatalog = parseCatalogJson(store.readFile('catalog.json', { validate: validatePlayDocument }).content)
    assert.equal(savedCatalog.playthroughs.length, 1)
    assert.equal(savedCatalog.playthroughs[0].ext.pmpDshTavern.rootSessionId, undefined)
    assert.equal(savedCatalog.playthroughs[0].ext.pmpDshTavern.importContextPath, undefined)
    const savedTimeline = parseTimelineJson(store.readFile('card/pt/timeline.json', { validate: validatePlayDocument }).content)
    assert.equal(savedTimeline.ext?.pmpDshTavern?.importContextPath, undefined)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('PlayMembershipService atomically relinks catalog ownership and every timeline session', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-relink-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-relink-root-'))
  try {
    const store = new PlayWorkspaceStore(pluginDir)
    await store.bindRoot(playRoot)
    store.createDir('old-card/pt')
    const timeline = sampleTimeline()
    const catalog = {
      playthroughs: [{
        id: 'pt',
        path: 'old-card/pt/timeline.json',
        title: '1周目',
        ext: { pmpDshTavern: { characterId: 'old-card', characterName: 'Old card', rootSessionId: 'root' } },
      }],
    }
    store.writeFile('old-card/pt/timeline.json', JSON.stringify(timeline), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    store.writeFile('catalog.json', JSON.stringify(catalog), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    const selected = []
    const service = new PlayMembershipService(store)
    const result = service.relinkCharacter('old-card', {
      id: 'new-card',
      name: 'Restored card',
      sha256: 'b'.repeat(64),
    }, {
      selectionPolicy: {
        selection: () => null,
        selectMany(sessionIds, patch) { selected.push({ sessionIds, patch }) },
      },
    })
    assert.deepEqual(result, { relinkedPlaythroughCount: 1, relinkedSessionCount: 5 })
    const saved = parseCatalogJson(store.readFile('catalog.json', { validate: validatePlayDocument }).content)
    assert.deepEqual(saved.playthroughs[0].ext.pmpDshTavern, {
      characterId: 'new-card',
      characterName: 'Restored card',
      characterSha256: 'b'.repeat(64),
      rootSessionId: 'root',
    })
    assert.deepEqual(new Set(selected[0].sessionIds), new Set(['root', 'target', 'sibling', 'child', 'kept']))
    assert.deepEqual(selected[0].patch, { characterCardId: 'new-card', character: { greetingIndex: 0 } })
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('PlayMembershipService relinks exactly one playthrough and accepts its current character binding', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-single-relink-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-single-relink-root-'))
  try {
    const store = new PlayWorkspaceStore(pluginDir)
    await store.bindRoot(playRoot)
    store.createDir('old-card/first')
    store.createDir('old-card/second')
    for (const path of ['old-card/first/timeline.json', 'old-card/second/timeline.json']) {
      store.writeFile(path, JSON.stringify(sampleTimeline()), {
        expectedRevision: null,
        expectedRevisionPresent: true,
        validate: validatePlayDocument,
      })
    }
    store.writeFile('catalog.json', JSON.stringify({
      playthroughs: [
        { id: 'first', path: 'old-card/first/timeline.json', title: '1周目', ext: { pmpDshTavern: { characterId: 'old-card', characterName: 'Old card' } } },
        { id: 'second', path: 'old-card/second/timeline.json', title: '2周目', ext: { pmpDshTavern: { characterId: 'old-card', characterName: 'Old card' } } },
      ],
    }), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    const selected = []
    const service = new PlayMembershipService(store)
    const result = service.relinkPlaythrough('first', { id: 'new-card', name: 'New card' }, {
      selectionPolicy: {
        selection: () => ({ characterCardId: 'old-card' }),
        selectMany(sessionIds, patch) { selected.push({ sessionIds, patch }) },
      },
    })
    assert.equal(result.playthroughId, 'first')
    assert.equal(result.previousCharacterId, 'old-card')
    assert.equal(result.relinkedPlaythroughCount, 1)
    const saved = parseCatalogJson(store.readFile('catalog.json', { validate: validatePlayDocument }).content)
    assert.equal(saved.playthroughs[0].ext.pmpDshTavern.characterId, 'new-card')
    assert.equal(saved.playthroughs[1].ext.pmpDshTavern.characterId, 'old-card')
    assert.equal(selected.length, 1)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('v2 detach-session route delegates one logged mutation to the membership service', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-api-'))
  try {
    const calls = []
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      membershipService: {
        detach(playthroughId, sessionId, { operation }) {
          calls.push({ playthroughId, sessionId, operation: operation.operation })
          return { ok: true, detached: true, playthroughId, sessionId, detachedSessionIds: [sessionId], empty: true }
        },
      },
    })
    const response = await invoke(handler, {
      method: 'POST',
      url: `${API_V2}/playthroughs/pt-a/detach-session`,
      body: { sessionId: 'session-a' },
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.detached, true)
    assert.deepEqual(calls, [{ playthroughId: 'pt-a', sessionId: 'session-a', operation: 'playthrough.session.detach' }])
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
  }
})

test('v2 playthrough character relink route resolves the card and logs one scoped mutation', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-relink-api-'))
  try {
    const calls = []
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      resolveCharacter: characterId => characterId === 'card-b' ? { id: 'card-b', name: 'B' } : null,
      relinkPlaythrough(playthroughId, character, { operation }) {
        calls.push({ playthroughId, character, operation: operation.operation })
        return { ok: true, playthroughId, characterId: character.id, relinkedPlaythroughCount: 1, relinkedSessionCount: 2 }
      },
    })
    const response = await invoke(handler, {
      method: 'POST',
      url: `${API_V2}/playthroughs/pt-a/relink-character`,
      body: { characterId: 'card-b' },
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.characterId, 'card-b')
    assert.deepEqual(calls, [{
      playthroughId: 'pt-a',
      character: { id: 'card-b', name: 'B' },
      operation: 'playthrough.character.relink',
    }])
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
  }
})

test('character selection guard is a no-op before an RP workspace is bound', () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-unbound-'))
  try {
    const service = new PlayMembershipService(new PlayWorkspaceStore(pluginDir))
    assert.deepEqual(service.conflictsForSelection('ordinary-session', 'card'), [])
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
  }
})
