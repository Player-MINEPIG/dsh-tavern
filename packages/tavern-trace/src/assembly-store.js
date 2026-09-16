import { mkdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const validSession = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id)
const bytes = value => Buffer.byteLength(JSON.stringify(value))
const limit = (v, fallback, max) => Number.isSafeInteger(v) && v >= 4096 ? Math.min(v, max) : fallback

/** Bounded derived audit data; never modifies DSH history. Single Host writer. */
export class AssemblyStore {
  constructor(directory, options = {}) {
    mkdirSync(directory, { recursive: true })
    this.path = join(directory, 'tavern-assemblies.json')
    this.maxRecordBytes = limit(options.maxRecordBytes, 2 * 1024 * 1024, 4 * 1024 * 1024)
    this.maxTotalBytes = limit(options.maxTotalBytes, 16 * 1024 * 1024, 32 * 1024 * 1024)
    this.maxRecords = 256
    this.rows = []
    try {
      if (statSync(this.path).size > 32 * 1024 * 1024) throw new Error('Assembly store exceeds read limit')
      const value = JSON.parse(readFileSync(this.path, 'utf8'))
      if (value.schemaVersion !== 3 || !Array.isArray(value.records)) throw new Error('Invalid assembly store')
      this.rows = value.records.filter(r => validSession(r.sessionId) && typeof r.id === 'string' && bytes(r) <= this.maxRecordBytes).slice(-this.maxRecords)
      this.trim(this.rows)
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  trim(rows) {
    while (rows.length > this.maxRecords || bytes({ schemaVersion: 3, records: rows }) > this.maxTotalBytes) rows.shift()
  }
  put(record) {
    if (!validSession(record.sessionId)) throw new TypeError('Invalid session id')
    let row = structuredClone(record)
    if (bytes(row) > Math.min(this.maxRecordBytes, this.maxTotalBytes - 256)) {
      row = { schemaVersion: 3, id: row.id, sessionId: row.sessionId, turn: row.turn, step: row.step,
        attempt: row.attempt, recordedAt: row.recordedAt, status: row.status, contentStatus: 'omitted-size-limit' }
    }
    const rows = this.rows.filter(r => r.id !== row.id || r.sessionId !== row.sessionId)
    rows.push(row)
    this.trim(rows)
    const temporary = `${this.path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify({ schemaVersion: 3, records: rows }), { mode: 0o600 })
      renameSync(temporary, this.path)
    } finally { try { unlinkSync(temporary) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    this.rows = rows
    return structuredClone(row)
  }
  list(id) {
    if (!validSession(id)) throw new TypeError('Invalid session id')
    return this.rows.filter(r => r.sessionId === id).map(({ sections, contexts, systemMessages, audit, ...r }) => ({
      ...structuredClone(r), sectionCount: sections?.length ?? 0,
    }))
  }
  get(id, recordId) {
    if (!validSession(id)) throw new TypeError('Invalid session id')
    return structuredClone(this.rows.find(r => r.sessionId === id && r.id === recordId) ?? null)
  }
  storage() { return { kind: 'bounded-assembly-snapshots', maxRecords: this.maxRecords, maxRecordBytes: this.maxRecordBytes, maxTotalBytes: this.maxTotalBytes } }
}
