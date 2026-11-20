import { createHash, randomUUID } from 'node:crypto'
import { linkSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError } from './http.js'

const active = new Set()
const limit = 64 * 1024
const validKey = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)
const invalid = () => httpError(400, 'Invalid session operation identity or workspace scope', 'PLAY_SESSION_OPERATION_INVALID')
const pending = () => httpError(409, 'Check the saved session operation receipt before continuing', 'PLAY_SESSION_OPERATION_PENDING')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

function scopeCheck(store, scope) {
  const binding = store.get()
  if (!binding.rootPath || scope !== JSON.stringify([binding.workspaceId, binding.rootPath])) {
    throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
  }
}
function receiptPath(store, scope, key) {
  if (!validKey(key) || typeof scope !== 'string') throw invalid()
  scopeCheck(store, scope)
  return join(store.storageDir, 'session-receipts', digest([scope, key]) + '.json')
}
function read(path) {
  try { return readJsonFile(path, limit) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

export function readSessionReceipt(store, scope, key) {
  const path = receiptPath(store, scope, key)
  const record = read(path)
  if (!record || record.stage === 'unattempted') return { state: 'missing' }
  const { inputHash, ...publicFields } = record
  if (record.state === 'pending') publicFields.active = active.has(path)
  return publicFields
}

// Only a native action with an unknown outcome needs a permanent pending
// receipt. Validation and possibly slow preparation happen before admission.
export async function runSessionMutation(store, action, source, body, operation, waitMs, run) {
  const { operationKey, expectedWorkspaceScope: scope, checkpointId, checkpointKey } = body ?? {}
  if (operationKey === undefined && checkpointId === undefined && checkpointKey === undefined) {
    return run({ beforeNative() {}, check() {}, operation })
  }
  if ((checkpointId !== undefined || checkpointKey !== undefined) && !(validKey(checkpointId) && validKey(checkpointKey))) throw invalid()
  const path = receiptPath(store, scope, operationKey)
  const inputHash = digest([action, source, canonical(body)])
  const replay = () => {
    const existing = read(path)
    if (!existing) return
    if (existing.inputHash !== inputHash) throw httpError(409, 'This session operation key has different input', 'PLAY_SESSION_OPERATION_CONFLICT')
    if (existing.state !== 'done') throw pending()
    return existing.result
  }
  const result = replay()
  if (result) return result
  const deadline = AbortSignal.timeout(waitMs)
  function check() {
    deadline.throwIfAborted()
    scopeCheck(store, scope)
    if (checkpointId !== undefined) store.checkpoints.assertOwner(checkpointId, checkpointKey, scope)
  }
  let record
  function save(patch) {
    record = { ...record, ...patch }
    atomicJson(path, record, limit)
  }
  const context = {
    check,
    beforeNative() {
      check()
      // Recheck after asynchronous preflight, before admitting the side effect.
      if (replay()) throw pending()
      const candidate = path + '.' + randomUUID()
      const intent = { state: 'pending', stage: 'attempted', inputHash }
      atomicJson(candidate, intent, limit)
      try {
        // Install a fully written receipt exactly once, including across Host processes.
        linkSync(candidate, path)
        record = intent
        active.add(path)
      } catch (error) {
        if (error.code === 'EEXIST') throw pending()
        throw error
      } finally { unlinkSync(candidate) }
    },
    operation: {
      ...operation,
      identify: details => operation?.identify(details),
      checkpoint(stage, details) {
        if (record) save({ stage, ...(details?.sessionId ? { sessionId: details.sessionId } : {}) })
        operation?.checkpoint(stage, details)
      },
    },
  }
  let onAbort
  const timeout = new Promise((_, reject) => {
    onAbort = () => reject(httpError(504, 'Session operation timed out. Inspect the operation receipt.', 'PLAY_SESSION_OPERATION_TIMEOUT'))
    deadline.addEventListener('abort', onAbort, { once: true })
  })
  const work = async () => {
    try {
      const result = await run(context)
      save({ state: 'done', stage: 'completed', result })
      return result
    } catch (error) {
      if (record && error.rollbackForkNotAttempted && !record.sessionId) unlinkSync(path)
      throw error
    } finally { if (record) active.delete(path) }
  }
  try { return await Promise.race([work(), timeout]) }
  finally { deadline.removeEventListener('abort', onAbort) }
}
