import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayWorkspaceStore,
  createPlayApiHandler,
  deriveFocus,
  normalizeTimeline,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => resolve({
        status: res.statusCode,
        headers,
        body: payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

const emptyTimeline = { nodes: [] }

const qaNode = {
  id: 'q0',
  kind: 'qa',
  hidden: false,
  displayOverride: null,
  adoptedVariantId: 'v0',
  variants: [{ id: 'v0', sessionId: 'session-root', startEventId: 0, endEventId: 1 }],
}

const multiQaUnusedVariant = {
  nodes: [
    {
      id: 'q1',
      kind: 'qa',
      hidden: false,
      adoptedVariantId: 'v-old',
      variants: [
        { id: 'v-old', sessionId: 'session-root', startEventId: 1, endEventId: 4 },
        { id: 'v-unused', sessionId: 'session-swipe-old', startEventId: 1, endEventId: 4 },
      ],
    },
    {
      id: 'q2',
      kind: 'qa',
      hidden: false,
      adoptedVariantId: 'v-new',
      variants: [
        { id: 'v-old', sessionId: 'session-root', startEventId: 5, endEventId: 8 },
        { id: 'v-new', sessionId: 'session-focus', startEventId: 5, endEventId: 8 },
      ],
    },
  ],
}

test('normalizeTimeline accepts legal documents and rejects bad kind, missing event ids, and focusSessionId', () => {
  assert.deepEqual(normalizeTimeline(emptyTimeline), emptyTimeline)
  assert.equal(normalizeTimeline({ nodes: [qaNode] }).nodes[0].kind, 'qa')
  assert.throws(() => normalizeTimeline({ nodes: [{ ...qaNode, kind: 'greeting' }] }), /kind must be qa/)
  assert.throws(() => normalizeTimeline({ nodes: [{ ...qaNode, kind: 'swipe' }] }), /kind must be qa/)
  assert.throws(() => normalizeTimeline({
    nodes: [{
      ...qaNode,
      variants: [{ id: 'v0', sessionId: 's', startEventId: 0 }],
    }],
  }), /endEventId/)
  assert.throws(() => normalizeTimeline({ focusSessionId: 'nope', nodes: [] }), /focusSessionId/)
  assert.throws(() => normalizeTimeline({
    nodes: [{ ...qaNode, focusSessionId: 'nope' }],
  }), /focusSessionId/)
})

test('deriveFocus uses the last rendered QA adopted variant and ignores unused older swipes', () => {
  assert.deepEqual(deriveFocus(emptyTimeline), { sessionId: null, nodeId: null, variantId: null })
  assert.deepEqual(deriveFocus(multiQaUnusedVariant), {
    sessionId: 'session-focus',
    nodeId: 'q2',
    variantId: 'v-new',
  })
  const hiddenTail = structuredClone(multiQaUnusedVariant)
  hiddenTail.nodes[1].hidden = true
  assert.equal(deriveFocus(hiddenTail).sessionId, 'session-root')
})

test('tree timeline derives focus from the explicit active branch head', () => {
  const tree = {
    nodes: [
      {
        id: 'root', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'root-a', variants: [
          { id: 'root-a', sessionId: 'session-a', startEventId: 1, endEventId: 2 },
          { id: 'root-b', sessionId: 'session-b', startEventId: 1, endEventId: 3 },
        ],
      },
      {
        id: 'child-a', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: 'root-a', adoptedVariantId: 'child-a-v', variants: [
          { id: 'child-a-v', sessionId: 'session-a', startEventId: 4, endEventId: 5 },
        ],
      },
    ],
    head: { sessionId: 'session-b', nodeId: 'root', variantId: 'root-b' },
  }
  assert.deepEqual(normalizeTimeline(tree), tree)
  assert.deepEqual(deriveFocus(tree), tree.head)
  assert.throws(() => normalizeTimeline({
    ...tree, head: { sessionId: 'session-b', nodeId: 'child-a', variantId: 'root-b' },
  }), /head must reference/)
})

test('PUT timeline.json validates before writing; catalog.json likewise', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-timeline-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-timeline-root-'))
  try {
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      workspaceStore: new PlayWorkspaceStore(pluginDir),
    })
    await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })

    const bad = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify({ focusSessionId: 'session-x', nodes: [] }) },
    })
    assert.equal(bad.status, 400)
    assert.equal(existsSync(join(playRoot, 'run', 'timeline.json')), false)

    const ok = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify(multiQaUnusedVariant), expectedRevision: null },
    })
    assert.equal(ok.status, 200)
    const saved = JSON.parse(readFileSync(join(playRoot, 'run', 'timeline.json'), 'utf8'))
    assert.equal(Object.hasOwn(saved, 'focusSessionId'), false)
    assert.equal(deriveFocus(saved).sessionId, 'session-focus')

    const badCatalog = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=catalog.json`,
      body: { content: JSON.stringify({ focusSessionId: 'x', playthroughs: [] }) },
    })
    assert.equal(badCatalog.status, 400)
    assert.equal(existsSync(join(playRoot, 'catalog.json')), false)

    const catalog = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=catalog.json`,
      body: { content: JSON.stringify({ playthroughs: [{ id: 'pt1', path: 'run/timeline.json' }] }), expectedRevision: null },
    })
    assert.equal(catalog.status, 200)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('timeline validation does not read DSH events', () => {
  const source = readFileSync(new URL('../packages/play/src/timeline.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /ctx\.sessions|session\.history|deriveMessages|@deepseek-ai/)
})

test('catalog and timeline documents are validated on GET and PUT with stable error codes', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-validate-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-validate-root-'))
  try {
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      workspaceStore: new PlayWorkspaceStore(pluginDir),
    })
    await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })
    const valid = {
      playthroughs: [{
        id: 'pt-a',
        path: 'alice/pt-a/timeline.json',
        ext: {
          pmpDshTavern: {
            characterId: 'alice',
            rootSessionId: 'session.root-1',
            playthroughNumber: 1,
            importContextPath: 'alice/pt-a/import-context.json',
            thirdPartyNested: { keep: true },
          },
          thirdParty: { keep: true },
        },
      }],
      ext: { thirdPartyCatalog: ['keep'] },
    }
    const saved = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=catalog.json`,
      body: { content: JSON.stringify(valid), expectedRevision: null },
    })
    assert.equal(saved.status, 200)
    const read = await invoke(handler, { url: `${API_V2}/workspace/files?path=catalog.json` })
    assert.equal(read.status, 200)
    assert.deepEqual(JSON.parse(read.body.content), valid)

    const badCatalogs = [
      { playthroughs: [{ id: 'bad id', path: 'alice/pt/timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: '../pt/timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: '/alice/pt/timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: 'alice\\pt\\timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: 'alice//timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/chat.json' }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/timeline.json' }, { id: 'pt', path: 'alice/other/timeline.json' }] },
      { playthroughs: [{ id: 'pt-a', path: 'alice/pt-a/timeline.json' }, { id: 'pt-b', path: 'alice/pt-a/timeline.json' }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/timeline.json', ext: { pmpDshTavern: { characterId: 'bad id' } } }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/timeline.json', ext: { pmpDshTavern: { rootSessionId: ':bad' } } }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/timeline.json', ext: { pmpDshTavern: { playthroughNumber: 0 } } }] },
      { playthroughs: [{ id: 'pt', path: 'alice/pt/timeline.json', ext: { pmpDshTavern: { importContextPath: 'alice/pt/context.json' } } }] },
    ]
    for (const [index, content] of badCatalogs.entries()) {
      const result = await invoke(handler, {
        method: 'PUT',
        url: `${API_V2}/workspace/files?path=bad-${index}.json`,
        body: { content: JSON.stringify(content) },
      })
      assert.equal(result.status, 200, `non-document files remain unvalidated: ${index}`)
      const currentCatalog = await invoke(handler, { url: `${API_V2}/workspace/files?path=catalog.json` })
      const catalogResult = await invoke(handler, {
        method: 'PUT',
        url: `${API_V2}/workspace/files?path=catalog.json`,
        body: { content: JSON.stringify(content), expectedRevision: currentCatalog.body.revision },
      })
      assert.equal(catalogResult.status, 400, `catalog case ${index}`)
      assert.equal(catalogResult.body.code, 'PLAY_CATALOG_INVALID', `catalog code ${index}`)
    }

    const unsafeTimeline = {
      nodes: [],
      ext: { pmpDshTavern: { importContextPath: '../alice/import-context.json' } },
    }
    const timelinePut = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=alice/pt-a/timeline.json`,
      body: { content: JSON.stringify(unsafeTimeline), expectedRevision: null },
    })
    assert.equal(timelinePut.status, 400)
    assert.equal(timelinePut.body.code, 'PLAY_TIMELINE_INVALID')
    mkdirSync(join(playRoot, 'alice', 'pt-a'), { recursive: true })
    writeFileSync(join(playRoot, 'alice', 'pt-a', 'timeline.json'), JSON.stringify(unsafeTimeline))
    const timelineGet = await invoke(handler, { url: `${API_V2}/workspace/files?path=alice/pt-a/timeline.json` })
    assert.equal(timelineGet.status, 400)
    assert.equal(timelineGet.body.code, 'PLAY_TIMELINE_INVALID')

    writeFileSync(join(playRoot, 'catalog.json'), JSON.stringify(badCatalogs[0]))
    const catalogGet = await invoke(handler, { url: `${API_V2}/workspace/files?path=catalog.json` })
    assert.equal(catalogGet.status, 400)
    assert.equal(catalogGet.body.code, 'PLAY_CATALOG_INVALID')
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('managed catalog/timeline files expose SHA-256 revisions and enforce guarded CAS', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-cas-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-cas-root-'))
  const timeline = JSON.stringify({ nodes: [] })
  try {
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      workspaceStore: new PlayWorkspaceStore(pluginDir),
    })
    await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })

    const missing = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: timeline },
    })
    assert.equal(missing.status, 400)
    assert.equal(missing.body.code, 'PLAY_FILE_REVISION_REQUIRED')

    const created = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: timeline, expectedRevision: null },
    })
    assert.equal(created.status, 200)
    const expectedCreatedRevision = createHash('sha256').update(Buffer.from(timeline, 'utf8')).digest('hex')
    assert.equal(created.body.revision, expectedCreatedRevision)

    const read = await invoke(handler, { url: `${API_V2}/workspace/files?path=run/timeline.json` })
    assert.equal(read.status, 200)
    assert.equal(read.body.revision, expectedCreatedRevision)

    for (const expectedRevision of ['', 'A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), 42]) {
      const invalid = await invoke(handler, {
        method: 'PUT',
        url: `${API_V2}/workspace/files?path=run/timeline.json`,
        body: { content: timeline, expectedRevision },
      })
      assert.equal(invalid.status, 400)
      assert.equal(invalid.body.code, 'PLAY_FILE_REVISION_INVALID')
    }

    const nullExisting = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: timeline, expectedRevision: null },
    })
    assert.equal(nullExisting.status, 409)
    assert.equal(nullExisting.body.code, 'PLAY_FILE_REVISION_CONFLICT')

    const updatedTimeline = JSON.stringify({ nodes: [], ext: { marker: 'updated' } })
    const updated = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: updatedTimeline, expectedRevision: expectedCreatedRevision },
    })
    assert.equal(updated.status, 200)
    assert.notEqual(updated.body.revision, expectedCreatedRevision)
    const beforeStale = readFileSync(join(playRoot, 'run', 'timeline.json'))
    const stale = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: timeline, expectedRevision: expectedCreatedRevision },
    })
    assert.equal(stale.status, 409)
    assert.equal(stale.body.code, 'PLAY_FILE_REVISION_CONFLICT')
    assert.deepEqual(readFileSync(join(playRoot, 'run', 'timeline.json')), beforeStale)

    const ordinary = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=ordinary.txt`,
      body: { content: 'ordinary' },
    })
    assert.equal(ordinary.status, 200)
    assert.equal(Object.hasOwn(ordinary.body, 'revision'), false)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('managed CAS rejects a target deleted after the revision check', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-cas-delete-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-cas-delete-root-'))
  const target = join(playRoot, 'run', 'timeline.json')
  let deleteBeforeRename = false
  try {
    const store = new PlayWorkspaceStore(pluginDir, {
      beforeRename: () => {
        if (!deleteBeforeRename) return
        deleteBeforeRename = false
        rmSync(target, { force: true })
      },
    })
    const handler = createPlayApiHandler({ chromeStore: new ChromeStore(pluginDir), workspaceStore: store })
    await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })
    const first = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify({ nodes: [] }), expectedRevision: null },
    })
    assert.equal(first.status, 200)
    deleteBeforeRename = true
    const result = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify({ nodes: [], ext: { marker: 'must-not-write' } }), expectedRevision: first.body.revision },
    })
    assert.equal(result.status, 409)
    assert.equal(result.body.code, 'PLAY_FILE_REVISION_CONFLICT')
    assert.equal(existsSync(target), false)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})
