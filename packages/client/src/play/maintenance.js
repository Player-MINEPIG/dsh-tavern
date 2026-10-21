import { isPlaythroughArchived } from '../../../play/src/playthrough-state.js'

export async function archiveInvalidPlaythroughs(client, { isCurrent = () => true } = {}) {
  const workspace = await client.getWorkspace()
  const expectedWorkspaceScope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
  const catalog = await client.getCatalog()
  const report = { archived: 0, preserved: 0, failed: 0 }
  const candidates = []
  for (const row of catalog.playthroughs.filter(row => !isPlaythroughArchived(row))) {
    if (!isCurrent()) return null
    try {
      const inspection = await client.inspectPlaythrough(row.id)
      if (inspection.workspaceScope !== expectedWorkspaceScope) return null
      if (inspection.status === 'invalid') candidates.push(row.id)
      else report.preserved++
    } catch { report.failed++ }
  }
  for (const id of candidates) {
    if (!isCurrent()) return null
    try {
      const result = await client.archiveInvalidPlaythrough(id, { expectedWorkspaceScope })
      if (result.status === 'archived') report.archived++
      else report.preserved++
    } catch { report.failed++ }
  }
  return isCurrent() ? report : null
}
