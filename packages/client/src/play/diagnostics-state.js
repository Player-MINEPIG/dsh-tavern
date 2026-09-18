import { PLUGIN_ID } from '../../../identity.js'
import { loadPlaySidebarResources } from './sidebar-model.js'

const DISMISSED_KEY = `${PLUGIN_ID}:workspace-diagnostics-dismissed:v1`
const MAX_DISMISSED = 2000

export function workspaceDiagnosticScope(workspace) {
  return JSON.stringify([workspace?.workspaceId ?? null, workspace?.rootPath ?? null])
}

export function currentWorkspaceIssues(resources) {
  const scope = workspaceDiagnosticScope(resources?.workspace)
  const playthroughs = new Map((resources?.catalog?.playthroughs ?? []).map(item => [item.id, item]))
  const characters = new Map((resources?.characters ?? []).map(item => [item.id, item.name]))
  const issues = new Map()
  for (const diagnostic of resources?.diagnostics ?? []) {
    const playthrough = playthroughs.get(diagnostic.playthroughId)
    const binding = playthrough?.ext?.pmpDshTavern
    const code = diagnostic.code || 'PLAY_TIMELINE_READ_FAILED'
    const key = JSON.stringify([scope, diagnostic.playthroughId, code])
    issues.set(key, {
      ...diagnostic, key, scope, code, kind: 'timeline', playthrough,
      characterName: characters.get(binding?.characterId) ?? binding?.characterName ?? '',
    })
  }
  return [...issues.values()].sort((a, b) => a.key.localeCompare(b.key))
}

// This is current resource state, not a log. Dismissals store identities only;
// error bodies and resource contents are never copied into browser storage.
export function createWorkspaceDiagnostics(client, {
  load = loadPlaySidebarResources,
  storage,
} = {}) {
  let dismissed = new Set()
  try {
    const saved = JSON.parse(storage?.getItem(DISMISSED_KEY) ?? '[]')
    if (Array.isArray(saved)) dismissed = new Set(saved.filter(item => typeof item === 'string').slice(-MAX_DISMISSED))
  } catch { /* Storage availability must not block diagnostics. */ }
  let snapshot = { resources: null, issues: [], loading: true, error: null, showSummary: false }
  let generation = 0
  let disposed = false
  const listeners = new Set()
  const openListeners = new Set()
  const persistDismissed = () => {
    dismissed = new Set([...dismissed].slice(-MAX_DISMISSED))
    try { storage?.setItem(DISMISSED_KEY, JSON.stringify([...dismissed])) } catch { /* Optional UI preference. */ }
  }
  const commit = next => {
    snapshot = { ...next, showSummary: next.issues.some(issue => !dismissed.has(issue.key)) }
    for (const listener of listeners) listener()
  }
  const controller = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribeOpen(listener) {
      openListeners.add(listener)
      return () => openListeners.delete(listener)
    },
    open(playthroughId = null) {
      if (disposed) return
      for (const listener of openListeners) listener(playthroughId)
    },
    dismiss() {
      if (disposed) return
      for (const issue of snapshot.issues) dismissed.add(issue.key)
      persistDismissed()
      commit(snapshot)
    },
    updateResources(update) {
      if (snapshot.resources === null || disposed) return
      commit({ ...snapshot, resources: update(snapshot.resources) })
    },
    async refresh() {
      if (disposed) return
      const request = ++generation
      // Never present the previous workspace as the result of a pending check.
      // Keep acknowledgements until a successful snapshot proves resolution.
      commit({ resources: null, issues: [], loading: true, error: null })
      try {
        const resources = await load(client)
        if (disposed || request !== generation) return
        const issues = currentWorkspaceIssues(resources)
        const scope = workspaceDiagnosticScope(resources.workspace)
        const currentKeys = new Set(issues.map(issue => issue.key))
        for (const key of dismissed) {
          try {
            const [owner] = JSON.parse(key)
            if ((owner === scope || owner === 'workspace-read') && !currentKeys.has(key)) dismissed.delete(key)
          } catch { dismissed.delete(key) }
        }
        persistDismissed()
        commit({ resources, issues, loading: false, error: null })
      } catch (reason) {
        if (disposed || request !== generation) return
        const code = reason?.code || 'PLAY_WORKSPACE_READ_FAILED'
        const issue = {
          key: JSON.stringify(['workspace-read', null, code]), scope: 'workspace-read', kind: 'workspace', code,
          message: reason instanceof Error ? reason.message : String(reason),
        }
        commit({ resources: null, issues: [issue], loading: false, error: issue })
      }
    },
    dispose() {
      disposed = true
      generation++
      listeners.clear()
      openListeners.clear()
    },
  }
  return controller
}

export function workspaceDiagnosticReport(snapshot, issues = snapshot.issues) {
  return JSON.stringify({
    scope: 'current-rp-workspace',
    workspace: snapshot.resources?.workspace ? {
      workspaceId: snapshot.resources.workspace.workspaceId,
      rootPath: snapshot.resources.workspace.rootPath,
    } : null,
    issues: issues.map(issue => ({
      module: 'RP workspace', code: issue.code, message: issue.message,
      playthroughId: issue.playthroughId ?? null, path: issue.path ?? null,
    })),
  }, null, 2)
}
