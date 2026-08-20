import test from 'node:test'
import assert from 'node:assert/strict'
import { projectRpWorkspaceSetting, workspaceSelectionRequest } from '../packages/client/src/play/workspace-setting.js'

test('projects the authoritative RP workspace and marks a missing list item', () => {
  const setting = projectRpWorkspaceSetting({
    workspace: { selected: true, rootPath: 'D:/rp', contractVersion: 1 },
    items: [{ workspaceId: 'rp', path: 'D:/rp', title: 'Role play' }, { workspaceId: 'other', path: 'D:/other', title: 'Other' }],
  })
  assert.equal(setting.currentPath, 'D:/rp')
  assert.equal(setting.currentAvailable, true)
  assert.equal(setting.selectedPath, 'D:/rp')
  assert.deepEqual(setting.available.map(item => item.title), ['Role play', 'Other'])
})

test('keeps an authoritative workspace visible when DSH list no longer contains it', () => {
  const setting = projectRpWorkspaceSetting({
    workspace: { selected: true, rootPath: 'D:/gone', contractVersion: 1 },
    items: [{ workspaceId: 'other', path: 'D:/other', title: 'Other' }],
  })
  assert.equal(setting.currentAvailable, false)
  assert.equal(setting.selectedPath, 'D:/gone')
  assert.equal(setting.current.unavailable, true)
  assert.equal(setting.available.length, 1)
})

test('matches Windows workspace paths across slash and case differences', () => {
  const setting = projectRpWorkspaceSetting({
    workspace: { selected: true, rootPath: 'D:\\RP\\Tavern' },
    items: [{ workspaceId: 'rp', path: 'd:/rp/tavern/', title: 'Role play' }],
  })
  assert.equal(setting.currentAvailable, true)
  assert.equal(setting.selectedPath, 'd:/rp/tavern/')
  assert.deepEqual(
    workspaceSelectionRequest('d:/RP/tavern', { setting }),
    { path: 'd:/RP/tavern', changed: false },
  )
})

test('does not create a second settings truth for an unchanged path', () => {
  assert.deepEqual(workspaceSelectionRequest('D:/rp', { setting: { currentPath: 'D:/rp' } }), { path: 'D:/rp', changed: false })
  assert.deepEqual(workspaceSelectionRequest('D:/other', { setting: { currentPath: 'D:/rp' } }), { path: 'D:/other', changed: true })
  assert.throws(() => workspaceSelectionRequest(''), /non-empty string/)
})
