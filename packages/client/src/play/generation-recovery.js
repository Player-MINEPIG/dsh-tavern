import { withOperationDeadline } from './operation-deadline.js'
import { httpError } from '../../../play/src/http.js'
import { generationConflict, generationTimeline, resolveGenerationSource, resultHead, verifyGenerationTarget } from '../../../play/src/generation-target.js'
import { validateTimelineCoordinates } from '../../../play/src/session-coordinates.js'
import { sourceSha256 } from './source-sha256.js'

const owner = 'tavern.generation'
const pending = () => httpError(409, 'Generation needs verification. Open Repair playthrough.', 'PLAY_GENERATION_PENDING')
const stopped = () => httpError(409, 'Generation stopped without a saved assistant reply.', 'PLAY_GENERATION_STOPPED')

function descriptor(checkpoint) {
  const { kind, sessionId, sourceSessionId, nodeId, sourceIndex, boundary, stage } = checkpoint.data
  return { operationKey: checkpoint.key, operationId: checkpoint.key, kind, sessionId, sourceSessionId, nodeId, sourceIndex, boundary, stage }
}

function save(client, row, checkpoint, patch, released = false) {
  return client.putCheckpoint(row, {
    owner, key: checkpoint.key, expectedWorkspaceScope: checkpoint.data.scope, expectedRevision: checkpoint.revision,
    released, data: { ...checkpoint.data, ...patch },
  })
}

function fence(row, checkpoint) {
  return { checkpointId: row.id, checkpointKey: checkpoint.key, expectedWorkspaceScope: checkpoint.data.scope }
}

function sourceRequest(body) {
  return body.kind === 'reply-swipe' ? { kind: body.kind, nodeId: body.nodeId, variantId: body.variantId }
    : { kind: body.kind, sessionId: body.sessionId, userEventId: body.userEventId }
}

async function start(client, row, body, scope, existing, signal) {
  const request = sourceRequest(body)
  let child
  if (existing) {
    if (existing.owner !== owner || existing.key !== body.operationKey
      || JSON.stringify(existing.data.request) !== JSON.stringify(request)
      || existing.data.scope !== scope || existing.data.path !== row.path) throw generationConflict()
    if (existing.released && existing.data.stage !== 'done') throw pending()
    if (existing.released) return { ok: true, ...descriptor(existing) }
    if (existing.data.stage === 'sending') {
      const send = await client.getSessionReceipt(existing.data.requestId, scope)
      if (send.state !== 'missing') return { ok: true, ...descriptor(existing) }
      child = { sessionId: existing.data.sessionId }
    } else if (existing.data.stage === 'creating') {
      const creation = await client.getSessionReceipt(existing.data.sessionKey, scope)
      if (creation.state === 'pending') throw pending()
      if (creation.state === 'done') child = creation.result
    } else throw pending()
  }
  if (!['reply-swipe','request-retry'].includes(body.kind) || !body.operationKey) throw generationConflict()
  const file = await client.getFile(row.path)
  if (!existing && body.expectedRevision && body.expectedRevision !== file.revision) throw generationConflict()
  const timeline = JSON.parse(file.content)
  await validateTimelineCoordinates(timeline, id => client.getCoordinates(id))
  const { intent, text } = await resolveGenerationSource(id => client.getMessages(id), row, timeline, request, sourceSha256)
  const uuid = () => globalThis.crypto.randomUUID()
  if (existing) verifyGenerationTarget(existing.data, timeline, sourceSha256)
  const data = existing?.data ?? { ...intent, scope, path: row.path, request, sessionKey: uuid(), requestId: uuid(), stage: 'creating' }
  signal.throwIfAborted()
  let checkpoint = existing ?? await client.putCheckpoint(row, { owner, key: body.operationKey, data, expectedWorkspaceScope: scope,
    expectedRevision: null, expectedTimelineRevision: file.revision,
    expectedBinding: { path: row.path, rootSessionId: row.ext?.pmpDshTavern?.rootSessionId ?? null, characterId: row.ext?.pmpDshTavern?.characterId ?? null } })
  const options = { ...fence(row, checkpoint), operationKey: data.sessionKey, signal }
  if (!child && data.boundary >= 0) {
    child = await client.postBranch(data.sourceSessionId, data.boundary, data.forkVersion, data.stateSource, options)
  } else if (!child) {
    const ref = await client.getImportContextBinding(data.sourceSessionId)
    signal.throwIfAborted()
    child = await client.postSession(data.sourceSessionId, ref?.path ? { path: ref.path } : undefined, data.stateSource, options)
  }
  if (!child?.sessionId) throw pending()
  const { sessionFormatVersion } = await client.getCoordinates(child.sessionId)
  if (!Number.isSafeInteger(sessionFormatVersion)) throw pending()
  verifyGenerationTarget(data, JSON.parse((await client.getFile(row.path)).content), sourceSha256)
  signal.throwIfAborted()
  if (checkpoint.data.stage !== 'sending') {
    checkpoint = await save(client, row, checkpoint, { stage: 'sending', sessionId: child.sessionId, childVersion: sessionFormatVersion })
  } else if (checkpoint.data.childVersion !== sessionFormatVersion) throw generationConflict()
  signal.throwIfAborted()
  await client.postUserMessage(child.sessionId, text, { ...fence(row, checkpoint), operationKey: data.requestId, requestId: data.requestId, signal })
  // Admission has its own durable receipt. No second checkpoint write is needed here:
  // a reload can observe the receipt even if the original caller lost the response.
  return { ok: true, ...descriptor(checkpoint) }
}

async function inspect(client, checkpoint) {
  const data = checkpoint.data
  if (checkpoint.released) return { state: data.stage }
  if (data.stage === 'creating') {
    const receipt = await client.getSessionReceipt(data.sessionKey, data.scope)
    return { state: receipt.active ? 'busy' : 'uncertain', sessionId: receipt.result?.sessionId ?? receipt.sessionId }
  }
  if (data.stage !== 'sending' || !data.sessionId) return { state: 'uncertain' }
  const receipt = await client.getSessionReceipt(data.requestId, data.scope)
  const outcome = await client.getRequestOutcome(data.sessionId, { requestId: data.requestId, boundary: data.boundary,
    version: data.childVersion, stage: receipt.state === 'done' ? 'accepted' : 'sending' })
  return outcome.state === 'uncertain' && receipt.active ? { state: 'busy' } : outcome
}

async function complete(client, row, checkpoint, { apply, beforeWrite, signal }) {
  const data = checkpoint.data
  if (checkpoint.released) {
    if (data.stage === 'stopped') throw stopped()
    if (data.stage !== 'done') throw pending()
    return { ok: true, ...resultHead(data), timeline: JSON.parse((await client.getFile(row.path)).content) }
  }
  const outcome = await inspect(client, checkpoint)
  signal?.throwIfAborted()
  if (outcome.state === 'stopped') {
    if (apply) await save(client, row, checkpoint, { stage: 'stopped' }, true)
    throw stopped()
  }
  if (outcome.state === 'busy' || outcome.state === 'waiting') throw httpError(409, 'The native request is pending.', 'PLAY_GENERATION_BUSY')
  if (outcome.state === 'running') throw httpError(409, 'The native turn is still in progress.', 'PLAY_GENERATION_RUNNING')
  if (outcome.state !== 'ready') throw pending()
  const file = await client.getFile(row.path)
  const timeline = JSON.parse(file.content)
  const next = generationTimeline(data, timeline, outcome, sourceSha256)
  if (apply) {
    if (next !== timeline) {
      await beforeWrite?.(file, row.path)
      signal?.throwIfAborted()
      await client.putFile(row.path, JSON.stringify(next), { ...fence(row, checkpoint), expectedRevision: file.revision, signal })
    }
    signal?.throwIfAborted()
    await save(client, row, checkpoint, { stage: 'done' }, true)
  }
  return { ok: true, ...resultHead(data), timeline: next }
}

async function run(client, row, body, signal) {
  let scope = body.expectedWorkspaceScope
  if (!scope) {
    const workspace = await client.getWorkspace()
    scope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
  }
  const checkpoint = await client.getCheckpoint(row, scope, body.operationKey)
  if (body.action === 'start') return start(client, row, body, scope, checkpoint, signal)
  if (body.action === 'status' && !body.operationKey
    && (!checkpoint || checkpoint.released || checkpoint.owner !== owner)) return { ok: true, pending: null }
  if (!checkpoint || checkpoint.owner !== owner || checkpoint.data.scope !== scope || checkpoint.data.path !== row.path
    || (body.operationKey && checkpoint.key !== body.operationKey)) throw generationConflict()
  if (body.action !== 'status' && !body.operationKey) throw generationConflict()
  if (body.action === 'finish') return complete(client, row, checkpoint, { apply: true, signal })
  const outcome = await inspect(client, checkpoint)
  if (body.action === 'dismiss') {
    if (!body.operationKey || (checkpoint.released && checkpoint.data.stage !== 'dismissed')) throw generationConflict()
    if (['busy','running','ready','waiting'].includes(outcome.state)) throw pending()
    signal.throwIfAborted()
    if (!checkpoint.released) await save(client, row, checkpoint, { stage: 'dismissed' }, true)
    return { ok: true }
  }
  if (body.action !== 'status') throw generationConflict()
  const entry = descriptor(checkpoint)
  if (outcome.sessionId) entry.sessionId = outcome.sessionId
  if (!checkpoint.released) {
    try {
      const timeline = JSON.parse((await client.getFile(row.path)).content)
      if (outcome.state === 'ready') generationTimeline(checkpoint.data, timeline, outcome, sourceSha256)
      else verifyGenerationTarget(checkpoint.data, timeline, sourceSha256)
    } catch (error) {
      return { ok: true, state: 'uncertain', pending: entry, code: error.code ?? 'PLAY_GENERATION_UNVERIFIED' }
    }
  }
  return { ok: true, state: outcome.state, pending: entry }
}

function boundedGeneration(signal, work) {
  const timeoutError = httpError(504, 'Timed out checking generation. Open Repair playthrough.', 'PLAY_GENERATION_TIMEOUT')
  return withOperationDeadline({ signal, timeoutError }, work)
}

export function runGenerationOperation(client, row, body) {
  return boundedGeneration(undefined, signal => run(client, row, body, signal))
}

export async function repairGenerationOperation(client, row, checkpoint, { apply, beforeWrite, signal } = {}) {
  if (checkpoint?.owner !== owner || checkpoint.released) return null
  const info = descriptor(checkpoint)
  try {
    const current = await client.getCheckpoint(row, checkpoint.data.scope)
    if (current?.key !== checkpoint.key || current.revision !== checkpoint.revision || checkpoint.data.path !== row.path) throw generationConflict()
    await boundedGeneration(signal, inner => complete(client, row, checkpoint, { apply, beforeWrite, signal: inner }))
    return { changes: [{ ...info, kind: 'generation-recovered' }], remaining: [] }
  } catch (error) {
    signal?.throwIfAborted()
    const reason = error.code === 'PLAY_GENERATION_RUNNING' ? 'turn-in-progress' : 'generation-pending'
    return { changes: [], remaining: [{ ...info, reason, code: error.code ?? 'PLAY_GENERATION_UNVERIFIED' }] }
  }
}
