import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = () => { throw Object.assign(new Error('Source metadata changed; reload the source to rebuild its index'), { code: 'SCOPE_CATALOG_STALE' }) }
const idPattern = /^[A-Za-z0-9_-]{1,100}$/
/** Source-owned persistent summaries. Queries inspect filesystem metadata, never resource bodies. */
export class ScopeMetadataIndex {
  #epoch = 0; #instance = randomUUID(); #unavailable = false
  constructor({ directory, path, readMetadata }) {
    this.directory = directory; this.path = path; this.rows = new Map()
    try { this.files = this.inventory() } catch { this.files = new Map(); this.#unavailable = true; return }
    let cached
    try { cached = JSON.parse(readFileSync(path, 'utf8')) } catch {}
    const previous = new Map(cached?.version === 1 && Array.isArray(cached.records) ? cached.records.map(row => [row.id, row]) : [])
    for (const [id, fingerprint] of this.files) {
      const prior = previous.get(id)
      if (prior?.fingerprint === fingerprint && this.valid(prior)) this.rows.set(id, { id, name: prior.name })
      else {
        try {
          const row = readMetadata(join(directory, `${id}.json`))
          if (this.valid(row) && row.id === id) this.rows.set(id, { id, name: row.name })
        } catch {}
      }
    }
    try { this.persist() } catch { this.#unavailable = true }
  }
  valid(row) { return row && typeof row.id === 'string' && idPattern.test(row.id) && typeof row.name === 'string' && row.name.trim() && row.name.length <= 200 }
  inventory() {
    const files = new Map()
    for (const entry of readdirSync(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const id = entry.name.slice(0, -5)
      if (!idPattern.test(id)) continue
      if (files.size >= 4096) throw Object.assign(new Error('Scope metadata catalog exceeds 4096 resources'), { code: 'SCOPE_CATALOG_LIMIT' })
      const stat = lstatSync(join(this.directory, entry.name), { bigint: true })
      if (stat.isFile() && !stat.isSymbolicLink()) files.set(id, `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`)
    }
    return new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  }
  persist() {
    const temp = `${this.path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temp, JSON.stringify({ version: 1, records: [...this.rows.values()].map(row => ({ ...row, fingerprint: this.files.get(row.id) })) }), { mode: 0o600, flag: 'wx' })
      renameSync(temp, this.path)
    } finally { try { unlinkSync(temp) } catch {} }
  }
  /** Called by the owning store only after its durable resource mutation succeeds. */
  changed(row, removedId) {
    this.#epoch++
    try {
      if (removedId) this.rows.delete(removedId)
      else if (this.valid(row)) this.rows.set(row.id, { id: row.id, name: row.name })
      else this.rows.delete(row?.id)
      if (removedId) this.files.delete(removedId)
      else {
        const stat = lstatSync(join(this.directory, `${row.id}.json`), { bigint: true })
        if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Source file is unavailable')
        this.files.set(row.id, `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`)
      }
      this.files = new Map([...this.files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
      this.persist()
    } catch { this.#unavailable = true }
  }
  current() {
    try { return !this.#unavailable && hash([...this.inventory()]) === hash([...this.files]) } catch { return false }
  }
  snapshot() {
    if (!this.current()) fail()
    const epoch = this.#epoch, generation = `${this.#instance}:${epoch}`
    return { items: [...this.rows.values()].map(row => ({ ...row })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), generation,
      checkCurrent: () => epoch === this.#epoch && this.current() }
  }
}
