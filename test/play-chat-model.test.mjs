import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findPlaythroughForSession,
  latestUserNodeSeq,
  loadCurrentPlaythrough,
  projectLiveTurns,
  projectTimelineQa,
  sessionIsInRpWorkspace,
} from '../packages/client/src/play/chat-model.js'

const playthrough = {
  id: 'pt-a',
  path: 'characters/a/playthroughs/pt-a/timeline.json',
  ext: { pmpDshTavern: { rootSessionId: 'root' } },
}
const timeline = {
  nodes: [{
    id: 'qa-1',
    kind: 'qa',
    hidden: false,
    displayOverride: null,
    adoptedVariantId: 'variant-a',
    variants: [{ id: 'variant-a', sessionId: 'fork', startEventId: 2, endEventId: 4 }],
  }],
}

test('current playthrough classification is workspace-first', async () => {
  assert.equal(sessionIsInRpWorkspace(
    { selected: true, rootPath: 'D:\\Roleplay\\' },
    { id: 'root', cwd: 'd:/roleplay' },
  ), true)
  assert.equal(sessionIsInRpWorkspace(
    { selected: true, rootPath: 'D:\\Roleplay' },
    { id: 'root', cwd: 'D:\\Other' },
  ), false)

  const calls = []
  const client = {
    async getWorkspace() { calls.push('workspace'); return { selected: true, rootPath: '/rp' } },
    async getCatalog() { calls.push('catalog'); return { playthroughs: [playthrough] } },
    async getTimeline() { calls.push('timeline'); return timeline },
  }
  assert.equal(await loadCurrentPlaythrough(client, { id: 'root', cwd: '/other' }), null)
  assert.deepEqual(calls, ['workspace'])

  const match = await loadCurrentPlaythrough(client, { id: 'root', cwd: '/rp' })
  assert.equal(match.playthrough.id, 'pt-a')
  assert.equal(match.timeline, timeline)
  assert.deepEqual(calls, ['workspace', 'workspace', 'catalog', 'timeline'])
})

test('variant sessions resolve to their owning playthrough', () => {
  assert.equal(findPlaythroughForSession('root', { playthroughs: [playthrough] }, {}).playthrough, playthrough)
  assert.equal(findPlaythroughForSession('fork', { playthroughs: [playthrough] }, { [playthrough.path]: timeline }).timeline, timeline)
  assert.equal(findPlaythroughForSession('external', { playthroughs: [playthrough] }, { [playthrough.path]: timeline }), null)
})

test('timeline projection renders only adopted visible QA ranges', () => {
  const projected = projectTimelineQa(timeline, {
    fork: { messages: [
      { id: 'system', role: 'system', seq: 1, text: 'hidden context' },
      { id: 'user', role: 'user', seq: 2, text: 'Hello' },
      { id: 'tool', role: 'tool', seq: 3, text: 'tool output' },
      {
        id: 'assistant', role: 'assistant', seq: 4, text: 'internal reasoningHi',
        content: [
          { type: 'reasoning', text: 'internal reasoning' },
          { type: 'text', text: 'Hi' },
        ],
      },
      { id: 'later', role: 'assistant', seq: 5, text: 'outside' },
    ] },
  })
  assert.deepEqual(projected, [{
    id: 'qa-1',
    hidden: false,
    userText: 'Hello',
    assistantText: 'Hi',
    originalAssistantText: 'Hi',
    displayOverridden: false,
    variant: timeline.nodes[0].variants[0],
    variants: timeline.nodes[0].variants,
    variantCount: 1,
  }])

  const overridden = structuredClone(timeline)
  overridden.nodes[0].displayOverride = 'Display only'
  const display = projectTimelineQa(overridden, { fork: [] })[0]
  assert.equal(display.assistantText, 'Display only')
  assert.equal(display.displayOverridden, true)
  overridden.nodes[0].hidden = true
  assert.equal(projectTimelineQa(overridden, { fork: [] })[0].hidden, true)
})

test('live projection shows the durable user immediately and streams only assistant text blocks', () => {
  const live = projectLiveTurns({
    timeline: { nodes: [] },
    sessionId: 'root',
    nodes: [{
      kind: 'user',
      seq: 10,
      content: [{ type: 'text', text: 'Hello now' }],
    }],
    partial: {
      turn: 1,
      step: 1,
      blocks: [
        { kind: 'reasoning', text: 'private reasoning' },
        { kind: 'text', text: 'Streaming answer' },
      ],
    },
    running: true,
  })
  assert.deepEqual(live, [{
    id: 'live-10',
    transient: true,
    userText: 'Hello now',
    assistantText: 'Streaming answer',
    running: true,
  }])
})

test('live projection disappears after the same session range is adopted by timeline', () => {
  const nodes = [
    { kind: 'user', seq: 10, content: [{ type: 'text', text: 'Hello' }] },
    { kind: 'assistant', seq: 12, blocks: [{ kind: 'text', text: 'Complete' }] },
  ]
  assert.equal(projectLiveTurns({ timeline: { nodes: [] }, sessionId: 'root', nodes })[0].assistantText, 'Complete')
  assert.deepEqual(projectLiveTurns({
    timeline: {
      nodes: [{ variants: [{ sessionId: 'root', startEventId: 10, endEventId: 12 }] }],
    },
    sessionId: 'root',
    nodes,
  }), [])
})

test('latest user sequence changes only when a newer user node arrives', () => {
  assert.equal(latestUserNodeSeq(undefined), -1)
  assert.equal(latestUserNodeSeq([
    { kind: 'user', seq: 2 },
    { kind: 'assistant', seq: 9 },
    { kind: 'context', seq: 10 },
    { kind: 'user', seq: 7 },
  ]), 7)
})
