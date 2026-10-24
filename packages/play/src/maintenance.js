import { parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'
import { isPlaythroughArchived } from './playthrough-state.js'

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

export function referencedPlaythroughSessions(playthrough, timeline) {
  const ids = new Set()
  const add = value => {
    if (typeof value !== 'string' || !SESSION_ID.test(value)) throw new TypeError('Unsupported session reference')
    ids.add(value)
  }
  const root = playthrough.ext?.pmpDshTavern?.rootSessionId
  if (root !== undefined) add(root)
  if (timeline.head !== undefined) add(timeline.head.sessionId)
  for (const node of timeline.nodes) for (const variant of node.variants) add(variant.sessionId)
  const heads = timeline.ext?.pmpDshTavern?.branchHeads
  if (heads !== undefined) {
    if (!Array.isArray(heads)) throw new TypeError('Unsupported remembered branch heads')
    for (const head of heads) {
      if (head === null || typeof head !== 'object' || Array.isArray(head)
        || ['branchVariantId', 'nodeId', 'variantId'].some(key => typeof head[key] !== 'string' || head[key].trim() === '')
        || Object.keys(head).some(key => !['branchVariantId', 'nodeId', 'variantId', 'sessionId'].includes(key))) {
        throw new TypeError('Unsupported remembered branch head')
      }
      add(head.sessionId)
    }
  }
  return [...ids]
}

export class PlayMaintenanceService {
  constructor({ workspaceStore, inspectSession, isDraftProtected = () => true }) {
    this.workspaceStore = workspaceStore
    this.inspectSession = inspectSession
    this.isDraftProtected = isDraftProtected
  }

  async assess(id, { signal, expectedWorkspaceScope, includeArchived = false } = {}) {
    signal?.throwIfAborted()
    const store = this.workspaceStore
    const scope = () => { const binding = store.get(); return JSON.stringify([binding.workspaceId, binding.rootPath]) }
    const workspaceScope = scope()
    const result = (status, reason, sessionIds = []) => ({ id, status, ...(reason ? { reason } : {}), sessionIds, workspaceScope })
    if (expectedWorkspaceScope !== undefined && expectedWorkspaceScope !== workspaceScope) return { result: result('unavailable', 'changed') }
    const mutationLease = store.captureMutationLease()
    let file, catalog, playthrough, timelineFile, timeline, sessionIds, readLease
    try {
      file = store.readFile('catalog.json', { validate: validatePlayDocument })
      parseCatalogJson(file.content)
      catalog = JSON.parse(file.content)
      playthrough = catalog.playthroughs.find(row => row.id === id)
      if (!playthrough) return { result: result('unavailable', 'not-found') }
      if (!includeArchived && isPlaythroughArchived(playthrough)) return { result: result('protected', 'archived') }
      if (this.isDraftProtected(playthrough) !== false) return { result: result('protected', 'draft') }
      timelineFile = store.readFile(playthrough.path, { validate: validatePlayDocument })
      timeline = parseTimelineJson(timelineFile.content)
      sessionIds = referencedPlaythroughSessions(playthrough, timeline)
      readLease = store.captureReadLease(['catalog.json', playthrough.path])
    } catch {
      return { result: result('unavailable', 'metadata') }
    }
    if (sessionIds.length === 0) return { result: result('empty', 'no-references') }
    if (typeof this.inspectSession !== 'function') return { result: result('unavailable', 'host', sessionIds) }
    let present = false, unknown = false
    for (const sessionId of sessionIds) {
      signal?.throwIfAborted()
      try {
        const inspection = await this.inspectSession(sessionId)
        if (inspection === null || typeof inspection !== 'object') unknown = true
        else present = true
      } catch (error) {
        if (error?.code !== 'PLAY_SESSION_NOT_FOUND') unknown = true
      }
      signal?.throwIfAborted()
    }
    const current = () => {
      signal?.throwIfAborted()
      if (this.workspaceStore !== store || scope() !== workspaceScope || !mutationLease() || !readLease()) return false
      try {
        return store.readFile('catalog.json').revision === file.revision
          && store.readFile(playthrough.path).revision === timelineFile.revision
          && this.isDraftProtected(playthrough) === false
      } catch { return false }
    }
    if (!current()) return { result: result('unavailable', 'changed', sessionIds) }
    if (present) return { result: result('available', 'session-present', sessionIds) }
    if (unknown) return { result: result('unavailable', 'inspection', sessionIds) }
    return { result: result('invalid', 'all-sessions-missing', sessionIds), current,
      evidence: { catalog, file, playthrough, timeline, timelineFile, sessionIds } }
  }

  async inspect(id, options) { return (await this.assess(id, options)).result }

  async withInvalid(id, apply, options = {}) {
    const assessment = await this.assess(id, options)
    options.signal?.throwIfAborted()
    if (assessment.result.status !== 'invalid') return assessment.result
    if (!assessment.current()) return { ...assessment.result, status: 'unavailable', reason: 'changed' }
    return apply(assessment.evidence)
  }

}
