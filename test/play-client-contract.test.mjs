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

const messages = {
  messages: [
    {
      id: 'message-user',
      role: 'user',
      content: [{ type: 'text', text: 'Hello ' }, { type: 'image' }],
      seq: 12,
    },
    {
      id: 'message-assistant',
      role: 'assistant',
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
  assert.deepEqual(normalizeFocus({ sessionId: null }), { sessionId: null })
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
    calls.push({ url, method: options.method ?? 'GET', body: options.body })
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
      return response({ ok: true, path: 'catalog.json', content: JSON.stringify(catalog) })
    }
    if (url.includes('/workspace/files?path=character-1%2Fplaythrough-1%2Ftimeline.json') && (options.method ?? 'GET') === 'GET') {
      return response({ ok: true, path: catalog.playthroughs[0].path, content: JSON.stringify(timeline) })
    }
    if (url.includes('/sessions/session-1/messages')) return response({ ok: true, ...messages })
    if (url.includes('/focus?path=')) return response({ ok: true, sessionId: null })
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
  assert.equal((await client.getFocus(catalog.playthroughs[0])).sessionId, null)
  await client.putCatalog(catalog)
  await client.putTimeline(catalog.playthroughs[0], timeline)
  await client.postBranch('session-1', 19)
  await client.putGreetingIndex('session-1', 1)
  await client.putCharacterSelection('session-2', 'character-1', { greetingIndex: 0 })

  const catalogPut = calls.find(item => item.method === 'PUT' && item.url.includes('path=catalog.json'))
  const timelinePut = calls.find(item => item.method === 'PUT' && item.url.includes('timeline.json'))
  assert.equal(typeof JSON.parse(catalogPut.body).content, 'string')
  assert.deepEqual(JSON.parse(JSON.parse(timelinePut.body).content), timeline)

  const focusCall = calls.find(item => item.url.includes('/focus?path='))
  assert.match(focusCall.url, /timeline\.json/)
  const branchCall = calls.find(item => item.url.endsWith('/branch'))
  assert.equal(JSON.parse(branchCall.body).atEventId, 19)
  const selectionPosts = calls.filter(item => item.method === 'POST' && item.url === API_V1 + '/character-selection')
  const directSelection = selectionPosts.map(item => JSON.parse(item.body)).find(body => body.sessionId === 'session-2')
  const greetingSelection = selectionPosts.map(item => JSON.parse(item.body)).find(body => body.sessionId === 'session-1')
  assert.equal(directSelection.characterCardId, 'character-1')
  assert.equal(greetingSelection.character.greetingIndex, 1)
  assert.throws(() => client.getTimeline('character-1/playthrough-1'), /timeline\.json/)
  assert.throws(() => client.postBranch('session-1', '19'), /non-negative integer/)
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
