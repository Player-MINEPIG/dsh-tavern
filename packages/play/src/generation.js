import { existsSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { generationConflict, generationOutcome, generationTimeline, resolveGenerationSource, resultHead, verifyGenerationTarget } from './generation-evidence.js'
import { httpError } from './http.js'
import { isPlaythroughArchived } from './playthrough-state.js'
import { validateTimelineCoordinates } from './session-coordinates.js'
import { copyBranchContext, formatPlaySessionTitle, requireSessionId } from './sessions.js'
import { isSafeCatalogSegment, parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'

const recordLimit = 16 * 1024
const terminal = record => ['done', 'stopped', 'dismissed'].includes(record.stage)
const invalid = () => httpError(400, 'Invalid generation action, identity or source', 'PLAY_GENERATION_INVALID')
const pending = () => httpError(409, 'A previous generation needs verification. Open Repair playthrough.', 'PLAY_GENERATION_PENDING')
const busy = () => httpError(409, 'Generation is in progress. Check its status.', 'PLAY_GENERATION_BUSY')
const scopeOf = binding => JSON.stringify([binding.workspaceId, binding.rootPath])
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function recordPath(store, scope, id) {
  const hash = createHash('sha256').update(JSON.stringify([scope, id])).digest('hex')
  return join(store.storageDir, 'playthrough-generations', hash + '.json')
}

function read(path) {
  try { return readJsonFile(path, recordLimit) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

function save(path, record, patch) {
  if (!same(read(path), record)) throw generationConflict()
  const next = { ...record, ...patch }
  atomicJson(path, next, recordLimit)
  return next
}

function descriptor(record) {
  const { operationKey, operationId, sessionId, kind, sourceSessionId, nodeId, boundary, sourceIndex, stage } = record
  return { operationKey, operationId, sessionId, kind, sourceSessionId, nodeId, boundary, sourceIndex, stage }
}

function scopedRow(store, id, scope) {
  const binding = store.get()
  if (!binding.rootPath || scope !== scopeOf(binding)) throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
  const rows = parseCatalogJson(store.readFile('catalog.json').content).playthroughs
  const row = rows.find(row => row.id === id)
  if (!row || isPlaythroughArchived(row)) throw httpError(409, 'Playthrough unavailable or archived', 'PLAY_GENERATION_UNAVAILABLE')
  return row
}

async function createChild(host, binding, record, operation, signal) {
  const { sourceSessionId, stateSource, boundary, forkVersion } = record
  if (boundary >= 0) {
    const child = await host.forkSession({ sessionId: sourceSessionId, atSeq: boundary, sessionFormatVersion: forkVersion, stateSource }, { operation })
    const id = requireSessionId(child?.sessionId)
    operation.checkpoint('session.created', { sessionId: id })
    signal.throwIfAborted()
    await copyBranchContext(host, sourceSessionId, id, boundary, operation)
    return id
  }
  const ref = await host.getImportContextBinding?.(sourceSessionId)
  const prepared = ref?.path ? await host.prepareImportContext({ path: ref.path }) : null
  signal.throwIfAborted()
  const name = host.characterName?.(sourceSessionId)
  const title = typeof name === 'string' && name.trim() ? formatPlaySessionTitle(name) : undefined
  const child = await host.createSession({ workspaceId: binding.workspaceId, cwd: binding.rootPath, title, stateSource }, { operation })
  const id = requireSessionId(child?.sessionId)
  operation.checkpoint('session.created', { sessionId: id })
  signal.throwIfAborted()
  if (prepared !== null) {
    await host.bindImportContext(id, prepared)
    operation.checkpoint('session.import-context.bound', { sessionId: id })
  }
  signal.throwIfAborted()
  if (host.copySelection) {
    await host.copySelection(sourceSessionId, id)
    operation.checkpoint('session.selection.copied', { sessionId: id })
  }
  return id
}

// Native calls need not implement cancellation. Release the caller and its
// reservation on timeout; every continuation checks this signal before effects.
function bounded(waitMs, parent, work) {
  const deadline = AbortSignal.timeout(waitMs)
  const signal = parent ? AbortSignal.any([parent, deadline]) : deadline
  signal.throwIfAborted()
  let aborted
  const timeout = new Promise((_, reject) => {
    aborted = () => reject(parent?.aborted ? parent.reason : httpError(504,
      'Generation timed out. Open Repair playthrough to verify its outcome.', 'PLAY_GENERATION_TIMEOUT'))
    signal.addEventListener('abort', aborted, { once: true })
  })
  return Promise.race([timeout, Promise.resolve().then(() => work(signal))])
    .finally(() => signal.removeEventListener('abort', aborted))
}

export function createGenerationService(store, host, { waitMs = 30_000 } = {}) {
  const active = new Map()
  const publicationOwner = Symbol('generation publication')
  function openRecord(row) {
    const record = read(recordPath(store, scopeOf(store.get()), row.id))
    return record && !terminal(record) ? record : null
  }
  function guardPathChange(row, owner) {
    if (owner !== publicationOwner && openRecord(row)) throw pending()
  }
  function guardCatalogChange(row, next) {
    if (!next || next.path !== row.path || isPlaythroughArchived(next) !== isPlaythroughArchived(row)
      || next.ext?.pmpDshTavern?.rootSessionId !== row.ext?.pmpDshTavern?.rootSessionId) guardPathChange(row)
  }
  function guardTimelineWrite(row, before, after, owner) {
    if (owner === publicationOwner) return
    const record = openRecord(row)
    if (!record) return
    try { verifyGenerationTarget(record, after) }
    catch { throw pending() }
  }

  async function start(row, path, request, operation, signal) {
    const prior = read(path)
    if (prior?.operationKey === request.operationKey) {
      if (prior.kind !== request.kind || prior.requestedNode !== request.nodeId || prior.requestedSession !== request.sessionId
        || prior.requestedUser !== request.userEventId || prior.requestedVariant !== request.variantId || prior.revision !== request.expectedRevision) throw generationConflict()
      if (!prior.sessionId || ['creating','created','dismissed'].includes(prior.stage)) throw pending()
      return { ok: true, ...descriptor(prior) }
    }
    if (active.has(path)) throw busy()
    if (prior && !terminal(prior)) throw pending()
    const file = store.readFile(row.path)
    if (file.revision !== request.expectedRevision) throw generationConflict()
    const timeline = parseTimelineJson(file.content)
    const binding = store.get()
    const checkTarget = () => {
      const current = scopedRow(store, row.id, request.expectedWorkspaceScope)
      if (current.path !== row.path || current.ext?.pmpDshTavern?.rootSessionId !== row.ext?.pmpDshTavern?.rootSessionId) throw generationConflict()
      return parseTimelineJson(store.readFile(row.path).content)
    }
    const owner = Symbol()
    active.set(path, owner)
    const release = () => { if (active.get(path) === owner) active.delete(path) }
    signal.addEventListener('abort', release, { once: true })
    let dispatched = false
    try {
      const lease = store.captureReadLease([row.path])
      await validateTimelineCoordinates(timeline, id => host.coordinates(id))
      const { text, intent } = await resolveGenerationSource(host, row, timeline, request)
      signal.throwIfAborted()
      checkTarget()
      if (!lease() || store.readFile(row.path).revision !== file.revision) throw generationConflict()
      // Replace a terminal record only after validating the complete new intent.
      if (!same(read(path), prior)) throw generationConflict()
      let record = { ...intent, operationKey: request.operationKey, requestId: randomUUID(),
        operationId: operation?.operationId ?? request.operationKey, stage: 'creating', path: row.path,
        rootSessionId: row.ext?.pmpDshTavern?.rootSessionId ?? null,
        requestedNode: request.nodeId, requestedVariant: request.variantId, requestedUser: request.userEventId, requestedSession: request.sessionId,
        revision: file.revision }
      atomicJson(path, record, recordLimit)
      operation?.checkpoint('playthrough.generation.intent', { playthroughId: row.id })
      const checkpoints = { checkpoint(event, info) {
        if (event === 'session.created') {
          const sessionId = requireSessionId(info.sessionId)
          if (record.sessionId && record.sessionId !== sessionId) throw generationConflict()
          if (!record.sessionId) record = save(path, record, { stage: 'created', sessionId })
        }
        operation?.checkpoint(event, info)
        signal.throwIfAborted()
      } }
      let sessionId
      try { sessionId = await createChild(host, binding, record, checkpoints, signal) }
      catch (error) {
        if (error.rollbackForkNotAttempted && !record.sessionId) save(path, record, { stage: 'dismissed' })
        throw error
      }
      const { sessionFormatVersion: childVersion } = await host.coordinates(sessionId)
      if (!Number.isSafeInteger(childVersion)) throw pending()
      signal.throwIfAborted()
      verifyGenerationTarget(record, checkTarget())
      record = save(path, record, { stage: 'sending', childVersion })
      operation?.checkpoint('playthrough.generation.send-intent', { sessionId })
      // A queued DSH call can outlive the HTTP connection. Only this continuation
      // can send. A restart observes the RPC ID and never dispatches it again.
      dispatched = true
      bounded(waitMs, signal, async admissionSignal => {
        admissionSignal.throwIfAborted()
        verifyGenerationTarget(record, checkTarget())
        await host.promptSession({ sessionId, mode: 'queue', text, requestId: record.requestId })
        admissionSignal.throwIfAborted()
        save(path, record, { stage: 'accepted' })
      }).catch(() => {
        // An interrupted acknowledgement leaves the persisted send intent.
        // Status and repair inspect native history for this exact requestId.
      }).finally(release)
      return { ok: true, ...descriptor(record) }
    } finally {
      signal.removeEventListener('abort', release)
      if (!dispatched) release()
    }
  }

  function currentTimeline(row, scope, record) {
    const current = scopedRow(store, row.id, scope)
    if (current.path !== record.path || (current.ext?.pmpDshTavern?.rootSessionId ?? null) !== record.rootSessionId) throw generationConflict()
    const file = store.readFile(current.path)
    return { file, timeline: parseTimelineJson(file.content) }
  }

  async function finish(row, path, scope, record, { apply, beforeWrite, signal, operation } = {}) {
    if (record.stage === 'done') return { ok: true, ...resultHead(record), timeline: currentTimeline(row, scope, record).timeline }
    if (record.stage === 'stopped') throw outcomeError('stopped')
    if (active.has(path) && record.stage !== 'sending') throw busy()
    const outcome = await generationOutcome(host, record)
    signal?.throwIfAborted()
    const { timeline, file } = currentTimeline(row, scope, record)
    if (active.has(path) && outcome.state === 'uncertain') throw busy()
    if (outcome.state === 'stopped' && apply) save(path, record, { stage: 'stopped' })
    if (outcome.state !== 'ready') throw outcomeError(outcome.state)
    const next = generationTimeline(record, timeline, outcome)
    await validateTimelineCoordinates(next, id => host.coordinates(id))
    signal?.throwIfAborted()
    const current = currentTimeline(row, scope, record)
    const latest = read(path)
    if (latest?.operationKey === record.operationKey && latest.stage === 'done') return { ok: true, ...resultHead(record), timeline: current.timeline }
    if (record.stage === 'sending' && latest?.stage === 'accepted' && same({ ...record, stage: 'accepted' }, latest)) record = latest
    if (current.file.revision !== file.revision || !same(latest, record)) throw generationConflict()
    if (apply) {
      if (timeline !== next) {
        beforeWrite?.(file, row.path)
        store.writeFile(row.path, JSON.stringify(next), { expectedWorkspaceScope: scope, expectedRevision: file.revision,
          expectedRevisionPresent: true, generationOwner: publicationOwner, validate: validatePlayDocument })
        operation?.checkpoint('playthrough.timeline.updated', { playthroughId: row.id, sessionId: record.sessionId })
      }
      save(path, record, { stage: 'done' })
    }
    return { ok: true, ...resultHead(record), timeline: next }
  }

  async function status(row, path, scope, key) {
    const record = read(path)
    if (!record || (terminal(record) && !key)) return { ok: true, pending: null }
    if (key && key !== record.operationKey) throw generationConflict()
    if (terminal(record)) return { ok: true, state: record.stage, pending: descriptor(record) }
    const { timeline } = currentTimeline(row, scope, record)
    let state
    try {
      const outcome = await generationOutcome(host, record)
      if (outcome.state === 'ready') generationTimeline(record, timeline, outcome)
      else verifyGenerationTarget(record, timeline)
      state = active.has(path) && outcome.state === 'uncertain' ? 'busy' : outcome.state
    } catch (error) {
      return { ok: true, state: 'uncertain', code: error.code ?? 'PLAY_GENERATION_UNVERIFIED', pending: descriptor(record) }
    }
    return { ok: true, state, pending: descriptor(record) }
  }

  async function run(id, request, operation) {
    if (!isSafeCatalogSegment(id) || typeof request?.expectedWorkspaceScope !== 'string') throw invalid()
    const scope = request.expectedWorkspaceScope
    const row = scopedRow(store, id, scope)
    const path = recordPath(store, scope, id)
    const key = request.operationKey
    if (key !== undefined && !isSafeCatalogSegment(key)) throw invalid()
    if (request.action === 'status') return bounded(waitMs, null, () => status(row, path, scope, key))
    if (!key) throw invalid()
    if (request.action === 'start') {
      if (!/^[a-f0-9]{64}$/.test(request.expectedRevision)
        || !(request.kind === 'reply-swipe' && typeof request.nodeId === 'string' && request.nodeId
          || request.kind === 'request-retry' && requireSessionId(request.sessionId) && Number.isSafeInteger(request.userEventId) && request.userEventId >= 0)) throw invalid()
      return store.withReservedTimeline(row, () => bounded(waitMs, null, signal => start(row, path, request, operation, signal)), publicationOwner)
    }
    const record = read(path)
    if (record?.operationKey !== key) throw generationConflict()
    if (request.action === 'finish') return bounded(waitMs, null, signal => finish(row, path, scope, record, { apply: true, operation, signal }))
    if (request.action === 'dismiss') {
      if (active.has(path)) throw busy()
      if (record.stage === 'done') throw generationConflict()
      if (record.stage !== 'dismissed') {
        const observed = await bounded(waitMs, null, () => status(row, path, scope, key))
        if (observed.state === 'busy' || observed.state === 'running') throw busy()
        if (observed.state === 'ready') throw pending()
        save(path, record, { stage: 'dismissed' })
      }
      return { ok: true }
    }
    throw invalid()
  }

  async function repair(row, { apply, beforeWrite, signal } = {}) {
    const scope = scopeOf(store.get())
    const path = recordPath(store, scope, row.id)
    const record = read(path)
    if (!record || terminal(record)) return null
    const details = { operationId: record.operationId, operationKey: record.operationKey, nodeId: record.nodeId,
      sessionId: record.sessionId ?? record.sourceSessionId, stage: record.stage }
    try {
      await bounded(waitMs, signal, inner => finish(row, path, scope, record, { apply, beforeWrite, signal: inner }))
      return { changes: [{ kind: 'generation-recovered', ...details }], remaining: [] }
    } catch (error) {
      signal?.throwIfAborted()
      const reason = error.code === 'PLAY_GENERATION_RUNNING' ? 'turn-in-progress' : 'generation-pending'
      return { changes: [], remaining: [{ reason, ...details, code: error.code ?? 'PLAY_GENERATION_UNVERIFIED' }] }
    }
  }
  return {
    run, repair, guardPathChange, guardCatalogChange, guardTimelineWrite,
    hasRecords: () => existsSync(join(store.storageDir, 'playthrough-generations')),
    hasPending: row => Boolean(openRecord(row)),
  }
}

function outcomeError(state) {
  if (state === 'stopped') return httpError(409, 'Generation stopped without a saved assistant reply', 'PLAY_GENERATION_STOPPED')
  if (state === 'running') return httpError(409, 'The native turn is still in progress', 'PLAY_GENERATION_RUNNING')
  return pending()
}
