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

test('clients without durable draft creation reject a new run before a native or workspace write', async () => {
  const client = fakeClient()
  await assert.rejects(createCharacterPlaythrough(client, { character: { id: 'character-a' }, reuseEmpty: false }), { code: 'PLAY_CREATION_UNAVAILABLE' })
  assert.deepEqual(client.calls, [])
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
  assert.equal(renamed.ext.pmpDshTavern.autoTitle, false)
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

test('a detached legacy run cannot acquire an untracked native child', async () => {
  const row = { id: 'vacant', path: 'card/vacant/timeline.json', ext: { pmpDshTavern: { characterId: 'card' } } }
  const client = { getCatalog: async () => ({ playthroughs: [row] }), getTimeline: async () => ({ nodes: [] }), postSession: assert.fail }
  await assert.rejects(createCharacterPlaythrough(client, { character: { id: 'card' } }), { code: 'PLAY_CREATION_UNAVAILABLE' })
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

for (const code of ['PLAY_COORDINATES_MIGRATION_REQUIRED', 'PLAY_PATH_NOT_FOUND', 'PLAY_HOST_ERROR', 'FORBIDDEN']) {
  test(`reuse check still rejects ${code} without creating a session`, async () => {
    const client = fakeClient()
    const reason = Object.assign(new Error(code), { code })
    client.getCatalog = async () => ({ playthroughs: [{ id: 'old', path: 'character-a/old/timeline.json',
      ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'old-root' } } }] })
    client.getTimeline = async () => { throw reason }
    await assert.rejects(createCharacterPlaythrough(client, { character: { id: 'character-a' }, ...dependencies }), error => error === reason)
    assert.equal(client.calls.length, 0)
  })
}

function fakeDraftClient() {
  const client = fakeClient(), drafts = new Map()
  client.postDraft = async body => {
    const id = `draft-${drafts.size + 1}`
    const playthrough = { id, path: `character-a/${id}/timeline.json`, ext: { pmpDshTavern: { characterId: body.characterId, draftId: id, playthroughNumber: drafts.size + 1 } } }
    const draft = { id, phase: 'draft', claim: null, selection: { characterCardId: body.characterId, userId: body.source?.templateId ?? null }, variables: { hp: 100 } }
    drafts.set(id, { draft, playthrough })
    const catalog = await client.getCatalog().catch(error => { if (error.code !== 'PLAY_PATH_NOT_FOUND') throw error; return { playthroughs: [] } })
    await client.putCatalog({ ...catalog, playthroughs: [...catalog.playthroughs, playthrough] })
    client.calls.push(['postDraft', body])
    return structuredClone({ draft, playthrough, sessionId: null })
  }
  client.getDraft = async id => structuredClone(drafts.get(id))
  return { client, drafts }
}

test('repeated create joins and reopens the same pending opening, preserving edits across controllers', async () => {
  const { client, drafts } = fakeDraftClient(), controller = createPlaythroughController(client)
  const args = { character: { id: 'character-a' } }
  const first = controller.create(args)
  assert.equal(controller.create(args), first)
  const created = await first
  drafts.get(created.draft.id).draft.variables.hp = 70
  const reopened = await controller.create(args)
  const remounted = await createPlaythroughController(client).create(args)
  assert.equal(reopened.playthrough.id, created.playthrough.id)
  assert.equal(remounted.playthrough.id, created.playthrough.id)
  assert.equal(reopened.reused, true)
  assert.equal(remounted.draft.variables.hp, 70)
  assert.equal(client.calls.filter(call => call[0] === 'postDraft').length, 1)
})

for (const state of ['preparing', 'started', 'claimed', 'archived']) test(`new opening does not reuse a ${state} draft`, async () => {
  const { client, drafts } = fakeDraftClient(), args = { character: { id: 'character-a' } }
  const first = await createCharacterPlaythrough(client, args), record = drafts.get(first.draft.id)
  if (state === 'claimed') record.draft.claim = { sessionId: 'preparing-session' }
  else if (state === 'archived') record.playthrough.ext.pmpDshTavern.archivedAt = '2026-10-18T00:00:00Z'
  else record.draft.phase = state
  const second = await createCharacterPlaythrough(client, args)
  assert.notEqual(second.playthrough.id, first.playthrough.id)
})

test('configuration-based creation reuses a matching draft and honors a different explicit configuration', async () => {
  const { client } = fakeDraftClient()
  const args = { character: { id: 'character-a' }, configurationSource: { mode: 'template', templateId: 'user-a' }, configurationSelection: { characterCardId: 'character-a', userId: 'user-a' } }
  const first = await createCharacterPlaythrough(client, args)
  assert.equal((await createCharacterPlaythrough(client, args)).playthrough.id, first.playthrough.id)
  const changed = await createCharacterPlaythrough(client, { ...args, configurationSource: { mode: 'template', templateId: 'user-b' }, configurationSelection: { characterCardId: 'character-a', userId: 'user-b' } })
  assert.notEqual(changed.playthrough.id, first.playthrough.id)
  assert.equal(changed.draft.selection.userId, 'user-b')
  assert.equal(client.calls.filter(call => call[0] === 'postDraft').length, 2)
})
