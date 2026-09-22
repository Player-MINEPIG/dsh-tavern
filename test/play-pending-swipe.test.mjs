import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayNodeController } from '../packages/client/src/play/nodes.js'
import { pendingSwipe, pendingSwipeForSession } from '../packages/client/src/play/pending-swipe.js'
import { loadCurrentPlaythrough, projectLiveTurns } from '../packages/client/src/play/chat-model.js'
import { loadChatState } from '../packages/client/src/play/chat.js'
import { projectPlaySidebar } from '../packages/client/src/play/sidebar-model.js'

function fixture({ first = false } = {}) {
  const playthrough = { id: 'pt', path: 'pt/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'old', characterId: 'card' } } }
  const nodes = [1, 2, 3].map(i => ({ id: `qa-${i}`, kind: 'qa', parentVariantId: i === 1 ? null : `v-${i-1}`, adoptedVariantId: `v-${i}`, variants: [{ id: `v-${i}`, sessionId: 'old', startEventId: i*3, endEventId: i*3+1 }] }))
  let timeline = { nodes, head: { sessionId: 'old', nodeId: 'qa-3', variantId: 'v-3' } }
  const saved = structuredClone(timeline)
  const workspace = { selected: true, rootPath: '/rp' }
  const sourceIndex = first ? 1 : 2
  const userSeq = sourceIndex * 3
  let phase = 'open', writes = 0, release
  const oldMessages = nodes.flatMap((n, i) => [{ role: 'user', seq: (i+1)*3, text: `Q${i+1}` }, { role: 'assistant', seq: (i+1)*3+1, text: `A${i+1}` }])
  const client = {
    getWorkspace: async () => workspace,
    getCatalog: async () => ({ playthroughs: [playthrough] }),
    getTimeline: async () => structuredClone(timeline),
    putTimeline: async (_p, next) => { writes++; timeline = structuredClone(next) },
    getCharacterSelection: async () => ({ selection: null }),
    getFocus: async () => timeline.head,
    postSession: async () => ({ sessionId: 'new' }),
    postBranch: async () => ({ sessionId: 'new' }),
    postUserMessage: async () => ({ accepted: true }),
    getMessages: async id => id === 'old' ? { incompleteTurn: false, messages: oldMessages } : {
      incompleteTurn: phase === 'open', messages: [
        ...oldMessages.filter(m => m.seq < userSeq),
        { role: 'user', seq: userSeq, text: `Q${sourceIndex}` },
        ...(phase === 'done' ? [{ role: 'assistant', seq: userSeq+1, text: 'New reply' }] : []),
      ],
    },
  }
  const controller = createPlayNodeController(client, { delay: () => new Promise(r => { release = r }), maxPolls: 3, idFactory: () => 'new-variant' })
  return { client, controller, playthrough, saved, userSeq, get timeline() { return timeline }, get writes() { return writes }, settle(next = 'done') { phase = next; release() } }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

for (const first of [true, false]) test(`pending ${first ? 'first' : 'later'} swipe is navigable and streams without committing a fake variant`, async () => {
  const f = fixture({ first })
  const opened = []
  const task = f.controller.createReplySwipe(f.playthrough, first ? 'qa-1' : 'qa-2', { onStarted: value => opened.push(value.sessionId) })
  await tick()
  assert.deepEqual(opened, ['new'])
  assert.equal(f.writes, 0)
  assert.deepEqual(f.timeline, f.saved)
  const pending = pendingSwipe(f.client, f.playthrough)
  assert.equal(pending.sessionId, 'new')
  assert.equal(pendingSwipeForSession(f.client, 'new'), pending)
  const match = await loadCurrentPlaythrough(f.client, { id: 'new', cwd: '/rp' })
  assert.equal(match.playthrough.id, 'pt')
  assert.equal(await loadCurrentPlaythrough(f.client, { id: 'new', cwd: '/other' }), null)
  const state = await loadChatState(f.client, 'new', f.playthrough)
  assert.deepEqual(state.turns.map(turn => turn.assistantText), first ? [] : ['A1'])
  assert.equal(f.writes, 0)
  const turns = projectLiveTurns({ timeline: state.timeline, sessionId: 'new', running: true,
    nodes: [{ kind: 'user', seq: 3, content: [{ type: 'text', text: 'Q1' }] },
      ...(first ? [] : [{ kind: 'user', seq: 6, content: [{ type: 'text', text: 'Q2' }] }])],
    partial: { blocks: [{ kind: 'text', text: 'Growing answer' }] },
  })
  assert.equal(turns.length, 1)
  assert.equal(turns[0].assistantText, 'Growing answer')
  const sidebar = projectPlaySidebar({ workspace: { selected: true, rootPath: '/rp' },
    characters: [{ id: 'card', name: 'Card' }], catalog: { playthroughs: [f.playthrough] },
    timelines: { [f.playthrough.path]: f.timeline }, sessions: { old: { id: 'old', cwd: '/rp' }, new: { id: 'new', cwd: '/rp' } },
    currentId: 'new', pendingSwipes: [pending],
  })
  assert.equal(sidebar.characters[0].playthroughs[0].active, true)
  assert.equal(sidebar.otherSessions.length, 0)
  f.settle()
  const result = await task
  assert.equal(result.sessionId, 'new')
  assert.equal(f.timeline.nodes[first ? 0 : 1].variants.length, 2)
  assert.equal(pendingSwipe(f.client, f.playthrough), null)
  assert.equal((await loadChatState(f.client, 'new', f.playthrough)).turns.at(-1).assistantText, 'New reply')
})

test('canceling before an assistant is saved ends polling and preserves existing variants', async () => {
  const f = fixture()
  const task = f.controller.createReplySwipe(f.playthrough, 'qa-2')
  await tick()
  f.settle('stopped')
  await assert.rejects(task, /stopped without a saved/)
  assert.equal(f.writes, 0)
  assert.deepEqual(f.timeline, f.saved)
  assert.match(pendingSwipe(f.client, f.playthrough).error, /stopped/)
})

test('display edits and another playthrough finish while a swipe waits, and survive its commit', async () => {
  const f = fixture()
  const other = { id: 'other', path: 'other/timeline.json' }
  let otherTimeline = structuredClone(f.saved)
  const get = f.client.getTimeline, put = f.client.putTimeline, focus = f.client.getFocus
  f.client.getTimeline = p => p.id === other.id ? structuredClone(otherTimeline) : get(p)
  f.client.putTimeline = (p, value) => p.id === other.id ? (otherTimeline = structuredClone(value)) : put(p, value)
  f.client.getFocus = p => p.id === other.id ? otherTimeline.head : focus(p)
  const task = f.controller.createReplySwipe(f.playthrough, 'qa-2')
  await tick()
  let edited = false, adopted = false
  const edit = f.controller.setDisplayOverride(f.playthrough, 'qa-1', 'Edited during stream').then(() => { edited = true })
  const adopt = f.controller.adoptVariant(other, 'qa-1', 'v-1').then(() => { adopted = true })
  await tick()
  try {
    assert.equal(edited, true, 'display save must not wait for model completion')
    assert.equal(adopted, true, 'another playthrough must not wait for this model')
    assert.equal((await loadChatState(f.client, 'new', f.playthrough)).turns[0].assistantText, 'Edited during stream')
    await f.controller.setDisplayOverride(f.playthrough, 'qa-1', null)
    assert.equal((await loadChatState(f.client, 'new', f.playthrough)).turns[0].assistantText, 'A1')
    await f.controller.setDisplayOverride(f.playthrough, 'qa-1', 'Retained edit')
  } finally {
    f.settle()
    await Promise.all([task, edit, adopt])
  }
  assert.equal(f.timeline.nodes[0].displayOverride, 'Retained edit')
  assert.equal(f.timeline.nodes[1].variants.length, 2)
})
