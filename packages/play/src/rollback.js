import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { uniqueMessageCoordinates } from './coordinate-recovery.js'
import { httpError } from './http.js'
import { isPlaythroughArchived } from './playthrough-state.js'
import { requireCoordinates, sessionCoordinates, validateTimelineCoordinates, variantFormatVersion } from './session-coordinates.js'
import { copyBranchContext, requireSessionId } from './sessions.js'
import { isSafeCatalogSegment, parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'
import { activeTimelineEntries, timelineWithHead } from './timeline-tree.js'

const RECORD_LIMIT = 16 * 1024
const pendingError = message => httpError(409, message, 'PLAY_ROLLBACK_PENDING')
const conflict = () => httpError(409, 'The playthrough changed. Reload before rolling back.', 'PLAY_FILE_REVISION_CONFLICT')

function recordPath(store, id) {
  const { rootPath, workspaceId } = store.get()
  const key = createHash('sha256').update(JSON.stringify([workspaceId, rootPath, id])).digest('hex')
  return join(store.storageDir, 'playthrough-rollbacks', key + '.json')
}

export function readRollback(store, id) {
  return readRecordFile(recordPath(store, id))
}

export function canResumeRollback(record) {
  return ['forked', 'selection-copied', 'ready'].includes(record?.stage)
}

function readRecordFile(path) {
  try { return readJsonFile(path, RECORD_LIMIT) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

function completedHead(timeline, record) {
  return record.child && timeline.head?.sessionId === record.child
    && timeline.head?.nodeId === record.nodeId && timeline.head?.variantId === record.variantId
}

function checkChild(child, record) {
  if (child?.meta?.id !== record.child || !Array.isArray(child.events)
    || child.inheritedEventCount !== record.end + 1) throw pendingError('Cannot verify the inherited reply in ' + record.child)
  requireCoordinates(record.version, sessionCoordinates(child))
  const endpoints = new Map()
  for (const message of uniqueMessageCoordinates(child.events).values()) if (message) endpoints.set(message.seq, message.role)
  if (endpoints.get(record.start) !== 'user' || endpoints.get(record.end) !== 'assistant') {
    throw pendingError('The inherited question and reply could not be verified in ' + record.child)
  }
}

// The Host owns the fork and the head write. The private record survives disabled
// operation logs, lost responses and restarts. DSH assigns the fork ID, so a
// crash inside that call must never cause an automatic second fork.
export function createRollbackService(store, host, { waitMs = 30_000 } = {}) {
  const active = new Map()
  function dismiss(id, operationId) {
    const path = recordPath(store, id)
    const record = readRollback(store, id)
    if (active.has(path) || !record || record.operationId !== operationId || record.stage === 'done') {
      throw pendingError('Rollback is active, complete or does not match that operation ID.')
    }
    atomicJson(path, { ...record, stage: 'dismissed' }, RECORD_LIMIT)
  }

  async function rollback(id, request, operation, beforeWrite) {
    if (!isSafeCatalogSegment(id) || typeof request?.nodeId !== 'string'
      || !/^[0-9a-f]{64}$/.test(request.expectedRevision) || typeof request.expectedWorkspaceScope !== 'string') {
      throw httpError(400, 'Rollback requires a playthrough, node, timeline revision and workspace', 'PLAY_ROLLBACK_INVALID')
    }
    const binding = store.get()
    if (!binding.rootPath || JSON.stringify([binding.workspaceId, binding.rootPath]) !== request.expectedWorkspaceScope) {
      throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
    }
    const path = recordPath(store, id)
    const row = parseCatalogJson(store.readFile('catalog.json').content).playthroughs.find(row => row.id === id)
    if (!row || isPlaythroughArchived(row)) throw httpError(409, 'Playthrough unavailable or archived', 'PLAY_ROLLBACK_UNAVAILABLE')
    if (active.has(path)) throw httpError(409, 'Rollback still running; check the repair report before retrying', 'PLAY_ROLLBACK_BUSY')
    return store.withReservedTimeline(row, async reservation => {
      const file = store.readFile(row.path)
      const timeline = parseTimelineJson(file.content)
      let record = readRecordFile(path)
      let lastSaved = record
      const save = patch => {
        if (JSON.stringify(readRecordFile(path)) !== JSON.stringify(lastSaved)) throw conflict()
        const next = { ...record, ...patch }
        atomicJson(path, next, RECORD_LIMIT)
        record = next
        lastSaved = next
      }
      if (record && record.stage !== 'dismissed' && completedHead(timeline, record) && record.nodeId === request.nodeId
        && (request.variantId === undefined || request.variantId === record.variantId)
        && [file.revision, record.revision].includes(request.expectedRevision)) {
        operation.identify({ playthroughId: id, sessionId: record.child })
        operation.checkpoint('playthrough.rollback.head-verified')
        if (record.stage !== 'done') save({ stage: 'done' })
        return { ok: true, sessionId: record.child, timeline }
      }
      if (file.revision !== request.expectedRevision) throw conflict()
      const target = activeTimelineEntries(timeline).find(entry => entry.node.id === request.nodeId)
      if (!target || (request.variantId !== undefined && target.variant.id !== request.variantId)) throw conflict()
      if (record && !['done', 'dismissed'].includes(record.stage)) {
        if (record.revision !== file.revision || record.nodeId !== target.node.id || record.path !== row.path || record.variantId !== target.variant.id) {
          throw pendingError('Previous rollback needs review. Open Repair playthrough. Operation ' + record.operationId)
        }
        if (!canResumeRollback(record)) {
          throw pendingError('Fork outcome needs verification. Open Repair playthrough. Operation ' + record.operationId)
        }
      } else {
        if (request.resumeOnly) throw conflict()
        record = undefined
      }

      const lease = store.captureReadLease([row.path])
      const deadline = AbortSignal.timeout(waitMs)
      const ensureCurrent = () => {
        if (deadline.aborted) throw pendingError('Rollback timed out. Open Repair playthrough to check its checkpoint.')
        if (!lease()) throw conflict()
      }
      // Read-only work may be abandoned on timeout. Native mutations keep
      // ownership until their outcome is known, even after the response expires.
      let mutatingHost = false
      const mutateHost = async action => {
        mutatingHost = true
        try { return await action() } finally { mutatingHost = false }
      }
      const run = async () => {
        ensureCurrent()
        await validateTimelineCoordinates(timeline, sessionId => host.coordinates(sessionId))
        ensureCurrent()
        if (!record) {
          const { variant, node } = target
          save({ stage: 'starting', operationId: operation.operationId, path: row.path, revision: file.revision,
            nodeId: node.id, variantId: variant.id, source: variant.sessionId, start: variant.startEventId,
            end: variant.endEventId, version: variantFormatVersion(variant) })
          operation.checkpoint('playthrough.rollback.intent', { playthroughId: id, sessionId: record.source })
          let created
          try {
            created = await mutateHost(() => host.forkSession({ sessionId: record.source, atSeq: record.end, sessionFormatVersion: record.version }, {
              operation: { checkpoint(event, meta) {
                if (event === 'session.created') save({ stage: 'created', child: requireSessionId(meta.sessionId) })
                operation.checkpoint(event, meta)
              } },
            }))
          } catch (error) {
            if (error.rollbackForkNotAttempted && !record.child) save({ stage: 'dismissed' })
            throw error
          }
          save({ stage: 'forked', child: requireSessionId(created.sessionId) })
          operation.checkpoint('session.created', { sessionId: record.child })
        }
        operation.identify({ playthroughId: id, sessionId: record.child })
        ensureCurrent()
        checkChild(await host.inspectSession(record.child), record)
        ensureCurrent()
        operation.checkpoint('playthrough.rollback.child-verified')
        if (record.stage !== 'ready') {
          await mutateHost(() => copyBranchContext(host, record.source, record.child, record.end, {
            checkpoint(event, meta) {
              save({ stage: event === 'session.selection.copied' ? 'selection-copied' : 'ready' })
              operation.checkpoint(event, meta)
              ensureCurrent()
            },
          }, { selectionCopied: record.stage === 'selection-copied' }))
          if (record.stage !== 'ready') save({ stage: 'ready' })
        }
        ensureCurrent()
        const head = { sessionId: record.child, nodeId: record.nodeId, variantId: record.variantId }
        const next = timelineWithHead({ ...timeline, nodes: timeline.nodes.map(node =>
          node.id === head.nodeId ? { ...node, adoptedVariantId: head.variantId } : node) }, head)
        const currentRow = parseCatalogJson(store.readFile('catalog.json').content).playthroughs.find(item => item.id === id)
        if (JSON.stringify(currentRow) !== JSON.stringify(row)) throw conflict()
        beforeWrite?.(file)
        store.writeFile(row.path, JSON.stringify(next), { expectedRevisionPresent: true, expectedRevision: file.revision,
          expectedWorkspaceScope: request.expectedWorkspaceScope, validate: validatePlayDocument, reservation })
        operation.checkpoint('playthrough.timeline.updated')
        if (!completedHead(parseTimelineJson(store.readFile(row.path).content), record)) {
          throw pendingError('Could not verify the saved rollback head')
        }
        operation.checkpoint('playthrough.rollback.head-verified')
        save({ stage: 'done' })
        return { ok: true, sessionId: record.child, timeline: next }
      }
      const release = () => {
        if (active.get(path) === reservation) active.delete(path)
      }
      active.set(path, reservation)
      const task = run().finally(release)
      // If the native call stalls, release unrelated writes and surface a pending
      // result. Late completion records its child but cannot publish a stale head.
      const timeout = new Promise((_, reject) => deadline.addEventListener('abort', () => {
        if (!mutatingHost) release()
        reject(record ? pendingError('Rollback timed out. Open Repair playthrough to check its checkpoint.')
          : httpError(504, 'Checking session history timed out before branch creation. Retry the rollback.', 'PLAY_ROLLBACK_PREFLIGHT_TIMEOUT'))
      }, { once: true }))
      try {
        return await Promise.race([task, timeout])
      } catch (error) {
        if (!record || ['done', 'dismissed'].includes(record.stage)) throw error
        throw httpError(error.status ?? 500,
          error.message + ' · 回退检查点 ' + record.stage + '，操作 ' + record.operationId + '。请打开「修复周目」核对。',
          error.code ?? 'PLAY_ROLLBACK_PENDING')
      }
    })
  }
  function hasPending(id) {
    const record = readRollback(store, id)
    return Boolean(record && !['dismissed', 'done'].includes(record.stage))
  }
  return { run: rollback, dismiss, hasPending, isActive: id => active.has(recordPath(store, id)) }
}
