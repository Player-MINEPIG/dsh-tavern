import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { uniqueMessageCoordinates } from './coordinate-recovery.js'
import { creationConflict, creationRow, publishCreation } from './creation-publication.js'
import { httpError } from './http.js'
import { isPlaythroughArchived } from './playthrough-state.js'
import { requireCoordinates, sessionCoordinates, validateTimelineCoordinates, variantFormatVersion, withVariantFormat } from './session-coordinates.js'
import { copyBranchContext, requireSessionId } from './sessions.js'
import { isSafeCatalogSegment, parseCatalogJson, parseTimelineJson } from './timeline.js'
import { activeTimelineEntries } from './timeline-tree.js'

const limit = 16 * 1024
const digest = value => createHash('sha256').update(value).digest('hex')
const scopeOf = store => JSON.stringify([store.get().workspaceId, store.get().rootPath])
const pending = record => httpError(409, 'Fork needs review in Repair playthrough. Operation ' + record.operationId + ', stage ' + record.stage
  + (record.child ? ', session ' + record.child : ''), 'PLAY_CREATION_PENDING')

function recordDirectory(store, id) {
  return join(store.storageDir, 'playthrough-forks', digest(JSON.stringify([scopeOf(store), id])))
}

function read(path) {
  try { return readJsonFile(path, limit) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}

function forkedTimeline(source, entries, child, version) {
  let parentVariantId = null
  const target = entries.at(-1)
  const nodes = entries.map(({ node, variant }) => {
    const copied = { ...node, parentVariantId, adoptedVariantId: variant.id, variants: node.variants.map(item =>
      node === target.node && item.id === variant.id ? withVariantFormat({ ...item, sessionId: child }, version) : item) }
    parentVariantId = variant.id
    return copied
  })
  return { ...source, nodes, head: { sessionId: child, nodeId: target.node.id, variantId: target.variant.id } }
}

function replyEndpoints(log, variant) {
  if (log?.meta?.id !== variant.sessionId || !Array.isArray(log.events)) throw creationConflict()
  requireCoordinates(variantFormatVersion(variant), sessionCoordinates(log))
  const bySeq = new Map()
  for (const [id, message] of uniqueMessageCoordinates(log.events)) {
    if (message) bySeq.set(message.seq, { id, role: message.role })
  }
  const start = bySeq.get(variant.startEventId), end = bySeq.get(variant.endEventId)
  if (start?.role !== 'user' || end?.role !== 'assistant') throw creationConflict()
  return [start.id, end.id]
}

export function createCreationService(store, host, { waitMs = 30_000 } = {}) {
  const active = new Map()
  const catalog = () => parseCatalogJson(store.readFile('catalog.json').content)
  const meta = record => ({ characterId: record.characterId, rootSessionId: record.child })
  function completed(record) {
    if (record.stage === 'dismissed') throw httpError(409, 'This fork was dismissed. Start a new fork explicitly.', 'PLAY_CREATION_DISMISSED')
    const playthrough = creationRow(catalog(), record.target, record.targetPath, meta(record))
    if (!playthrough || isPlaythroughArchived(playthrough)) throw creationConflict()
    return { ok: true, sessionId: record.child, playthrough, timeline: parseTimelineJson(store.readFile(playthrough.path).content) }
  }

  async function run(id, request, operation, { signal, beforeWrite, resumeOnly = false } = {}) {
    if (!isSafeCatalogSegment(id) || !isSafeCatalogSegment(request?.creationId)
      || typeof request.nodeId !== 'string' || !/^[a-f0-9]{64}$/.test(request.expectedRevision)
      || typeof request.expectedWorkspaceScope !== 'string') {
      throw httpError(400, 'Fork requires a creation ID, node, timeline revision and workspace.', 'PLAY_CREATION_INVALID')
    }
    if (!store.get().rootPath || scopeOf(store) !== request.expectedWorkspaceScope) {
      throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
    }
    const directory = recordDirectory(store, id), current = join(directory, 'pending.json')
    const receipt = key => join(directory, digest(key) + '.json')
    const previous = read(receipt(request.creationId))
    if (previous) {
      if (previous.nodeId !== request.nodeId || (request.variantId !== undefined && previous.variantId !== request.variantId)) throw creationConflict()
      return completed(previous)
    }
    if (active.has(current)) throw httpError(409, 'Fork still running. Check Repair playthrough.', 'PLAY_CREATION_BUSY')
    const row = catalog().playthroughs.find(row => row.id === id)
    const characterId = row?.ext?.pmpDshTavern?.characterId ?? row?.path.split('/')[0]
    if (!row || isPlaythroughArchived(row) || !isSafeCatalogSegment(characterId)) throw creationConflict()
    return store.withReservedTimeline(row, async () => {
      const deadline = AbortSignal.timeout(waitMs)
      const stopped = signal ? AbortSignal.any([deadline, signal]) : deadline
      const file = store.readFile(row.path), lease = store.captureReadLease([row.path])
      const timeline = parseTimelineJson(file.content)
      let record = read(current), lastSaved = record, mutationInFlight = false
      const hostMutation = async callback => {
        mutationInFlight = true
        try { return await callback() } finally { mutationInFlight = false }
      }
      const checkCheckpoint = () => {
        if (JSON.stringify(read(current)) !== JSON.stringify(lastSaved)) throw creationConflict()
      }
      const check = () => {
        stopped.throwIfAborted()
        checkCheckpoint()
        if (!lease() || store.readFile(row.path).revision !== file.revision || scopeOf(store) !== request.expectedWorkspaceScope
          || JSON.stringify(catalog().playthroughs.find(item => item.id === id)) !== JSON.stringify(row)) throw creationConflict()
      }
      const save = patch => {
        checkCheckpoint()
        const next = { ...record, ...patch }
        atomicJson(current, next, limit)
        record = lastSaved = next
      }
      const execute = async () => {
        stopped.throwIfAborted()
        if (['done', 'dismissed'].includes(record?.stage)) {
          // Archive the previous receipt before admitting the next intent.
          atomicJson(receipt(record.creationId), record, limit)
          if (record.creationId === request.creationId) {
            if (record.nodeId !== request.nodeId || (request.variantId !== undefined && record.variantId !== request.variantId)) throw creationConflict()
            return completed(record)
          }
          record = null
        }
        if (record?.stage === 'unattempted') record = null
        if (record && (record.creationId !== request.creationId || record.nodeId !== request.nodeId
          || record.path !== row.path || record.revision !== file.revision || record.characterId !== characterId
          || ['starting', 'created'].includes(record.stage))) throw pending(record)
        if (resumeOnly && !record) throw creationConflict()
        if (request.expectedRevision !== file.revision) throw creationConflict()
        const entries = activeTimelineEntries(timeline)
        const index = entries.findIndex(entry => entry.node.id === request.nodeId)
        if (index < 0) throw creationConflict()
        const { variant } = entries[index]
        if (request.variantId !== undefined && request.variantId !== variant.id) throw creationConflict()
        await validateTimelineCoordinates(timeline, sessionId => host.coordinates(sessionId))
        check()
        const endpoints = replyEndpoints(await host.inspectSession(variant.sessionId), variant)
        check()
        if (!record) {
          const target = 'playthrough-' + randomUUID()
          save({ creationId: request.creationId, operationId: operation?.operationId ?? request.creationId, stage: 'starting',
            revision: file.revision, path: row.path, nodeId: request.nodeId, variantId: variant.id, source: variant.sessionId,
            target, targetPath: characterId + '/' + target + '/timeline.json', characterId, createdAt: new Date().toISOString() })
          operation?.checkpoint('playthrough.fork.intent', { playthroughId: id, sessionId: variant.sessionId })
          try {
            const created = await hostMutation(() => host.forkSession({ sessionId: variant.sessionId, atSeq: variant.endEventId,
              sessionFormatVersion: variantFormatVersion(variant) }, { operation: { checkpoint(event, data) {
              if (event === 'session.created') save({ stage: 'created', child: requireSessionId(data.sessionId) })
              operation?.checkpoint(event, data)
            } } }))
            const child = requireSessionId(created.sessionId)
            if (child === record.source || (record.child && record.child !== child)) throw creationConflict()
            save({ stage: 'forked', child })
            operation?.checkpoint('session.created', { sessionId: child })
          } catch (error) {
            if (error.rollbackForkNotAttempted && !record.child) save({ stage: 'unattempted' })
            throw error
          }
        }
        check()
        operation?.identify({ playthroughId: id, sessionId: record.child })
        const child = await host.inspectSession(record.child)
        const inherited = replyEndpoints(child, { ...variant, sessionId: record.child })
        if (child.inheritedEventCount !== variant.endEventId + 1 || inherited.some((id, i) => id !== endpoints[i])
          || child.events.slice(child.inheritedEventCount).some(event =>
            ['turn/start', 'user/message', 'steering/message', 'assistant/message'].includes(event.type))) throw creationConflict()
        check()
        operation?.checkpoint('playthrough.fork.child-verified', { sessionId: record.child })
        if (record.stage !== 'ready') {
          await hostMutation(() => copyBranchContext(host, variant.sessionId, record.child, variant.endEventId, { checkpoint(event, data) {
            save({ stage: event === 'session.selection.copied' ? 'selection-copied' : 'ready' })
            operation?.checkpoint(event, data)
            check()
          } }, { selectionCopied: record.stage === 'selection-copied' }))
          if (record.stage !== 'ready') save({ stage: 'ready' })
        }
        check()
        const next = forkedTimeline(timeline, entries.slice(0, index + 1), record.child, child.meta.version)
        const playthrough = publishCreation(store, { id: record.target, path: record.targetPath, meta: meta(record),
          content: JSON.stringify(next), createdAt: record.createdAt, scope: request.expectedWorkspaceScope }, beforeWrite)
        save({ stage: 'done' })
        operation?.checkpoint('playthrough.timeline.updated')
        operation?.checkpoint('playthrough.catalog.updated')
        operation?.checkpoint('playthrough.fork.published', { playthroughId: record.target })
        return { ok: true, sessionId: record.child, playthrough, timeline: next }
      }
      const token = Symbol()
      active.set(current, token)
      const release = () => { if (active.get(current) === token) active.delete(current) }
      const task = execute().finally(release)
      let rejectStopped
      const interrupted = new Promise((_, reject) => {
        rejectStopped = () => {
          // Read-only waits can expire before or after a fork. Their late
          // results cannot pass check() or replace a newer checkpoint.
          if (!mutationInFlight) release()
          reject(record ? pending(record) : httpError(409, 'Fork preflight stopped before Session creation. Retry after checking the Host.', 'PLAY_CREATION_PREFLIGHT_STOPPED'))
        }
      })
      stopped.addEventListener('abort', rejectStopped, { once: true })
      try { return await Promise.race([task, interrupted]) }
      catch (error) {
        if (!record || ['done', 'dismissed', 'unattempted'].includes(record.stage) || error.code === 'PLAY_CREATION_PENDING') throw error
        throw httpError(error.status ?? 409, error.message + ' · ' + pending(record).message, error.code ?? 'PLAY_CREATION_PENDING')
      } finally { stopped.removeEventListener('abort', rejectStopped) }
    })
  }

  async function repair(row, { apply, beforeWrite, signal } = {}) {
    const path = join(recordDirectory(store, row.id), 'pending.json'), record = read(path)
    if (!record || ['done', 'dismissed', 'unattempted'].includes(record.stage)) return null
    const details = { operationId: record.operationId, stage: record.stage, nodeId: record.nodeId, sessionId: record.child ?? record.source }
    const report = code => ({ changes: [], remaining: [{ reason: 'fork-creation-pending', ...details, ...(code ? { code } : {}) }] })
    if (active.has(path)) return report('PLAY_CREATION_BUSY')
    if (!apply || ['starting', 'created'].includes(record.stage)) return report()
    try {
      await run(row.id, { creationId: record.creationId, nodeId: record.nodeId, expectedRevision: record.revision,
        expectedWorkspaceScope: scopeOf(store) }, null, { beforeWrite, signal, resumeOnly: true })
      return { changes: [{ kind: 'fork-creation-recovered', ...details }], remaining: [] }
    } catch (error) { signal?.throwIfAborted(); return report(error.code ?? 'repair-unavailable') }
  }
  function dismiss(id, operationId, expectedWorkspaceScope) {
    if (!isSafeCatalogSegment(id) || scopeOf(store) !== expectedWorkspaceScope || !store.get().rootPath) throw creationConflict()
    const path = join(recordDirectory(store, id), 'pending.json'), record = read(path)
    if (!record || record.operationId !== operationId || ['done', 'dismissed', 'unattempted'].includes(record.stage)) throw creationConflict()
    if (active.has(path)) throw httpError(409, 'Fork still running.', 'PLAY_CREATION_BUSY')
    atomicJson(path, { ...record, stage: 'dismissed' }, limit)
  }
  return { run, repair, dismiss }
}
