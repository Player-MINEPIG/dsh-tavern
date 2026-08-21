import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findPlaythroughForSession,
  latestUserNodeSeq,
  loadCurrentPlaythrough,
  projectLiveTurns,
  projectTimelineQa,
  sessionHasConversationHistory,
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

test('conversation history ignores non-conversation session events', () => {
  assert.equal(sessionHasConversationHistory({ messages: [] }), false)
  assert.equal(sessionHasConversationHistory({ messages: [
    { role: 'system' },
    { role: 'tool' },
  ] }), false)
  assert.equal(sessionHasConversationHistory({ messages: [{ role: 'user' }] }), true)
  assert.equal(sessionHasConversationHistory({ messages: [{ role: 'assistant' }] }), true)
})

test('variant sessions resolve to their owning playthrough', () => {
  assert.equal(findPlaythroughForSession('root', { playthroughs: [playthrough] }, {}).playthrough, playthrough)
  assert.equal(findPlaythroughForSession('fork', { playthroughs: [playthrough] }, { [playthrough.path]: timeline }).timeline, timeline)
  assert.equal(findPlaythroughForSession('external', { playthroughs: [playthrough] }, { [playthrough.path]: timeline }), null)
})

test('explicit playthrough selection disambiguates a session shared by fork histories', async () => {
  const first = { id: 'first', path: 'first/timeline.json' }
  const selected = { id: 'selected', path: 'selected/timeline.json' }
  const firstTimeline = {
    nodes: [{ id: 'first-qa', variants: [{ id: 'first-v', sessionId: 'shared' }] }],
  }
  const selectedTimeline = {
    nodes: [{ id: 'selected-qa', variants: [{ id: 'selected-v', sessionId: 'shared' }] }],
  }
  const client = {
    async getWorkspace() { return { selected: true, rootPath: '/rp' } },
    async getCatalog() { return { playthroughs: [first, selected] } },
    async getTimeline(playthrough) {
      return playthrough.id === 'first' ? firstTimeline : selectedTimeline
    },
  }
  const match = await loadCurrentPlaythrough(client, { id: 'shared', cwd: '/rp' }, {
    preferredPlaythroughId: 'selected',
  })
  assert.equal(match.playthrough.id, 'selected')
  assert.equal(match.timeline, selectedTimeline)
})

test('an unrecorded active branch head still resolves to its owning playthrough', () => {
  const playthrough = { id: 'pt', path: 'card/pt/timeline.json' }
  const timeline = {
    nodes: [{
      id: 'qa', kind: 'qa', adoptedVariantId: 'v',
      variants: [{ id: 'v', sessionId: 'old-session', startEventId: 1, endEventId: 2 }],
    }],
    head: { sessionId: 'rollback-session', nodeId: 'qa', variantId: 'v' },
  }
  assert.equal(findPlaythroughForSession(
    'rollback-session', { playthroughs: [playthrough] }, { [playthrough.path]: timeline },
  )?.playthrough, playthrough)
})

test('timeline projection renders only adopted visible QA ranges', () => {
  const projected = projectTimelineQa(timeline, {
    fork: { messages: [
      { id: 'system', role: 'system', seq: 1, text: 'hidden context' },
      { id: 'user', role: 'user', seq: 2, text: 'Hello' },
      {
        id: 'context', role: 'user', seq: 3, text: 'Background child finished',
        origin: { kind: 'context', producer: 'subagent-settled', form: 'notice', summary: 'Child finished' },
      },
      { id: 'tool', role: 'tool', seq: 3.5, text: 'tool output' },
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
    contexts: [{
      id: 'context', seq: 3, text: 'Background child finished',
      producer: 'subagent-settled', form: 'notice', summary: 'Child finished',
    }],
    triggerKind: 'user',
    reasoningText: 'internal reasoning',
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
  overridden.nodes[0].displayOverride = ''
  const emptyDisplay = projectTimelineQa(overridden, { fork: [] })[0]
  assert.equal(emptyDisplay.assistantText, '')
  assert.equal(emptyDisplay.displayOverridden, true)
  overridden.nodes[0].hidden = true
  assert.equal(projectTimelineQa(overridden, { fork: [] })[0].hidden, true)
})

test('tree timeline projection follows only ancestors of the active head', () => {
  const timeline = {
    nodes: [
      {
        id: 'root', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'root-a', variants: [
          { id: 'root-a', sessionId: 'a', startEventId: 1, endEventId: 2 },
          { id: 'root-b', sessionId: 'b', startEventId: 1, endEventId: 2 },
        ],
      },
      {
        id: 'a-child', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: 'root-a', adoptedVariantId: 'a-child-v', variants: [
          { id: 'a-child-v', sessionId: 'a', startEventId: 3, endEventId: 4 },
        ],
      },
      {
        id: 'b-child', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: 'root-b', adoptedVariantId: 'b-child-v', variants: [
          { id: 'b-child-v', sessionId: 'b', startEventId: 3, endEventId: 4 },
        ],
      },
    ],
    head: { sessionId: 'b', nodeId: 'b-child', variantId: 'b-child-v' },
  }
  const message = (text, seq, role) => ({ text, seq, role, content: [{ type: 'text', text }] })
  const projected = projectTimelineQa(timeline, {
    a: { messages: [message('A user', 1, 'user'), message('A reply', 2, 'assistant'), message('A2 user', 3, 'user'), message('A2 reply', 4, 'assistant')] },
    b: { messages: [message('B user', 1, 'user'), message('B reply', 2, 'assistant'), message('B2 user', 3, 'user'), message('B2 reply', 4, 'assistant')] },
  })
  assert.deepEqual(projected.map(turn => turn.id), ['root', 'b-child'])
  assert.deepEqual(projected.map(turn => turn.assistantText), ['B reply', 'B2 reply'])
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
    contexts: [],
    triggerKind: 'user',
    reasoningText: 'private reasoning',
    assistantText: 'Streaming answer',
    running: true,
  }])
})

test('context-triggered live output keeps non-human provenance instead of becoming a user bubble', () => {
  const live = projectLiveTurns({
    timeline: { nodes: [] },
    sessionId: 'root',
    nodes: [
      {
        kind: 'context', seq: 20,
        content: [{ type: 'text', text: 'Child report body' }],
        source: { kind: 'subagent-report', form: 'relay' },
        provenance: { role: 'inject', label: 'subagent-report' },
        form: 'relay',
      },
      { kind: 'assistant', seq: 22, blocks: [{ kind: 'text', text: 'Still waiting.' }] },
    ],
  })
  assert.deepEqual(live, [{
    id: 'live-20', transient: true, userText: '', triggerKind: 'context',
    contexts: [{
      id: 'context-20', seq: 20, text: 'Child report body',
      producer: 'subagent-report', form: 'relay', summary: null,
    }],
    reasoningText: '', assistantText: 'Still waiting.', running: false,
  }])
})

test('live projection disappears after the same session range is adopted by timeline', () => {
  const nodes = [
    { kind: 'user', seq: 10, content: [{ type: 'text', text: 'Hello' }] },
    { kind: 'assistant', seq: 12, blocks: [
      { kind: 'reasoning', text: 'finished reasoning' },
      { kind: 'text', text: 'Complete' },
    ] },
  ]
  const projected = projectLiveTurns({ timeline: { nodes: [] }, sessionId: 'root', nodes })[0]
  assert.equal(projected.reasoningText, 'finished reasoning')
  assert.equal(projected.assistantText, 'Complete')
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
