import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SessionConfigurationUnavailableError,
  createCleanSessionWorkflow,
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
