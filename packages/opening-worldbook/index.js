import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseSillyTavernWorldBook } from '../world-book/src/format.js'
import { API_V1 } from '../identity.js'
import { createStaticOpeningRegistry, openingFail, sha256 } from './static-registry.js'
import { OPENING_IDENTITY_SHA256 } from './manifest.js'

export const OPENING_WORLD_BOOK_SERVICE = 'tavernOpeningWorldBooks'
const digest = value => sha256(JSON.stringify(value))
const same = (a, b) => digest(a) === digest(b)
const clone = value => structuredClone(value)
const resourceId = identity => `session-opening-${digest([identity.sessionId, identity.characterId, identity.greetingIndex, identity.greetingSha256]).slice(0, 32)}`
function greeting(card, index) {
  const data = card?.data
  return index === 0 ? data?.firstMessage ?? data?.first_mes ?? '' : (data?.alternateGreetings ?? data?.alternate_greetings ?? [])[index - 1] ?? ''
}
function rawFile(path) { try { if (statSync(path).size > 16 * 1024 * 1024) openingFail('OPENING_STORAGE_LIMIT', 'Opening storage exceeds its bound', 413); return readFileSync(path, 'utf8') } catch (error) { if (error.code === 'ENOENT') return ''; throw error } }
function atomic(path, value) {
  const tmp = `${path}.${randomUUID()}.tmp`, text = JSON.stringify(value)
  if (Buffer.byteLength(text) > 16 * 1024 * 1024) openingFail('OPENING_STORAGE_LIMIT', 'Session opening storage exceeds its bound', 413)
  writeFileSync(tmp, text, { mode: 0o600 })
  try { renameSync(tmp, path) } catch (error) { try { unlinkSync(tmp) } catch {} throw error }
  return text
}
function document(identity, entries, previous, now) {
  const raw = { name: 'Session opening world book', entries: Object.fromEntries(entries.map(e => {
    const uid = sha256(e.name).slice(0, 16)
    return [uid, { uid, comment: e.name, key: e.strategy.keys, keysecondary: e.strategy.keys_secondary.keys, content: e.content,
      disable: !e.enabled, constant: false, selective: true, selectiveLogic: 0, order: e.position.order, position: 4, depth: e.position.depth,
      role: 0, probability: e.probability, useProbability: true }]
  })) }
  const book = parseSillyTavernWorldBook(raw)
  return { schemaVersion: 1, kind: 'world-book-document', id: resourceId(identity), name: raw.name, createdAt: previous?.createdAt ?? now, updatedAt: now,
    source: { format: book.source.format, fileName: 'session-opening.json', byteLength: Buffer.byteLength(JSON.stringify(raw)), sha256: digest(raw) }, book,
    ownerSessionId: identity.sessionId, ownerCharacterId: identity.characterId, openingSourceIdentity: clone(identity) }
}

/** Session-only world-book proposals. Never writes to cards or the global library. */
export class OpeningWorldBookService {
  #proposals = new Map(); #completedSkips = new Map(); #disposed = false; #generation = 0
  constructor({ storageDir, characters, getSelection, getSelectionRevision, getSession, onChange = () => {}, now = Date.now, ttlMs = 10 * 60 * 1000, readRegistry = createStaticOpeningRegistry() }) {
    if (!characters?.get || !getSelection || !getSelectionRevision || !getSession) throw new TypeError('Trusted source, selection and DSH session providers required')
    Object.assign(this, { characters, getSelection, getSelectionRevision, getSession, onChange, now, ttlMs, readRegistry })
    mkdirSync(storageDir, { recursive: true }); this.path = join(storageDir, 'session-opening-world-books.json')
    const text = rawFile(this.path)
    if (Buffer.byteLength(text) > 16 * 1024 * 1024) openingFail('OPENING_STORAGE_LIMIT', 'Session opening storage exceeds its bound', 413)
    this.state = text ? JSON.parse(text) : { version: 1, records: {} }
    if (this.state.version !== 1 || !this.state.records || Array.isArray(this.state.records) || Object.keys(this.state.records).length > 256
      || Object.entries(this.state.records).some(([id, r]) => !r?.sourceIdentity || id !== resourceId(r.sourceIdentity) || !Number.isSafeInteger(r.revision) || r.revision < 1
        || !Array.isArray(r.entries) || r.entries.length < 1 || r.entries.length > 15 || !Array.isArray(r.receipts) || r.receipts.length > 128
        || r.document?.id !== id || r.document?.ownerSessionId !== r.sourceIdentity.sessionId || r.document?.ownerCharacterId !== r.sourceIdentity.characterId
        || !same(r.document?.openingSourceIdentity, r.sourceIdentity))) openingFail('OPENING_STORAGE_INVALID', 'Invalid session opening storage')
    this.fileHash = sha256(text)
  }
  #current() {
    if (this.#disposed) openingFail('OPENING_UNAVAILABLE', 'Opening world-book source is unloaded', 503)
    if (sha256(rawFile(this.path)) !== this.fileHash) openingFail('OPENING_STORAGE_CHANGED', 'Opening storage changed outside this source; reload required', 409)
  }
  #binding(identity) {
    this.#current()
    identity = clone(identity)
    if (!identity || Object.keys(identity).sort().join(',') !== 'characterId,greetingIndex,greetingSha256,identitySha256,owner,sessionId,version' || identity.version !== 1 || identity.owner !== 'pmp-dsh-tavern'
      || identity.identitySha256 !== OPENING_IDENTITY_SHA256 || typeof identity.sessionId !== 'string' || !identity.sessionId || identity.sessionId.length > 200
      || typeof identity.characterId !== 'string' || !Number.isSafeInteger(identity.greetingIndex) || identity.greetingIndex < 0 || !/^[a-f0-9]{64}$/.test(identity.greetingSha256)) openingFail('OPENING_SCOPE', 'Invalid opening source identity')
    const session = this.getSession(identity.sessionId), selection = clone(this.getSelection(identity.sessionId)), revision = this.getSelectionRevision(identity.sessionId)
    if (!session || selection.characterCardId !== identity.characterId || (selection.character?.greetingIndex ?? 0) !== identity.greetingIndex) openingFail('OPENING_SCOPE', 'Opening is not the selected DSH session greeting', 409)
    const card = this.characters.get(identity.characterId), cardHash = digest(card)
    if (sha256(greeting(card, identity.greetingIndex)) !== identity.greetingSha256) openingFail('OPENING_SOURCE_CHANGED', 'Original selected greeting changed', 409)
    const generation = this.#generation
    return () => {
      try {
        this.#current()
        return generation === this.#generation && session === this.getSession(identity.sessionId) && revision === this.getSelectionRevision(identity.sessionId)
          && same(this.getSelection(identity.sessionId), selection) && digest(this.characters.get(identity.characterId)) === cardHash
      } catch { return false }
    }
  }
  #prune() { for (const [id, p] of this.#proposals) if (p.expiresAt <= this.now()) this.#proposals.delete(id) }
  prepare({ sourceIdentity, openingId, identitySource, source, signal } = {}) {
    signal?.throwIfAborted(); const checkCurrent = this.#binding(sourceIdentity)
    const entries = this.readRegistry({ openingId, identitySource, source }), id = resourceId(sourceIdentity), previous = this.state.records[id]
    this.#prune(); if (this.#proposals.size >= 64) openingFail('OPENING_PROPOSAL_LIMIT', 'Too many pending opening proposals', 429)
    const proposal = { proposalId: randomUUID(), expectedRevision: previous?.revision ?? 0, entriesHash: digest(entries), entries: clone(entries), openingId, entryCount: entries.length,
      expiresAt: this.now() + this.ttlMs, sourceIdentity: clone(sourceIdentity), resourceId: `world-book:${id}` }
    if (!checkCurrent()) openingFail('OPENING_SOURCE_CHANGED', 'Opening source changed during preparation', 409)
    this.#proposals.set(proposal.proposalId, { ...proposal, checkCurrent })
    return clone(proposal)
  }
  commit({ proposalId, expectedRevision, operationId, sourceIdentity, reviewed, write, signal } = {}) {
    signal?.throwIfAborted(); this.#current(); this.#prune()
    if (reviewed !== true || write !== true) openingFail('OPENING_CONFIRMATION_REQUIRED', 'Separate trusted UI review and world-book write confirmation required', 403)
    if (typeof operationId !== 'string' || !operationId || operationId.length > 200 || !Number.isSafeInteger(expectedRevision)) openingFail('OPENING_OPERATION', 'Invalid commit operation')
    const bindingCurrent = this.#binding(sourceIdentity), id = resourceId(sourceIdentity), previous = this.state.records[id]
    const fingerprint = digest({ proposalId, expectedRevision, sourceIdentity })
    const skippedRetry = this.#completedSkips.get(`${id}:${operationId}`)
    if (skippedRetry) { if (skippedRetry.fingerprint !== fingerprint) openingFail('OPENING_OPERATION_CONFLICT', 'Operation id was reused', 409); return clone(skippedRetry.receipt) }
    const retry = previous?.receipts?.find(r => r.operationId === operationId)
    if (retry) { if (retry.fingerprint !== fingerprint) openingFail('OPENING_OPERATION_CONFLICT', 'Operation id was reused with a different proposal', 409); return clone(retry.receipt) }
    const proposal = this.#proposals.get(proposalId)
    if (!proposal || !same(proposal.sourceIdentity, sourceIdentity) || proposal.expectedRevision !== expectedRevision || !proposal.checkCurrent() || !bindingCurrent()) openingFail('OPENING_PROPOSAL_STALE', 'Opening proposal or source lease is stale', 409)
    if ((previous?.revision ?? 0) !== expectedRevision) openingFail('OPENING_REVISION_CONFLICT', 'Session world book changed since preparation', 409)
    if (!proposal.entries.length) {
      this.#proposals.delete(proposalId)
      const receipt = { ok: true, skipped: true, inserted: 0, existing: 0, updated: 0, targetWorldbook: null, method: 'session-local', receiptId: randomUUID(), resourceId: null, revision: expectedRevision }
      if (this.#completedSkips.size >= 256) this.#completedSkips.delete(this.#completedSkips.keys().next().value)
      this.#completedSkips.set(`${id}:${operationId}`, { fingerprint, receipt })
      return clone(receipt)
    }
    if (!previous && Object.keys(this.state.records).length >= 256) openingFail('OPENING_STORAGE_LIMIT', 'Session opening resource limit reached', 413)
    const old = new Map((previous?.entries ?? []).map(e => [e.name, e])), merged = new Map(old)
    let inserted = 0, existing = 0, updated = 0
    for (const entry of proposal.entries) { const current = old.get(entry.name); if (!current) inserted++; else if (same(current, entry)) existing++; else updated++; merged.set(entry.name, entry) }
    const entries = [...merged.values()], revision = expectedRevision + 1
    const receipt = { ok: true, inserted, existing, updated, targetWorldbook: 'Session opening world book', method: 'session-local', receiptId: randomUUID(), resourceId: `world-book:${id}`, revision }
    const next = clone(this.state), doc = document(sourceIdentity, entries, previous?.document, new Date(this.now()).toISOString())
    next.records[id] = { revision, entries, sourceIdentity: clone(sourceIdentity), document: doc, receipts: [...(previous?.receipts ?? []), { operationId, fingerprint, receipt }].slice(-128) }
    signal?.throwIfAborted(); if (!proposal.checkCurrent() || !bindingCurrent()) openingFail('OPENING_PROPOSAL_STALE', 'Opening source lease changed before commit', 409)
    const persisted = atomic(this.path, next)
    // Match the durable JSON representation, just as global WorldBookStore.get
    // does. Format parser optional fields may be undefined before persistence.
    this.fileHash = sha256(persisted); this.state = JSON.parse(persisted); this.#generation++; this.#proposals.delete(proposalId); this.onChange()
    return clone(receipt)
  }
  selectedIds(sessionId, selection = this.getSelection(sessionId)) {
    this.#current()
    if (!sessionId || !this.getSession(sessionId)) return []
    return Object.entries(this.state.records).filter(([, r]) => r.sourceIdentity.sessionId === sessionId && r.sourceIdentity.characterId === selection.characterCardId
      && r.sourceIdentity.greetingIndex === (selection.character?.greetingIndex ?? 0)
      && r.sourceIdentity.greetingSha256 === sha256(greeting(this.characters.get(selection.characterCardId), r.sourceIdentity.greetingIndex))).map(([id]) => id)
  }
  get(id, sessionId) {
    this.#current(); const row = this.state.records[id]
    if (!row || !sessionId || !this.getSession(sessionId) || row.sourceIdentity.sessionId !== sessionId) openingFail('WORLD_BOOK_NOT_FOUND', 'Session opening world book is unavailable', 404)
    return clone(row.document)
  }
  list(sessionId) { this.#current(); return !this.getSession(sessionId) ? [] : Object.entries(this.state.records).filter(([, r]) => r.sourceIdentity.sessionId === sessionId).map(([id]) => ({ id })) }
  revision() { this.#current(); return `${this.fileHash}:${this.#generation}` }
  dispose() { this.#disposed = true; this.#generation++; this.#proposals.clear(); this.#completedSkips.clear() }
}

const route = url => new RegExp(`^${API_V1}/sessions/([^/]+)/opening-worldbook/(prepare|commit)$`).exec(new URL(url ?? '/', 'http://localhost').pathname)
export const isOpeningWorldBookPath = url => Boolean(route(url))
export function createOpeningWorldBookHandler(service, { getConnection = () => null } = {}) {
  const send = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)) }
  return async (req, res) => {
    const controller = new AbortController(); req.on?.('aborted', () => controller.abort())
    try {
      const admission = getConnection()?.admit?.(req)
      if (!admission || 'rejection' in admission) return send(res, admission?.rejection === 403 ? 403 : 401, { ok: false, code: 'DSH_ADMISSION', error: 'DSH admission required' })
      const match = route(req.url); if (req.method !== 'POST' || !match) return send(res, 405, { ok: false, error: 'Method not allowed' })
      const chunks = []; let size = 0
      for await (const chunk of req) { size += chunk.length; if (size > 24 * 1024 * 1024) openingFail('OPENING_REQUEST_LIMIT', 'Opening request exceeds its bound', 413); chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (body.sourceIdentity?.sessionId !== decodeURIComponent(match[1])) openingFail('OPENING_SCOPE', 'Route and source session mismatch')
      const result = service[match[2]]({ ...body, signal: controller.signal })
      return send(res, 200, { ok: true, ...result })
    } catch (error) { return send(res, error.status ?? 400, { ok: false, code: error.code ?? 'OPENING_REQUEST', error: String(error.message).slice(0, 300) }) }
  }
}
