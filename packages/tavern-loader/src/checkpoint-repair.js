import { repairBranchOperation } from '../../client/src/play/branch-recovery.js'
import { repairGenerationOperation, runGenerationOperation } from '../../client/src/play/generation-recovery.js'
import { generationOutcome } from '../../play/src/generation-evidence.js'
import { httpError } from '../../play/src/http.js'
import { readSessionReceipt } from '../../play/src/session-receipts.js'
import { validateTimelineCoordinates } from '../../play/src/session-coordinates.js'
import { readSessionEvidence, readSessionMessages } from '../../play/src/sessions.js'
import { deriveFocus, parseCatalogJson, parseTimelineJson, validatePlayDocument } from '../../play/src/timeline.js'

// The repair command runs the same publication policy as the UI. This adapter
// can verify native receipts and save files; it cannot create a session or send.
export function createCheckpointRepair(store, host) {
  const client = {
    getWorkspace: () => store.get(),
    getFile: path => store.readFile(path),
    getCheckpoint: (row, scope, key) => store.checkpoints.get(row.id, scope, key),
    putCheckpoint: (row, body) => store.checkpoints.put(row.id, body),
    getSessionReceipt: (key, scope) => readSessionReceipt(store, scope, key),
    getSessionEvidence: (id, bounds) => readSessionEvidence(host, id, bounds),
    getCoordinates: id => host.coordinates(id),
    getMessages: id => readSessionMessages(host, id),
    getRequestOutcome: (sessionId, { requestId, boundary, version, stage }) =>
      generationOutcome(host, { sessionId, requestId, boundary, childVersion: version, stage }),
    async putFile(path, content, options) {
      if (path.endsWith('/timeline.json')) await validateTimelineCoordinates(parseTimelineJson(content), id => host.coordinates(id))
      options.signal?.throwIfAborted()
      return store.writeFile(path, content, { ...options, expectedRevisionPresent: true, validate: validatePlayDocument })
    },
    getFocus({ id }) {
      const row = parseCatalogJson(store.readFile('catalog.json').content).playthroughs.find(item => item.id === id)
      if (!row) throw httpError(409, 'Playthrough no longer exists', 'PLAY_CHECKPOINT_CONFLICT')
      const timeline = parseTimelineJson(store.readFile(row.path).content)
      return { ...deriveFocus(timeline), playthroughId: id, ...(timeline.nodes.length ? {} : {sessionId: row.ext?.pmpDshTavern?.rootSessionId ?? null}) }
    },
  }
  async function repair(row, options) {
    const record = store.checkpoints.active(row.id)
    if (!record) return null
    if (record.owner === 'tavern.generation') return repairGenerationOperation(client, row, record, options)
    if (['tavern.fork', 'tavern.rollback'].includes(record.owner)) return repairBranchOperation(client, row, record, options)
    return { changes: [], remaining: [{ reason: 'external-checkpoint', operationId: record.key }] }
  }
  async function dismiss(owner, id, key, expectedWorkspaceScope) {
    const record = store.checkpoints.get(id, expectedWorkspaceScope)
    if (!record || record.key !== key) return false
    if (record.owner !== owner || record.released) throw httpError(409, 'Checkpoint owner changed', 'PLAY_CHECKPOINT_CONFLICT')
    if (owner === 'tavern.generation') {
      await runGenerationOperation(client, { id, path: record.data.path }, { action: 'dismiss', operationKey: key, expectedWorkspaceScope })
    } else {
      const receipt = readSessionReceipt(store, expectedWorkspaceScope, record.data.nativeKey)
      if (receipt.active) throw httpError(409, 'Native operation is still running', 'PLAY_CHECKPOINT_CONFLICT')
      store.checkpoints.put(id, { key, owner, released: true, expectedRevision: record.revision,
        expectedWorkspaceScope, data: { ...record.data, dismissed: true } })
    }
    return true
  }
  return { repair, dismiss }
}
