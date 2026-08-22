import test from 'node:test'
import assert from 'node:assert/strict'
import { createCharacterPlaythrough, renamePlaythrough } from '../packages/client/src/play/create.js'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'
import { createTurnReconciler } from '../packages/client/src/play/turns.js'

const playthrough = {
  id: 'pt-a',
  path: 'character-a/pt-a/timeline.json',
  title: '1周目',
  ext: { pmpDshTavern: { characterId: 'character-a', rootSessionId: 'session-a', playthroughNumber: 1 } },
}

function timeline() {
  return {
    nodes: [{
      id: 'qa-1', kind: 'qa', displayOverride: null, adoptedVariantId: 'v-1',
      variants: [{ id: 'v-1', sessionId: 'session-a', startEventId: 1, endEventId: 3 }],
    }],
  }
}

test('rename CAS replay preserves concurrent rows and fields', async () => {
  let catalog = { playthroughs: [playthrough] }
  let attempt = 0
  const client = {
    async updateCatalog(mutator) {
      attempt += 1
      const first = await mutator(structuredClone(catalog))
      catalog = { playthroughs: [...catalog.playthroughs, { id: 'pt-b', path: 'b/pt-b/timeline.json', title: '并发' }] }
      const second = await mutator(structuredClone(catalog))
      catalog = second
      return second
    },
    async getCatalog() { return structuredClone(catalog) },
  }
  const saved = await renamePlaythrough(client, playthrough, '新标题')
  assert.equal(attempt, 1)
  assert.equal(saved.title, '新标题')
  assert.equal(catalog.playthroughs.length, 2)
  assert.equal(catalog.playthroughs[1].title, '并发')
})

test('create CAS replay recomputes number and does not repeat external side effects', async () => {
  let catalog = { playthroughs: [{ ...playthrough }] }
  let timelineValue = { nodes: [{ kind: 'qa' }] }
  let attempts = 0
  const calls = []
  const client = {
    async getCatalog() { return structuredClone(catalog) },
    async getTimeline() { return structuredClone(timelineValue) },
    async getMessages() { return { incompleteTurn: false, messages: [{ role: 'user' }] } },
    async postSession() { calls.push('session'); return { sessionId: 'session-new' } },
    async getCharacterSelection() { return { selection: { characterCardId: 'character-a' } } },
    async putCharacterSelection() {},
    async createDirs() { calls.push('dirs') },
    async putTimeline() { calls.push('timeline'); timelineValue = { nodes: [] } },
    async updateCatalog(mutator) {
      attempts += 1
      await mutator(structuredClone(catalog))
      catalog.playthroughs.push({ id: 'pt-b', path: 'character-a/pt-b/timeline.json', ext: { pmpDshTavern: { characterId: 'character-a', playthroughNumber: 2 } } })
      catalog = await mutator(structuredClone(catalog))
      return catalog
    },
  }
  const result = await createCharacterPlaythrough(client, {
    character: { id: 'character-a' },
    randomUUID: () => '11111111-2222-4333-8444-555555555555',
    now: () => new Date('2026-08-19T03:04:05.000Z'),
  })
  assert.equal(attempts, 1)
  assert.deepEqual(calls, ['session', 'dirs', 'timeline'])
  assert.equal(result.playthrough.title, '3周目')
  assert.equal(catalog.playthroughs.some(item => item.id === 'pt-b'), true)
})

test('node CAS replay applies local intent to fresh timeline and preserves unrelated edits', async () => {
  let value = timeline()
  let attempt = 0
  const client = {
    async updateTimeline(_playthrough, mutator) {
      attempt += 1
      await mutator(structuredClone(value))
      value.nodes.push({ id: 'qa-2', kind: 'qa', displayOverride: null, adoptedVariantId: 'v-2', variants: [{ id: 'v-2', sessionId: 's2', startEventId: 4, endEventId: 6 }] })
      value = await mutator(structuredClone(value))
      return value
    },
  }
  const saved = await createPlayNodeController(client).setDisplayOverride(playthrough, 'qa-1', 'local display')
  assert.equal(attempt, 1)
  assert.equal(saved.nodes.find(item => item.id === 'qa-1').displayOverride, 'local display')
  assert.equal(saved.nodes.find(item => item.id === 'qa-2').id, 'qa-2')
})

test('first-QA swipe creates one clean session, preserves import context and appends variant once', async () => {
  let value = timeline()
  let updateAttempts = 0
  let branches = 0
  let sessions = 0
  let prompts = 0
  const client = {
    async getTimeline() { return structuredClone(value) },
    async getMessages(sessionId) {
      if (sessionId === 'session-a') return { incompleteTurn: false, messages: [{ role: 'user', seq: 1, text: '原问题' }, { role: 'assistant', seq: 3, text: '旧回复' }] }
      return { incompleteTurn: false, messages: [{ role: 'user', seq: 1, text: '原问题' }, { role: 'assistant', seq: 4, text: '新回复' }] }
    },
    async getImportContextBinding() { return { path: 'character-a/pt-a/import-context.json' } },
    async postSession(sourceSessionId, importContextRef) {
      sessions += 1
      assert.equal(sourceSessionId, 'session-a')
      assert.deepEqual(importContextRef, { path: 'character-a/pt-a/import-context.json' })
      return { sessionId: 'session-new' }
    },
    async postBranch() { branches += 1; return { sessionId: 'wrong' } },
    async postUserMessage() { prompts += 1 },
    async updateTimeline(_playthrough, mutator) {
      updateAttempts += 1
      await mutator(structuredClone(value))
      value = await mutator(structuredClone(value))
      return value
    },
    async getFocus() { return { sessionId: 'session-new' } },
  }
  const result = await createPlayNodeController(client, { idFactory: () => 'variant-new' }).createReplySwipe(playthrough, 'qa-1')
  assert.equal(updateAttempts, 1)
  assert.equal(branches, 0)
  assert.equal(sessions, 1)
  assert.equal(prompts, 1)
  assert.equal(value.nodes[0].variants.filter(item => item.id === 'variant-new').length, 1)
  assert.equal(result.variantId, 'variant-new')
})

test('later swipe branches the current continuation exactly after the previous active QA', async () => {
  let value = {
    nodes: [
      {
        id: 'qa-1', kind: 'qa', displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'v-1',
        variants: [{ id: 'v-1', sessionId: 'session-ancestor', startEventId: 1, endEventId: 3 }],
      },
      {
        id: 'qa-2', kind: 'qa', displayOverride: null,
        parentVariantId: 'v-1', adoptedVariantId: 'v-2',
        variants: [{ id: 'v-2', sessionId: 'session-current', startEventId: 4, endEventId: 6 }],
      },
    ],
    head: { sessionId: 'session-current', nodeId: 'qa-2', variantId: 'v-2' },
  }
  const calls = []
  const client = {
    async getTimeline() { return structuredClone(value) },
    async getMessages(sessionId) {
      if (sessionId === 'session-current') return { incompleteTurn: false, messages: [
        { role: 'user', seq: 4, text: '第二问' },
        { role: 'assistant', seq: 6, text: '旧回复' },
      ] }
      return { incompleteTurn: false, messages: [
        { role: 'user', seq: 4, text: '第二问' },
        { role: 'assistant', seq: 7, text: '新回复' },
      ] }
    },
    async postBranch(sessionId, atEventId) {
      calls.push(['branch', sessionId, atEventId])
      return { sessionId: 'session-new' }
    },
    async postSession() { throw new Error('later swipe must not create a root session') },
    async postUserMessage(sessionId, text) { calls.push(['prompt', sessionId, text]) },
    async updateTimeline(_playthrough, mutator) {
      value = await mutator(structuredClone(value))
      return value
    },
    async getFocus() { return { sessionId: 'session-new' } },
  }
  await createPlayNodeController(client, { idFactory: () => 'variant-new' })
    .createReplySwipe(playthrough, 'qa-2')
  assert.deepEqual(calls, [
    ['branch', 'session-current', 3],
    ['prompt', 'session-new', '第二问'],
  ])
})

test('turn reconcile CAS replay does not duplicate an already recorded QA', async () => {
  let value = { nodes: [] }
  let captured
  const client = {
    async getMessages() { return { incompleteTurn: false, messages: [{ role: 'user', seq: 1 }, { role: 'assistant', seq: 2 }] } },
    async getTimeline() { return structuredClone(value) },
    async updateTimeline(_playthrough, mutator) {
      captured = await mutator(structuredClone(value))
      value = captured
      const replay = await mutator(structuredClone(value))
      value = replay
      return replay
    },
  }
  const result = await createTurnReconciler(client)('session-a', playthrough)
  assert.equal(result.added.length, 0)
  assert.equal(value.nodes.length, 1)
})

test('turn reconcile never appends a historical session after another active head', async () => {
  const value = {
    nodes: [{
      id: 'qa-head', kind: 'qa', parentVariantId: null, adoptedVariantId: 'v-head',
      variants: [{ id: 'v-head', sessionId: 'head-session', startEventId: 1, endEventId: 2 }],
    }],
    head: { sessionId: 'head-session', nodeId: 'qa-head', variantId: 'v-head' },
  }
  let writes = 0
  const client = {
    async getMessages() {
      return { incompleteTurn: false, messages: [
        { role: 'user', seq: 1, text: 'foreign user' },
        { role: 'assistant', seq: 2, text: 'foreign answer' },
      ] }
    },
    async getTimeline() { return structuredClone(value) },
    async updateTimeline() { writes += 1; throw new Error('must not write') },
  }

  const result = await createTurnReconciler(client)('historical-session', playthrough)
  assert.equal(result.added.length, 0)
  assert.deepEqual(result.timeline, value)
  assert.equal(writes, 0)
})
