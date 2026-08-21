import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SessionCharacterBindingCache,
  loadSessionCharacterBindings,
  playthroughFocusTarget,
  projectPlaySidebar,
  requiresSystemWorkspaceConfirmation,
  shouldShowUnboundNotice,
  sessionIdsInRpWorkspace,
} from '../packages/client/src/play/sidebar-model.js'

function session(id, cwd, title = id) {
  return { id, cwd, displayTitle: title, blank: false }
}

test('RP workspace membership wins over timeline metadata and character binding', () => {
  const sessions = {
    's-play': session('s-play', 'D:\\Roleplay'),
    's-root': session('s-root', 'D:\\Roleplay'),
    's-unassigned': session('s-unassigned', 'D:\\Roleplay', 'Loose card session'),
    's-ordinary': session('s-ordinary', 'D:\\Roleplay', 'Regular session'),
    's-archived': session('s-archived', 'D:\\Roleplay'),
    's-external': session('s-external', 'D:\\Other', 'Moved outside RP'),
  }
  const workspace = { selected: true, rootPath: 'D:\\Roleplay', workspaceId: 'workspace-rp' }
  const workspaceItems = [{ workspaceId: 'workspace-rp', sessionIds: ['s-play', 's-root', 's-unassigned', 's-ordinary', 's-archived'] }]
  const catalog = {
    playthroughs: [{
      id: 'pt-a',
      title: 'First run',
      path: 'char-a/pt-a/timeline.json',
      ext: { pmpDshTavern: { characterId: 'char-a', rootSessionId: 's-root' } },
    }],
  }
  const timelines = {
    'char-a/pt-a/timeline.json': {
      nodes: [{ id: 'qa-1', kind: 'qa', variants: [{ id: 'v-1', sessionId: 's-play', startEventId: 1, endEventId: 2 }] }],
    },
  }

  const model = projectPlaySidebar({
    workspace,
    workspaceItems,
    characters: [{ id: 'char-a', name: 'Alice' }, { id: 'char-b', name: 'Bob' }],
    catalog,
    timelines,
    sessions,
    sessionIds: Object.keys(sessions),
    archivedSessionIds: ['s-archived'],
    currentId: 's-root',
    sessionCharacters: {
      's-unassigned': 'char-a',
      's-external': 'char-a',
      's-archived': 'char-b',
    },
  })

  const alice = model.characters.find(item => item.id === 'char-a')
  const bob = model.characters.find(item => item.id === 'char-b')
  assert.deepEqual(alice.playthroughs[0].sessionIds.sort(), ['s-play', 's-root'])
  assert.equal(alice.playthroughs[0].rootSessionId, 's-root')
  assert.equal(alice.playthroughs[0].active, true)
  assert.deepEqual(alice.unassigned.map(item => item.id), ['s-unassigned'])
  assert.deepEqual(bob.playthroughs, [])
  assert.deepEqual(bob.unassigned, [])
  assert.deepEqual(model.otherSessions.map(item => [item.id, item.kind]), [
    ['s-ordinary', 'ordinary'],
    ['s-external', 'external'],
  ])
  assert.deepEqual(model.playSessionIds.sort(), ['s-play', 's-root'])
})

test('outside the selected RP workspace every session stays non-RP despite stale bindings', () => {
  const sessions = {
    outside: session('outside', '/other'),
  }
  const model = projectPlaySidebar({
    workspace: { selected: true, rootPath: '/rp', workspaceId: 'rp' },
    workspaceItems: [{ workspaceId: 'rp', sessionIds: [] }],
    characters: [{ id: 'char-a', name: 'Alice' }],
    catalog: {
      playthroughs: [{ id: 'pt', path: 'char-a/pt/timeline.json', ext: { pmpDshTavern: { characterId: 'char-a' } } }],
    },
    timelines: {
      'char-a/pt/timeline.json': { nodes: [{ id: 'qa', variants: [{ id: 'v', sessionId: 'outside' }] }] },
    },
    sessions,
    sessionIds: ['outside'],
    sessionCharacters: { outside: 'char-a' },
  })

  assert.equal(model.characters[0].playthroughs[0].missing, true)
  assert.deepEqual(model.characters[0].unassigned, [])
  assert.deepEqual(model.otherSessions.map(item => [item.id, item.kind]), [['outside', 'external']])
})

test('an explicit playthrough selection stays unique when histories share the current session', () => {
  const shared = session('shared', '/rp')
  const catalog = {
    playthroughs: ['first', 'second'].map(id => ({
      id,
      path: `character/${id}/timeline.json`,
      ext: { pmpDshTavern: { characterId: 'character' } },
    })),
  }
  const timelines = Object.fromEntries(catalog.playthroughs.map(playthrough => [
    playthrough.path,
    { nodes: [{ id: `qa-${playthrough.id}`, variants: [{ id: `v-${playthrough.id}`, sessionId: 'shared' }] }] },
  ]))

  const model = projectPlaySidebar({
    workspace: { selected: true, rootPath: '/rp', workspaceId: 'rp' },
    workspaceItems: [{ workspaceId: 'rp', sessionIds: ['shared'] }],
    characters: [{ id: 'character', name: 'Character' }],
    catalog,
    timelines,
    sessions: { shared },
    sessionIds: ['shared'],
    currentId: 'shared',
    activePlaythroughId: 'second',
  })

  assert.deepEqual(model.characters[0].playthroughs.map(item => [item.id, item.active]), [
    ['first', false],
    ['second', true],
  ])
})

test('workspace path fallback is canonicalized when the DSH workspace row is not loaded yet', () => {
  const ids = sessionIdsInRpWorkspace({
    workspace: { selected: true, rootPath: 'D:\\Roleplay\\', workspaceId: 'pending' },
    workspaceItems: [],
    sessions: {
      matching: session('matching', 'd:/roleplay'),
      outside: session('outside', 'D:\\Other'),
    },
  })
  assert.deepEqual([...ids], ['matching'])
})

test('fresh focus can open an RP session even when the playthrough projection is stale', () => {
  const playthrough = { rootSessionId: 'root', sessionIds: ['root'] }
  assert.equal(playthroughFocusTarget({
    focus: { sessionId: 'new-swipe-session' },
    playthrough,
    rpSessionIds: ['root', 'new-swipe-session'],
  }), 'new-swipe-session')
  assert.equal(playthroughFocusTarget({
    focus: { sessionId: 'outside' },
    playthrough,
    rpSessionIds: ['root', 'new-swipe-session'],
  }), null)
})

test('character selection reads are cached and never exceed four concurrent requests', async () => {
  const cache = new SessionCharacterBindingCache()
  let active = 0
  let maximum = 0
  let calls = 0
  const client = {
    getSelection(id) {
      calls += 1
      active += 1
      maximum = Math.max(maximum, active)
      return new Promise(resolve => setImmediate(() => {
        active -= 1
        resolve({ characterCardId: `character-${id}` })
      }))
    },
  }
  const ids = Array.from({ length: 11 }, (_, index) => `session-${index}`)
  const first = await loadSessionCharacterBindings(client, ids, { concurrency: 99, cache })
  assert.equal(maximum, 4)
  assert.equal(calls, 11)
  assert.equal(first['session-3'], 'character-session-3')

  await loadSessionCharacterBindings(client, ids, { cache })
  assert.equal(calls, 11)
  cache.clear()
  await loadSessionCharacterBindings(client, ['session-3'], { cache })
  assert.equal(calls, 12)
})

test('system workspace confirmation follows the backend disk policy', () => {
  assert.equal(requiresSystemWorkspaceConfirmation('C:\\Roleplay'), true)
  assert.equal(requiresSystemWorkspaceConfirmation('c:/Roleplay'), true)
  assert.equal(requiresSystemWorkspaceConfirmation('D:\\Roleplay'), false)
  assert.equal(requiresSystemWorkspaceConfirmation('/'), true)
  assert.equal(requiresSystemWorkspaceConfirmation('/usr/local/rp'), true)
  assert.equal(requiresSystemWorkspaceConfirmation('/System/Volumes/Data'), true)
  assert.equal(requiresSystemWorkspaceConfirmation('/home/user/rp'), false)
})

test('ordinary-session notice follows workspace membership before stale card binding', () => {
  const workspace = { selected: true, rootPath: 'D:\\Roleplay' }
  assert.equal(shouldShowUnboundNotice({
    workspace,
    session: session('inside-bound', 'D:\\Roleplay'),
    selection: { selection: { characterCardId: 'character-a' } },
  }), false)
  assert.equal(shouldShowUnboundNotice({
    workspace,
    session: session('inside-ordinary', 'd:/roleplay'),
    selection: { selection: null },
  }), true)
  assert.equal(shouldShowUnboundNotice({
    workspace,
    session: session('outside-stale', 'D:\\Other'),
    selection: { selection: { characterCardId: 'character-a' } },
  }), true)
  assert.equal(shouldShowUnboundNotice({
    workspace: { selected: false, rootPath: null },
    session: session('unconfigured', 'D:\\Other'),
    selection: { selection: { characterCardId: 'character-a' } },
  }), true)
  assert.equal(shouldShowUnboundNotice({ workspace, session: null, selection: null }), false)
})
