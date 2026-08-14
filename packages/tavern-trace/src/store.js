import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const SCHEMA_VERSION = 1
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const DEFAULT_MAX_SESSIONS = 128
const DEFAULT_MAX_RECORDS_PER_SESSION = 128
const DEFAULT_MAX_RECORD_BYTES = 64 * 1024
const DEFAULT_MAX_TOTAL_BYTES = 8 * 1024 * 1024
const HARD_MAX_SESSIONS = DEFAULT_MAX_SESSIONS
const HARD_MAX_RECORDS_PER_SESSION = DEFAULT_MAX_RECORDS_PER_SESSION
const HARD_MAX_RECORD_BYTES = 64 * 1024
const HARD_MAX_TOTAL_BYTES = DEFAULT_MAX_TOTAL_BYTES
const HARD_MAX_READ_BYTES = 16 * 1024 * 1024
const MIN_MAX_TOTAL_BYTES = 1024

function clone(value) {
  return structuredClone(value)
}

function boundedPositiveInteger(value, fallback, maximum, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) return fallback
  return Math.min(value, maximum)
}

function validateSessionId(value) {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) throw new TypeError('Invalid session id')
  return value
}

function serializeState(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function atomicSerialized(path, serialized) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, serialized, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, sessions: {} }
}

function normalizeRecord(record, maximumBytes = Infinity) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return null
  if (typeof record.id !== 'string' || record.id.length > 160) return null
  if (!Number.isSafeInteger(record.turn) || record.turn < 0) return null
  if (!Number.isSafeInteger(record.step) || record.step < 0) return null
  if (!Number.isSafeInteger(record.attempt) || record.attempt < 1) return null
  try {
    const cloned = clone(record)
    if (Buffer.byteLength(JSON.stringify(cloned)) > maximumBytes) return null
    return cloned
  } catch {
    return null
  }
}

function recordTime(record, bucket) {
  if (Number.isFinite(record?.updatedAt)) return record.updatedAt
  if (Number.isFinite(record?.recordedAt)) return record.recordedAt
  return Number.isFinite(bucket?.updatedAt) ? bucket.updatedAt : 0
}

function bucketTime(records) {
  return records.reduce((latest, record) => Math.max(latest, recordTime(record)), 0)
}

function pruneSessions(state, maximumSessions) {
  const entries = Object.entries(state.sessions)
  if (entries.length <= maximumSessions) return
  const keep = entries
    .toSorted((left, right) => left[1].updatedAt - right[1].updatedAt || left[0].localeCompare(right[0]))
    .slice(-maximumSessions)
  state.sessions = Object.fromEntries(keep)
}

function evictionCandidates(state) {
  return Object.entries(state.sessions)
    .flatMap(([sessionId, bucket]) => bucket.records.map((record, index) => ({
      sessionId,
      index,
      record,
      time: recordTime(record, bucket),
    })))
    .toSorted((left, right) => left.time - right.time
      || left.sessionId.localeCompare(right.sessionId)
      || left.index - right.index)
}

/**
 * Enforce the actual UTF-8 byte size of the complete pretty-printed state.
 * Compact record bytes are a lower bound for each record's formatted footprint,
 * so one batch normally reaches the target without repeatedly serializing the
 * bounded state once for every evicted record.
 */
function fitStateToBudget(state, maximumBytes) {
  let serialized = serializeState(state)
  let bytes = Buffer.byteLength(serialized)
  let evicted = 0
  while (bytes > maximumBytes) {
    const candidates = evictionCandidates(state)
    if (candidates.length === 0) throw new RangeError(`Tavern Trace state envelope exceeds total limit ${maximumBytes} bytes`)
    const excess = bytes - maximumBytes
    const removals = new Map()
    let reclaimedLowerBound = 0
    for (const candidate of candidates) {
      const indexes = removals.get(candidate.sessionId) ?? new Set()
      indexes.add(candidate.index)
      removals.set(candidate.sessionId, indexes)
      reclaimedLowerBound += Buffer.byteLength(JSON.stringify(candidate.record))
      evicted += 1
      if (reclaimedLowerBound >= excess) break
    }
    for (const [sessionId, indexes] of removals) {
      const records = state.sessions[sessionId].records.filter((_record, index) => !indexes.has(index))
      if (records.length === 0) {
        delete state.sessions[sessionId]
      } else {
        state.sessions[sessionId] = { updatedAt: bucketTime(records), records }
      }
    }
    serialized = serializeState(state)
    bytes = Buffer.byteLength(serialized)
  }
  return { state, serialized, bytes, evicted }
}

function normalizeState(value, limits) {
  if (value?.schemaVersion !== SCHEMA_VERSION || value.sessions === null || typeof value.sessions !== 'object' || Array.isArray(value.sessions)) {
    return emptyState()
  }
  const sessions = Object.entries(value.sessions)
    .flatMap(([id, bucket]) => {
      try { validateSessionId(id) } catch { return [] }
      const records = Array.isArray(bucket?.records)
        ? bucket.records.map(record => normalizeRecord(record, limits.maxRecordBytes)).filter(Boolean).slice(-limits.maxRecordsPerSession)
        : []
      if (records.length === 0) return []
      return [[id, { updatedAt: bucketTime(records), records }]]
    })
    .toSorted((left, right) => left[1].updatedAt - right[1].updatedAt || left[0].localeCompare(right[0]))
    .slice(-limits.maxSessions)
  return { schemaVersion: SCHEMA_VERSION, sessions: Object.fromEntries(sessions) }
}

function readState(path, limits) {
  try {
    const fileBytes = statSync(path).size
    if (fileBytes > HARD_MAX_READ_BYTES) {
      const fitted = fitStateToBudget(emptyState(), limits.maxTotalBytes)
      return { ...fitted, persistedBytes: fileBytes, needsRewrite: true, resetOversizedFile: true }
    }
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    const normalized = normalizeState(parsed, limits)
    const fitted = fitStateToBudget(normalized, limits.maxTotalBytes)
    return {
      ...fitted,
      persistedBytes: fileBytes,
      needsRewrite: fitted.evicted > 0
        || fileBytes > limits.maxTotalBytes
        || JSON.stringify(parsed) !== JSON.stringify(fitted.state),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      const fitted = fitStateToBudget(emptyState(), limits.maxTotalBytes)
      return { ...fitted, persistedBytes: 0, needsRewrite: false, resetOversizedFile: false }
    }
    throw error
  }
}

function assertRecordFitsTotalBudget(sessionId, record, maximumBytes) {
  const singleton = {
    schemaVersion: SCHEMA_VERSION,
    sessions: {
      [sessionId]: { updatedAt: recordTime(record), records: [record] },
    },
  }
  if (Buffer.byteLength(serializeState(singleton)) > maximumBytes) {
    throw new RangeError(`Tavern Trace record cannot fit total limit ${maximumBytes} bytes`)
  }
}

/**
 * Plugin-owned bounded audit persistence. Records are metadata-only snapshots;
 * this store never reads or writes DSH Session logs.
 */
export class TavernTraceStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'tavern-traces.json')
    this.maxSessions = boundedPositiveInteger(options.maxSessions, DEFAULT_MAX_SESSIONS, HARD_MAX_SESSIONS)
    this.maxRecordsPerSession = boundedPositiveInteger(options.maxRecordsPerSession, DEFAULT_MAX_RECORDS_PER_SESSION, HARD_MAX_RECORDS_PER_SESSION)
    this.maxRecordBytes = boundedPositiveInteger(options.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES, HARD_MAX_RECORD_BYTES)
    this.maxTotalBytes = boundedPositiveInteger(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES, HARD_MAX_TOTAL_BYTES, MIN_MAX_TOTAL_BYTES)
    mkdirSync(this.storageDir, { recursive: true })
    const loaded = readState(this.statePath, this)
    this.state = loaded.state
    this.serializedBytes = loaded.bytes
    this.persistedBytes = loaded.persistedBytes
    this.resetOversizedFile = loaded.resetOversizedFile === true
    if (loaded.needsRewrite) {
      atomicSerialized(this.statePath, loaded.serialized)
      this.persistedBytes = loaded.bytes
    }
  }

  list(sessionId) {
    const key = validateSessionId(sessionId)
    return clone(this.state.sessions[key]?.records ?? [])
  }

  upsert(sessionId, record) {
    return this.upsertMany(sessionId, [record])[0]
  }

  upsertMany(sessionId, recordsToUpsert) {
    const key = validateSessionId(sessionId)
    if (!Array.isArray(recordsToUpsert) || recordsToUpsert.length === 0) throw new TypeError('Tavern Trace upsert batch must not be empty')
    const normalizedRecords = recordsToUpsert.map(record => {
      const normalized = normalizeRecord(record, this.maxRecordBytes)
      if (normalized === null) throw new TypeError(`Invalid or oversized Tavern Trace record (limit ${this.maxRecordBytes} bytes)`)
      assertRecordFitsTotalBudget(key, normalized, this.maxTotalBytes)
      return normalized
    })
    const nextState = { schemaVersion: SCHEMA_VERSION, sessions: { ...this.state.sessions } }
    for (const normalized of normalizedRecords) {
      const current = nextState.sessions[key]?.records ?? []
      const index = current.findIndex(item => item.id === normalized.id)
      const records = index === -1
        ? [...current, normalized]
        : current.map((item, itemIndex) => itemIndex === index ? normalized : item)
      const boundedRecords = records.slice(-this.maxRecordsPerSession)
      nextState.sessions[key] = {
        updatedAt: bucketTime(boundedRecords),
        records: boundedRecords,
      }
    }
    pruneSessions(nextState, this.maxSessions)
    const fitted = fitStateToBudget(nextState, this.maxTotalBytes)
    atomicSerialized(this.statePath, fitted.serialized)
    this.state = fitted.state
    this.serializedBytes = fitted.bytes
    this.persistedBytes = fitted.bytes
    return clone(normalizedRecords)
  }
}

export const tavernTraceStoreConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  maxSessions: DEFAULT_MAX_SESSIONS,
  maxRecordsPerSession: DEFAULT_MAX_RECORDS_PER_SESSION,
  maxRecordBytes: DEFAULT_MAX_RECORD_BYTES,
  maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
  hardMaxSessions: HARD_MAX_SESSIONS,
  hardMaxRecordsPerSession: HARD_MAX_RECORDS_PER_SESSION,
  hardMaxRecordBytes: HARD_MAX_RECORD_BYTES,
  hardMaxTotalBytes: HARD_MAX_TOTAL_BYTES,
  hardMaxReadBytes: HARD_MAX_READ_BYTES,
})
