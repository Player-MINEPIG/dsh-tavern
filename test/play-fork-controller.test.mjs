import test from 'node:test'
import assert from 'node:assert/strict'
import { forkPlaythroughAtNode } from '../packages/client/src/play/fork.js'

function sourceTimeline() {
  return { nodes: [
    {
      id: 'qa-1', kind: 'qa', displayOverride: null,
      adoptedVariantId: 'v-1',
      variants: [{ id: 'v-1', sessionId: 'ancestor-a', startEventId: 1, endEventId: 3 }],
    },
    {
      id: 'qa-2', kind: 'qa', displayOverride: 'display only',
      adoptedVariantId: 'v-2b',
      variants: [
        { id: 'v-2a', sessionId: 'ancestor-a', startEventId: 4, endEventId: 6 },
        { id: 'v-2b', sessionId: 'ancestor-b', startEventId: 4, endEventId: 7 },
      ],
    },
    {
      id: 'qa-3', kind: 'qa', displayOverride: null,
      adoptedVariantId: 'v-3',
      variants: [{ id: 'v-3', sessionId: 'later', startEventId: 8, endEventId: 9 }],
    },
  ] }
}

test('Tavern fork branches durable history and rebases only the copied focus variant', async () => {
  let catalog = { playthroughs: [{
    id: 'old', path: 'character-a/old/timeline.json', title: '1周目',
    ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'ancestor-a', playthroughNumber: 1 } },
  }] }
  let savedTimeline
  const calls = []
  const client = {
    async getTimeline() { calls.push('timeline:read'); return sourceTimeline() },
    async postBranch(sessionId, eventId) { calls.push(`branch:${sessionId}:${eventId}`); return { sessionId: 'child' } },
    async getMessages() {
      calls.push('messages:child')
      return { incompleteTurn: false, messages: [{ role: 'user', seq: 4 }, { role: 'assistant', seq: 7 }] }
    },
    async createDirs(path) { calls.push(`dirs:${path}`) },
    async putTimeline(playthrough, timeline) {
      calls.push(`timeline:write:${playthrough.path}`)
      savedTimeline = structuredClone(timeline)
    },
    async updateCatalog(mutator) {
      calls.push('catalog:update')
      catalog = await mutator(structuredClone(catalog))
      return structuredClone(catalog)
    },
    async getFocus(playthrough) {
      calls.push(`focus:${playthrough.id}`)
      const node = savedTimeline.nodes.at(-1)
      const variant = node.variants.find(item => item.id === node.adoptedVariantId)
      return { playthroughId: playthrough.id, sessionId: variant.sessionId, nodeId: node.id, variantId: variant.id }
    },
  }

  const result = await forkPlaythroughAtNode(client, {
    playthrough: catalog.playthroughs[0],
    nodeId: 'qa-2',
    now: () => new Date('2026-08-21T00:00:00.000Z'),
    randomUUID: () => 'fork-id',
  })

  assert.equal(result.sessionId, 'child')
  assert.equal(result.playthrough.title, '2周目')
  assert.equal(result.playthrough.ext.pmpDshTavern.rootSessionId, 'child')
  assert.equal(savedTimeline.nodes.length, 2)
  assert.equal(savedTimeline.nodes[0].variants[0].sessionId, 'ancestor-a')
  assert.equal(savedTimeline.nodes[1].variants[0].sessionId, 'ancestor-a')
  assert.equal(savedTimeline.nodes[1].variants[1].sessionId, 'child')
  assert.equal(sourceTimeline().nodes[1].variants[1].sessionId, 'ancestor-b')
  assert.deepEqual(calls, [
    'timeline:read',
    'branch:ancestor-b:7',
    'messages:child',
    'dirs:character-a/playthrough-fork-id',
    'timeline:write:character-a/playthrough-fork-id/timeline.json',
    'catalog:update',
    'focus:playthrough-fork-id',
  ])
})

test('Tavern fork rejects a branch without the adopted durable range before workspace writes', async () => {
  let writes = 0
  const client = {
    async getTimeline() { return sourceTimeline() },
    async postBranch() { return { sessionId: 'child' } },
    async getMessages() { return { incompleteTurn: false, messages: [{ role: 'user', seq: 4 }] } },
    async createDirs() { writes += 1 },
    async putTimeline() { writes += 1 },
    async updateCatalog() { writes += 1 },
  }
  await assert.rejects(forkPlaythroughAtNode(client, {
    playthrough: { id: 'old', path: 'character-a/old/timeline.json', ext: { pmpDshTavern: { characterId: 'character-a' } } },
    nodeId: 'qa-2',
    randomUUID: () => 'fork-id',
  }), /does not contain/)
  assert.equal(writes, 0)
})

test('catalog CAS replay recomputes the playthrough number without repeating branch side effects', async () => {
  let branchCalls = 0
  let catalog = { playthroughs: [{
    id: 'old', path: 'character-a/old/timeline.json',
    ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'ancestor-a', playthroughNumber: 1 } },
  }] }
  let savedTimeline
  const client = {
    async getTimeline() { return sourceTimeline() },
    async postBranch() { branchCalls += 1; return { sessionId: 'child' } },
    async getMessages() {
      return { incompleteTurn: false, messages: [{ role: 'user', seq: 4 }, { role: 'assistant', seq: 7 }] }
    },
    async createDirs() {},
    async putTimeline(_playthrough, timeline) { savedTimeline = timeline },
    async updateCatalog(mutator) {
      await mutator(structuredClone(catalog))
      catalog.playthroughs.push({
        id: 'concurrent', path: 'character-a/concurrent/timeline.json',
        ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'other', playthroughNumber: 2 } },
      })
      catalog = await mutator(structuredClone(catalog))
      return structuredClone(catalog)
    },
    async getFocus(playthrough) {
      const node = savedTimeline.nodes.at(-1)
      return { playthroughId: playthrough.id, sessionId: 'child', nodeId: node.id, variantId: node.adoptedVariantId }
    },
  }
  const result = await forkPlaythroughAtNode(client, {
    playthrough: catalog.playthroughs[0], nodeId: 'qa-2', randomUUID: () => 'fork-id',
  })
  assert.equal(branchCalls, 1)
  assert.equal(result.playthrough.title, '3周目')
  assert.deepEqual(catalog.playthroughs.map(item => item.id), ['old', 'concurrent', 'playthrough-fork-id'])
})
