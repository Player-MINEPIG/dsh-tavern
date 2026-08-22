import test from 'node:test'
import assert from 'node:assert/strict'
import { API_V1, API_V2 } from '../packages/identity.js'
import { createLivePlayClient } from '../packages/client/src/play/live.js'
import {
  normalizeCatalog,
  normalizeFocus,
  normalizeSessionMessages,
  normalizeTimeline,
  playthroughCharacterId,
  projectContentText,
} from '../packages/client/src/play/schema.js'

const timeline = {
  nodes: [{
    id: 'qa-1',
    kind: 'qa',
    hidden: false,
    displayOverride: null,
    adoptedVariantId: 'variant-1',
    variants: [{
      id: 'variant-1',
      sessionId: 'session-1',
      startEventId: 12,
      endEventId: 19,
    }],
  }],
}

const catalog = {
  playthroughs: [{
    id: 'playthrough-1',
    path: 'character-1/playthrough-1/timeline.json',
    title: 'First run',
    ext: {
      pmpDshTavern: {
        schemaVersion: 1,
        characterId: 'character-1',
      },
    },
  }],
}

const catalogRevision = 'a'.repeat(64)
const timelineRevision = 'b'.repeat(64)

const messages = {
  messages: [
    {
      id: 'message-user',
      role: 'user',
      origin: { kind: 'user' },
      content: [{ type: 'text', text: 'Hello ' }, { type: 'image' }],
      seq: 12,
    },
    {
      id: 'message-assistant',
      role: 'assistant',
      origin: { kind: 'assistant' },
      content: [{ type: 'text', text: 'Welcome.' }],
      seq: 19,
    },
  ],
  incompleteTurn: false,
}

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

test('play schema matches integer event seqs, QA-only timelines, and ContentPart arrays', () => {
  const normalized = normalizeTimeline(timeline)
  assert.equal(normalized.nodes[0].variants[0].startEventId, 12)
  assert.throws(() => normalizeTimeline({
    nodes: [{ ...timeline.nodes[0], kind: 'greeting' }],
  }), /kind must be qa/)
  assert.throws(() => normalizeTimeline({
    nodes: [{
      ...timeline.nodes[0],
      variants: [{ ...timeline.nodes[0].variants[0], startEventId: '12' }],
    }],
  }), /non-negative integer/)

  const projected = normalizeSessionMessages(messages)
  assert.equal(projected.messages[0].text, 'Hello ⟦image⟧')
  assert.throws(() => normalizeSessionMessages({
    messages: [{ ...messages.messages[0], seq: -1 }],
    incompleteTurn: false,
  }), /non-negative integer/)
  assert.equal(projected.messages[0].seq, 12)
  assert.deepEqual(projected.messages[0].origin, { kind: 'user' })
  const context = normalizeSessionMessages({
    messages: [{
      id: 'context', role: 'user', content: [], seq: 13,
      origin: { kind: 'context', producer: 'subagent-settled', form: 'notice', summary: 'done' },
    }],
    incompleteTurn: false,
  })
  assert.deepEqual(context.messages[0].origin, {
    kind: 'context', producer: 'subagent-settled', form: 'notice', summary: 'done',
  })
  assert.deepEqual(normalizeFocus({ playthroughId: 'playthrough-1', sessionId: null, nodeId: null, variantId: null }), { playthroughId: 'playthrough-1', sessionId: null, nodeId: null, variantId: null })
  assert.equal(projectContentText([{ type: 'text', text: 'a' }, { type: 'tool' }]), 'a⟦tool⟧')
})

test('catalog keeps character ownership in ext and falls back to its path segment', () => {
  const normalized = normalizeCatalog(catalog)
  assert.equal(playthroughCharacterId(normalized.playthroughs[0]), 'character-1')
  assert.equal(playthroughCharacterId({
    id: 'legacy',
    path: 'legacy-character/run/timeline.json',
  }), 'legacy-character')
  assert.equal(Object.hasOwn(normalized.playthroughs[0], 'characterId'), false)
})

test('live play client parses JSON file envelopes and writes them as content strings', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', headers: options.headers, body: options.body })
    if (url === API_V2 + '/workspace') {
      return response({
        ok: true,
        selected: true,
        rootPath: 'D:/play',
        workspaceId: 'workspace-rp',
        contractVersion: 1,
        activeTimelinePath: catalog.playthroughs[0].path,
        warnings: [],
      })
    }
    if (url.includes('/workspace/files?path=catalog.json') && (options.method ?? 'GET') === 'GET') {
      return response({ ok: true, path: 'catalog.json', content: JSON.stringify(catalog), revision: catalogRevision })
    }
    if (url.includes('/workspace/files?path=character-1%2Fplaythrough-1%2Ftimeline.json') && (options.method ?? 'GET') === 'GET') {
      return response({ ok: true, path: catalog.playthroughs[0].path, content: JSON.stringify(timeline), revision: timelineRevision })
    }
    if (url.includes('/sessions/session-1/messages')) return response({ ok: true, ...messages })
    if (url.includes('/sessions/session-1/import-context')) {
      return response({ ok: true, binding: (options.method ?? 'GET') === 'DELETE' ? null : { path: 'character-1/playthrough-1/import-context.json', state: 'pending' } })
    }
    if (url.startsWith(API_V2 + '/playthroughs/') && url.endsWith('/focus')) return response({ ok: true, playthroughId: 'playthrough-1', sessionId: null, nodeId: null, variantId: null })
    if (url === API_V1 + '/characters') {
      return response({ ok: true, characters: [{ id: 'character-1', name: 'Guide' }] })
    }
    if (url.includes('/character-selection') && (options.method ?? 'GET') === 'GET') {
      return response({
        ok: true,
        selection: {
          characterCardId: 'character-1',
          character: { greetingIndex: 0 },
        },
      })
    }
    if (url.includes('/workspace/files?path=catalog.json') && options.method === 'PUT') {
      return response({ ok: true, path: 'catalog.json', revision: 'c'.repeat(64) })
    }
    if (url.includes('timeline.json') && options.method === 'PUT') {
      return response({ ok: true, path: catalog.playthroughs[0].path, revision: 'd'.repeat(64) })
    }
    return response({ ok: true, mode: 'play', accepted: true, sessionId: 'session-2' })
  }
  const client = createLivePlayClient({ fetchImpl })
  assert.equal(client.apiRoot, API_V2)
  assert.equal(client.v1Root, API_V1)
  assert.equal((await client.getWorkspace()).rootPath, 'D:/play')
  assert.equal((await client.getCharacters()).characters[0].id, 'character-1')
  assert.equal((await client.getCatalog()).playthroughs[0].id, 'playthrough-1')
  assert.equal((await client.getTimeline(catalog.playthroughs[0])).nodes[0].id, 'qa-1')
  assert.equal((await client.getMessages('session-1')).messages[0].text, 'Hello ⟦image⟧')
  assert.equal((await client.getImportContextBinding('session-1')).state, 'pending')
  assert.equal((await client.putImportContextBinding('session-1', { path: 'character-1/playthrough-1/import-context.json' })).path, 'character-1/playthrough-1/import-context.json')
  assert.equal(await client.deleteImportContextBinding('session-1'), null)
  const importDelete = calls.find(item => item.method === 'DELETE' && item.url.endsWith('/import-context'))
  assert.equal(importDelete.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(importDelete.body), {})
  assert.equal((await client.getFocus(catalog.playthroughs[0])).sessionId, null)
  await client.detachPlaythroughSession('playthrough-1', 'session-1')
  const detach = calls.find(item => item.url.endsWith('/playthroughs/playthrough-1/detach-session'))
  assert.equal(detach.method, 'POST')
  assert.deepEqual(JSON.parse(detach.body), { sessionId: 'session-1' })
  await client.putCatalog(catalog)
  await client.putTimeline(catalog.playthroughs[0], timeline)
  await client.postBranch('session-1', 19)
  await client.putGreetingIndex('session-1', 1)
  await client.putCharacterSelection('session-2', 'character-1', { greetingIndex: 0 })
  await client.putPresetRegexScripts('preset-1', [{ id: 'preset-rule' }])
  await client.putCharacterRegexScripts('character-1', [{ id: 'character-rule' }])

  const catalogPut = calls.find(item => item.method === 'PUT' && item.url.includes('path=catalog.json'))
  const timelinePut = calls.find(item => item.method === 'PUT' && item.url.includes('timeline.json'))
  assert.equal(typeof JSON.parse(catalogPut.body).content, 'string')
  assert.equal(JSON.parse(catalogPut.body).expectedRevision, catalogRevision)
  assert.deepEqual(JSON.parse(JSON.parse(timelinePut.body).content), timeline)
  assert.equal(JSON.parse(timelinePut.body).expectedRevision, timelineRevision)

  const focusCall = calls.find(item => item.url.endsWith('/playthroughs/playthrough-1/focus'))
  assert.ok(focusCall)
  assert.doesNotMatch(focusCall.url, /[?&]path=/)
  const branchCall = calls.find(item => item.url.endsWith('/branch'))
  assert.equal(JSON.parse(branchCall.body).atEventId, 19)
  const selectionPosts = calls.filter(item => item.method === 'POST' && item.url === API_V1 + '/character-selection')
  const directSelection = selectionPosts.map(item => JSON.parse(item.body)).find(body => body.sessionId === 'session-2')
  const greetingSelection = selectionPosts.map(item => JSON.parse(item.body)).find(body => body.sessionId === 'session-1')
  assert.equal(directSelection.characterCardId, 'character-1')
  assert.equal(greetingSelection.character.greetingIndex, 1)
  const regexPuts = calls.filter(item => item.method === 'PUT' && item.url.endsWith('/regex-scripts'))
  assert.deepEqual(regexPuts.map(item => JSON.parse(item.body).regexScripts[0].id), ['preset-rule', 'character-rule'])
  assert.throws(() => client.getTimeline('character-1/playthrough-1'), /timeline\.json/)
  assert.throws(() => client.postBranch('session-1', '19'), /non-negative integer/)
})

test('live focus uses the encoded playthrough id and validates the stable response', async () => {
  const calls = []
  const client = createLivePlayClient({
    fetchImpl: async url => {
      calls.push(url)
      return response({ ok: true, playthroughId: 'run/with space', sessionId: 'session-a', nodeId: 'node-a', variantId: 'variant-a' })
    },
  })
  const result = await client.getFocus({ id: 'run/with space', path: 'ignored/timeline.json' })
  assert.deepEqual(result, {
    playthroughId: 'run/with space',
    sessionId: 'session-a',
    nodeId: 'node-a',
    variantId: 'variant-a',
  })
  assert.deepEqual(calls, [API_V2 + '/playthroughs/run%2Fwith%20space/focus'])
})

test('live focus rejects missing ids, mismatched ids, and malformed nullable fields', async () => {
  let calls = 0
  const client = createLivePlayClient({
    fetchImpl: async () => {
      calls += 1
      return response({ ok: true, playthroughId: 'other', sessionId: null, nodeId: null, variantId: null })
    },
  })
  await assert.rejects(client.getFocus(), error => error instanceof TypeError && /playthrough\.id/.test(error.message))
  await assert.rejects(client.getFocus({ id: 'requested' }), error => error instanceof TypeError && /does not match/.test(error.message))
  assert.equal(calls, 1)

  for (const field of ['sessionId', 'nodeId', 'variantId']) {
    const malformed = createLivePlayClient({
      fetchImpl: async () => response({ ok: true, playthroughId: 'requested', sessionId: null, nodeId: null, variantId: null, [field]: '' }),
    })
    await assert.rejects(malformed.getFocus({ id: 'requested' }), error => error instanceof TypeError && new RegExp(field).test(error.message))
  }

  const empty = createLivePlayClient({
    fetchImpl: async () => response({ ok: true, playthroughId: 'requested', sessionId: null, nodeId: null, variantId: null }),
  })
  assert.deepEqual(await empty.getFocus({ id: 'requested' }), { playthroughId: 'requested', sessionId: null, nodeId: null, variantId: null })
})
test('live client preserves structured HTTP failures', async () => {
  const client = createLivePlayClient({
    fetchImpl: async () => response({
      ok: false,
      code: 'PLAY_WORKSPACE_UNBOUND',
      error: 'workspace missing',
    }, { ok: false, status: 409 }),
  })
  await assert.rejects(client.getWorkspace(), error => {
    assert.equal(error.status, 409)
    assert.equal(error.code, 'PLAY_WORKSPACE_UNBOUND')
    assert.match(error.message, /workspace missing/)
    return true
  })
})

test('live client writes character order through the v1 resource contract', async () => {
  const calls = []
  const client = createLivePlayClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return response({ ok: true, characters: [{ id: 'b' }, { id: 'a' }] })
    },
  })

  const result = await client.putCharacterOrder('custom', ['b', 'a'])
  assert.deepEqual(result.characters.map(character => character.id), ['b', 'a'])
  assert.equal(calls[0].url, `${API_V1}/characters/order`)
  assert.equal(calls[0].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[0].options.body), { mode: 'custom', characterIds: ['b', 'a'] })
})
