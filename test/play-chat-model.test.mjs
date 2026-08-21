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
    head: { sessionId: 'shared', nodeId: 'first-qa', variantId: 'first-v' },
  }
  const selectedTimeline = {
    nodes: [{ id: 'selected-qa', variants: [{ id: 'selected-v', sessionId: 'shared' }] }],
    head: { sessionId: 'shared', nodeId: 'selected-qa', variantId: 'selected-v' },
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

test('a historical membership never outranks another playthrough active head', async () => {
  const historical = { id: 'historical', path: 'historical/timeline.json' }
  const active = { id: 'active', path: 'active/timeline.json' }
  const historicalTimeline = {
    nodes: [{ id: 'old', variants: [{ id: 'old-v', sessionId: 'shared' }] }],
    head: { sessionId: 'other', nodeId: 'old', variantId: 'old-v' },
  }
  const activeTimeline = {
    nodes: [{ id: 'active', variants: [{ id: 'active-v', sessionId: 'shared' }] }],
    head: { sessionId: 'shared', nodeId: 'active', variantId: 'active-v' },
  }
  const client = {
    async getWorkspace() { return { selected: true, rootPath: '/rp' } },
    async getCatalog() { return { playthroughs: [historical, active] } },
    async getTimeline(playthrough) {
      return playthrough.id === 'historical' ? historicalTimeline : activeTimeline
    },
  }

  const match = await loadCurrentPlaythrough(client, { id: 'shared', cwd: '/rp' }, {
    preferredPlaythroughId: 'historical',
  })
  assert.equal(match.playthrough.id, 'active')
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
    assistantCandidates: ['Hi'],
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

test('legacy reply-level subagent nodes project as one real-user QA', () => {
  const timeline = {
    nodes: [
      {
        id: 'root', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: null, adoptedVariantId: 'root-v', variants: [
          { id: 'root-v', sessionId: 'session-a', startEventId: 1, endEventId: 2 },
        ],
      },
      {
        id: 'context-child', kind: 'qa', hidden: false, displayOverride: null,
        parentVariantId: 'root-v', adoptedVariantId: 'context-v', variants: [
          { id: 'context-v', sessionId: 'session-a', startEventId: 3, endEventId: 4 },
        ],
      },
    ],
    head: { sessionId: 'session-a', nodeId: 'context-child', variantId: 'context-v' },
  }
  const projected = projectTimelineQa(timeline, { 'session-a': { messages: [
    { role: 'user', seq: 1, text: 'Start', origin: { kind: 'user' } },
    { role: 'assistant', seq: 2, text: 'Dispatched' },
    { role: 'user', seq: 3, text: 'Child result', origin: { kind: 'context', producer: 'subagent-report' } },
    { role: 'assistant', seq: 4, text: '<正文>Final</正文>' },
  ] } })
  assert.equal(projected.length, 1)
  assert.equal(projected[0].id, 'root')
  assert.equal(projected[0].userText, 'Start')
  assert.deepEqual(projected[0].assistantCandidates, ['Dispatched', '<正文>Final</正文>'])
  assert.equal(projected[0].contexts[0].producer, 'subagent-report')
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

test('live projection ignores a historical session that is not the active head', () => {
  const tree = {
    nodes: [{
      id: 'qa', parentVariantId: null, adoptedVariantId: 'head-v',
      variants: [{ id: 'head-v', sessionId: 'head-session', startEventId: 1, endEventId: 2 }],
    }],
    head: { sessionId: 'head-session', nodeId: 'qa', variantId: 'head-v' },
  }
  assert.deepEqual(projectLiveTurns({
    timeline: tree,
    sessionId: 'historical-session',
    nodes: [
      { kind: 'user', seq: 1, content: [{ type: 'text', text: 'foreign user' }] },
      { kind: 'assistant', seq: 2, blocks: [{ kind: 'text', text: 'foreign answer' }] },
    ],
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
