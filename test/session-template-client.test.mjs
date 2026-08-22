import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SessionConfigurationUnavailableError,
  createCleanSessionWorkflow,
  createConfiguredPlaythroughWorkflow,
  workspaceIdForSession,
  workspaceTargetId,
} from '../packages/session-template/src/client-state.js'

test('clean-session workflow uses public DSH create/navigation seams in transactional order', async () => {
  const calls = []
  const target = await createCleanSessionWorkflow({
    workspaceId: 'workspace-a',
    source: { mode: 'current', sessionId: 'source' },
    preview: async source => { calls.push(['preview', source]); return { available: true, diagnostics: [] } },
    connectWorkspace: async id => { calls.push(['connectWorkspace', id]); return 'target' },
    applySelection: async (id, source) => { calls.push(['applySelection', id, source]) },
    openSession: id => { calls.push(['openSession', id]) },
    refresh: () => { calls.push(['refresh']) },
  })
  assert.equal(target, 'target')
  assert.deepEqual(calls.map(call => call[0]), [
    'preview',
    'connectWorkspace',
    'applySelection',
    'openSession',
    'refresh',
  ])
})

test('Mowan configuration workflow creates a character-owned playthrough and applies the exact source', async () => {
  const calls = []
  const source = { mode: 'template', templateId: 'template-b' }
  const target = await createConfiguredPlaythroughWorkflow({
    source,
    preview: async value => {
      calls.push(['preview', value])
      return {
        available: true,
        selection: { characterCardId: 'character-b' },
        contents: { characterCard: { id: 'character-b', name: 'Bob' } },
        diagnostics: [],
      }
    },
    applySelection: async (sessionId, value) => { calls.push(['apply', sessionId, value]) },
    playthroughController: {
      async create(args) {
        calls.push(['create', args.character, args.selectionFromSessionId])
        await args.configureSession('session-b')
        return { sessionId: 'session-b', playthrough: { id: 'pt-b' } }
      },
    },
    openSession: id => calls.push(['open', id]),
    refresh: () => calls.push(['refresh']),
  })
  assert.equal(target, 'session-b')
  assert.deepEqual(calls, [
    ['preview', source],
    ['create', { id: 'character-b', name: 'Bob' }, null],
    ['apply', 'session-b', source],
    ['open', 'session-b'],
    ['refresh'],
  ])
})

test('Mowan configuration workflow rejects configurations without a character before creating a session', async () => {
  let created = false
  await assert.rejects(createConfiguredPlaythroughWorkflow({
    source: { mode: 'current', sessionId: 'ordinary' },
    preview: async () => ({ available: true, selection: { characterCardId: null }, diagnostics: [] }),
    applySelection: async () => {},
    playthroughController: { create: async () => { created = true } },
    openSession: () => {},
    refresh: () => {},
  }), error => error.uiKey === 'template.error.needCharacter')
  assert.equal(created, false)
})

test('diagnostic, creation and apply failures never navigate or refresh', async () => {
  const diagnosticCalls = []
  await assert.rejects(
    createCleanSessionWorkflow({
      workspaceId: 'workspace-a',
      source: { mode: 'template', templateId: 'stale' },
      preview: async () => ({ available: false, diagnostics: [{ message: 'missing book' }] }),
      connectWorkspace: async () => { diagnosticCalls.push('connect') },
      applySelection: async () => { diagnosticCalls.push('apply') },
      openSession: () => { diagnosticCalls.push('open') },
      refresh: () => { diagnosticCalls.push('refresh') },
    }),
    error => error instanceof SessionConfigurationUnavailableError && /missing book/.test(error.message),
  )
  assert.deepEqual(diagnosticCalls, [])

  const creationCalls = []
  await assert.rejects(createCleanSessionWorkflow({
    workspaceId: 'workspace-a',
    source: { mode: 'current', sessionId: 'source' },
    preview: async () => ({ available: true, diagnostics: [] }),
    connectWorkspace: async () => { creationCalls.push('connect'); throw new Error('host create rejected') },
    applySelection: async () => { creationCalls.push('apply') },
    openSession: () => { creationCalls.push('open') },
    refresh: () => { creationCalls.push('refresh') },
  }), /host create rejected/)
  assert.deepEqual(creationCalls, ['connect'])

  const applyCalls = []
  await assert.rejects(createCleanSessionWorkflow({
    workspaceId: 'workspace-a',
    source: { mode: 'current', sessionId: 'source' },
    preview: async () => ({ available: true, diagnostics: [] }),
    connectWorkspace: async () => 'blank-target',
    applySelection: async () => { applyCalls.push('apply'); throw new Error('atomic store full') },
    openSession: () => { applyCalls.push('open') },
    refresh: () => { applyCalls.push('refresh') },
  }), /atomic store full/)
  assert.deepEqual(applyCalls, ['apply'])
})

test('workspace resolver follows DSH workspace membership rather than cwd guesses', () => {
  const workspaces = [
    { workspaceId: 'workspace-a', sessionIds: ['one', 'two'] },
    { workspaceId: 'workspace-b', sessionIds: ['three'] },
  ]
  assert.equal(workspaceIdForSession(workspaces, 'three'), 'workspace-b')
  assert.equal(workspaceIdForSession(workspaces, 'missing'), null)
  assert.equal(workspaceIdForSession(null, 'three'), null)
  assert.equal(workspaceTargetId({ items: workspaces, recentWorkspaceId: 'workspace-a' }, 'missing'), null)
  assert.equal(workspaceTargetId({ items: workspaces, recentWorkspaceId: 'workspace-a' }, undefined), 'workspace-a')
})
