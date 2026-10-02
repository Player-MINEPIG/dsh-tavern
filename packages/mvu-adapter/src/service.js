import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'
import { applyMvuUpdate, containsMvuUpdate, normalizeVariables, parseMvuUpdate } from './updates.js'
import { fail, json } from './value.js'
import { parseMvuData } from './data.js'
import { compileMvuSchema, applyMvuSchema } from './schema.js'

const MAX_STORE = 32 * 1024 * 1024
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const keyOf = source => hash(source)
const textOf = message => (message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
const allowedStrategy = {
  card_variable_update: ['validate_card_update', 'apply_card_update'],
  assistant_message_committed: ['parse_mvu_update', 'validate_update', 'apply_update'],
  before_model_request: ['read_content', 'render_state_and_update_instructions', 'provide_to_model'],
}
export function validateMvuConfig(config) {
  if (config.type !== 'mvu-state') fail('MVU_CONFIG', 'Expected mvu-state type')
  for (const [mode, on] of Object.entries({ store: 'assistant_message_committed', retrieve: 'before_model_request' })) {
    if (!config[mode]) continue
    if (config[mode].on !== on && !(mode === 'store' && config[mode].on === 'card_variable_update')) fail('MVU_CONFIG', `Unsupported ${mode} event`)
    validateStrategy(config[mode].on, config[mode].strategy)
  }
  return true
}
function validateStrategy(on, strategy) {
  if (strategy === undefined) return
  const names = (Array.isArray(strategy) ? strategy : [strategy]).map(x => { if (typeof x === 'string') return x; if (!x || Object.keys(x).some(key => key !== 'operation')) fail('MVU_CONFIG', 'Unsupported strategy parameters'); return x.operation })
  if (JSON.stringify(names) !== JSON.stringify(allowedStrategy[on])) fail('MVU_CONFIG', 'MVU requires the ordered parse/validate/apply or read/render/provide operation chain')
}

function prepareResource(resource) {
      if (!/^mvu:[A-Za-z0-9_.-]{1,160}$/.test(resource.id) || !Array.isArray(resource.sessionIds) || resource.sessionIds.some(id => typeof id !== 'string' || !id)) fail('MVU_CONFIG', 'Resource requires namespaced id and explicit sessionIds')
      let initial = typeof resource.initial === 'string' ? { stat_data: parseMvuData(resource.initial) } : json(resource.initial)
      if (resource.schemaSource) {
        const definition = compileMvuSchema(resource.schemaSource)
        initial = { ...initial, stat_data: applyMvuSchema(initial.stat_data, definition), mvu_schema: definition, schema: { type: 'object', properties: {}, extensible: true, strictSet: true } }
      }
      return { ...json(resource), initial: normalizeVariables(initial) }
}

export class MvuService {
  protocolVersion = 1
  #state; #path; #listeners = new Set(); #usage = new Set(); #usageEpoch = 0; #queue = Promise.resolve(); #disposed = false; #fatal; #sessions = new Map(); #hostWork = new Set(); #cardBindings = new Map()
  constructor({ storageDir, resources = [], inspect, resolveScope, refresh, isActive, authorizeCardWrite } = {}) {
    this.inspect = inspect; this.resolveScope = resolveScope; this.refresh = refresh; this.isActive = isActive; this.authorizeCardWrite = authorizeCardWrite
    this.#path = join(storageDir, 'mvu-state.json')
    this.#state = existsSync(this.#path) ? readJsonFile(this.#path, MAX_STORE) : { version: 1, resources: {} }
    if (this.#state?.version !== 1 || !this.#state.resources) fail('MVU_VERSION', 'Unsupported MVU storage version')
    this.resources = [...resources, ...Object.values(this.#state.resources).filter(r => r.definition && !resources.some(input => input.id === r.definition.id)).map(r => r.definition)].map(prepareResource)
    if (new Set(this.resources.map(r => r.id)).size !== this.resources.length) fail('MVU_CONFIG', 'Duplicate resource id')
    for (const record of Object.values(this.#state.resources)) {
      if (!Number.isSafeInteger(record.revision) || !Array.isArray(record.versions)) fail('MVU_VERSION', 'Invalid MVU ledger')
      for (const version of record.versions) normalizeVariables(version.variables)
    }
    for (const resource of this.resources) if (resource.managementMode === 'managed' && !this.#record(resource.id).managementMode) this.#save(resource.id, { ...this.#record(resource.id), managementMode: 'managed' })
  }
  /** Trusted Host discovery only. New discoveries are managed and disabled until a usage decision. */
  async discover({ definition, sessionId }) {
    return this.#serial(async () => {
      const existing = this.resources.find(r => r.id === definition.id)
      if (existing && (!existing.discovered || existing.characterId !== definition.characterId)) fail('MVU_ID_CONFLICT', 'Discovered identity conflicts with configured resource')
      let resource
      if (existing && (!existing.sourceError || definition.sourceError || this.#record(existing.id).versions.length)) resource = { ...existing }
      else {
        try { resource = prepareResource({ ...definition, sessionIds: existing?.sessionIds ?? [], managementMode: 'managed', discovered: true }) }
        catch (error) { resource = prepareResource({ id: definition.id, name: definition.name, characterId: definition.characterId, sessionIds: [], managementMode: 'managed', discovered: true, sourceError: error.code ?? 'MVU_INITIALIZATION_INVALID', initial: { stat_data: {} } }) }
        delete resource.schemaSource
      }
      if (existing?.sourceError && !resource.sourceError) {
        resource.activationSeqs = { ...(existing.activationSeqs ?? {}) }
        for (const id of resource.sessionIds) {
          const observed = await this.inspect?.(id) ?? this.#sessions.get(id)
          resource.activationSeqs[id] = observed ? (observed.events.at(-1)?.seq ?? -1) + 1 : Number.MAX_SAFE_INTEGER
        }
      }
      if (sessionId && !resource.sessionIds.includes(sessionId)) resource.sessionIds = [...resource.sessionIds, sessionId]
      if (existing && hash(existing) === hash(resource)) return
      const record = this.#record(resource.id)
      this.#save(resource.id, { ...record, revision: existing?.sourceError && !resource.sourceError ? record.revision + 1 : record.revision, managementMode: record.managementMode ?? 'managed', definition: resource })
      if (existing) this.resources[this.resources.indexOf(existing)] = resource
      else this.resources.push(resource)
    })
  }
  async syncDiscoveredSelection(sessionId, id) {
    if (!sessionId) return
    const observed = await this.inspect?.(sessionId) ?? this.#sessions.get(sessionId)
    const boundary = observed ? (observed.events.at(-1)?.seq ?? -1) + 1 : Number.MAX_SAFE_INTEGER
    return this.#serial(() => {
      const previous = this.#state.discoverySelections?.[sessionId] ?? null
      const resource = this.resources.find(r => r.id === id && r.discovered)
      const selected = resource?.id ?? null
      if (previous === selected && resource?.activationSeqs?.[sessionId] !== Number.MAX_SAFE_INTEGER) return
      const extra = { discoverySelections: { ...(this.#state.discoverySelections ?? {}), [sessionId]: selected } }
      if (!resource) { if (previous) this.#save(previous, this.#record(previous), extra); return }
      const definition = { ...resource, sessionIds: [...new Set([...resource.sessionIds, sessionId])], activationSeqs: { ...(resource.activationSeqs ?? {}), [sessionId]: boundary } }
      this.#save(resource.id, { ...this.#record(resource.id), definition }, extra)
      this.resources[this.resources.indexOf(resource)] = definition
    })
  }
  #configured(id, scope) {
    if (scope?.authority && scope.authority !== 'local') fail('MVU_AUTHORITY', 'Remote authority requires its own MVU service')
    const resource = this.resources.find(r => r.id === id)
    if (!resource) return null
    if (scope && Object.keys(scope).every(key => key === 'authority') && (!scope.authority || scope.authority === 'local')) return resource
    if (typeof scope?.sessionId !== 'string' || !resource.sessionIds.some(s => s === '*' || s === scope.sessionId)) fail('SCOPE_MISMATCH', 'Resource is not bound to this session')
    return resource
  }
  #record(id) { return this.#state.resources[id] ?? { revision: 0, versions: [], currentKey: null } }
  #current(resource) { const record = this.#record(resource.id); return record.versions.find(v => v.key === record.currentKey)?.variables ?? resource.initial }
  #emit(fact) { for (const listener of this.#listeners) { try { listener(json(fact)) } catch {} } }
  observe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  registerUsage(handler) { if (typeof handler !== 'function') throw new TypeError('Usage handler required'); const registration = { handler }; this.#usage.add(registration); this.#usageEpoch++; return () => { if (this.#usage.delete(registration)) this.#usageEpoch++ } }
  validateConfig(config) { return validateMvuConfig(config) }
  async #decision(on, resource, scope, event, variables) {
    if (resource.sourceError || (resource.discovered && this.isActive && !this.isActive(resource, scope.sessionId))) return { enabled: false, configRevision: null }
    const managementMode = this.#record(resource.id).managementMode ?? resource.managementMode ?? 'native'
    let enabled = true, decided = false, configRevision = null
    const usageEpoch = this.#usageEpoch
    for (const registration of [...this.#usage]) {
      let answer
      try { answer = await registration.handler(json({ on, id: resource.id, scope, event, variables, managementMode })) }
      catch (error) { if (usageEpoch !== this.#usageEpoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed'); throw error }
      if (usageEpoch !== this.#usageEpoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed')
      if (answer === undefined) continue
      decided = true
      if (!answer || typeof answer.enabled !== 'boolean') fail('MVU_USAGE', 'Invalid usage decision')
      validateStrategy(on, answer.strategy)
      enabled &&= answer.enabled
      configRevision = answer.configRevision ?? configRevision
    }
    return { enabled: enabled && (managementMode !== 'managed' || decided), configRevision, usageEpoch }
  }
  #serial(fn) {
    const task = this.#queue.then(() => { if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed'); return fn() })
    this.#queue = task.catch(() => {})
    return task
  }
  trackHostWork(task) { this.#hostWork.add(task); task.finally(() => this.#hostWork.delete(task)).catch(() => {}); return task }
  async flush() { await Promise.all([...this.#hostWork]); await this.#queue; if (this.#fatal) throw this.#fatal }
  #save(id, record, extra = {}) {
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed before commit')
    const next = { ...this.#state, ...extra, resources: { ...this.#state.resources, [id]: record } }
    try { atomicJson(this.#path, next, MAX_STORE) } catch (error) { this.#fatal = error; throw error }
    this.#fatal = undefined
    this.#state = next
  }
  async #snapshot(resource, scope) {
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    const record = this.#record(resource.id)
    if (this.inspect) {
      for (const sessionId of new Set(record.versions.filter(v => !v.source.manual).map(v => v.source.sessionId))) {
        const history = await this.inspect(sessionId)
        if (!history) fail('MVU_HISTORY_UNAVAILABLE', 'Source session is unavailable')
        this.#verifyHistory(record, sessionId, history)
      }
    } else if (record.recoveryError) fail('MVU_HISTORY_UNAVAILABLE', 'Source history requires reconciliation')
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    // Scope restricts access, never content identity. Only explicit historical
    // coordinates select an immutable old snapshot instead of the shared entity.
    let version = record.versions.find(v => v.key === record.currentKey)
    if (scope.messageId) version = record.versions.findLast(v => v.source.messageId === scope.messageId && v.source.sessionId === scope.sessionId)
    else if (scope.endEventId != null) version = record.versions.findLast(v => v.source.sessionId === scope.sessionId && v.source.messageSeq <= scope.endEventId && (!v.source.manual || v.source.card))
    if (!version && !scope.messageId && scope.endEventId != null) {
      let origin = scope.sessionId
      const seen = new Set()
      while (!seen.has(origin)) {
        seen.add(origin)
        const session = this.#sessions.get(origin) ?? await this.inspect?.(origin)
        if (!session) break
        const header = session.header ?? session.meta
        const boundary = Number.isSafeInteger(session.inheritedEventCount) ? session.inheritedEventCount : (session.events.findLast(e => e.type === 'session/end-seed')?.seq ?? 0)
        if (scope.endEventId >= boundary || !header?.parentSession) break
        origin = header.parentSession
        const event = session.events.find(e => e.seq === scope.endEventId)
        version = record.versions.findLast(v => v.source.sessionId === origin && v.source.messageSeq === scope.endEventId && v.source.messageId === event?.data?.message?.id && (v.sourceFingerprint ?? v.fingerprint) === hash(textOf(event?.data?.message)))
        if (version) break
      }
    }
    if (scope.messageId && (!version || (scope.endEventId != null && version.source.messageSeq !== scope.endEventId))) fail('MVU_SCOPE', 'Historical coordinates do not identify the same source')
    const historical = scope.messageId != null || scope.endEventId != null
    return { id: resource.id, name: resource.name ?? resource.id, type: 'mvu-state', authority: 'local', managementMode: record.managementMode ?? resource.managementMode ?? 'native', ...(resource.sourceError ? { sourceError: resource.sourceError } : {}), ...(resource.discovered ? { source: { kind: 'character', characterId: resource.characterId, discovered: true } } : {}), scope: json(scope), content: json(version?.variables ?? resource.initial), revision: historical ? (version?.revision ?? version?.result?.revision ?? 0) : record.revision, currentRevision: record.revision, historical, versionKey: version?.key ?? null }
  }
  #verifyHistory(record, sessionId, session) {
    const header = session.header ?? session.meta
    for (const version of record.versions.filter(v => v.source.sessionId === sessionId && (!v.source.manual || v.source.card))) {
      const source = version.source, message = session.events.find(e => e.seq === source.messageSeq), end = session.events.find(e => e.seq === source.endSeq)
      if (header?.version !== source.sessionFormatVersion || (source.sessionCreatedAt !== undefined && header?.createdAt !== source.sessionCreatedAt)
        || message?.type !== 'assistant/message' || message.data?.message?.id !== source.messageId || hash(textOf(message.data?.message)) !== (version.sourceFingerprint ?? version.fingerprint)
        || end?.type !== 'turn/end' || end.data?.turn !== source.turn || end.data?.reason?.kind !== 'completed') fail('MVU_HISTORY_UNAVAILABLE', 'Recorded source no longer matches durable history')
    }
  }
  async setManagementMode({ id, mode, expectedRevision, operationId, scope, signal }) {
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      if (!['managed', 'native'].includes(mode) || typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('MVU_CONFIG', 'Explicit mode and operationId required')
      const record = this.#record(id), prior = record.managementOperations?.find(op => op.id === operationId)
      const fingerprint = hash({ mode, expectedRevision, scope })
      if (prior) { if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused'); return json(prior.result) }
      if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
      const result = { id, managementMode: mode, revision: record.revision + 1 }
      this.#save(id, { ...record, managementMode: mode, revision: result.revision, managementOperations: [...(record.managementOperations ?? []), { id: operationId, fingerprint, result }] })
      return result
    })
  }
  async copy({ id, newId, scope, signal }) {
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      if (!/^mvu:[A-Za-z0-9_.-]{1,160}$/.test(newId) || this.resources.some(r => r.id === newId)) fail('MVU_ID_CONFLICT', 'Copy requires a new resource id')
      const definition = { ...resource, id: newId, initial: json(this.#current(resource)), managementMode: resource.discovered ? 'managed' : 'native' }
      delete definition.schemaSource
      this.#save(newId, { revision: 0, versions: [], currentKey: null, managementMode: definition.managementMode, definition, copiedFrom: { id, revision: this.#record(id).revision } })
      this.resources.push(definition)
      return this.#snapshot(definition, scope)
    })
  }
  async list({ scope, signal } = {}) {
    signal?.throwIfAborted()
    await this.refresh?.(scope?.sessionId)
    const out = []
    for (const resource of this.resources) {
      try { this.#configured(resource.id, scope) } catch (error) { if (error.code === 'SCOPE_MISMATCH') continue; throw error }
      out.push(await this.#snapshot(resource, scope))
    }
    return out
  }
  async read({ id, scope, signal } = {}) {
    signal?.throwIfAborted()
    await this.refresh?.(scope?.sessionId)
    const resource = this.#configured(id, scope)
    return resource ? this.#snapshot(resource, scope) : null
  }
  async history({ id, scope, signal } = {}) {
    signal?.throwIfAborted(); if (!this.#configured(id, scope)) return []
    return json(this.#record(id).versions.filter(v => v.source.sessionId === scope.sessionId))
  }
  async update({ id, content, expectedRevision, operationId, scope, signal } = {}) {
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      if (typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('MVU_OPERATION', 'operationId required')
      if (scope.messageId != null || scope.endEventId != null) fail('MVU_SCOPE', 'Edit current content with a current scope')
      const record = this.#record(id), current = this.#current(resource), variables = normalizeVariables(content)
      // The source owns its schema. An editor cannot remove or replace it.
      if (current.mvu_schema) {
        if (variables.mvu_schema && hash(variables.mvu_schema) !== hash(current.mvu_schema)) fail('MVU_SCHEMA_CODE', 'Source schema cannot be replaced by a content edit')
        variables.mvu_schema = json(current.mvu_schema)
      }
      const fingerprint = hash({ content: variables, scope, expectedRevision })
      const prior = record.versions.find(v => v.operationId === operationId)
      if (prior) { if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused with different input'); return json(prior.result) }
      if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
      if (variables.mvu_schema) { variables.stat_data = applyMvuSchema(variables.stat_data, variables.mvu_schema); variables.display_data = json(variables.stat_data) }
      const source = { ...(scope.sessionId ? { sessionId: scope.sessionId } : {}), messageId: `manual:${operationId}`, messageSeq: scope.endEventId ?? record.versions.findLast(v => v.source.sessionId === scope.sessionId)?.source.messageSeq ?? -1, manual: true }
      const key = hash({ id, operationId }), revision = record.revision + 1
      const result = { id, type: 'mvu-state', content: variables, revision, scope, authority: 'local' }
      this.#save(id, { ...record, revision, currentKey: key, versions: [...record.versions, { key, source, variables, operationId, fingerprint, revision, result }] })
      this.#emit({ id, eventId: key, phase: 'completed', ...(scope.sessionId ? { sessionId: scope.sessionId } : {}), revision, detail: 'manual-update' })
      return json(result)
    })
  }
  /** Only call with a trusted DSH Session snapshot, never with browser text. */
  ingest(session) {
    const snapshot = { id: session.id, header: json(session.header), events: json(session.snapshotEvents()), inheritedEventCount: session.inheritedEventCount }
    return this.#serial(() => this.#ingest(snapshot))
  }
  async #ingest(session) {
    if (session.header.origin === 'subagent') return
    this.#sessions.set(session.id, session)
    const scope = { sessionId: session.id, authority: 'local' }
    for (const resource of this.resources) {
      try { this.#configured(resource.id, scope) } catch (error) { if (error.code === 'SCOPE_MISMATCH') continue; throw error }
      if (resource.sourceError || (resource.discovered && this.isActive && !this.isActive(resource, session.id))) continue
      const existing = this.#record(resource.id)
      try { this.#verifyHistory(existing, session.id, session) }
      catch (error) { this.#save(resource.id, { ...existing, recoveryError: { sessionId: session.id, code: error.code } }); throw error }
      if (existing.recoveryError?.sessionId === session.id) { const repaired = { ...existing }; delete repaired.recoveryError; this.#save(resource.id, repaired) }
      for (const end of session.events) {
        if (end.type !== 'turn/end') continue
        const turn = end.data?.turn
        const turnEvents = session.events.filter(e => e.seq < end.seq && e.data?.turn === turn)
        const reply = turnEvents.findLast(e => e.type === 'assistant/message')
        if (reply && reply.seq < (resource.activationSeqs?.[session.id] ?? 0)) continue
        if (!reply || reply.data?.interrupted || reply.data.message?.content?.some(b => b.type === 'tool-call')) continue
        const seedBoundary = Number.isSafeInteger(session.inheritedEventCount) ? session.inheritedEventCount : (session.events.findLast(e => e.type === 'session/end-seed')?.seq ?? 0)
        if (reply.seq < seedBoundary || end.data?.reason?.kind === 'forked') continue
        const text = textOf(reply.data.message), messageId = reply.data.message?.id
        if (typeof messageId !== 'string') continue
        const source = { sessionId: session.id, sessionFormatVersion: session.header.version, ...(session.header.createdAt === undefined ? {} : { sessionCreatedAt: session.header.createdAt }), eventType: 'assistant/message', messageId, messageSeq: reply.seq, turn, step: reply.data.step ?? null, endSeq: end.seq }
        const key = keyOf(source), fingerprint = hash(text), record = this.#record(resource.id)
        const previous = record.versions.find(v => v.key === key)
        if (previous) { if (previous.fingerprint !== fingerprint) fail('MVU_HISTORY_CHANGED', 'Durable reply changed at recorded coordinates'); continue }
        if (end.data?.reason?.kind !== 'completed') continue
        const baseline = this.#current(resource)
        const user = turnEvents.find(e => e.type === 'user/message'), origin = user?.data?.message?.source?.kind ?? user?.data?.source?.kind
        const fact = { id: resource.id, eventId: key, sessionId: session.id, turn, turnKind: origin === 'user' ? 'human' : 'unknown' }
        this.#emit({ ...fact, phase: 'started' })
        try {
          const event = { ...source, text, containsMvuUpdate: containsMvuUpdate(text) }
          const { enabled, configRevision, usageEpoch } = await this.#decision('assistant_message_committed', resource, scope, event, baseline)
          if (usageEpoch !== undefined && usageEpoch !== this.#usageEpoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed before commit')
          if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed before commit')
          let variables = baseline
          if (enabled && event.containsMvuUpdate) { this.#emit({ ...fact, phase: 'triggered' }); variables = applyMvuUpdate(baseline, parseMvuUpdate(text)) }
          else this.#emit({ ...fact, phase: 'skipped', detail: enabled ? 'no-update' : 'usage-policy' })
          const latest = this.#record(resource.id), revision = latest.revision + 1
          this.#save(resource.id, { ...latest, revision, currentKey: key, versions: [...latest.versions, { key, source, fingerprint, variables, parentKey: latest.currentKey, sourceRevision: latest.revision, revision, configRevision }] })
          if (enabled && event.containsMvuUpdate && JSON.stringify(baseline.stat_data) !== JSON.stringify(variables.stat_data)) this.#emit({ ...fact, phase: 'applied', revision, detail: 'state-committed' })
          this.#emit({ ...fact, phase: 'completed', revision, detail: 'state-committed' })
        } catch (error) {
          if (this.#disposed || error.code === 'MVU_USAGE_CANCELLED') { this.#emit({ ...fact, phase: 'failed', detail: error.code }); throw error }
          // Keep the unchanged snapshot and a durable failure receipt; later valid
          // turns and explicit edits can recover without replaying a poison reply.
          const latest = this.#record(resource.id), revision = latest.revision + 1
          this.#save(resource.id, { ...latest, revision, versions: [...latest.versions, { key, source, fingerprint, revision, variables: baseline, error: error.code ?? 'MVU_UPDATE_FAILED' }] })
          this.#emit({ ...fact, phase: 'failed', revision, detail: error.code ?? 'MVU_UPDATE_FAILED' })
        }
      }
    }
  }
  async #cardGrant(binding, signal) {
    signal?.throwIfAborted()
    const authority = this.authorizeCardWrite
    const grant = await authority?.({ grantId: binding.grantId, sourceIdentity: binding.sourceIdentity })
    signal?.throwIfAborted()
    if (this.#disposed || authority !== this.authorizeCardWrite) fail('MVU_DISPOSED', 'Card authority changed')
    if (!grant?.valid || !grant.write || hash(grant.scope) !== hash(binding.scope) || typeof grant.checkCurrent !== 'function' || grant.checkCurrent() !== true) fail('MVU_WRITE_DENIED', 'Explicit source write grant required')
    return grant.checkCurrent
  }
  async createCardBinding({ scope, grantId, sourceIdentity, signal } = {}) {
    if (typeof grantId !== 'string' || !grantId || !scope || !sourceIdentity || hash(sourceIdentity.scope) !== hash(scope) || sourceIdentity.version !== 1 || !/^[a-f0-9]{64}$/.test(sourceIdentity.sha256)) fail('MVU_SCOPE', 'Execution identity must bind the exact scope')
    const binding = { scope: json(scope), grantId, sourceIdentity: json(sourceIdentity) }
    const checkGrant = await this.#cardGrant(binding, signal)
    const evidence = await this.resolveScope?.(scope)
    if (!evidence?.writableHead) fail('MVU_READ_ONLY', 'Historical or running messages are read-only')
    const rows = (await this.list({ scope, signal })).filter(row => { const resource = this.resources.find(r => r.id === row.id); const version = this.#record(row.id).versions.find(v => v.key === row.versionKey); return version?.source.messageSeq === scope.endEventId && version?.source.messageId === evidence.messageId && (version?.sourceFingerprint ?? version?.fingerprint) === evidence.fingerprint && (!resource.discovered || !this.isActive || this.isActive(resource, scope.sessionId)) })
    if (rows.length !== 1 || !rows[0].versionKey || rows[0].versionKey !== this.#record(rows[0].id).currentKey) fail('MVU_READ_ONLY', 'Binding is not the current resource version')
    for (const [key, value] of this.#cardBindings) if (value.expiresAt < Date.now()) this.#cardBindings.delete(key)
    if (this.#cardBindings.size >= 512) fail('MVU_LIMIT', 'Too many live card bindings')
    const snapshot = await this.snapshot(scope)
    signal?.throwIfAborted()
    if (checkGrant() !== true) fail('MVU_WRITE_DENIED', 'Write grant was revoked during binding')
    const capability = randomUUID()
    this.#cardBindings.set(capability, { ...binding, resourceId: rows[0].id, expiresAt: Date.now() + 30 * 60 * 1000 })
    return { capability, snapshot }
  }
  revokeCardBinding(capability) { this.#cardBindings.delete(capability) }
  /** Transport belongs to the authenticated Host dispatcher, never to card code. */
  async cardWrite({ capability, operation, value, expectedRevision, operationId, cause, signal } = {}) {
    return this.#serial(async () => {
      const binding = this.#cardBindings.get(capability)
      if (!binding || binding.expiresAt < Date.now()) fail('MVU_WRITE_DENIED', 'Card capability expired or revoked')
      if (!['patch', 'replace'].includes(operation) || !['user-interaction', 'interval', 'script'].includes(cause) || typeof operationId !== 'string' || !operationId || operationId.length > 200 || !Number.isSafeInteger(expectedRevision)) fail('MVU_OPERATION', 'Invalid card operation')
      const scope = binding.scope, id = binding.resourceId, resource = this.#configured(id, scope)
      const fact = { id, eventId: operationId, operationId, on: 'card_variable_update', cause, sessionId: scope.sessionId }
      this.#emit({ ...fact, phase: 'started' })
      try {
        await this.#cardGrant(binding, signal)
        const evidence = await this.resolveScope?.(scope)
        if (!evidence?.writableHead) fail('MVU_READ_ONLY', 'Card no longer owns the active message')
        const record = this.#record(id), input = json(value), fingerprint = hash({ operation, value: input, expectedRevision, operationId, cause, scope, sourceIdentity: binding.sourceIdentity })
        const prior = record.versions.find(v => v.operationId === operationId)
        if (prior) {
          if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused')
          this.#emit({ ...fact, phase: 'completed', revision: prior.revision, detail: 'idempotent-replay' })
          return json(prior.result)
        }
        if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
        const current = record.versions.find(v => v.key === record.currentKey)
        if (!current || current.source.sessionId !== scope.sessionId || current.source.messageSeq !== scope.endEventId || current.source.messageId !== evidence.messageId || (current.sourceFingerprint ?? current.fingerprint) !== evidence.fingerprint) fail('MVU_READ_ONLY', 'Resource changed outside this message binding')
        const baseline = this.#current(resource)
        const event = { operationId, expectedRevision, cause, operation, sourceIdentity: binding.sourceIdentity, containsMvuUpdate: true }
        const decision = await this.#decision('card_variable_update', resource, { ...scope, authority: 'local' }, event, baseline)
        if (!decision.enabled) fail('MVU_USAGE_DENIED', 'Usage policy denied card update')
        this.#emit({ ...fact, phase: 'triggered' })
        let variables
        if (operation === 'patch') {
          if (!Array.isArray(input)) fail('MVU_PARSE', 'Card patch must be an array')
          variables = applyMvuUpdate(baseline, parseMvuUpdate(`<JSONPatch>${JSON.stringify(input)}</JSONPatch>`))
        } else {
          variables = normalizeVariables({ ...input, schema: baseline.schema, ...(baseline.mvu_schema ? { mvu_schema: baseline.mvu_schema } : {}) })
          if (!baseline.mvu_schema) delete variables.mvu_schema
          if (baseline.mvu_schema) { variables.stat_data = applyMvuSchema(variables.stat_data, baseline.mvu_schema); variables.display_data = json(variables.stat_data) }
        }
        const checkGrant = await this.#cardGrant(binding, signal)
        const finalEvidence = await this.resolveScope?.(scope)
        if (!finalEvidence?.writableHead || finalEvidence.messageId !== evidence.messageId || finalEvidence.fingerprint !== evidence.fingerprint) fail('MVU_READ_ONLY', 'Active message changed during update')
        signal?.throwIfAborted()
        if (checkGrant() !== true) fail('MVU_WRITE_DENIED', 'Source write grant was revoked')
        if (!this.#cardBindings.has(capability) || decision.usageEpoch !== this.#usageEpoch) fail('MVU_USAGE_CANCELLED', 'Card binding or usage provider changed')
        const revision = record.revision + 1, key = hash({ id, operationId })
        const result = { version: 1, scope: json(scope), revision, currentRevision: revision, status: 'available', variables, resourceId: id }
        this.#save(id, { ...record, revision, currentKey: key, versions: [...record.versions, { key, source: { ...current.source, manual: true, card: true }, fingerprint, sourceFingerprint: evidence.fingerprint, variables, revision, operationId, result, parentKey: record.currentKey, configRevision: decision.configRevision }] })
        if (hash(baseline.stat_data) !== hash(variables.stat_data)) this.#emit({ ...fact, phase: 'applied', revision, configRevision: decision.configRevision, detail: 'state-committed' })
        this.#emit({ ...fact, phase: 'completed', revision, configRevision: decision.configRevision, detail: 'state-committed' })
        return json(result)
      } catch (error) {
        const denied = ['MVU_WRITE_DENIED', 'MVU_READ_ONLY', 'MVU_USAGE_DENIED'].includes(error.code)
        this.#emit({ ...fact, phase: denied ? 'skipped' : 'failed', reason: error.code ?? 'MVU_CARD_UPDATE_FAILED' })
        throw error
      }
    })
  }
  async snapshot(scope) {
    let evidence = this.resolveScope ? await this.resolveScope(scope) : null
    if (!evidence && scope.endEventId != null) { const source = this.#sessions.get(scope.sessionId) ?? await this.inspect?.(scope.sessionId); const event = source?.events?.find(e => e.seq === scope.endEventId && e.type === 'assistant/message'); if (event) evidence = { messageId: event.data.message.id, fingerprint: hash(textOf(event.data.message)) } }
    let rows = await this.list({ scope })
    if (rows.length > 1 && evidence) rows = rows.filter(row => { const version = this.#record(row.id).versions.find(v => v.key === row.versionKey); return version?.source.messageSeq === scope.endEventId && version?.source.messageId === evidence.messageId && (version?.sourceFingerprint ?? version?.fingerprint) === evidence.fingerprint })
    else if (rows.length > 1 && scope.endEventId != null) rows = rows.filter(row => row.versionKey)
    if (rows.length > 1) fail('MVU_AMBIGUOUS', 'Multiple MVU resources match; choose a resourceId')
    const row = rows[0]
    if (row && evidence) {
      const version = this.#record(row.id).versions.find(v => v.key === row.versionKey && v.source.messageId === evidence.messageId && v.source.messageSeq === scope.endEventId && (v.sourceFingerprint ?? v.fingerprint) === evidence.fingerprint)
      if (!version) return { version: 1, scope: json(scope), revision: row.revision, status: 'unavailable', variables: {}, resourceId: row.id }
      row.content = json(version.variables)
      row.revision = version.revision ?? version.result?.revision ?? 0
    }
    return { version: 1, scope: json(scope), revision: row?.revision ?? 0, currentRevision: row?.currentRevision ?? 0, status: row ? 'available' : 'unavailable', variables: row?.content ?? {}, ...(row ? { resourceId: row.id } : {}) }
  }
  async resolveRequest(context) {
    const scope = { sessionId: context.sessionId, authority: 'local' }, blocks = [], diagnostics = []
    for (const row of await this.list({ scope, signal: context.signal })) {
      const resource = this.resources.find(r => r.id === row.id)
      const { enabled, configRevision, usageEpoch } = await this.#decision('before_model_request', resource, scope, { preview: context.preview === true, ...(context.turn === undefined ? {} : { turn: context.turn }), ...(context.step === undefined ? {} : { step: context.step }) }, row.content)
      context.signal?.throwIfAborted()
      if (usageEpoch !== undefined && usageEpoch !== this.#usageEpoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed before provide')
      if (enabled) {
        const blockId = `v1-${hash([row.id, row.revision, configRevision, 1])}`
        blocks.push({ type: 'text', id: blockId, role: 'system', name: resource.name ?? row.id, text: `${JSON.stringify(row.content.stat_data)}\n${resource.instructions ?? 'Return variable changes as <JSONPatch>[{"op":"replace","path":"/field","value":0}]</JSONPatch>. Use delta for numeric changes. Output literal values only.'}`, source: { resourceId: row.id, field: 'stat_data' } })
        diagnostics.push({ code: 'MVU_RESOURCE_VERSION', resourceId: row.id, blockId, revision: row.revision, configRevision, strategyRevision: 1 })
      }
    }
    return { blocks, diagnostics }
  }
  observeRequest(options, session) {
    const event = session?.snapshotEvents?.().findLast(e => e.type === 'request/assembly')
    if (!event || event.data.metadata?.owner !== 'pmp-dsh-tavern' || hash(event.data.messages) !== hash(options.messages)) return
    const assembly = event.data.metadata.assembly
    for (const entry of assembly.diagnostics ?? []) {
      if (entry.code !== 'MVU_RESOURCE_VERSION') continue
      const included = assembly.nodes?.some(node => Number.isSafeInteger(node.start) && Number.isSafeInteger(node.count) && node.count > 0 && node.start >= 0 && node.start + node.count <= options.messages.length && (
        (node.source?.resourceId === entry.resourceId && node.id.endsWith(`:${entry.blockId}`))
        || node.children?.some(child => child.source?.resourceId === entry.resourceId && child.name === entry.blockId)))
      if (!included) continue
      const fact = { id: entry.resourceId, eventId: `${session.id}:${event.seq}:${entry.blockId}`, requestId: `${session.id}:${event.seq}`, sessionId: session.id, turn: event.data.turn, turnKind: 'unknown', revision: entry.revision, detail: 'dsh-request-observed' }
      for (const phase of ['started', 'triggered', 'applied', 'completed']) this.#emit({ ...fact, phase })
    }
  }
  dispose() { this.#disposed = true; this.#listeners.clear(); this.#usage.clear(); this.#usageEpoch++; this.#cardBindings.clear() }
}
