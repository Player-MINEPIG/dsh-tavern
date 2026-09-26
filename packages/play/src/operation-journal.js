import { randomUUID } from 'node:crypto'
import { appendFileSync, closeSync, constants, existsSync, fstatSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { httpError, sendJson } from './http.js'

export const operationJournalLimits = Object.freeze({ segmentBytes: 1024 * 1024, segments: 4, recordBytes: 4096, pageSize: 200, maxPageSize: 1000 })
const strings = { operationId: 128, operation: 96, stage: 96, result: 96, errorCode: 96, method: 32, sessionId: 128, playthroughId: 128 }
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/
const recordId = /^[\da-f-]{36}:\d{1,16}$/

// A second whitelist at the persistence boundary deliberately excludes paths.
function fields(input) {
  const output = {}
  for (const [key, length] of Object.entries(strings)) {
    if (typeof input?.[key] === 'string') output[key] = input[key].replace(/[\u0000-\u001f\u007f]/g, '\ufffd').slice(0, length)
  }
  if (Number.isInteger(input?.status) && input.status >= 100 && input.status <= 599) output.status = input.status
  if (Number.isSafeInteger(input?.durationMs) && input.durationMs >= 0) output.durationMs = input.durationMs
  if (typeof input?.result === 'boolean' || (typeof input?.result === 'number' && Number.isFinite(input.result))) output.result = input.result
  return output
}

function readFile(path, maxBytes) {
  if (lstatSync(path).isSymbolicLink()) throw new Error('unsafe log link')
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.size > maxBytes || stat.nlink !== 1) throw new Error('unsafe log file')
    return readFileSync(fd, 'utf8')
  } finally { closeSync(fd) }
}

/** One writer per storage directory; synchronous bounded I/O serializes requests.
 * An exclusive startup guard serializes lock recovery. An orphan guard fails
 * closed, rather than risking removal of a live writer's ownership record.
 */
export class OperationJournal {
  constructor(storageDir, { enabled = true, limits = operationJournalLimits } = {}) {
    this.limits = limits
    this.runId = randomUUID()
    this.sequence = 0
    this.dropped = 0
    this.code = enabled ? null : 'LOG_DISABLED'
    this.directory = join(storageDir, 'operation-logs')
    this.owned = false
    if (!enabled) return
    try {
      mkdirSync(this.directory, { recursive: true, mode: 0o700 })
      if (!lstatSync(this.directory).isDirectory() || lstatSync(this.directory).isSymbolicLink()) throw new Error('unsafe log directory')
      const guard = join(this.directory, '.guard')
      try { mkdirSync(guard, { mode: 0o700 }) } catch (error) {
        this.code = error.code === 'EEXIST' ? 'LOG_LOCK_RECOVERY_REQUIRED' : 'LOG_STORAGE_UNAVAILABLE'
        return
      }
      try {
        const lock = join(this.directory, '.owner')
        if (existsSync(lock)) {
          const owner = JSON.parse(readFile(lock, 256))
          if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('invalid owner')
          let dead = false
          try { process.kill(owner.pid, 0) } catch (error) { dead = error.code === 'ESRCH' }
          if (!dead) { this.code = 'LOG_WRITER_BUSY'; return }
          rmSync(lock)
        }
        writeFileSync(lock, JSON.stringify({ pid: process.pid, runId: this.runId }), { flag: 'wx', mode: 0o600 })
        this.owned = true
      } finally { rmSync(guard, { recursive: true }) }
      // A crash may leave an unfinished last line. Keep earlier complete records.
      const path = this.path(0)
      if (existsSync(path)) {
        const text = readFile(path, limits.segmentBytes)
        if (text && !text.endsWith('\n')) {
          const fd = openSync(path, constants.O_WRONLY | constants.O_NOFOLLOW)
          try { ftruncateSync(fd, Buffer.byteLength(text.slice(0, text.lastIndexOf('\n') + 1))) } finally { closeSync(fd) }
        }
      }
    } catch { this.code = 'LOG_STORAGE_UNAVAILABLE' }
  }

  path(index) { return join(this.directory, `${index}.jsonl`) }

  append(level, payload) {
    if (!this.owned || this.code !== null) { this.dropped++; return false }
    try {
      const row = { schemaVersion: 1, id: `${this.runId}:${++this.sequence}`, runId: this.runId, timestamp: new Date().toISOString(), level: level === 'warn' ? 'warn' : 'info', ...fields(payload) }
      const line = `${JSON.stringify(row)}\n`
      const size = Buffer.byteLength(line)
      if (size > this.limits.recordBytes || size > this.limits.segmentBytes) { this.dropped++; return false }
      const path = this.path(0)
      const stat = existsSync(path) ? lstatSync(path) : null
      if (stat && (!stat.isFile() || stat.nlink !== 1 || stat.size > this.limits.segmentBytes)) throw new Error('unsafe log file')
      const currentSize = stat?.size ?? 0
      if (currentSize + size > this.limits.segmentBytes) {
        rmSync(this.path(this.limits.segments - 1), { force: true })
        for (let i = this.limits.segments - 2; i >= 0; i--) {
          if (existsSync(this.path(i))) renameSync(this.path(i), this.path(i + 1))
        }
      }
      const fd = openSync(path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
      try {
        const stat = fstatSync(fd)
        if (!stat.isFile() || stat.nlink !== 1) throw new Error('unsafe log file')
        appendFileSync(fd, line)
      } finally { closeSync(fd) }
      return true
    } catch {
      this.code = 'LOG_STORAGE_UNAVAILABLE'
      this.dropped++
      return false
    }
  }

  query({ limit = this.limits.pageSize, before, operationId, sessionId, playthroughId, level } = {}) {
    let records = []
    let skippedRecords = 0
    let readCode = null
    if (this.code !== 'LOG_DISABLED') {
      try {
        for (let i = 0; i < this.limits.segments; i++) {
          if (!existsSync(this.path(i))) continue
          const text = readFile(this.path(i), this.limits.segmentBytes)
          const lines = text.split('\n')
          if (lines.pop() !== '') skippedRecords++
          for (const line of lines.reverse()) {
            try {
              if (Buffer.byteLength(line) > this.limits.recordBytes) throw new Error('oversize')
              const row = JSON.parse(line)
              if (row.schemaVersion !== 1 || !uuid.test(row.runId) || !recordId.test(row.id) || !row.id.startsWith(`${row.runId}:`) || !['info', 'warn'].includes(row.level) || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp))) throw new Error('invalid row')
              records.push({ schemaVersion: 1, id: row.id, runId: row.runId, timestamp: new Date(row.timestamp).toISOString(), level: row.level, ...fields(row) })
            } catch { skippedRecords++ }
          }
        }
      } catch { records = []; readCode = 'LOG_STORAGE_UNAVAILABLE' }
    }
    if (before && !readCode) {
      const index = records.findIndex(row => row.id === before)
      if (index < 0) throw httpError(409, 'Log cursor has expired; refresh the query.', 'LOG_CURSOR_EXPIRED')
      records = records.slice(index + 1)
    }
    records = records.filter(row => (!operationId || row.operationId === operationId) && (!sessionId || row.sessionId === sessionId) && (!playthroughId || row.playthroughId === playthroughId) && (!level || row.level === level))
    const hasMore = records.length > limit
    records = records.slice(0, limit)
    return { ok: true, schemaVersion: 1, records, nextCursor: hasMore ? records.at(-1).id : null,
      storage: { available: this.code === null && readCode === null, code: readCode ?? this.code, dropped: this.dropped, skippedRecords }, limits: this.limits }
  }

  close() {
    if (!this.owned) return
    try {
      const lock = join(this.directory, '.owner')
      if (JSON.parse(readFile(lock, 256)).runId === this.runId) rmSync(lock)
    } catch { /* Leave an ambiguous lock in place. */ }
    this.owned = false
    this.code ??= 'LOG_CLOSED'
  }
}

export function serveOperationLogs(journal, req, res, searchParams) {
  if (!journal) throw httpError(404, 'Operation logs are unavailable.', 'PLAY_NOT_FOUND')
  if (req.method !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
  const allowed = new Set(['limit', 'before', 'operationId', 'sessionId', 'playthroughId', 'level', 'format'])
  const options = {}
  for (const [key, value] of searchParams) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1 || value.length === 0) throw httpError(400, 'Invalid log query.', 'LOG_QUERY_INVALID')
    options[key] = value
  }
  if (options.limit !== undefined) {
    if (!/^\d+$/.test(options.limit) || Number(options.limit) < 1 || Number(options.limit) > journal.limits.maxPageSize) throw httpError(400, 'Invalid log limit.', 'LOG_QUERY_INVALID')
    options.limit = Number(options.limit)
  }
  for (const key of ['operationId', 'sessionId', 'playthroughId']) if (options[key] && (options[key].length > 128 || /[\u0000-\u001f\u007f]/.test(options[key]))) throw httpError(400, 'Invalid log filter.', 'LOG_QUERY_INVALID')
  if ((options.before && !recordId.test(options.before)) || (options.level && !['info', 'warn'].includes(options.level)) || (options.format && !['json', 'jsonl'].includes(options.format))) throw httpError(400, 'Invalid log query.', 'LOG_QUERY_INVALID')
  const page = journal.query(options)
  res.setHeader('Cache-Control', 'no-store')
  if (options.format !== 'jsonl') return sendJson(res, 200, page)
  const { records, ...metadata } = page
  // The first line makes incomplete/degraded exports explicit and carries pagination.
  const body = [JSON.stringify({ type: 'metadata', ...metadata }), ...records.map(row => JSON.stringify(row))].join('\n') + '\n'
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="tavern-operation-logs.jsonl"')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}
