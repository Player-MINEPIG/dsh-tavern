import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'

const MAX_LEDGER_BYTES = 16 * 1024 * 1024
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const scopeKey = ref => digest([ref.sessionId, ref.sessionCreatedAt])
const refKey = ref => scopeKey(ref) + ':' + ref.endSeq
const initial = () => ({ version: 1, revision: 0, config: { enabled: true, referenceSource: 'original', assessmentInterval: 4, refreshMode: 'immediate' },
  generation: 0, history: [], receipts: [], observed: {}, pending: {}, attempts: {}, turnCounts: {} })

function reject(message, code = 'INVALID_EVOLUTION', status = 400) {
  throw Object.assign(new Error(message), { code, status })
}

function bounded(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) reject(`Invalid ${label}`)
  return value.trim()
}

const evidenceKeys = reference => (reference?.items ?? [reference]).flatMap(ref => ref?.kind === 'external'
  ? [digest([ref.source, ref.id, ref.version]), digest([ref.source, ref.id, ref.textHash])]
  : [])

export class PersonalityEvidenceSources {
  #sources = new Map()
  version = 1
  list(personalityId) {
    const sources = [...this.#sources].filter(([, source]) => personalityId === undefined || !source.supports || source.supports(personalityId) === true)
    return ['original', ...sources.map(([id]) => id)]
  }
  get(id) { return this.#sources.get(id) }
  register(source) {
    if (!source || typeof source.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(source.id) ||
      source.id === 'original' || this.#sources.has(source.id) || typeof source.resolve !== 'function') reject('Invalid or duplicate evidence source')
    if (source.read !== undefined && typeof source.read !== 'function') reject('Invalid evidence reader')
    if (source.supports !== undefined && typeof source.supports !== 'function') reject('Invalid evidence source scope')
    const provider = { resolve: source.resolve.bind(source), read: source.read?.bind(source), supports: source.supports?.bind(source) }
    this.#sources.set(source.id, provider)
    return () => { if (this.#sources.get(source.id) === provider) this.#sources.delete(source.id) }
  }
}

export function validateChange(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('Invalid self-revision')
  const output = {}
  for (const key of ['before', 'after', 'behavior', 'boundary', 'reason']) output[key] = bounded(value[key], 1200, key)
  if (output.after === output.before) reject('Unchanged self-revision')
  return output
}

export class PersonalityEvolution {
  #cache = new Map()
  constructor(directory, cards, sources = new PersonalityEvidenceSources()) {
    this.directory = join(directory, 'revisions')
    this.cards = cards
    this.sources = sources
  }
  record(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) reject('Invalid personality identity')
    if (!this.#cache.has(id)) {
      this.cards.get(id)
      let data
      try { data = readJsonFile(join(this.directory, `${id}.json`), MAX_LEDGER_BYTES) }
      catch (e) { if (e.code !== 'ENOENT') throw e; data = initial() }
      if (data?.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.history) ||
        !Array.isArray(data.receipts) || !data.config || !data.observed) reject('Invalid personality ledger', 'EVOLUTION_STORAGE', 500)
      data.config.assessmentInterval ??= 1
      data.config.refreshMode ??= 'immediate'
      data.pending ??= {}
      data.attempts ??= {}
      data.turnCounts ??= {}
      // Older ledgers retain their original cadence and evidence history.
      data.reviewedEvidence ??= Object.fromEntries(data.history.flatMap(row => evidenceKeys(row.evidence)).map(key => [key, true]))
      this.#cache.set(id, data)
    }
    return this.#cache.get(id)
  }
  save(id, data) {
    atomicJson(join(this.directory, `${id}.json`), data, MAX_LEDGER_BYTES)
    this.#cache.set(id, data)
  }
  remove(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) reject('Invalid personality identity')
    this.#cache.delete(id)
    rmSync(join(this.directory, `${id}.json`), { force: true })
  }
  current(id) {
    const row = this.record(id).history.at(-1)
    return row?.after ? structuredClone(row) : null
  }
  notice(id) {
    const row = this.record(id).history.at(-1)
    return row ? { kind: row.kind, revision: row.revision, before: row.before, after: row.after, personalityId: id } : null
  }
  view(id) {
    this.cards.get(id)
    const state = this.record(id)
    const deferredReasons = {}
    for (const entry of Object.values(state.attempts)) deferredReasons[entry.reason] = (deferredReasons[entry.reason] ?? 0) + 1
    return { revision: state.revision, config: structuredClone(state.config), current: this.current(id),
      deferredCount: Object.keys(state.attempts).length, deferredReasons,
      history: structuredClone(state.history), availableSources: this.sources.list(id),
      pendingCount: Object.values(state.pending).reduce((n,refs) => n + refs.length, 0) }
  }
  mutate(id, kind, body) {
    this.cards.get(id)
    const state = this.record(id)
    const op = bounded(body?.operationId, 180, 'operationId')
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) reject('Invalid expectedRevision')
    const signature = digest([kind, body.expectedRevision, body.enabled, body.referenceSource, body.assessmentInterval, body.refreshMode, body.targetRevision])
    const previous = state.receipts.find(r => r.id === op)
    if (previous) {
      if (previous.signature !== signature) reject('Operation ID reused', 'EVOLUTION_CONFLICT', 409)
      return this.view(id)
    }
    if (state.revision !== body.expectedRevision) reject('Personality changed; refresh before editing.', 'EVOLUTION_CONFLICT', 409)
    const next = { ...state, revision: state.revision + 1, generation: state.generation + 1, receipts: [...state.receipts, { id: op, signature }] }
    if (kind === 'config') {
      const source = body.referenceSource ?? state.config.referenceSource
      // Allow disabling a previously configured adapter after it has been uninstalled.
      if (typeof body.enabled !== 'boolean' || (!this.sources.list(id).includes(source) && (body.enabled || source !== state.config.referenceSource))) {
        reject('Invalid evolution configuration')
      }
      const assessmentInterval = body.assessmentInterval ?? state.config.assessmentInterval
      if (!Number.isSafeInteger(assessmentInterval) || assessmentInterval < 1 || assessmentInterval > 8) reject('Assessment interval must be 1–8 turns')
      const refreshMode = body.refreshMode ?? state.config.refreshMode
      if (!['immediate', 'session-compaction'].includes(refreshMode)) reject('Invalid personality refresh mode')
      next.config = { enabled: body.enabled, referenceSource: source, assessmentInterval, refreshMode }
      if (!body.enabled || source !== state.config.referenceSource) { next.pending = {}; next.attempts = {} }

    } else if (kind === 'rollback') {
      const target = state.history.find(row => row.revision === body.targetRevision)
      if (body.targetRevision !== 0 && !target) reject('Unknown target revision')
      next.pending = {}
      next.attempts = {}
      next.history = [...state.history, { revision: next.revision, kind, targetRevision: body.targetRevision,
        before: this.current(id)?.after ?? '', after: target?.after ?? '', behavior: target?.behavior ?? '',
        boundary: target?.boundary ?? '', reason: '用户回滚', evidence: target?.evidence ?? null, at: Date.now() }]
    } else reject('Unknown evolution operation')
    this.save(id, next)
    return this.view(id)
  }
  enqueue(id, origin) {
    const state = this.record(id)
    const key = scopeKey(origin)
    if (!state.config.enabled || (state.observed[key] ?? -1) >= origin.endSeq) return
    const queue = state.pending[key] ?? []
    this.save(id, { ...state, pending: { ...state.pending, [key]: [...queue, origin] },
      observed: { ...state.observed, [key]: origin.endSeq }, turnCounts: { ...state.turnCounts, [key]: (state.turnCounts[key] ?? 0) + 1 } })
  }
  batch(id, origin, { urgent = false } = {}) {
    const state = this.record(id)
    const key = scopeKey(origin)
    const queue = state.pending[key] ?? []
    if (!urgent && queue.length < state.config.assessmentInterval) return []
    const fresh = [], retry = []
    for (const entry of queue) {
      const attempt = state.attempts[refKey(entry)]
      if (!attempt) fresh.push(entry)
      else if (attempt.nextTurn <= state.turnCounts[key]) retry.push(entry)
    }
    // New evidence continues behind missing records, while due retries receive
    // a share of every bounded wake. On a large backlog, always try this turn.
    retry.sort((a,b) => state.attempts[refKey(a)].nextTurn - state.attempts[refKey(b)].nextTurn)
    const due = retry.slice(0, fresh.length ? 2 : 16)
    const room = 16 - due.length
    const selected = fresh.length <= room ? fresh : [...fresh.slice(0, room - 1), fresh.at(-1)]
    return [...due, ...selected]
  }
  defer(id, origin, reason) {
    const state = this.record(id), key = scopeKey(origin)
    if (!state.pending[key]?.includes(origin)) return
    const token = refKey(origin)
    const count = (state.attempts[token]?.count ?? 0) + 1
    const nextTurn = (state.turnCounts[key] ?? 0) + (reason === 'assessment-rejected' ? Math.min(32, 4 * 2 ** Math.min(3, count - 1)) : Math.min(16, 2 ** Math.min(4, count - 1)))
    this.save(id, { ...state, attempts: { ...state.attempts, [token]: { reason, count, nextTurn } } })
  }
  hasEvidence(id, reference) {
    return evidenceKeys(reference).some(key => this.record(id).reviewedEvidence?.[key])
  }
  finish(id, revision, batch, evidence, candidate, { partial = false, reviewed = [evidence] } = {}) {
    const origin = batch[0]
    const state = this.record(id)
    const key = scopeKey(origin)
    const queue = state.pending[key] ?? []
    if (state.revision !== revision || !state.config.enabled || !batch.length ||
      (partial ? batch.length > state.config.assessmentInterval : batch.length !== state.config.assessmentInterval) || batch.some(ref => !queue.includes(ref))) return false
    const pending = { ...state.pending }
    const included = new Set(batch)
    const rest = queue.filter(ref => !included.has(ref))
    const attempts = { ...state.attempts }
    for (const ref of batch) delete attempts[refKey(ref)]
    if (rest.length) pending[key] = rest
    else delete pending[key]
    const next = { ...state, pending, attempts, reviewedEvidence: { ...state.reviewedEvidence, ...Object.fromEntries(reviewed.flatMap(evidenceKeys).map(key => [key, true])) } }
    if (candidate) {
      const value = validateChange(candidate)
      const previous = this.current(id)
      if (previous) value.before = previous.after
      if (previous && ['after', 'behavior', 'boundary'].every(key => previous[key] === value[key])) {
        this.save(id, next)
        return false
      }
      next.revision++
      next.history = [...state.history, { ...value, revision: next.revision, kind: 'revision', at: Date.now(), evidence }]
    }
    this.save(id, next)
    return !!candidate
  }
}
