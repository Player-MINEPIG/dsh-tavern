import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const SCHEMA_VERSION = 1
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const DEFAULT_MAX_SESSIONS = 128
const DEFAULT_MAX_RECORDS_PER_SESSION = 128
const DEFAULT_MAX_RECORD_BYTES = 256 * 1024

function clone(value) {
  return structuredClone(value)
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function validateSessionId(value) {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) throw new TypeError('Invalid session id')
  return value
}

function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
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
  const cloned = clone(record)
  if (Buffer.byteLength(JSON.stringify(cloned)) > maximumBytes) return null
  return cloned
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
      const updatedAt = Number.isFinite(bucket?.updatedAt) ? bucket.updatedAt : records.at(-1)?.recordedAt ?? 0
      return [[id, { updatedAt, records }]]
    })
    .toSorted((left, right) => left[1].updatedAt - right[1].updatedAt)
    .slice(-limits.maxSessions)
  return { schemaVersion: SCHEMA_VERSION, sessions: Object.fromEntries(sessions) }
}

function readState(path, limits) {
  try {
    return normalizeState(JSON.parse(readFileSync(path, 'utf8')), limits)
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyState()
    throw error
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
    this.maxSessions = positiveInteger(options.maxSessions, DEFAULT_MAX_SESSIONS)
    this.maxRecordsPerSession = positiveInteger(options.maxRecordsPerSession, DEFAULT_MAX_RECORDS_PER_SESSION)
    this.maxRecordBytes = positiveInteger(options.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES)
    mkdirSync(this.storageDir, { recursive: true })
    this.state = readState(this.statePath, this)
  }

  list(sessionId) {
    const key = validateSessionId(sessionId)
    return clone(this.state.sessions[key]?.records ?? [])
  }

  upsert(sessionId, record) {
    const key = validateSessionId(sessionId)
    const normalized = normalizeRecord(record, this.maxRecordBytes)
    if (normalized === null) throw new TypeError(`Invalid or oversized Tavern Trace record (limit ${this.maxRecordBytes} bytes)`)
    const current = this.state.sessions[key]?.records ?? []
    const index = current.findIndex(item => item.id === normalized.id)
    const records = index === -1
      ? [...current, normalized]
      : current.map((item, itemIndex) => itemIndex === index ? normalized : item)
    this.state.sessions[key] = {
      updatedAt: Number.isFinite(normalized.updatedAt) ? normalized.updatedAt : Date.now(),
      records: records.slice(-this.maxRecordsPerSession),
    }
    this.pruneSessions()
    atomicJson(this.statePath, this.state)
    return clone(normalized)
  }

  pruneSessions() {
    const entries = Object.entries(this.state.sessions)
    if (entries.length <= this.maxSessions) return
    const keep = entries
      .toSorted((left, right) => left[1].updatedAt - right[1].updatedAt)
      .slice(-this.maxSessions)
    this.state.sessions = Object.fromEntries(keep)
  }
}

export const tavernTraceStoreConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  maxSessions: DEFAULT_MAX_SESSIONS,
  maxRecordsPerSession: DEFAULT_MAX_RECORDS_PER_SESSION,
  maxRecordBytes: DEFAULT_MAX_RECORD_BYTES,
})
