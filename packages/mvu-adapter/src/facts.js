import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'

const MAX_BYTES = 1024 * 1024
const MAX_RECORDS = 2048
const phases = new Set(['started', 'triggered', 'applied', 'skipped', 'failed', 'completed'])
const strings = ['id', 'eventId', 'sessionId', 'on', 'cause', 'requestId', 'reason', 'detail']
function metadata(fact) {
  if (!phases.has(fact?.phase) || typeof fact.id !== 'string' || typeof fact.sessionId !== 'string') return null
  const row = { phase: fact.phase, recordedAt: Number.isFinite(fact.recordedAt) ? fact.recordedAt : Date.now() }
  for (const key of strings) if (typeof fact[key] === 'string') row[key] = fact[key].slice(0, 300)
  for (const key of ['turn', 'revision', 'configRevision']) if (Number.isSafeInteger(fact[key])) row[key] = fact[key]
  if (fact.configRevision === null) row.configRevision = null
  return row
}

/** Bounded observation metadata; variables remain exclusively in the MVU ledger. */
export class MvuFacts {
  constructor(storageDir) {
    this.path = join(storageDir, 'mvu-facts.json')
    this.records = []
    this.unavailable = false
    try {
      if (existsSync(this.path)) {
        const stored = readJsonFile(this.path, MAX_BYTES)
        if (stored.version !== 1 || !Array.isArray(stored.records)) throw new Error('Invalid MVU facts')
        this.records = stored.records.slice(-MAX_RECORDS).map(metadata).filter(Boolean)
      }
    } catch { this.unavailable = true }
  }
  append(fact) {
    const row = metadata(fact)
    if (!row) return
    const records = [...this.records, row].slice(-MAX_RECORDS)
    while (Buffer.byteLength(JSON.stringify({ version: 1, records })) > MAX_BYTES) records.shift()
    try { atomicJson(this.path, { version: 1, records }, MAX_BYTES); this.records = records; this.unavailable = false }
    catch { this.unavailable = true } // Optional observation cannot roll back a committed state.
  }
  list(id, sessionId) {
    return { records: structuredClone(this.records.filter(row => row.id === id && row.sessionId === sessionId)),
      unavailable: this.unavailable, maxRecords: MAX_RECORDS }
  }
}
