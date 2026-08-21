import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCharacterPlaythrough,
  createPlaythroughController,
  nextPlaythroughNumber,
  playthroughIsReusable,
  renamePlaythrough,
  sourceSessionIdForCharacter,
} from '../packages/client/src/play/create.js'

function fakeClient({ copied = false } = {}) {
  const calls = []
  let catalog = null
  let selection = copied
    ? { selection: { characterCardId: 'character-a', character: { greetingIndex: 2 } } }
    : { selection: null }
  const timelines = new Map()
  return {
    calls,
    async postSession(sourceId) {
      calls.push(['postSession', sourceId])
      return { ok: true, sessionId: 'session-new', ...(copied ? { title: 'Alice copied' } : {}) }
    },
    async putCharacterSelection(sessionId, characterId, options) {
      calls.push(['putCharacterSelection', sessionId, characterId, options])
      selection = { selection: { characterCardId: characterId, character: options } }
    },
    async getCharacterSelection(sessionId) {
      calls.push(['getCharacterSelection', sessionId])
      return selection
    },
    async getCatalog() {
      calls.push(['getCatalog'])
      if (catalog === null) {
        const error = new Error('missing catalog')
        error.code = 'PLAY_PATH_NOT_FOUND'
        throw error
      }
      return catalog
    },
    async createDirs(path) {
      calls.push(['createDirs', path])
    },
    async putTimeline(playthrough, timeline) {
      calls.push(['putTimeline', playthrough.path, timeline])
      timelines.set(playthrough.path, timeline)
    },
    async putCatalog(value) {
      calls.push(['putCatalog', value])
      catalog = value
    },
    async getTimeline(playthrough) {
      calls.push(['getTimeline', playthrough.path])
      return timelines.get(playthrough.path)
    },
  }
}

const dependencies = {
  now: () => new Date('2026-08-19T03:04:05.000Z'),
  randomUUID: () => '11111111-2222-4333-8444-555555555555',
}

test('new card playthrough binds the card and persists an empty verified timeline without a greeting message', async () => {
  const client = fakeClient()
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-a', name: 'Alice' },
    ...dependencies,
  })

  assert.equal(result.sessionId, 'session-new')
  assert.equal(result.playthrough.ext.pmpDshTavern.characterId, 'character-a')
  assert.equal(result.playthrough.ext.pmpDshTavern.rootSessionId, 'session-new')
  assert.equal(result.playthrough.title, '1周目')
  assert.equal(result.playthrough.ext.pmpDshTavern.playthroughNumber, 1)
  assert.deepEqual(client.calls[0], ['getCatalog'])
  assert.deepEqual(client.calls[1], ['postSession', null])
  assert.deepEqual(client.calls[2], ['getCharacterSelection', 'session-new'])
  assert.deepEqual(client.calls[3], ['putCharacterSelection', 'session-new', 'character-a', { greetingIndex: 0 }])
  const timelineWrite = client.calls.find(call => call[0] === 'putTimeline')
  assert.match(timelineWrite[1], /^character-a\/playthrough-[^/]+\/timeline\.json$/)
  assert.deepEqual(timelineWrite[2], { nodes: [] })
  assert.equal(client.calls.some(call => call[0] === 'postUserMessage'), false)
  assert.equal(client.calls.some(call => call[0] === 'putGreetingIndex'), false)
})

test('existing card session is copied instead of rebinding only the character', async () => {
  const client = fakeClient({ copied: true })
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-a', name: 'Alice' },
    selectionFromSessionId: 'session-source',
    ...dependencies,
  })
  assert.equal(result.playthrough.title, '1周目')
  assert.deepEqual(client.calls[1], ['postSession', 'session-source'])
  assert.equal(client.calls.some(call => call[0] === 'putCharacterSelection'), false)
  assert.equal(client.calls.filter(call => call[0] === 'getCharacterSelection').length, 2)
})

test('copied DSH settings are corrected when they still point at the previously focused character', async () => {
  const client = fakeClient({ copied: true })
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-b', name: 'Bob' },
    selectionFromSessionId: 'session-b-source',
    ...dependencies,
  })
  assert.equal(result.playthrough.ext.pmpDshTavern.characterId, 'character-b')
  assert.deepEqual(client.calls.find(call => call[0] === 'putCharacterSelection'), [
    'putCharacterSelection', 'session-new', 'character-b', { greetingIndex: 0 },
  ])
})

test('playthrough numbers are character-local and survive renamed or legacy rows', () => {
  const catalog = { playthroughs: [
    { id: 'a-old', ext: { pmpDshTavern: { characterId: 'a' } } },
    { id: 'b-one', ext: { pmpDshTavern: { characterId: 'b', playthroughNumber: 1 } } },
    { id: 'a-five', title: 'custom', ext: { pmpDshTavern: { characterId: 'a', playthroughNumber: 5 } } },
  ] }
  assert.equal(nextPlaythroughNumber(catalog, 'a'), 6)
  assert.equal(nextPlaythroughNumber(catalog, 'b'), 2)
  assert.equal(nextPlaythroughNumber(catalog, 'c'), 1)
})

test('renaming changes only the catalog display title and verifies the write', async () => {
  let catalog = { playthroughs: [{ id: 'pt-a', path: 'a/pt-a/timeline.json', title: '1周目', ext: { pmpDshTavern: { rootSessionId: 'session-a' } } }] }
  const client = {
    async getCatalog() { return structuredClone(catalog) },
    async putCatalog(next) { catalog = structuredClone(next) },
  }
  const renamed = await renamePlaythrough(client, catalog.playthroughs[0], '  夜班线  ')
  assert.equal(renamed.title, '夜班线')
  assert.equal(renamed.ext.pmpDshTavern.rootSessionId, 'session-a')
  await assert.rejects(renamePlaythrough(client, catalog.playthroughs[0], '   '), /play\.rename\.invalid/)
})

test('character source selection prefers active playthrough, then loose session, then any root', () => {
  assert.equal(sourceSessionIdForCharacter({
    playthroughs: [
      { rootSessionId: 'root-old', active: false },
      { rootSessionId: 'root-active', active: true },
    ],
    unassigned: [{ id: 'loose-active', active: true }],
  }), 'root-active')
  assert.equal(sourceSessionIdForCharacter({
    playthroughs: [],
    unassigned: [{ id: 'loose', active: false }],
  }), 'loose')
  assert.equal(sourceSessionIdForCharacter({ playthroughs: [], unassigned: [] }), null)
})

test('controller deduplicates a same-character double click into one transaction', async () => {
  const client = fakeClient()
  const controller = createPlaythroughController(client, dependencies)
  const args = { character: { id: 'character-a', name: 'Alice' } }
  const first = controller.create(args)
  const second = controller.create(args)
  assert.equal(first, second)
  const [left, right] = await Promise.all([first, second])
  assert.equal(left.sessionId, right.sessionId)
  assert.equal(client.calls.filter(call => call[0] === 'postSession').length, 1)
  assert.equal(client.calls.filter(call => call[0] === 'putCatalog').length, 1)
})

test('selection verification failure stops before workspace metadata writes', async () => {
  const client = fakeClient()
  client.putCharacterSelection = async (...args) => {
    client.calls.push(['putCharacterSelection', ...args])
  }
  await assert.rejects(createCharacterPlaythrough(client, {
    character: { id: 'character-a', name: 'Alice' },
    ...dependencies,
  }), /selection did not persist/)
  assert.equal(client.calls.some(call => call[0] === 'createDirs'), false)
  assert.equal(client.calls.some(call => call[0] === 'putTimeline'), false)
  assert.equal(client.calls.some(call => call[0] === 'putCatalog'), false)
})

test('latest empty playthrough is reused without creating workspace or session data', async () => {
  const playthrough = {
    id: 'pt-2', path: 'character-a/pt-2/timeline.json', title: '2周目',
    ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'session-empty', playthroughNumber: 2 } },
  }
  const calls = []
  const client = {
    async getCatalog() { calls.push('catalog'); return { playthroughs: [playthrough] } },
    async getTimeline() { calls.push('timeline'); return { nodes: [] } },
    async getMessages(id) { calls.push(['messages', id]); return { incompleteTurn: false, messages: [{ role: 'system' }] } },
    async getCharacterSelection(id) { calls.push(['selection', id]); return { selection: { characterCardId: 'character-a' } } },
    async postSession() { calls.push('postSession'); throw new Error('must not create') },
  }
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-a' },
    ...dependencies,
  })
  assert.deepEqual(result, { sessionId: 'session-empty', playthrough, reused: true })
  assert.equal(calls.includes('postSession'), false)
})

test('a reusable empty playthrough repairs a stale character binding before navigation', async () => {
  const playthrough = {
    id: 'pt-b', path: 'character-b/pt-b/timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-b', rootSessionId: 'session-empty', playthroughNumber: 1 } },
  }
  let selection = { selection: { characterCardId: 'character-a' } }
  const calls = []
  const client = {
    async getCatalog() { return { playthroughs: [playthrough] } },
    async getTimeline() { return { nodes: [] } },
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async getCharacterSelection() { calls.push('get'); return selection },
    async putCharacterSelection(sessionId, characterId, options) {
      calls.push(['put', sessionId, characterId, options])
      selection = { selection: { characterCardId: characterId, character: options } }
    },
  }
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-b' },
    ...dependencies,
  })
  assert.equal(result.reused, true)
  assert.deepEqual(calls, [
    'get',
    ['put', 'session-empty', 'character-b', { greetingIndex: 0 }],
    'get',
  ])
})

test('greeting-only import remains reusable but imported QA does not', async () => {
  const playthrough = {
    path: 'character-a/pt/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'root', importContextPath: 'character-a/pt/import-context.json' } },
  }
  let qa = []
  const client = {
    async getTimeline() { return { nodes: [], ext: { pmpDshTavern: { importContextPath: 'character-a/pt/import-context.json' } } } },
    async getFile() { return { content: JSON.stringify({ greeting: 'Hello', qa }) } },
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async getCharacterSelection() { return { selection: { characterCardId: 'character-a' } } },
  }
  assert.equal(await playthroughIsReusable(client, playthrough), true)
  qa = [{ user: 'u', assistant: 'a' }]
  assert.equal(await playthroughIsReusable(client, playthrough), false)
})

test('timeline QA, authoritative messages and incomplete turns each prevent empty reuse', async () => {
  const playthrough = { path: 'character-a/pt/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'root' } } }
  const client = {
    timeline: { nodes: [{ kind: 'qa' }] },
    history: { incompleteTurn: false, messages: [] },
    async getTimeline() { return this.timeline },
    async getMessages() { return this.history },
    async getCharacterSelection() { return { selection: { characterCardId: 'character-a' } } },
  }
  assert.equal(await playthroughIsReusable(client, playthrough), false)
  client.timeline = { nodes: [] }
  client.history = { incompleteTurn: false, messages: [{ role: 'user' }] }
  assert.equal(await playthroughIsReusable(client, playthrough), false)
  client.history = { incompleteTurn: true, messages: [] }
  assert.equal(await playthroughIsReusable(client, playthrough), false)
})

test('a nonempty latest playthrough does not reuse an older empty one', async () => {
  const older = {
    id: 'pt-1', path: 'character-a/pt-1/timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'older', playthroughNumber: 1 } },
  }
  const latest = {
    id: 'pt-2', path: 'character-a/pt-2/timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'latest', playthroughNumber: 2 } },
  }
  const client = fakeClient()
  let catalog = { playthroughs: [older, latest] }
  client.getCatalog = async () => catalog
  client.getTimeline = async playthrough => playthrough.id === 'pt-2'
    ? { nodes: [{ kind: 'qa' }] }
    : { nodes: [] }
  client.putCatalog = async value => { catalog = value }
  const result = await createCharacterPlaythrough(client, { character: { id: 'character-a' }, ...dependencies })
  assert.equal(result.reused, false)
  assert.equal(result.playthrough.title, '3周目')
  assert.equal(client.calls.filter(call => call[0] === 'postSession').length, 1)
})
