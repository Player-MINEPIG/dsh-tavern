import { mkdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const validSession = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id)
const bytes = value => Buffer.byteLength(JSON.stringify(value))
const limit = (v, fallback, max) => Number.isSafeInteger(v) && v >= 4096 ? Math.min(v, max) : fallback
const legacyLink = record => {
  const id = record.audit?.captureId ?? record.legacyCaptureId
  return typeof id === 'string' && id !== '' ? { legacyCaptureId: id } : {}
}
function readRows(path, version) {
  try {
    if (statSync(path).size > 32 * 1024 * 1024) throw new Error('Trace store exceeds read limit')
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (value.schemaVersion !== version || !Array.isArray(value.records)) throw new Error('Invalid Trace store')
    return value.records.filter(row => row?.schemaVersion === version && validSession(row.sessionId)
      && typeof row.id === 'string' && row.id !== '').slice(-256)
  } catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
function metadataOnly(record) {
  const row = structuredClone(record)
  if (row.schemaVersion === 4) {
    row.bodyStorage = 'official-session'
    row.sourceTextStored = false
    delete row.systemMessages
    for (const part of [...row.sections ?? [], ...row.contexts ?? []]) {
      delete part.text
      for (const source of part.sources ?? []) { delete source.text; source.textStatus = 'not-stored' }
    }
  }
  return row
}

/** New captures share one metadata store. Old body snapshots are read-only. */
export class AssemblyStore {
  constructor(directory, options = {}) {
    mkdirSync(directory, { recursive: true })
    this.path = join(directory, 'tavern-trace-records.json')
    this.maxRecordBytes = limit(options.maxRecordBytes, 2 * 1024 * 1024, 4 * 1024 * 1024)
    this.maxTotalBytes = limit(options.maxTotalBytes, 16 * 1024 * 1024, 32 * 1024 * 1024)
    this.maxRecords = 256
    this.legacyRows = readRows(join(directory, 'tavern-assemblies.json'), 3)
    this.rows = readRows(this.path, 4).filter(row => bytes(row) <= this.maxRecordBytes).map(metadataOnly)
    this.trim(this.rows)
    this.persistedBytes = bytes({ schemaVersion: 4, records: this.rows })
  }
  trim(rows) {
    while (rows.length > this.maxRecords || bytes({ schemaVersion: 4, records: rows }) > this.maxTotalBytes) rows.shift()
  }
  bounded(record) {
    let row = metadataOnly(record)
    if (bytes(row) > Math.min(this.maxRecordBytes, this.maxTotalBytes - 256)) {
      row = { schemaVersion: row.schemaVersion, id: row.id, sessionId: row.sessionId, turn: row.turn, step: row.step,
        attempt: row.attempt, recordedAt: row.recordedAt, status: row.status, contentStatus: 'omitted-size-limit',
        ...(row.schemaVersion === 4 ? { bodyStorage: 'official-session', sourceTextStored: false } : {}), ...legacyLink(row) }
    }
    return row
  }
  persist(rows) {
    this.trim(rows)
    const serialized = JSON.stringify({ schemaVersion: 4, records: rows })
    const temporary = `${this.path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, serialized, { mode: 0o600 })
      renameSync(temporary, this.path)
    } finally { try { unlinkSync(temporary) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    this.rows = rows
    this.persistedBytes = Buffer.byteLength(serialized)
  }
  put(record) {
    if (!validSession(record.sessionId)) throw new TypeError('Invalid session id')
    if (typeof record.id !== 'string' || record.id === '') throw new TypeError('Invalid Trace record id')
    if (record.schemaVersion !== 4) throw new TypeError('New Trace records must use reference storage')
    const previous = this.rows.find(row => row.id === record.id && row.sessionId === record.sessionId)
    // The v1 recorder may have aligned its audit to request/header since begin.
    // Never overwrite that canonical audit with an earlier pending snapshot.
    const row = this.bounded({ ...record, ...(previous?.audit ? { audit: previous.audit } : {}) })
    const rows = this.rows.filter(item => item.id !== row.id || item.sessionId !== row.sessionId)
    rows.push(row)
    this.persist(rows)
    return structuredClone(row)
  }
  putAudits(sessionId, audits) {
    if (!validSession(sessionId)) throw new TypeError('Invalid session id')
    const rows = [...this.rows]
    for (const audit of audits) {
      if (typeof audit.captureId !== 'string' || audit.captureId === '') throw new TypeError('Trace capture identity is required')
      const index = rows.findIndex(row => row.sessionId === sessionId && row.id === audit.captureId)
      const existing = rows[index]
      const record = this.bounded({ ...(existing ?? { schemaVersion: 4, id: audit.captureId, sessionId,
        turn: audit.turn, step: audit.step, attempt: audit.attempt, recordedAt: audit.recordedAt,
        status: 'assembled', contentStatus: 'assembly-unavailable', entersModelHistory: false }), audit })
      if (index === -1) rows.push(record)
      else rows[index] = record
    }
    this.persist(rows)
  }
  retained(id) {
    if (!validSession(id)) throw new TypeError('Invalid session id')
    const rows = new Map(this.legacyRows.filter(row => row.sessionId === id).map(row => [row.id, row]))
    for (const row of this.rows) if (row.sessionId === id) rows.set(row.id, row)
    return [...rows.values()].sort((a, b) => a.recordedAt - b.recordedAt)
  }
  listAudits(id) {
    if (!validSession(id)) throw new TypeError('Invalid session id')
    // Old v3 snapshots can contain an earlier audit than the finalized v1 file.
    // Only new shared records are authoritative for both API views.
    return this.rows.filter(row => row.sessionId === id && row.audit?.id).map(row => structuredClone(row.audit))
  }
  list(id) {
    return this.retained(id).map(({ sections, contexts, systemMessages, audit, ...row }) => ({
      ...structuredClone(row), ...legacyLink({ audit, legacyCaptureId: row.legacyCaptureId }), sectionCount: sections?.length ?? 0,
    }))
  }
  get(id, recordId) { return structuredClone(this.retained(id).find(row => row.id === recordId) ?? null) }
  storage() { return { kind: 'bounded-assembly-references', maxRecords: this.maxRecords,
    maxRecordBytes: this.maxRecordBytes, maxTotalBytes: this.maxTotalBytes } }
}
