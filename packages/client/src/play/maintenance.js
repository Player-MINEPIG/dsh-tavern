import { isPlaythroughArchived, withPlaythroughArchive } from '../../../play/src/playthrough-state.js'
import { workspaceDiagnosticScope } from './diagnostics-state.js'
import { updateCatalog } from './mutations.js'

export async function archiveInvalidPlaythroughs(client, {
  controller, expectedWorkspaceScope, isCurrent = () => true, now = () => new Date(),
} = {}) {
  const scope = expectedWorkspaceScope ?? workspaceDiagnosticScope(await client.getWorkspace())
  await controller.refresh()
  if (!isCurrent()) return null
  const snapshot = controller.getSnapshot()
  if (snapshot.loading || snapshot.error || snapshot.availabilityReady !== true || snapshot.resources?.workspace?.selected !== true
    || workspaceDiagnosticScope(snapshot.resources.workspace) !== scope
    || snapshot.issues.some(issue => issue.kind === 'workspace')) return null
  const targets = new Map()
  for (const issue of snapshot.issues) {
    const row = issue.playthrough
    if (issue.kind === 'timeline' && typeof row?.id === 'string' && typeof row.path === 'string'
      && snapshot.resources.catalog.playthroughs.some(item => item.id === row.id && item.path === row.path)
      && !isPlaythroughArchived(row)) targets.set(row.id, row.path)
  }
  if (targets.size === 0) return { archived: 0, preserved: snapshot.resources.catalog.playthroughs.filter(row => !isPlaythroughArchived(row)).length, failed: 0 }
  const archivedAt = now().toISOString()
  let report
  await updateCatalog(client, async current => {
    const workspace = await client.getWorkspace()
    if (!isCurrent() || controller.getSnapshot().availabilityReady !== true || workspaceDiagnosticScope(workspace) !== scope
      || workspaceDiagnosticScope(controller.getSnapshot().resources?.workspace) !== scope) {
      throw new Error('PLAY_ARCHIVE_SCOPE_CHANGED')
    }
    report = { archived: 0, preserved: 0, failed: 0 }
    const remaining = new Set(targets.keys())
    const playthroughs = current.playthroughs.map(row => {
      if (targets.has(row.id)) {
        if (targets.get(row.id) !== row.path) return row
        remaining.delete(row.id)
        if (!isPlaythroughArchived(row)) { report.archived++; return withPlaythroughArchive(row, archivedAt) }
        report.preserved++
        return row
      }
      if (!isPlaythroughArchived(row)) report.preserved++
      return row
    })
    report.failed = remaining.size
    return { ...current, playthroughs }
  }, { expectedWorkspaceScope: scope })
  return isCurrent() ? report : null
}
