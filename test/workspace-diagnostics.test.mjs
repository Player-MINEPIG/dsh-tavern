import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWorkspaceDiagnostics,
  currentWorkspaceIssues,
  workspaceDiagnosticReport,
} from '../packages/client/src/play/diagnostics-state.js'

function resources({ workspaceId = 'workspace-a', rootPath = '/rp/a', diagnostics, selected = true } = {}) {
  return {
    workspace: { selected, workspaceId, rootPath },
    characters: [{ id: 'character', name: 'Character', description: 'PRIVATE_CARD_CONTENT' }],
    catalog: {
      playthroughs: [{
        id: 'playthrough', title: 'First playthrough', path: 'character/playthrough/timeline.json',
        ext: { pmpDshTavern: { characterId: 'character', characterName: 'Previous name' } },
      }],
    },
    timelines: { other: { nodes: [{ content: 'PRIVATE_CONVERSATION_CONTENT' }] } },
    diagnostics: diagnostics ?? [{
      playthroughId: 'playthrough', code: 'PLAY_SESSION_NOT_FOUND',
      path: 'character/playthrough/timeline.json', message: 'session "missing-session" not found',
    }],
  }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function memoryStorage() {
  const values = new Map()
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

function emptyPlaythroughResources(ids = ['first', 'middle', 'last']) {
  const value = resources({ diagnostics: [] })
  value.catalog.playthroughs = ids.map(id => ({
    id, title: id, path: `character/${id}/timeline.json`,
    ext: { pmpDshTavern: { characterId: 'character', rootSessionId: `session-${id}` } },
  }))
  value.timelines = Object.fromEntries(value.catalog.playthroughs.map(item => [item.path, { nodes: [] }]))
  return value
}

function sessionAvailability(ids = [], overrides = {}) {
  return {
    sessions: Object.fromEntries(ids.map(id => [id, { id, cwd: '/rp/a' }])),
    workspaceItems: [{ workspaceId: 'workspace-a', sessionIds: ids }],
    archivedSessionIds: [], sessionsPhase: 'ready', workspacesPhase: 'ready',
    ...overrides,
  }
}

test('empty timelines with unavailable root sessions have diagnostics at every catalog position', () => {
  const current = emptyPlaythroughResources()
  for (const missing of current.catalog.playthroughs) {
    const availableIds = current.catalog.playthroughs
      .filter(item => item.id !== missing.id).map(item => item.ext.pmpDshTavern.rootSessionId)
    const issues = currentWorkspaceIssues(current, sessionAvailability(availableIds))
    assert.deepEqual(issues.map(issue => [issue.playthroughId, issue.code, issue.sessionId]), [
      [missing.id, 'PLAY_NO_AVAILABLE_SESSION', missing.ext.pmpDshTavern.rootSessionId],
    ])
  }
  const allAvailable = current.catalog.playthroughs.map(item => item.ext.pmpDshTavern.rootSessionId)
  assert.deepEqual(currentWorkspaceIssues(current, sessionAvailability(allAvailable)), [], 'healthy empty playthroughs remain usable')
})

test('timeline read failures and unavailable sessions produce one diagnostic per affected playthrough', () => {
  const current = emptyPlaythroughResources(['failed-read', 'empty-missing', 'healthy'])
  current.diagnostics = [{
    playthroughId: 'failed-read', code: 'PLAY_SESSION_NOT_FOUND',
    path: 'character/failed-read/timeline.json', message: 'session not found',
  }]
  delete current.timelines['character/failed-read/timeline.json']
  const issues = currentWorkspaceIssues(current, sessionAvailability(['session-healthy']))
  assert.equal(issues.length, 2)
  assert.equal(issues.find(issue => issue.playthroughId === 'failed-read').code, 'PLAY_SESSION_NOT_FOUND')
  assert.equal(issues.find(issue => issue.playthroughId === 'empty-missing').code, 'PLAY_NO_AVAILABLE_SESSION')
})

test('archived or moved sessions use the unavailable-session explanation instead of claiming lost history', () => {
  const current = emptyPlaythroughResources(['archived', 'moved'])
  const available = sessionAvailability(['session-archived'], {
    sessions: {
      'session-archived': { id: 'session-archived', cwd: '/rp/a' },
      'session-moved': { id: 'session-moved', cwd: '/rp/other' },
    },
    archivedSessionIds: ['session-archived'],
  })
  const issues = currentWorkspaceIssues(current, available)
  assert.deepEqual(issues.map(issue => issue.playthroughId).sort(), ['archived', 'moved'])
  assert.ok(issues.every(issue => issue.code === 'PLAY_NO_AVAILABLE_SESSION'))
  assert.deepEqual(currentWorkspaceIssues(current, sessionAvailability(['session-archived', 'session-moved'])), [])
})

test('available timeline heads and variants keep playthroughs healthy when their original roots are unavailable', () => {
  const current = emptyPlaythroughResources(['head', 'variant'])
  for (const id of ['head', 'variant']) {
    current.timelines[`character/${id}/timeline.json`] = {
      nodes: [{
        id: 'qa', kind: 'qa', adoptedVariantId: 'v', variants: [{
          id: 'v', sessionId: id === 'variant' ? 'available-variant' : 'old-variant', startEventId: 1, endEventId: 2,
        }],
      }],
      ...(id === 'head' ? { head: { nodeId: 'qa', variantId: 'v', sessionId: 'available-head' } } : {}),
    }
  }
  assert.deepEqual(currentWorkspaceIssues(current, sessionAvailability(['available-head', 'available-variant'])), [])
})

test('unhydrated session and workspace mirrors cannot diagnose an empty list as unavailable sessions', () => {
  const current = emptyPlaythroughResources(['empty'])
  for (const [sessionsPhase, workspacesPhase] of [
    ['pending', 'pending'], ['ready', 'pending'], ['pending', 'ready'], [undefined, undefined],
  ]) {
    assert.deepEqual(currentWorkspaceIssues(current, sessionAvailability([], { sessionsPhase, workspacesPhase })), [])
  }
  assert.equal(currentWorkspaceIssues(current, sessionAvailability()).length, 1, 'ready mirrors can legitimately be empty')
})

test('availability follows either mirror-before-resource or resource-before-mirror arrival order', async () => {
  for (const mirrorFirst of [false, true]) {
    const pending = deferred()
    const diagnostics = createWorkspaceDiagnostics({}, { load: () => pending.promise })
    const refresh = diagnostics.refresh()
    if (mirrorFirst) diagnostics.setSessionAvailability(sessionAvailability())
    assert.deepEqual(diagnostics.getSnapshot().issues, [])
    pending.resolve(emptyPlaythroughResources(['empty']))
    await refresh
    if (!mirrorFirst) {
      assert.deepEqual(diagnostics.getSnapshot().issues, [])
      diagnostics.setSessionAvailability(sessionAvailability())
    }
    assert.deepEqual(diagnostics.getSnapshot().issues.map(issue => issue.code), ['PLAY_NO_AVAILABLE_SESSION'])
  }
})

test('mirror updates resolve and restore diagnostics without reloading workspace files', async () => {
  let loads = 0
  const diagnostics = createWorkspaceDiagnostics({}, { load: async () => {
    loads++
    return emptyPlaythroughResources(['empty'])
  } })
  diagnostics.setSessionAvailability(sessionAvailability())
  await diagnostics.refresh()
  diagnostics.dismiss()
  const loaded = diagnostics.getSnapshot().resources
  diagnostics.setSessionAvailability(sessionAvailability(['session-empty']))
  assert.equal(diagnostics.getSnapshot().resources, loaded)
  assert.deepEqual(diagnostics.getSnapshot().issues, [])
  diagnostics.setSessionAvailability(sessionAvailability())
  assert.equal(diagnostics.getSnapshot().showSummary, true, 'resolved issues alert again when they recur')
  assert.equal(diagnostics.getSnapshot().issues.length, 1)
  assert.equal(loads, 1)
  diagnostics.dispose()
  const disposed = diagnostics.getSnapshot()
  diagnostics.setSessionAvailability(sessionAvailability(['session-empty']))
  assert.equal(diagnostics.getSnapshot(), disposed)
})

test('pending mirrors after remount or recheck preserve dismissed availability issues', async () => {
  const storage = memoryStorage()
  const load = async () => emptyPlaythroughResources(['empty'])
  const first = createWorkspaceDiagnostics({}, { load, storage })
  first.setSessionAvailability(sessionAvailability())
  await first.refresh()
  first.dismiss()
  first.dispose()

  const second = createWorkspaceDiagnostics({}, { load, storage })
  second.setSessionAvailability(sessionAvailability([], { sessionsPhase: 'pending', workspacesPhase: 'pending' }))
  await second.refresh()
  assert.deepEqual(second.getSnapshot().issues, [])
  second.setSessionAvailability(sessionAvailability([], { workspacesPhase: 'pending' }))
  await second.refresh()
  assert.deepEqual(second.getSnapshot().issues, [])
  second.setSessionAvailability(sessionAvailability())
  assert.equal(second.getSnapshot().issues.length, 1)
  assert.equal(second.getSnapshot().showSummary, false, 'pending is not evidence of resolution')
  await second.refresh()
  assert.equal(second.getSnapshot().showSummary, false)
})

test('availability reports include the referenced root session ID without copying card or timeline content', () => {
  const current = emptyPlaythroughResources(['empty'])
  current.timelines['character/empty/timeline.json'].ext = { privateContent: 'PRIVATE_CONVERSATION_CONTENT' }
  const snapshot = { resources: current, issues: currentWorkspaceIssues(current, sessionAvailability()) }
  const report = JSON.parse(workspaceDiagnosticReport(snapshot))
  assert.equal(report.issues.length, 1)
  assert.equal(report.issues[0].sessionId, 'session-empty')
  assert.equal(report.issues[0].playthroughId, 'empty')
  assert.equal(report.issues[0].code, 'PLAY_NO_AVAILABLE_SESSION')
  assert.equal(JSON.stringify(report).includes('PRIVATE_'), false)
})

test('dismiss hides only the summary and repeated checks preserve the current problems', async () => {
  let next = resources()
  const diagnostics = createWorkspaceDiagnostics({}, { load: async () => next })
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, true)
  const first = diagnostics.getSnapshot()

  diagnostics.dismiss()
  assert.equal(diagnostics.getSnapshot().showSummary, false)
  assert.equal(diagnostics.getSnapshot().resources, first.resources)
  assert.equal(diagnostics.getSnapshot().issues, first.issues)

  next = resources({ diagnostics: [{
    ...next.diagnostics[0], message: 'same failed read, with more details',
  }] })
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, false)
  assert.equal(diagnostics.getSnapshot().issues.length, 1)
  assert.equal(diagnostics.getSnapshot().issues[0].message, 'same failed read, with more details')

  next = resources({ diagnostics: [...next.diagnostics, {
    playthroughId: 'second', code: 'PLAY_PATH_NOT_FOUND', path: 'second/timeline.json', message: 'missing file',
  }] })
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, true, 'a newly affected playthrough must be visible')
  assert.equal(diagnostics.getSnapshot().issues.length, 2)
})

test('a successfully resolved problem alerts again if it recurs', async () => {
  let next = resources()
  const diagnostics = createWorkspaceDiagnostics({}, { load: async () => next })
  await diagnostics.refresh()
  diagnostics.dismiss()
  next = resources({ diagnostics: [] })
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, false)
  assert.deepEqual(diagnostics.getSnapshot().issues, [])
  next = resources()
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, true)
})

test('dismissal is isolated by both workspace ID and root path and survives visits elsewhere', async () => {
  let next = resources()
  const diagnostics = createWorkspaceDiagnostics({}, { load: async () => next })
  await diagnostics.refresh()
  diagnostics.dismiss()

  for (const other of [
    resources({ workspaceId: 'workspace-b' }),
    resources({ rootPath: '/rp/b' }),
    resources({ workspaceId: null, rootPath: null, selected: false, diagnostics: [] }),
  ]) {
    next = other
    await diagnostics.refresh()
    assert.equal(diagnostics.getSnapshot().showSummary, other.diagnostics.length > 0)
    next = resources()
    await diagnostics.refresh()
    assert.equal(diagnostics.getSnapshot().showSummary, false, 'another workspace cannot resolve this workspace’s issue')
  }
})

test('pending checks hide previous workspace data without resolving its dismissed issues', async () => {
  let result = Promise.resolve(resources())
  const diagnostics = createWorkspaceDiagnostics({}, { load: () => result })
  await diagnostics.refresh()
  diagnostics.dismiss()
  const pending = deferred()
  result = pending.promise
  const refresh = diagnostics.refresh()
  assert.deepEqual(diagnostics.getSnapshot(), {
    resources: null, issues: [], loading: true, error: null, showSummary: false,
  })
  pending.resolve(resources())
  await refresh
  assert.equal(diagnostics.getSnapshot().showSummary, false)
})

test('newest successful check wins even if an older workspace read completes later', async () => {
  const first = deferred(), second = deferred()
  const requests = [first, second]
  const diagnostics = createWorkspaceDiagnostics({}, { load: () => requests.shift().promise })
  const oldCheck = diagnostics.refresh()
  const newCheck = diagnostics.refresh()
  second.resolve(resources({ workspaceId: 'workspace-b', rootPath: '/rp/b' }))
  await newCheck
  diagnostics.dismiss()
  const current = diagnostics.getSnapshot()
  first.resolve(resources({ diagnostics: [] }))
  await oldCheck
  assert.equal(diagnostics.getSnapshot(), current)
  assert.equal(current.resources.workspace.workspaceId, 'workspace-b')
  assert.equal(current.showSummary, false)
})

test('an obsolete failed request cannot replace a newer successful check', async () => {
  const first = deferred(), second = deferred()
  const requests = [first, second]
  const diagnostics = createWorkspaceDiagnostics({}, { load: () => requests.shift().promise })
  const oldCheck = diagnostics.refresh()
  const newCheck = diagnostics.refresh()
  second.resolve(resources({ diagnostics: [] }))
  await newCheck
  const current = diagnostics.getSnapshot()
  first.reject(new Error('obsolete workspace no longer exists'))
  await oldCheck
  assert.equal(diagnostics.getSnapshot(), current)
  assert.equal(current.error, null)
})

test('an obsolete successful request cannot hide a newer failed check', async () => {
  const first = deferred(), second = deferred()
  const requests = [first, second]
  const diagnostics = createWorkspaceDiagnostics({}, { load: () => requests.shift().promise })
  const oldCheck = diagnostics.refresh()
  const newCheck = diagnostics.refresh()
  second.reject(Object.assign(new Error('new workspace unavailable'), { code: 'WORKSPACE_UNAVAILABLE' }))
  await newCheck
  const current = diagnostics.getSnapshot()
  first.resolve(resources({ diagnostics: [] }))
  await oldCheck
  assert.equal(diagnostics.getSnapshot(), current)
  assert.equal(current.error.code, 'WORKSPACE_UNAVAILABLE')
  assert.equal(current.showSummary, true)
})

test('a failed recheck does not clear dismissals for unresolved timeline problems', async () => {
  let next = resources()
  const diagnostics = createWorkspaceDiagnostics({}, {
    load: async () => { if (next instanceof Error) throw next; return next },
  })
  await diagnostics.refresh()
  diagnostics.dismiss()
  next = new Error('temporary network failure')
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().resources, null)
  assert.equal(diagnostics.getSnapshot().error.code, 'PLAY_WORKSPACE_READ_FAILED')
  assert.equal(diagnostics.getSnapshot().issues[0].kind, 'workspace')
  assert.equal(diagnostics.getSnapshot().showSummary, true)
  next = resources()
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, false)
  assert.equal(diagnostics.getSnapshot().issues.length, 1)
})

test('workspace read failures can be dismissed, and alert again after a successful recovery', async () => {
  let fail = true
  const diagnostics = createWorkspaceDiagnostics({}, {
    load: async () => { if (fail) throw new Error('workspace unavailable'); return resources({ diagnostics: [] }) },
  })
  await diagnostics.refresh()
  diagnostics.dismiss()
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, false)
  fail = false
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().error, null)
  fail = true
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot().showSummary, true)
})

test('dismissals survive controller remounts without persisting resource or error content', async () => {
  const storage = memoryStorage()
  const first = createWorkspaceDiagnostics({}, { load: async () => resources(), storage })
  await first.refresh()
  first.dismiss()
  first.dispose()
  const second = createWorkspaceDiagnostics({}, { load: async () => resources(), storage })
  await second.refresh()
  assert.equal(second.getSnapshot().showSummary, false)
  assert.equal(second.getSnapshot().issues.length, 1)
  const persisted = [...storage.values.values()].join('\n')
  for (const privateContent of ['PRIVATE_CARD_CONTENT', 'PRIVATE_CONVERSATION_CONTENT', 'missing-session', 'First playthrough']) {
    assert.equal(persisted.includes(privateContent), false)
  }
})

test('unavailable or malformed optional browser storage never blocks checks or dismissal', async () => {
  for (const storage of [
    undefined,
    { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } },
    { getItem: () => '{invalid JSON', setItem() { throw new Error('quota') } },
    { getItem: () => '{"not":"an array"}', setItem() {} },
  ]) {
    const diagnostics = createWorkspaceDiagnostics({}, { load: async () => resources(), storage })
    await diagnostics.refresh()
    assert.equal(diagnostics.getSnapshot().showSummary, true)
    diagnostics.dismiss()
    await diagnostics.refresh()
    assert.equal(diagnostics.getSnapshot().showSummary, false)
  }
})

test('dispose ignores pending results and stops refresh, resource updates and panel listeners', async () => {
  const pending = deferred()
  let loads = 0, notifications = 0
  const opened = []
  const diagnostics = createWorkspaceDiagnostics({}, { load: () => { loads++; return pending.promise } })
  diagnostics.subscribe(() => { notifications++ })
  diagnostics.subscribeOpen(id => opened.push(id))
  const refresh = diagnostics.refresh()
  const current = diagnostics.getSnapshot()
  assert.equal(notifications, 1)
  diagnostics.dispose()
  pending.resolve(resources())
  await refresh
  await diagnostics.refresh()
  diagnostics.updateResources(() => resources())
  diagnostics.open('playthrough')
  assert.equal(loads, 1)
  assert.equal(notifications, 1)
  assert.deepEqual(opened, [])
  assert.equal(diagnostics.getSnapshot(), current)
})

test('sidebar and diagnostics panel share reads while open and local reorder stay read-free', async () => {
  let loads = 0, updates = 0
  const opened = []
  const client = { fixture: true }
  const diagnostics = createWorkspaceDiagnostics(client, { load: async received => {
    assert.equal(received, client)
    loads++
    return resources()
  } })
  const stopUpdates = diagnostics.subscribe(() => { updates++ })
  const stopOpen = diagnostics.subscribeOpen(id => opened.push(id))
  await diagnostics.refresh()
  assert.equal(diagnostics.getSnapshot(), diagnostics.getSnapshot(), 'external store snapshots stay stable between writes')
  diagnostics.open()
  diagnostics.open('playthrough')
  assert.deepEqual(opened, [null, 'playthrough'])
  assert.equal(loads, 1)
  const before = diagnostics.getSnapshot()
  diagnostics.updateResources(previous => ({ ...previous, characters: [...previous.characters].reverse() }))
  assert.notEqual(diagnostics.getSnapshot().resources, before.resources)
  assert.equal(diagnostics.getSnapshot().issues, before.issues)
  assert.equal(loads, 1)
  stopUpdates()
  stopOpen()
  const previousUpdates = updates
  diagnostics.open('other')
  diagnostics.dismiss()
  assert.equal(updates, previousUpdates)
  assert.deepEqual(opened, [null, 'playthrough'])
})

test('issue projection groups duplicate reads and keeps useful labels when a card is missing', () => {
  const current = resources()
  current.diagnostics.push({ ...current.diagnostics[0], message: 'latest error' })
  const issues = currentWorkspaceIssues(current)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].message, 'latest error')
  assert.equal(issues[0].characterName, 'Character')
  current.characters = []
  assert.equal(currentWorkspaceIssues(current)[0].characterName, 'Previous name')
  current.catalog.playthroughs = []
  delete current.diagnostics[0].code
  current.diagnostics = [current.diagnostics[0]]
  const orphaned = currentWorkspaceIssues(current)[0]
  assert.equal(orphaned.code, 'PLAY_TIMELINE_READ_FAILED')
  assert.equal(orphaned.characterName, '')
  assert.equal(orphaned.playthrough, undefined)
})

test('copied reports include troubleshooting fields and omit character, prompt and conversation data', async () => {
  const current = resources()
  current.diagnostics.push({
    playthroughId: 'other', code: 'PLAY_PATH_NOT_FOUND', path: 'other/timeline.json', message: 'missing file',
  })
  const diagnostics = createWorkspaceDiagnostics({}, { load: async () => current })
  await diagnostics.refresh()
  const snapshot = diagnostics.getSnapshot()
  const report = JSON.parse(workspaceDiagnosticReport(snapshot))
  assert.equal(report.scope, 'current-rp-workspace')
  assert.deepEqual(report.workspace, { workspaceId: 'workspace-a', rootPath: '/rp/a' })
  assert.equal(report.issues.length, 2)
  assert.deepEqual(report.issues.find(issue => issue.playthroughId === 'playthrough'), {
    module: 'RP workspace', code: 'PLAY_SESSION_NOT_FOUND',
    message: 'session "missing-session" not found', playthroughId: 'playthrough',
    path: 'character/playthrough/timeline.json',
  })
  assert.equal(JSON.stringify(report).includes('PRIVATE_'), false)
  assert.equal(JSON.stringify(report).includes('First playthrough'), false)
  const selectedIssue = snapshot.issues.find(issue => issue.playthroughId === 'other')
  const selectedReport = JSON.parse(workspaceDiagnosticReport(snapshot, [selectedIssue]))
  assert.deepEqual(selectedReport.issues.map(issue => issue.playthroughId), ['other'])
  assert.equal(JSON.parse(workspaceDiagnosticReport({ resources: null, issues: [] })).workspace, null)
})
