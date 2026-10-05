import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'
import { applyMvuUpdate, containsMvuUpdate, normalizeVariables, parseMvuUpdate } from './updates.js'
import { fail, json } from './value.js'
import { createCommandProcessor } from './command-processor.js'
import { commandHookDeclaration } from './command-hook-declaration.js'
import { parseMvuData } from './data.js'
import { compileMvuSchema, applyMvuSchema } from './schema.js'
import { sessionIdentity, stateInstanceId, inheritedVersion, textFingerprint } from './instances.js'
import { snapshotMvuSession, cloneMvuVersion, cloneMvuCheckpoint, cloneMvuReceipt } from './history.js'
import { MvuFacts } from './facts.js'
import { UsageLifecycle } from '../../memory-sources/usage-lifecycle.js'
import { boundScope, boundSnapshot } from '../../memory-sources/bound-metadata.js'

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
    if (typeof config[mode] !== 'object' || Array.isArray(config[mode])) fail('MVU_CONFIG', 'Expected a policy object')
    if (Object.keys(config[mode]).length === 0) continue
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
      if (resource.sharing !== undefined && resource.sharing !== 'shared') fail('MVU_CONFIG', 'Only an explicit shared state may use sharing')
      if (!/^mvu:[A-Za-z0-9_.-]{1,160}$/.test(resource.id) || !Array.isArray(resource.sessionIds) || resource.sessionIds.some(id => typeof id !== 'string' || !id)) fail('MVU_CONFIG', 'Resource requires namespaced id and explicit sessionIds')
      let initial = typeof resource.initial === 'string' ? { stat_data: parseMvuData(resource.initial) } : json(resource.initial)
      if (resource.schemaSource) {
        const definition = compileMvuSchema(resource.schemaSource)
        initial = { ...initial, stat_data: applyMvuSchema(initial.stat_data, definition), mvu_schema: definition, schema: { type: 'object', properties: {}, extensible: true, strictSet: true } }
      }
      const prepared = { ...json(resource), initial: normalizeVariables(initial) }
      delete prepared.schemaSource // The exact compiled declaration remains in initial.mvu_schema.
      return prepared
}

export class MvuService {
  protocolVersion = 1
  #state; #path; #legacy; #facts; #listeners = new Set(); #usage = new UsageLifecycle(); #requestChecks = new WeakMap(); #queue = Promise.resolve(); #disposed = false; #fatal; #sessions = new Map(); #hostWork = new Set(); #cardBindings = new Map()
  #cardCreations = new Map(); #processors = new Map()
  constructor({ storageDir, resources = [], inspect, resolveScope, refresh, isActive, isPreviewRead, authorizeCardWrite, capturePromptScope, waitForHost, captureSessionLease, resolveCommandHook, captureCommandScope } = {}) {
    if (resources.some(resource => resource.instance)) fail('MVU_CONFIG', 'State instance identity is allocated by the Host, not configuration')
    this.inspect = inspect; this.resolveScope = resolveScope; this.refresh = refresh; this.isActive = isActive; this.isPreviewRead = isPreviewRead; this.authorizeCardWrite = authorizeCardWrite; this.capturePromptScope = capturePromptScope
    this.captureCommandScope = captureCommandScope; this.resolveCommandHook = resolveCommandHook; this.waitForHost = waitForHost; this.captureSessionLease = captureSessionLease
    // The previous shared ledger is never rewritten or silently redistributed.
    this.#facts = new MvuFacts(storageDir)
    const legacyPath = join(storageDir, 'mvu-state.json')
    this.#legacy = existsSync(legacyPath) ? readJsonFile(legacyPath, MAX_STORE) : { version: 1, resources: {} }
    if (this.#legacy?.version !== 1 || !this.#legacy.resources) fail('MVU_VERSION', 'Unsupported legacy MVU storage version')
    this.#path = join(storageDir, 'mvu-instances.json')
    this.#state = existsSync(this.#path) ? readJsonFile(this.#path, MAX_STORE) : { version: 1, resources: {} }
    if (this.#state?.version !== 1 || !this.#state.resources) fail('MVU_VERSION', 'Unsupported MVU storage version')
    const definitions = [...resources, ...Object.values(this.#state.resources).filter(r => r.definition && !resources.some(input => input.id === r.definition.id)).map(r => r.definition)]
    this.templates = [...Object.values(this.#state.templates ?? {}).map(template => { const stored = { ...template }; delete stored.schemaSource; return stored }), ...resources.filter(r => r.sharing !== 'shared' && !(r.id in (this.#state.templates ?? {})))].map(prepareResource)
    this.resources = definitions.filter(r => r.instance || r.sharing === 'shared').map(prepareResource)
    for (const [id, record] of Object.entries(this.#legacy.resources)) {
      const definition = record.definition ?? resources.find(r => r.id === id) ?? { id, sessionIds: [...new Set(record.versions.map(v => v.source?.sessionId).filter(Boolean))], initial: record.versions[0]?.variables ?? { stat_data: {} } }
      if (definition) {
        if (this.resources.some(r => r.id === id)) fail('MVU_MIGRATION_REQUIRED', 'Legacy content requires an explicit import before using this id')
        const legacyDefinition = { ...definition }; delete legacyDefinition.schemaSource
        this.resources.push({ ...prepareResource(legacyDefinition), legacy: true })
      }
    }
    if (new Set(this.resources.map(r => r.id)).size !== this.resources.length) fail('MVU_CONFIG', 'Duplicate resource id')
    for (const record of Object.values(this.#state.resources)) {
      if (!Number.isSafeInteger(record.revision) || !Array.isArray(record.versions)) fail('MVU_VERSION', 'Invalid MVU ledger')
      for (const version of record.versions) normalizeVariables(version.variables)
      for (const checkpoint of record.checkpoints ?? []) normalizeVariables(checkpoint.variables)
    }
    for (const resource of this.resources) if (!resource.legacy && resource.managementMode === 'managed' && !this.#record(resource.id).managementMode) this.#save(resource.id, { ...this.#record(resource.id), managementMode: 'managed', definition: resource })
  }
  /** Trusted Host discovery only. New templates default native; stored ownership is preserved. */
  async discover({ definition, sessionId }) {
    return this.#serial(async () => {
      const existing = this.templates.find(r => r.id === definition.id)
      if (existing && (!existing.discovered || existing.characterId !== definition.characterId)) fail('MVU_ID_CONFLICT', 'Discovered identity conflicts with configured resource')
      let resource
      if (existing && (!existing.sourceError || definition.sourceError || this.resources.some(r => r.templateId === existing.id && this.#record(r.id).versions.length))) resource = { ...existing }
      else {
        const managementMode = existing?.managementMode ?? 'native'
        try { resource = prepareResource({ ...definition, sessionIds: existing?.sessionIds ?? [], managementMode, discovered: true }) }
        catch (error) { resource = prepareResource({ id: definition.id, name: definition.name, characterId: definition.characterId, sessionIds: [], managementMode, discovered: true, sourceError: error.code ?? 'MVU_INITIALIZATION_INVALID', initial: { stat_data: {} } }) }
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
      this.#saveLedger({ templates: { ...(this.#state.templates ?? {}), [resource.id]: resource } })
      if (existing) this.templates[this.templates.indexOf(existing)] = resource
      else this.templates.push(resource)
    })
  }
  async syncDiscoveredSelection(sessionId, id) {
    if (!sessionId) return
    const observed = await this.inspect?.(sessionId) ?? this.#sessions.get(sessionId)
    const boundary = observed ? (observed.events.at(-1)?.seq ?? -1) + 1 : Number.MAX_SAFE_INTEGER
    return this.#serial(async () => {
      const previous = this.#state.discoverySelections?.[sessionId] ?? null
      const resource = this.templates.find(r => r.id === id && r.discovered)
      const selected = resource?.id ?? null
      if (previous === selected && resource?.activationSeqs?.[sessionId] !== Number.MAX_SAFE_INTEGER) { await this.#ensureInstances(sessionId); return }
      const extra = { discoverySelections: { ...(this.#state.discoverySelections ?? {}), [sessionId]: selected } }
      if (!resource) { this.#saveLedger(extra); return }
      const definition = { ...resource, sessionIds: [...new Set([...resource.sessionIds, sessionId])], activationSeqs: { ...(resource.activationSeqs ?? {}), [sessionId]: boundary } }
      this.#saveLedger({ ...extra, templates: { ...(this.#state.templates ?? {}), [resource.id]: definition } })
      this.templates[this.templates.indexOf(resource)] = definition
      await this.#ensureInstances(sessionId)
      const instance = this.resources.find(r => r.templateId === selected && r.instance?.sessionId === sessionId)
      if (instance) {
        const updated = { ...instance, activationSeqs: { ...(instance.activationSeqs ?? {}), [sessionId]: boundary } }
        this.#save(instance.id, { ...this.#record(instance.id), definition: updated })
        this.resources[this.resources.indexOf(instance)] = updated
      }
    })
  }
  async #ensureInstances(sessionId) {
    if (!sessionId) return
    const pending = Object.values(this.#state.seeds ?? {}).find(seed => seed.targetSessionId === sessionId && !seed.installed)
    if (pending) fail('MVU_SEED_PENDING', 'State inheritance must finish before this session can use variables')
    const templates = this.templates.filter(template => template.discovered ? (this.isActive ? this.isActive(template, sessionId) === true : this.#state.discoverySelections?.[sessionId] === template.id)
      : template.sessionIds.some(id => id === '*' || id === sessionId) && (!template.characterId || this.isActive?.(template, sessionId) === true))
    if (!templates.length) return
    const observed = this.inspect ? await this.inspect(sessionId) : this.#sessions.get(sessionId)
    const identity = sessionIdentity(observed, sessionId), header = observed.header ?? observed.meta
    for (const template of templates) {
      if (this.resources.some(r => r.templateId === template.id && r.instance?.sessionId === sessionId && hash(r.instance) !== hash(identity))) fail('MVU_SESSION_IDENTITY', 'Session id was reused for a different durable identity')
      const id = stateInstanceId(template.id, identity), existing = this.resources.find(r => r.id === id)
      if (existing) {
        if (hash(existing.instance) !== hash(identity) || existing.templateId !== template.id) fail('MVU_SESSION_IDENTITY', 'State instance identity conflicts')
        if (existing.sourceError && !template.sourceError && !this.#record(id).versions.length) {
          const definition = { ...existing, initial: json(template.initial), activationSeqs: { [sessionId]: (observed.events.at(-1)?.seq ?? -1) + 1 } }
          delete definition.sourceError
          const record = this.#record(id)
          this.#save(id, { ...record, revision: record.revision + 1, definition })
          this.resources[this.resources.indexOf(existing)] = definition
        }
        continue
      }
      if (this.resources.some(r => {
        if (!r.legacy || r.id !== template.id) return false
        const record = this.#record(r.id)
        const bound = r.sessionIds.includes(sessionId) || record.versions.some(v => v.source?.sessionId === sessionId)
          || (r.sessionIds.includes('*') && observed.events.some(e => ['user/message', 'assistant/message', 'turn/start'].includes(e.type)))
        return bound && (record.versions.length || record.revision > 0)
      })) fail('MVU_MIGRATION_REQUIRED', 'The old session has shared state requiring explicit migration')
      if (header.parentSession) fail('MVU_SEED_REQUIRED', 'A fork requires a frozen state inheritance receipt')
      const definition = { ...template, id, templateId: template.id, instance: identity, sessionIds: [sessionId], activationSeqs: { [sessionId]: template.activationSeqs?.[sessionId] ?? (observed.events.at(-1)?.seq ?? -1) + 1 } }
      delete definition.schemaSource
      this.#save(id, { revision: 0, currentKey: null, versions: [], managementMode: template.managementMode ?? 'native', definition }, { templates: { ...(this.#state.templates ?? {}), [template.id]: template } })
      this.resources.push(definition)
    }
  }
  /** Trusted Host creation primitive. The opaque ticket never contains guest-supplied state. */
  async captureSessionSeed({ sessionId, kind, atEventId, prefixEndEventId, targetSessionId, signal } = {}) {
    const barrier = this.waitForHost?.(); if (barrier) await barrier
    signal?.throwIfAborted()
    if (!['fork', 'reply-swipe'].includes(kind) || !Number.isSafeInteger(atEventId) || atEventId < 0
      || (prefixEndEventId !== undefined && (kind !== 'reply-swipe' || !Number.isSafeInteger(prefixEndEventId) || prefixEndEventId < 0 || prefixEndEventId >= atEventId))
      || (kind === 'reply-swipe' && prefixEndEventId === undefined && (typeof targetSessionId !== 'string' || !targetSessionId))) fail('MVU_SEED', 'A concrete source reply and creation intent are required')
    await this.refresh?.(sessionId)
    const hasState = await this.#serial(async () => { await this.#ensureInstances(sessionId); return this.resources.some(r => r.instance?.sessionId === sessionId && this.#cardResourceActive(r, { sessionId })) })
    if (!hasState) { signal?.throwIfAborted(); return null }
    const lease = await this.#sessionLease(sessionId)
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const active = this.resources.filter(r => r.instance?.sessionId === sessionId && this.#cardResourceActive(r, { sessionId }))
      if (!active.length) return null
      const session = this.inspect ? await this.inspect(sessionId) : this.#sessions.get(sessionId), identity = sessionIdentity(session, sessionId)
      const message = session.events.find(e => e.seq === atEventId)
      if (message?.type !== 'assistant/message' || message.data?.interrupted) fail('MVU_SEED', 'Seed must reference a durable final reply')
      const prefix = prefixEndEventId === undefined ? null : session.events.find(e => e.seq === prefixEndEventId)
      const targetStart = session.events.find(e => e.type === 'turn/start' && e.data?.turn === message.data?.turn)
      if (prefixEndEventId !== undefined && (prefix?.type !== 'assistant/message' || !targetStart || targetStart.seq <= prefixEndEventId
        || session.events.some(e => e.seq > prefixEndEventId && e.seq < targetStart.seq && ['turn/start', 'assistant/message'].includes(e.type)))) fail('MVU_SEED_MISMATCH', 'Swipe prefix must immediately precede its target turn')
      const items = []
      for (const resource of active) {
        const record = this.#record(resource.id)
        this.#verifyHistory(record, sessionId, session)
        const version = record.versions.findLast(v => v.source.messageSeq === atEventId && v.source.messageId === message.data.message.id)
        if (!version) fail('MVU_SEED_REQUIRED', 'The source reply has no state snapshot')
        let variables = version.variables, sourceRevision = version.revision, versionKey = version.key, checkpointRevision = null
        if (kind === 'reply-swipe') {
          const checkpoint = record.checkpoints?.find(c => c.turn === message.data.turn)
          if (!checkpoint) fail('MVU_BASELINE_REQUIRED', 'Reply swipe requires its immutable pre-turn state')
          variables = checkpoint.variables; sourceRevision = checkpoint.revision; versionKey = checkpoint.versionKey; checkpointRevision = checkpoint.revision
        }
        const prefixCut = kind === 'fork' ? atEventId : prefixEndEventId
        const history = prefixCut === undefined ? [] : record.versions.filter(v => v.source.messageSeq <= prefixCut && v.source.messageSeq >= 0 && (checkpointRevision === null || v.revision <= checkpointRevision))
        const checkpoints = prefixCut === undefined ? [] : (record.checkpoints ?? []).filter(c => c.seq <= prefixCut)
        items.push({ templateId: resource.templateId, managementMode: record.managementMode ?? resource.managementMode ?? 'native', variables: json(variables), history: history.map(cloneMvuVersion), checkpoints: checkpoints.map(cloneMvuCheckpoint), prefixVersionKey: history.findLast(v => v.source.messageSeq === prefixCut)?.key ?? null, source: { id: resource.id, identity, versionKey, revision: sourceRevision, contentHash: hash(variables), atEventId } })
      }
      if (!items.length) return null
      if (targetSessionId && (this.resources.some(r => r.instance?.sessionId === targetSessionId) || Object.values(this.#state.seeds ?? {}).some(s => s.targetSessionId === targetSessionId))) fail('MVU_SEED_CONFLICT', 'Target already has state or a creation intent')
      signal?.throwIfAborted()
      if (lease() !== true) fail('MVU_SEED_CONFLICT', 'Seed source changed during capture')
      const ticket = randomUUID(), seed = { ticket, kind, sourceSessionId: sessionId, sourceIdentity: identity, atEventId, ...(prefixEndEventId === undefined ? {} : { prefixEndEventId }), ...(targetSessionId ? { targetSessionId } : {}), items, installed: false }
      this.#saveLedger({ seeds: { ...(this.#state.seeds ?? {}), [ticket]: seed } })
      return ticket
    })
  }
  /** Complete only after the official creation returned the durable child identity. */
  async installSessionSeed({ ticket, sessionId, signal } = {}) {
    signal?.throwIfAborted()
    const pending = this.#state.seeds?.[ticket]
    if (!pending || (pending.targetSessionId && pending.targetSessionId !== sessionId)) fail('MVU_SEED_CONFLICT', 'Seed does not belong to this child')
    const sourceLease = await this.#sessionLease(pending.sourceSessionId), targetLease = await this.#sessionLease(sessionId)
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const seed = this.#state.seeds?.[ticket]
      if (!seed || (seed.targetSessionId && seed.targetSessionId !== sessionId)) fail('MVU_SEED_CONFLICT', 'Seed does not belong to this child')
      const session = this.inspect ? await this.inspect(sessionId) : this.#sessions.get(sessionId), identity = sessionIdentity(session, sessionId), header = session.header ?? session.meta
      if (seed.installed) {
        if (seed.targetSessionId !== sessionId || hash(seed.targetIdentity) !== hash(identity)) fail('MVU_SEED_CONFLICT', 'Seed was already installed in another identity')
        signal?.throwIfAborted()
        if (targetLease() !== true || sourceLease() !== true) fail('MVU_SEED_CONFLICT', 'Seed identity changed during replay')
        return seed.items.map(item => stateInstanceId(item.templateId, identity))
      }
      const sourceSession = this.inspect ? await this.inspect(seed.sourceSessionId) : this.#sessions.get(seed.sourceSessionId)
      if (hash(sessionIdentity(sourceSession, seed.sourceSessionId)) !== hash(seed.sourceIdentity)) fail('MVU_SEED_MISMATCH', 'Seed source session identity changed')
      const prefixCut = seed.prefixEndEventId ?? seed.atEventId
      if (session.events.some(e => e.seq > prefixCut && ['user/message', 'assistant/message', 'turn/start'].includes(e.type))) fail('MVU_SEED_CONFLICT', 'Child already started new work')
      if ((seed.kind === 'fork' || seed.prefixEndEventId !== undefined) && header.parentSession !== seed.sourceSessionId) fail('MVU_SEED_MISMATCH', 'Official child parent does not match the seed')
      if (seed.kind === 'reply-swipe' && seed.prefixEndEventId === undefined && (header.parentSession || session.events.some(e => ['turn/start', 'user/message', 'assistant/message'].includes(e.type)))) fail('MVU_SEED_MISMATCH', 'Root swipe must use a new empty session')
      const definitions = [], records = { ...this.#state.resources }
      for (const item of seed.items) {
        const template = this.templates.find(t => t.id === item.templateId)
        if (!template || template.sourceError || hash(item.variables) !== item.source.contentHash) fail('MVU_SEED_MISMATCH', 'Frozen seed or template is unavailable')
        const id = stateInstanceId(item.templateId, identity)
        if (this.resources.some(r => r.id === id)) fail('MVU_SEED_CONFLICT', 'Child state was initialized before its seed')
        const managementMode = item.managementMode === 'managed' || template.managementMode === 'managed' ? 'managed' : 'native'
        const definition = { ...template, managementMode, id, templateId: template.id, instance: identity, initial: json(item.variables), sessionIds: [sessionId], activationSeqs: { [sessionId]: 0 } }
        delete definition.schemaSource
        const versions = item.history.map(version => inheritedVersion(version, session, identity))
        const currentKey = seed.kind === 'fork' ? versions.find(v => v.inheritedFrom.versionKey === item.source.versionKey)?.key : null
        if (seed.kind === 'fork' && !currentKey) fail('MVU_SEED_MISMATCH', 'Captured current version is missing from the child history')
        const anchorKey = versions.find(v => v.inheritedFrom.versionKey === item.prefixVersionKey)?.key ?? null
        const checkpoints = (item.checkpoints ?? []).map(checkpoint => {
          if (!session.events.some(e => e.seq === checkpoint.seq && e.type === 'turn/start' && e.data?.turn === checkpoint.turn)) fail('MVU_SEED_MISMATCH', 'Inherited pre-turn checkpoint does not match the child prefix')
          return { ...checkpoint, sessionId, revision: 0, versionKey: null, inheritedFrom: { id: item.source.id, revision: checkpoint.revision, versionKey: checkpoint.versionKey } }
        })
        records[id] = { revision: 0, currentKey, versions, checkpoints, managementMode, definition, seed: { kind: seed.kind, ticket, anchorKey, source: item.source } }
        definitions.push(definition)
      }
      signal?.throwIfAborted()
      if (sourceLease() !== true || targetLease() !== true) fail('MVU_SEED_CONFLICT', 'Seed source or child changed before commit')
      const installed = { ...seed, targetSessionId: sessionId, targetIdentity: identity, installed: true }
      this.#saveLedger({ resources: records, seeds: { ...(this.#state.seeds ?? {}), [ticket]: installed } })
      this.resources.push(...definitions)
      return definitions.map(r => r.id)
    })
  }
  /** Freeze once at the first turn/start, independently of prompt-source inclusion. */
  async checkpoint(session, event) {
    const barrier = this.waitForHost?.()
    const observed = snapshotMvuSession(session)
    if (barrier) await barrier
    return this.#serial(async () => {
      this.#sessions.set(session.id, observed)
      await this.#ensureInstances(session.id)
      const start = observed.events.find(e => e.seq === event.seq && e.type === 'turn/start' && e.data?.turn === event.data?.turn)
      if (!start) fail('MVU_BASELINE_REQUIRED', 'Checkpoint requires a durable turn/start')
      for (const resource of this.resources.filter(r => !r.legacy && r.sessionIds.some(id => id === '*' || id === session.id) && this.#cardResourceActive(r, { sessionId: session.id }))) {
        const record = this.#record(resource.id)
        if (record.checkpoints?.some(c => c.turn === start.data.turn && (c.sessionId === session.id || (resource.instance && c.sessionId === undefined)))) continue
        const checkpoint = { sessionId: session.id, turn: start.data.turn, seq: start.seq, revision: record.revision, versionKey: record.currentKey, variables: json(this.#current(resource)) }
        this.#save(resource.id, { ...record, checkpoints: [...(record.checkpoints ?? []), checkpoint] })
      }
    })
  }
  async #sessionLease(sessionId, options) {
    const lease = await this.captureSessionLease?.(sessionId, options)
    if (typeof lease !== 'function' || lease() !== true) fail('MVU_SESSION_LEASE', 'A controlled session mutation lease is required')
    return lease
  }
  async #instanceCommitLease(resource, lease) {
    if (!resource.instance) return null
    if (typeof lease !== 'function' || lease() !== true) fail('MVU_READ_ONLY', 'Instance changed before inspection')
    const observed = this.inspect ? await this.inspect(resource.instance.sessionId) : this.#sessions.get(resource.instance.sessionId)
    if (hash(sessionIdentity(observed, resource.instance.sessionId)) !== hash(resource.instance)) fail('MVU_SESSION_IDENTITY', 'State instance identity changed')
    if (observed.events.findLast(e => e.type === 'turn/start')?.seq > (observed.events.findLast(e => e.type === 'turn/end')?.seq ?? -1)) fail('MVU_READ_ONLY', 'Cannot edit an instance while its turn is running')
    return lease
  }
  #configured(id, scope) {
    if (scope?.authority && scope.authority !== 'local') fail('MVU_AUTHORITY', 'Remote authority requires its own MVU service')
    const resource = this.resources.find(r => r.id === id)
    if (!resource) return null
    if (scope && Object.keys(scope).every(key => key === 'authority') && (!scope.authority || scope.authority === 'local')) return resource
    if (typeof scope?.sessionId !== 'string' || !resource.sessionIds.some(s => s === '*' || s === scope.sessionId)) fail('SCOPE_MISMATCH', 'Resource is not bound to this session')
    return resource
  }
  #record(id) { return this.#state.resources[id] ?? this.#legacy.resources[id] ?? { revision: 0, versions: [], currentKey: null } }
  #current(resource) { const record = this.#record(resource.id); return record.versions.find(v => v.key === record.currentKey)?.variables ?? resource.initial }
  #emit(fact) { this.#facts.append(fact); for (const listener of this.#listeners) { try { listener(json(fact)) } catch {} } }
  observe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  registerUsage(handler, options) { return this.#usage.register(handler, options) }
  getManagementDefaults({ id, scope = { authority: 'local' } } = {}) {
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    if (!scope || Object.keys(scope).some(k => !['authority', 'sessionId'].includes(k))) fail('MVU_SCOPE', 'Current source scope required')
    scope = json(scope)
    const resource = this.#configured(id, scope)
    if (!resource || resource.legacy || resource.sourceError) return null
    const binding = scope.sessionId ? this.capturePromptScope?.(scope, resource) : () => true
    if (typeof binding !== 'function' || binding() !== true) return null
    const epoch = this.#usage.epoch, definition = hash(resource)
    const configuration = { type: 'mvu-state',
      store: { on: 'assistant_message_committed', rule: true, strategy: allowedStrategy.assistant_message_committed.map(operation => ({ operation })) },
      retrieve: { on: 'before_model_request', rule: true, strategy: allowedStrategy.before_model_request.map(operation => ({ operation })) } }
    const revision = hash(configuration)
    return { protocolVersion: 1, revision, configuration, scopePolicy: 'source-bound',
      checkCurrent: () => { try { return !this.#disposed && this.#usage.current(epoch) && hash(configuration) === revision && this.#configured(id, scope) === resource && hash(resource) === definition && binding() === true } catch { return false } } }
  }
  // Trusted Host registration only; no card endpoint or callback crosses into Node.
  async registerCommandProcessor({ id, source } = {}) {
    if (!this.resources.some(resource => resource.id === id)) fail('MVU_MISSING', 'Resource not found')
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    if (!commandHookDeclaration(source)) fail('MVU_COMMAND_HOOK_DECLARATION', 'Complete command declaration required')
    const previous = this.#processors.get(id)
    const entry = { source, registrationId: randomUUID(), active: true }
    this.#processors.set(id, entry); previous?.dispose()
    entry.dispose = () => { entry.active = false; entry.processor?.dispose(); if (this.#processors.get(id) === entry) this.#processors.delete(id) }
    entry.ready = createCommandProcessor(source).then(processor => {
      if (!entry.active || this.#disposed || this.#processors.get(id) !== entry) { processor.dispose(); fail('MVU_USAGE_CANCELLED', 'Command registration changed') }
      entry.processor = processor
      entry.receipt = { protocolVersion: 1, registered: true, registrationId: entry.registrationId, source, sha256: createHash('sha256').update(source).digest('hex'), listenerCount: processor.listenerCount }
      return entry
    }).catch(error => {
      const cancelled = this.#disposed || !entry.active || this.#processors.get(id) !== entry
      entry.dispose()
      if (cancelled) fail('MVU_USAGE_CANCELLED', 'Command registration changed during initialization')
      throw error
    })
    await entry.ready
    return { receipt: json(entry.receipt), dispose: entry.dispose }
  }
  async #processor(resource, scope) {
    const resolved = this.resolveCommandHook?.(resource, scope)
    const source = resolved ? resolved.source : resource.commandSource
    let entry = this.#processors.get(resource.id)
    try {
      if (source && entry?.source !== source) {
        await this.registerCommandProcessor({ id: resource.id, source })
        entry = this.#processors.get(resource.id)
      }
      if (resolved && !source) { entry?.dispose(); return null }
      if (!entry) return null
      await entry.ready
    } catch (error) {
      // Include reused, still-pending registrations in the same failure boundary.
      let current = false
      try { current = !resolved || resolved.checkCurrent?.() === true } catch {}
      if (!current) fail('MVU_USAGE_CANCELLED', 'Command source changed during initialization')
      throw error
    }
    const checkCurrent = () => {
      try { return !this.#disposed && entry.active && this.#processors.get(resource.id) === entry
        && (!resolved || (typeof resolved.checkCurrent === 'function' && resolved.checkCurrent() === true)) }
      catch { return false }
    }
    if (!checkCurrent()) fail('MVU_USAGE_CANCELLED', 'Command source changed during registration')
    return { processor: entry.processor, receipt: entry.receipt, checkCurrent }
  }
  validateConfig(config) { return validateMvuConfig(config) }
  async #decision(on, resource, scope, event, variables) {
    if (resource.legacy || resource.sourceError || (resource.discovered && this.isActive && !this.isActive(resource, scope.sessionId))) return { enabled: false, configRevision: null }
    const managementMode = this.#usage.managementMode
    let enabled = true, decided = false, abstained = false, configRevision = null, reason
    const leases = [], executionLeases = []
    const usageEpoch = this.#usage.epoch
    for (const registration of [...this.#usage]) {
      let answer
      try { answer = await registration.handler({ ...json({ on, id: resource.id, scope, event, managementMode }), variables: json(variables) }) }
      catch (error) { if (usageEpoch !== this.#usage.epoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed'); throw error }
      if (usageEpoch !== this.#usage.epoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed')
      if (answer === undefined) { abstained = true; if (registration.providerId === 'dsh-memory-manager') { enabled = false; reason = 'manager-decision-required' }; continue }
      decided = true
      leases.push(answer?.checkCurrent)
      if (!answer || typeof answer.enabled !== 'boolean') fail('MVU_USAGE', 'Invalid usage decision')
      validateStrategy(on, answer.strategy)
      enabled &&= answer.enabled
      if (answer.enabled && (registration.providerId === 'dsh-memory-manager' || answer.checkCurrent !== undefined)) executionLeases.push(answer.checkCurrent)
      if (!answer.enabled) reason = answer.reason ?? reason
      configRevision = answer.configRevision ?? configRevision
    }
    const executionCurrent = () => { try { return this.#usage.current(usageEpoch) && executionLeases.every(check => typeof check === 'function' && check() === true) } catch { return false } }
    return { enabled: enabled && ((managementMode !== 'managed' && on !== 'card_variable_update') || decided), configRevision, usageEpoch, decided, abstained, reason, executionCurrent, checkCurrent: () => leases.length > 0 && leases.every(check => typeof check === 'function' && check() === true) }
  }
  #serial(fn) {
    const task = this.#queue.then(() => { if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed'); return fn() })
    this.#queue = task.catch(() => {})
    return task
  }
  trackHostWork(task) { this.#hostWork.add(task); task.finally(() => this.#hostWork.delete(task)).catch(() => {}); return task }
  async flush() { await Promise.all([...this.#hostWork]); await this.#queue; if (this.#fatal) throw this.#fatal }
  #save(id, record, extra = {}) {
    if (id in this.#legacy.resources) fail('MVU_MIGRATION_REQUIRED', 'Legacy shared state is read-only')
    this.#saveLedger({ ...extra, resources: { ...this.#state.resources, [id]: record } })
  }
  #saveLedger(extra) {
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed before commit')
    if (this.isPreviewRead?.() === true) throw Object.assign(new Error('MVU state requires initialization or repair outside preview'), { code: 'MVU_PREVIEW_STATE_UNAVAILABLE', status: 409 })
    const next = { ...this.#state, ...extra }
    try { atomicJson(this.#path, next, MAX_STORE) } catch (error) { this.#fatal = error; throw error }
    this.#fatal = undefined
    this.#state = next
  }
  async #snapshot(resource, scope) {
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    const record = this.#record(resource.id)
    if (resource.instance) {
      const observed = this.inspect ? await this.inspect(resource.instance.sessionId) : this.#sessions.get(resource.instance.sessionId)
      if (hash(sessionIdentity(observed, resource.instance.sessionId)) !== hash(resource.instance)) fail('MVU_SESSION_IDENTITY', 'State instance session identity changed')
    }
    if (this.inspect) {
      for (const sessionId of new Set(record.versions.filter(v => !v.source.manual || v.source.initial).map(v => v.source.sessionId))) {
        const history = await this.inspect(sessionId)
        if (!history) fail('MVU_HISTORY_UNAVAILABLE', 'Source session is unavailable')
        this.#verifyHistory(record, sessionId, history)
      }
    } else if (record.recoveryError) fail('MVU_HISTORY_UNAVAILABLE', 'Source history requires reconciliation')
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    // IDs select state instances. Historical coordinates select a version within that instance.
    let version = record.versions.find(v => v.key === record.currentKey)
    if (scope.messageId) version = record.versions.findLast(v => v.source.messageId === scope.messageId && v.source.sessionId === scope.sessionId)
    else if (scope.endEventId != null) {
      const candidates = record.versions.filter(v => v.source.sessionId === scope.sessionId && v.source.messageSeq <= scope.endEventId && (!v.source.manual || v.source.card || resource.instance))
      version = resource.instance ? candidates.findLast(v => v.source.messageSeq === scope.endEventId)
        ?? candidates.toSorted((a, b) => b.source.messageSeq - a.source.messageSeq || b.revision - a.revision)[0] : candidates.at(-1)
    }
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
    const command = !resource.legacy && !resource.sourceError && (!resource.characterId || this.isActive?.(resource, scope.sessionId) === true) ? await this.#processor(resource, scope) : null
    return { ...(command ? { commandProcessor: json(command.receipt) } : {}), id: resource.id, name: resource.name ?? resource.id, type: 'mvu-state', authority: 'local', managementMode: this.#usage.managementMode, storedManagementMode: record.managementMode ?? resource.managementMode ?? 'native', ...(resource.legacy ? { sourceError: 'MVU_MIGRATION_REQUIRED', capabilities: { edit: false, copy: false, management: false }, legacy: true } : {}), ...(resource.templateId ? { templateId: resource.templateId, instance: json(resource.instance), ...(record.seed ? { inheritedFrom: json(record.seed.source) } : {}) } : {}), ...(resource.sourceError ? { sourceError: resource.sourceError } : {}), ...(resource.discovered ? { source: { kind: 'character', characterId: resource.characterId, discovered: true } } : {}), scope: json(scope), content: json(version?.variables ?? resource.initial), revision: historical ? (version?.revision ?? version?.result?.revision ?? 0) : record.revision, currentRevision: record.revision, historical, versionKey: version?.key ?? null }
  }
  #verifyHistory(record, sessionId, session) {
    const header = session.header ?? session.meta
    for (const version of record.versions.filter(v => v.source.sessionId === sessionId && (!v.source.manual || v.source.card))) {
      const source = version.source
      if (source.initial) {
        if (header?.version !== source.sessionFormatVersion || (source.sessionCreatedAt !== undefined && header?.createdAt !== source.sessionCreatedAt)) fail('MVU_HISTORY_UNAVAILABLE', 'Initial session identity changed')
        continue
      }
      const message = session.events.find(e => e.seq === source.messageSeq), end = session.events.find(e => e.seq === source.endSeq)
      if (source.inherited) {
        if (header?.version !== source.sessionFormatVersion || header?.createdAt !== source.sessionCreatedAt || message?.type !== 'assistant/message'
          || message.data?.message?.id !== source.messageId || textFingerprint(message) !== version.fingerprint) fail('MVU_HISTORY_UNAVAILABLE', 'Inherited snapshot no longer matches durable seed')
        continue
      }
      if (header?.version !== source.sessionFormatVersion || (source.sessionCreatedAt !== undefined && header?.createdAt !== source.sessionCreatedAt)
        || message?.type !== 'assistant/message' || message.data?.message?.id !== source.messageId || hash(textOf(message.data?.message)) !== (version.sourceFingerprint ?? version.fingerprint)
        || end?.type !== 'turn/end' || end.data?.turn !== source.turn || end.data?.reason?.kind !== 'completed') fail('MVU_HISTORY_UNAVAILABLE', 'Recorded source no longer matches durable history')
    }
  }
  async setManagementMode({ id, mode, expectedRevision, operationId, scope, signal }) {
    const barrier = this.waitForHost?.(); if (barrier) await barrier
    const selected = this.#configured(id, scope)
    const instanceLease = selected?.instance ? await this.#sessionLease(selected.instance.sessionId) : null
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      if (!['managed', 'native'].includes(mode) || typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('MVU_CONFIG', 'Explicit mode and operationId required')
      const lease = await this.#instanceCommitLease(resource, instanceLease)
      const record = this.#record(id), prior = record.managementOperations?.find(op => op.id === operationId)
      const fingerprint = hash({ mode, expectedRevision, scope })
      if (prior) { if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused'); return { ...json(prior.result), managementMode: this.#usage.managementMode, storedManagementMode: prior.result.managementMode } }
      if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
      const result = { id, managementMode: mode, revision: record.revision + 1 }
      signal?.throwIfAborted()
      if (lease && lease() !== true) fail('MVU_READ_ONLY', 'Instance changed before management commit')
      this.#save(id, { ...record, managementMode: mode, revision: result.revision, managementOperations: [...(record.managementOperations ?? []), { id: operationId, fingerprint, result }] })
      return { ...result, managementMode: this.#usage.managementMode, storedManagementMode: mode }
    })
  }
  async copy({ id, newId, scope, signal }) {
    const barrier = this.waitForHost?.(); if (barrier) await barrier
    const selected = this.#configured(id, scope)
    const instanceLease = selected?.instance ? await this.#sessionLease(selected.instance.sessionId) : null
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      if (resource.legacy) fail('MVU_MIGRATION_REQUIRED', 'Legacy state cannot be copied into an active instance')
      if (!/^mvu:[A-Za-z0-9_.-]{1,160}$/.test(newId) || this.resources.some(r => r.id === newId)) fail('MVU_ID_CONFLICT', 'Copy requires a new resource id')
      const lease = await this.#instanceCommitLease(resource, instanceLease)
      const definition = { ...resource, id: newId, sharing: 'shared', initial: json(this.#current(resource)), managementMode: resource.discovered ? 'managed' : 'native' }
      delete definition.instance; delete definition.templateId
      delete definition.schemaSource
      signal?.throwIfAborted()
      if (lease && lease() !== true) fail('MVU_READ_ONLY', 'Instance changed before copy')
      this.#save(newId, { revision: 0, versions: [], currentKey: null, managementMode: definition.managementMode, definition, copiedFrom: { id, revision: this.#record(id).revision } })
      this.resources.push(definition)
      return this.#snapshot(definition, scope)
    })
  }
  /** Metadata only. Does not discover cards, allocate instances or read snapshots. */
  async listBound({ scope, signal } = {}) {
    scope = boundScope(scope); signal?.throwIfAborted()
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    await this.waitForHost?.()
    signal?.throwIfAborted()
    const rowsNow = () => this.resources.filter(resource => {
      try { return !resource.legacy && this.#configured(resource.id, scope) && (!resource.characterId || this.isActive?.(resource, scope.sessionId) === true) } catch (error) { if (error.code === 'SCOPE_MISMATCH') return false; throw error }
    }).map(resource => {
      const record = this.#record(resource.id)
      return { id: resource.id, adapterId: 'tavern.mvu', name: resource.name ?? resource.id, type: 'mvu-state', revision: record.revision,
        managementMode: this.#usage.managementMode, storedManagementMode: record.managementMode ?? resource.managementMode ?? 'native', ...(resource.sourceError ? { sourceError: resource.sourceError } : {}),
        binding: { sessionId: scope.sessionId, kind: resource.instance ? 'state-instance' : 'shared-state', ...(resource.instance ? { instanceCreatedAt: resource.instance.createdAt } : {}),
          ...(resource.characterId ? { characterId: resource.characterId } : {}), ...(resource.templateId ? { templateId: resource.templateId } : {}) } }
    })
    const rows = rowsNow(), revision = hash(rows), usageEpoch = this.#usage.epoch
    const leases = rows.map(row => this.capturePromptScope?.(scope, this.resources.find(r => r.id === row.id))).filter(Boolean)
    const checkCurrent = () => { try { return !this.#disposed && !signal?.aborted && this.#usage.current(usageEpoch) && hash(rowsNow()) === revision && leases.every(check => check() === true) } catch { return false } }
    if (!checkCurrent()) fail('MVU_SCOPE', 'Bound MVU metadata changed during lookup')
    return boundSnapshot(rows, revision, checkCurrent)
  }
  async list({ scope, signal } = {}) {
    if (scope?.authority && scope.authority !== 'local') fail('MVU_AUTHORITY', 'Remote authority requires its own MVU service')
    signal?.throwIfAborted()
    await this.refresh?.(scope?.sessionId)
    if (scope?.sessionId) await this.#serial(() => this.#ensureInstances(scope.sessionId))
    const out = []
    for (const resource of this.resources) {
      try { this.#configured(resource.id, scope) } catch (error) { if (error.code === 'SCOPE_MISMATCH') continue; throw error }
      out.push(await this.#snapshot(resource, scope))
    }
    return out
  }
  async read({ id, scope, signal } = {}) {
    if (scope?.authority && scope.authority !== 'local') fail('MVU_AUTHORITY', 'Remote authority requires its own MVU service')
    signal?.throwIfAborted()
    if (!this.resources.find(r => r.id === id)?.legacy) {
      await this.refresh?.(scope?.sessionId)
      if (scope?.sessionId) await this.#serial(() => this.#ensureInstances(scope.sessionId))
    }
    const resource = this.#configured(id, scope)
    return resource ? this.#snapshot(resource, scope) : null
  }
  async history({ id, scope, signal, includeBefore = false } = {}) {
    signal?.throwIfAborted(); const resource = this.#configured(id, scope); if (!resource) return []
    await this.#snapshot(resource, scope); signal?.throwIfAborted()
    const record = this.#record(id)
    return record.versions.filter(v => v.source.sessionId === scope.sessionId).map(version => {
      const copy = cloneMvuVersion(version)
      if (!includeBefore) return copy
      const parent = record.versions.find(v => v.key === version.parentKey)
      const checkpoint = !version.source.manual && record.checkpoints?.find(c => c.turn === version.source.turn
        && (c.sessionId === version.source.sessionId || (resource.instance && c.sessionId === undefined)))
      const before = version.source.inherited ? undefined : version.error ? version.variables : checkpoint?.variables ?? parent?.variables
        ?? (!version.source.inherited && (version.parentKey === null || version.sourceRevision === 0 || version.revision === 1) ? resource.initial : undefined)
      // Missing older provenance stays unknown; do not infer it from current content.
      return { ...copy, beforeAvailable: before !== undefined, ...(before !== undefined ? { before: json(before.stat_data) } : {}) }
    })
  }
  async facts({ id, scope, signal } = {}) {
    signal?.throwIfAborted()
    const resource = this.#configured(id, scope)
    if (!resource) return { records: [], unavailable: false, maxRecords: 2048 }
    await this.#snapshot(resource, scope)
    signal?.throwIfAborted()
    return this.#facts.list(id, scope.sessionId)
  }
  async update({ id, content, expectedRevision, operationId, scope, signal } = {}) {
    const barrier = this.waitForHost?.(); if (barrier) await barrier
    const selected = this.#configured(id, scope)
    const instanceLease = selected?.instance ? await this.#sessionLease(selected.instance.sessionId) : null
    return this.#serial(async () => {
      signal?.throwIfAborted()
      const resource = this.#configured(id, scope); if (!resource) fail('MVU_MISSING', 'Resource not found')
      const lease = await this.#instanceCommitLease(resource, instanceLease)
      if (typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('MVU_OPERATION', 'operationId required')
      if (scope.messageId != null || scope.endEventId != null) fail('MVU_SCOPE', 'Edit current content with a current scope')
      const observed = scope.sessionId && (this.inspect ? await this.inspect(scope.sessionId) : this.#sessions.get(scope.sessionId))
      const actionTurn = observed?.events?.findLast(event => ['turn/start', 'turn/end'].includes(event.type))?.data?.turn ?? (observed ? 0 : undefined)
      const action = { ...(Number.isSafeInteger(actionTurn) ? { turn: actionTurn } : {}) }
      const record = this.#record(id), current = this.#current(resource), variables = normalizeVariables(content)
      // The source owns its schema. An editor cannot remove or replace it.
      if (current.mvu_schema) {
        if (variables.mvu_schema && hash(variables.mvu_schema) !== hash(current.mvu_schema)) fail('MVU_SCHEMA_CODE', 'Source schema cannot be replaced by a content edit')
        variables.mvu_schema = json(current.mvu_schema)
      }
      const fingerprint = hash({ content: variables, scope, expectedRevision })
      const prior = record.versions.find(v => v.operationId === operationId)
      if (prior) { if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused with different input'); return cloneMvuReceipt(prior.result) }
      if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
      if (variables.mvu_schema) { variables.stat_data = applyMvuSchema(variables.stat_data, variables.mvu_schema); variables.display_data = json(variables.stat_data) }
      json(variables)
      const previousVersion = record.versions.find(v => v.key === record.currentKey) ?? record.versions.find(v => v.key === record.seed?.anchorKey)
      const source = resource.instance && previousVersion?.source.messageSeq >= 0 ? { ...previousVersion.source, manual: true, card: false }
        : { ...(scope.sessionId ? { sessionId: scope.sessionId } : {}), messageId: `manual:${operationId}`, messageSeq: scope.endEventId ?? record.versions.findLast(v => v.source.sessionId === scope.sessionId)?.source.messageSeq ?? -1, manual: true }
      const key = hash({ id, operationId }), revision = record.revision + 1
      const result = { id, type: 'mvu-state', content: variables, revision, scope, authority: 'local' }
      signal?.throwIfAborted()
      if (lease && lease() !== true) fail('MVU_READ_ONLY', 'Instance changed before edit')
      this.#save(id, { ...record, revision, currentKey: key, versions: [...record.versions, { key, source, variables, action, operationId, fingerprint, parentKey: record.currentKey, ...(resource.instance && previousVersion?.source.messageSeq >= 0 ? { sourceFingerprint: previousVersion.sourceFingerprint ?? previousVersion.fingerprint } : {}), revision, result }] })
      this.#emit({ id, eventId: key, phase: 'completed', on: 'manual_update', cause: 'user-interaction', ...(Number.isSafeInteger(action.turn) ? { turn: action.turn } : {}), ...(scope.sessionId ? { sessionId: scope.sessionId } : {}), revision, detail: 'manual-update' })
      return cloneMvuReceipt(result)
    })
  }
  /** Only call with a trusted DSH Session snapshot, never with browser text. */
  ingest(session) {
    const snapshot = snapshotMvuSession(session)
    return this.#serial(() => this.#ingest(snapshot))
  }
  async #ingest(session) {
    if (session.header.origin === 'subagent') return
    this.#sessions.set(session.id, session)
    await this.#ensureInstances(session.id)
    const scope = { sessionId: session.id, authority: 'local' }
    for (const resource of this.resources) {
      try { this.#configured(resource.id, scope) } catch (error) { if (error.code === 'SCOPE_MISMATCH') continue; throw error }
      if (resource.legacy || resource.sourceError || (resource.discovered && this.isActive && !this.isActive(resource, session.id))) continue
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
        const checkpoint = record.checkpoints?.find(c => c.turn === turn && (c.sessionId === session.id || (resource.instance && c.sessionId === undefined)))
        if (resource.instance && !checkpoint) fail('MVU_BASELINE_REQUIRED', 'A state instance requires its persisted pre-turn checkpoint')
        const baseline = checkpoint?.variables ?? this.#current(resource)
        const turnStart = turnEvents.findLast(e => e.type === 'turn/start' && e.seq < reply.seq)
        // V4 user/message has no turn field. Its accepted message is logged
        // between this turn's start and reply; exclude runtime context messages.
        const users = (turnStart ? session.events.filter(e => e.seq > turnStart.seq && e.seq < reply.seq) : turnEvents).filter(e => e.type === 'user/message')
        const user = users.findLast(e => (e.data?.message?.source?.kind ?? e.data?.source?.kind) === 'user')
        const origin = user?.data?.message?.source?.kind ?? user?.data?.source?.kind
        const fact = { id: resource.id, eventId: key, on: 'assistant_message_committed', sessionId: session.id, turn, turnKind: origin === 'user' ? 'human' : 'unknown' }
        this.#emit({ ...fact, phase: 'started' })
        let command, decision, scopeLease, sessionLease
        const commitCurrent = () => {
          try { return !this.#disposed && (!decision || decision.usageEpoch === undefined || decision.usageEpoch === this.#usage.epoch)
            && (!command || command.checkCurrent() === true)
            && (!command || !decision?.decided || decision.checkCurrent() === true)
            && (!decision?.enabled || decision.executionCurrent() === true)
            && (typeof scopeLease !== 'function' ? !command || !this.capturePromptScope : scopeLease() === true)
            && (!command || !this.captureCommandScope || (typeof sessionLease === 'function' && sessionLease() === true))
            && this.resources.find(item => item.id === resource.id) === resource && this.#record(resource.id).revision === record.revision
            && (!resource.characterId || !this.isActive || this.isActive(resource, session.id) === true) } catch { return false }
        }
        try {
          const event = { ...source, text, containsMvuUpdate: containsMvuUpdate(text) || /<UpdateVariable>\s*(?:```(?:json)?\s*)?\[/i.test(text) }
          scopeLease = this.capturePromptScope?.(scope, resource); sessionLease = this.captureCommandScope?.(session)
          decision = await this.#decision('assistant_message_committed', resource, scope, event, baseline)
          const { enabled, configRevision, usageEpoch } = decision
          let variables = baseline
          if (enabled && event.containsMvuUpdate) {
            this.#emit({ ...fact, phase: 'triggered', configRevision })
            command = await this.#processor(resource, scope)
            const commands = command ? await command.processor.process({ variables: baseline, text, userText: textOf(user?.data?.message) }) : parseMvuUpdate(text)
            variables = applyMvuUpdate(baseline, commands)
          } else this.#emit({ ...fact, phase: 'skipped', configRevision, reason: decision.reason ?? (enabled ? 'no-update' : 'usage-policy'), detail: enabled ? 'no-update' : 'usage-policy' })
          // No await after these leases: registration, selection, policy and CAS
          // belong to this exact durable turn, never a display VM or focus.
          if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed before commit')
          if (usageEpoch !== undefined && usageEpoch !== this.#usage.epoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed before commit')
          if (!commitCurrent()) fail('MVU_USAGE_CANCELLED', 'Update commit lease changed')
          const latest = this.#record(resource.id), revision = latest.revision + 1
          this.#save(resource.id, { ...latest, revision, currentKey: key, versions: [...latest.versions, { key, source, fingerprint, variables, parentKey: latest.currentKey, sourceRevision: latest.revision, revision, configRevision }] })
          if (enabled && event.containsMvuUpdate && JSON.stringify(baseline.stat_data) !== JSON.stringify(variables.stat_data)) this.#emit({ ...fact, phase: 'applied', revision, configRevision, detail: 'state-committed' })
          this.#emit({ ...fact, phase: 'completed', revision, configRevision, detail: 'state-committed' })
        } catch (error) {
          if ((decision || command || error.code?.startsWith('MVU_COMMAND_HOOK_')) && !commitCurrent()) error = Object.assign(new Error('Update commit lease changed'), { code: 'MVU_USAGE_CANCELLED' })
          if (this.#disposed || ['MVU_USAGE_CANCELLED', 'MVU_COMMAND_HOOK_DISPOSED'].includes(error.code)) { this.#emit({ ...fact, phase: 'failed', detail: error.code }); throw error }
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
    if (!grant?.valid || !grant.write || hash(grant.scope) !== hash(binding.scope) || typeof grant.checkCurrent !== 'function' || grant.checkCurrent() !== true) fail('MVU_WRITE_DENIED', 'Current source execution binding required')
    return grant.checkCurrent
  }
  async createCardBinding({ scope, grantId, sourceIdentity, bindingId, signal } = {}) {
    if (scope?.mode === 'initial' && scope.greetingIndex !== undefined && (typeof scope.selectionToken !== 'string' || !/^[a-f0-9]{64}$/.test(scope.selectionToken))) fail('MVU_SCOPE', 'Selected greeting writes require a source view token')
    if (scope?.mode === 'greeting') fail('MVU_READ_ONLY', 'Greeting snapshots cannot grant writes')
    if (typeof grantId !== 'string' || !grantId || !scope || !sourceIdentity || hash(sourceIdentity.scope) !== hash(scope) || sourceIdentity.version !== 1 || !/^[a-f0-9]{64}$/.test(sourceIdentity.sha256)) fail('MVU_SCOPE', 'Execution identity must bind the exact scope')
    const binding = { scope: json(scope), grantId, sourceIdentity: json(sourceIdentity) }
    if (bindingId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(bindingId)) fail('MVU_SCOPE', 'Invalid card binding identity')
    const capability = bindingId ?? randomUUID(), fingerprint = hash(binding)
    for (const [key, value] of this.#cardBindings) if (value.grantLease?.() !== true) this.#cardBindings.delete(key)
    const existing = this.#cardBindings.get(capability)
    if (existing && existing.requestFingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Card binding identity changed')
    let pending = this.#cardCreations.get(capability)
    if (pending && pending.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Card binding identity changed')
    if (!pending) {
      if (this.#cardCreations.size >= 512 || (!existing && this.#cardBindings.size + this.#cardCreations.size >= 512)) fail('MVU_LIMIT', 'Too many live card bindings')
      pending = { fingerprint, cancelled: false, count: 0 }; this.#cardCreations.set(capability, pending)
    }
    pending.count++
    try {
      const checkGrant = await this.#cardGrant(binding, signal)
      const evidence = await this.resolveScope?.(scope)
      if (!evidence?.writableHead) fail('MVU_READ_ONLY', 'Historical or running messages are read-only')
      const initial = scope.mode === 'initial'
      const rows = (await this.list({ scope, signal })).filter(row => {
        const resource = this.resources.find(r => r.id === row.id)
        if (!this.#cardResourceActive(resource, scope)) return false
        if (initial) return true
        const version = this.#record(row.id).versions.find(v => v.key === row.versionKey)
        return version?.source.messageSeq === scope.endEventId && version?.source.messageId === evidence.messageId && (version?.sourceFingerprint ?? version?.fingerprint) === evidence.fingerprint
      })
      if (rows.length !== 1 || (!initial && (!rows[0].versionKey || rows[0].versionKey !== this.#record(rows[0].id).currentKey))) fail('MVU_READ_ONLY', 'Binding is not the current resource version')
      if (initial && (evidence.mode !== 'initial' || typeof evidence.checkCurrent !== 'function' || evidence.checkCurrent() !== true)) fail('MVU_READ_ONLY', 'Initial scope is no longer current')
      const snapshot = await this.snapshot(scope)
      signal?.throwIfAborted()
      if (checkGrant() !== true) fail('MVU_WRITE_DENIED', 'Write grant was revoked during binding')
      if (initial && evidence.checkCurrent() !== true) fail('MVU_READ_ONLY', 'Initial scope changed during binding')
      if (pending.cancelled) fail('MVU_WRITE_DENIED', 'Card execution binding stopped during creation')
      this.#cardBindings.set(capability, { ...binding, requestFingerprint: fingerprint, grantLease: checkGrant, resourceId: rows[0].id, ...(initial ? { scopeLease: evidence.checkCurrent, initialSource: json(evidence.initialSource) } : {}) })
      return { capability, snapshot }
    } finally { if (--pending.count === 0) this.#cardCreations.delete(capability) }
  }
  #cardResourceActive(resource, scope) {
    return resource && !resource.legacy && !resource.sourceError && (!resource.discovered || !this.isActive || this.isActive(resource, scope.sessionId))
      && (!['initial', 'greeting'].includes(scope.mode) || (resource.characterId === scope.characterId && this.isActive?.(resource, scope.sessionId) === true))
  }
  #initialBindingCurrent(binding, evidence) {
    if (binding.scope.mode !== 'initial') return true
    const active = this.resources.filter(resource => {
      try { return this.#configured(resource.id, binding.scope) && this.#cardResourceActive(resource, binding.scope) } catch { return false }
    })
    return evidence?.mode === 'initial' && evidence.writableHead && binding.scopeLease?.() === true && evidence.checkCurrent?.() === true
      && hash(evidence.initialSource) === hash(binding.initialSource) && active.length === 1 && active[0].id === binding.resourceId
  }
  revokeCardBinding(capability) { const pending = this.#cardCreations.get(capability); if (pending) pending.cancelled = true; this.#cardBindings.delete(capability) }
  /** Transport belongs to the authenticated Host dispatcher, never to card code. */
  async cardWrite({ capability, operation, value, expectedRevision, operationId, cause, signal } = {}) {
    const barrier = this.waitForHost?.(); if (barrier) await barrier
    const selectedBinding = this.#cardBindings.get(capability), selected = selectedBinding && this.#configured(selectedBinding.resourceId, selectedBinding.scope)
    const instanceLease = selected?.instance ? await this.#sessionLease(selected.instance.sessionId) : null
    return this.#serial(async () => {
      const binding = this.#cardBindings.get(capability)
      if (!binding) fail('MVU_WRITE_DENIED', 'Card execution binding stopped')
      if (!['patch', 'replace'].includes(operation) || !['user-interaction', 'interval', 'script'].includes(cause) || typeof operationId !== 'string' || !operationId || operationId.length > 200 || !Number.isSafeInteger(expectedRevision)) fail('MVU_OPERATION', 'Invalid card operation')
      const scope = binding.scope, id = binding.resourceId, resource = this.#configured(id, scope)
      const fact = { id, eventId: operationId, operationId, on: 'card_variable_update', cause, sessionId: scope.sessionId, turn: binding.initialSource?.turn ?? this.#record(id).versions.find(v => v.key === this.#record(id).currentKey)?.source.turn ?? 0 }
      this.#emit({ ...fact, phase: 'started' })
      try {
        const sessionLease = await this.#instanceCommitLease(resource, instanceLease)
        await this.#cardGrant(binding, signal)
        const evidence = await this.resolveScope?.(scope)
        if (!evidence?.writableHead || !this.#initialBindingCurrent(binding, evidence)) fail('MVU_READ_ONLY', 'Card no longer owns the active scope')
        const record = this.#record(id), input = json(value), fingerprint = hash({ operation, value: input, expectedRevision, operationId, cause, scope, sourceIdentity: binding.sourceIdentity })
        const prior = record.versions.find(v => v.operationId === operationId)
        if (prior) {
          if (prior.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation id reused')
          this.#emit({ ...fact, phase: 'completed', revision: prior.revision, configRevision: prior.configRevision ?? null, detail: 'idempotent-replay' })
          return cloneMvuReceipt(prior.result)
        }
        if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'MVU revision changed')
        const current = record.versions.find(v => v.key === record.currentKey)
        if (scope.mode !== 'initial' && (!current || current.source.sessionId !== scope.sessionId || current.source.messageSeq !== scope.endEventId || current.source.messageId !== evidence.messageId || (current.sourceFingerprint ?? current.fingerprint) !== evidence.fingerprint)) fail('MVU_READ_ONLY', 'Resource changed outside this message binding')
        const baseline = this.#current(resource)
        // Native card execution follows downloaded sources and saved switches.
        // Manager policies still govern model/store/retrieve usage, not a
        // second permission for this bound variable operation.
        this.#emit({ ...fact, phase: 'triggered', configRevision: null })
        let variables
        if (operation === 'patch') {
          if (!Array.isArray(input)) fail('MVU_PARSE', 'Card patch must be an array')
          variables = applyMvuUpdate(baseline, parseMvuUpdate(`<JSONPatch>${JSON.stringify(input)}</JSONPatch>`))
        } else {
          variables = normalizeVariables({ ...input, schema: baseline.schema, ...(baseline.mvu_schema ? { mvu_schema: baseline.mvu_schema } : {}) })
          if (!baseline.mvu_schema) delete variables.mvu_schema
          if (baseline.mvu_schema) { variables.stat_data = applyMvuSchema(variables.stat_data, baseline.mvu_schema); variables.display_data = json(variables.stat_data) }
        }
        json(variables)
        const checkGrant = await this.#cardGrant(binding, signal)
        const finalEvidence = await this.resolveScope?.(scope)
        if (!this.#initialBindingCurrent(binding, finalEvidence) || !finalEvidence?.writableHead || finalEvidence.messageId !== evidence.messageId || finalEvidence.fingerprint !== evidence.fingerprint) fail('MVU_READ_ONLY', 'Active message changed during update')
        signal?.throwIfAborted()
        if (sessionLease && sessionLease() !== true) fail('MVU_READ_ONLY', 'Instance changed during card update')
        if (checkGrant() !== true) fail('MVU_WRITE_DENIED', 'Source write grant was revoked')
        if (!this.#cardBindings.has(capability)) fail('MVU_WRITE_DENIED', 'Card execution binding stopped')
        const revision = record.revision + 1, key = hash({ id, operationId })
        const source = scope.mode === 'initial' ? { ...binding.initialSource, manual: true, card: true, initial: true } : { ...current.source, manual: true, card: true }
        const result = { version: 1, scope: json(scope), revision, currentRevision: revision, status: 'available', variables, resourceId: id }
        this.#save(id, { ...record, revision, currentKey: key, versions: [...record.versions, { key, source, fingerprint, ...(scope.mode === 'initial' ? {} : { sourceFingerprint: evidence.fingerprint }), variables, revision, operationId, result, parentKey: record.currentKey, configRevision: null }] })
        if (hash(baseline.stat_data) !== hash(variables.stat_data)) this.#emit({ ...fact, phase: 'applied', revision, configRevision: null, detail: 'state-committed' })
        this.#emit({ ...fact, phase: 'completed', revision, configRevision: null, detail: 'state-committed' })
        return cloneMvuReceipt(result)
      } catch (error) {
        const denied = ['MVU_WRITE_DENIED', 'MVU_READ_ONLY', 'MVU_USAGE_DENIED'].includes(error.code)
        this.#emit({ ...fact, phase: denied ? 'skipped' : 'failed', reason: error.code ?? 'MVU_CARD_UPDATE_FAILED' })
        throw error
      }
    })
  }
  async snapshot(scope) {
    let viewIdentity
    let evidence = this.resolveScope ? await this.resolveScope(scope) : null
    if (!evidence && scope.endEventId != null) { const source = this.#sessions.get(scope.sessionId) ?? await this.inspect?.(scope.sessionId); const event = source?.events?.find(e => e.seq === scope.endEventId && e.type === 'assistant/message'); if (event) evidence = { messageId: event.data.message.id, fingerprint: hash(textOf(event.data.message)) } }
    let rows = await this.list({ scope })
    if (scope.mode === 'initial' || scope.mode === 'greeting') {
      if (evidence?.mode !== scope.mode || evidence.checkCurrent?.() !== true) fail('MVU_READ_ONLY', 'Current card scope is no longer current')
      rows = rows.filter(row => this.#cardResourceActive(this.resources.find(r => r.id === row.id), scope))
      if (rows.length !== 1) fail('MVU_AMBIGUOUS', 'Current card scope requires one active resource')
      viewIdentity = evidence.viewIdentity
      evidence = null
    }
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
    return { version: 1, scope: json(scope), ...(viewIdentity ? { viewIdentity: json(viewIdentity) } : {}), revision: row?.revision ?? 0, currentRevision: row?.currentRevision ?? 0, status: row ? 'available' : 'unavailable', variables: row?.content ?? {}, ...(row ? { resourceId: row.id, ...(row.commandProcessor ? { commandProcessor: row.commandProcessor } : {}) } : {}) }
  }
  /** Trusted Host only. This grants a checked dependency read, not proof of model delivery.
   * @param {import('./prompt-dependency.js').MvuPromptDependencyRequest} request
   * @returns {Promise<import('./prompt-dependency.js').MvuPromptDependencyResult|null>}
   */
  async resolvePromptDependency({ id, scope, event, signal } = {}) {
    if (!scope || scope.authority !== 'local' || typeof scope.sessionId !== 'string' || !scope.sessionId
      || Object.keys(scope).some(key => !['authority', 'sessionId'].includes(key))) fail('MVU_SCOPE', 'A current local session scope is required')
    const worldBook = event?.usage === 'world-book-variable' && event.consumer?.adapterId === 'tavern.world-books' && /^world-book:.{1,300}$/.test(event.consumer?.id ?? '')
    const template = event?.usage === 'prompt-template-dependency' && event.consumer?.adapterId === 'tavern.prompt-templates' && /^prompt-template:[A-Za-z0-9_.-]{1,100}$/.test(event.consumer?.id ?? '')
    if (!event || (!worldBook && !template) || typeof event.preview !== 'boolean'
      || Object.keys(event).some(key => !['preview', 'turn', 'step', 'usage', 'consumer'].includes(key))
      || Object.keys(event.consumer).some(key => !['adapterId', 'id'].includes(key))
      || ['turn', 'step'].some(key => event[key] != null && (!Number.isSafeInteger(event[key]) || event[key] < 0))) fail('MVU_SCOPE', 'Trusted template dependency context is required')
    // Detach caller-owned input before any await. Neither a template nor a later caller mutation selects scope.
    scope = json(scope); event = json(event)
    signal?.throwIfAborted()
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    await this.refresh?.(scope.sessionId)
    signal?.throwIfAborted()
    if (this.#disposed) fail('MVU_DISPOSED', 'Service disposed')
    if (worldBook) await this.#ensureInstances(scope.sessionId)
    if (worldBook && id === undefined) {
      const candidates = this.resources.filter(resource => !resource.legacy && !resource.sourceError && resource.sessionIds.some(s => s === '*' || s === scope.sessionId)
        && (!resource.characterId || this.isActive?.(resource, scope.sessionId) === true))
      const instances = candidates.filter(resource => resource.instance?.sessionId === scope.sessionId)
      const selected = instances.length ? instances : candidates
      if (selected.length !== 1) return null
      id = selected[0].id
    }
    const resource = this.#configured(id, scope)
    if (!resource || resource.sourceError || (resource.characterId && this.isActive?.(resource, scope.sessionId) !== true)) return null
    const instanceLease = worldBook ? await this.#sessionLease(scope.sessionId, { allowRequestMetadata: true, readOnly: event.preview })
      : resource.instance ? await this.#sessionLease(resource.instance.sessionId, { readOnly: event.preview }) : null
    const scopeLease = this.capturePromptScope?.(scope, resource)
    if (typeof scopeLease !== 'function' || scopeLease() !== true) return null
    const definition = hash(resource), revision = this.#record(id).revision, usageEpoch = this.#usage.epoch
    const sourceCurrent = () => {
      try {
        return !this.#disposed && !signal?.aborted && this.#usage.epoch === usageEpoch && scopeLease() === true && (!instanceLease || instanceLease() === true)
          && this.#configured(id, scope) === resource && hash(resource) === definition && this.#record(id).revision === revision
          && (!resource.characterId || this.isActive?.(resource, scope.sessionId) === true)
      } catch { return false }
    }
    const row = await this.#snapshot(resource, scope)
    signal?.throwIfAborted()
    if (!sourceCurrent() || row.revision !== revision) return null
    let content = row.content, contentRevision = revision
    if (worldBook && event.turn != null && !event.preview) {
      const session = this.inspect ? await this.inspect(scope.sessionId) : this.#sessions.get(scope.sessionId)
      const start = session?.events?.findLast(e => e.type === 'turn/start')
      if (!start || start.data.turn !== event.turn) return null
      const checkpoint = this.#record(id).checkpoints?.find(c => c.turn === event.turn && (c.sessionId === scope.sessionId || (resource.instance && c.sessionId === undefined)))
      if (!checkpoint) return null
      content = checkpoint.variables; contentRevision = checkpoint.revision
    }
    if (!sourceCurrent()) return null
    const decision = await this.#decision('before_model_request', resource, scope, event, content)
    signal?.throwIfAborted()
    const checkCurrent = () => {
      try { return sourceCurrent() && decision.enabled === true && !decision.abstained && (!decision.decided || decision.checkCurrent?.() === true) }
      catch { return false }
    }
    if (!checkCurrent()) return null
    return { id: resource.id, adapterId: 'tavern.mvu', content: json(content), revision: contentRevision, configRevision: decision.configRevision, checkCurrent }
  }
  async resolveRequest(context) {
    const scope = { sessionId: context.sessionId, authority: 'local' }, blocks = [], diagnostics = [], checks = []
    for (const row of await this.list({ scope, signal: context.signal })) {
      const resource = this.resources.find(r => r.id === row.id)
      const decision = await this.#decision('before_model_request', resource, scope, { preview: context.preview === true, ...(context.turn === undefined ? {} : { turn: context.turn }), ...(context.step === undefined ? {} : { step: context.step }) }, row.content)
      const { enabled, configRevision, usageEpoch } = decision
      context.signal?.throwIfAborted()
      if (usageEpoch !== undefined && usageEpoch !== this.#usage.epoch) fail('MVU_USAGE_CANCELLED', 'Usage provider changed before provide')
      if (enabled) {
        const scopeLease = this.capturePromptScope?.(scope, resource)
        const check = () => decision.executionCurrent() && this.#record(row.id).revision === row.currentRevision && this.resources.includes(resource)
          && (!this.capturePromptScope || (typeof scopeLease === 'function' && scopeLease() === true))
        if (!check()) fail('MVU_USAGE_CANCELLED', 'Request usage lease changed before provide')
        checks.push(check)
        const blockId = `v1-${hash([row.id, row.revision, configRevision, 1])}`
        blocks.push({ type: 'text', id: blockId, role: 'system', name: resource.name ?? row.id, text: `${JSON.stringify(row.content.stat_data)}\n${resource.instructions ?? 'Return variable changes as <JSONPatch>[{"op":"replace","path":"/field","value":0}]</JSONPatch>. Use delta for numeric changes. Output literal values only.'}`, source: { resourceId: row.id, field: 'stat_data' } })
        diagnostics.push({ code: 'MVU_RESOURCE_VERSION', resourceId: row.id, blockId, revision: row.revision, configRevision, strategyRevision: 1 })
      }
    }
    this.#requestChecks.set(context, checks)
    this.validateResolved(context)
    return { blocks, diagnostics }
  }
  validateResolved(context) { if ((this.#requestChecks.get(context) ?? []).some(check => !check())) fail('MVU_USAGE_CANCELLED', 'Request usage lease changed before assembly') }
  observeRequest(options, session) {
    const event = session?.snapshotEvents?.().findLast(e => e.type === 'request/assembly')
    if (!event || event.data.metadata?.owner !== 'pmp-dsh-tavern' || hash(event.data.messages) !== hash(options.messages)) return
    const assembly = event.data.metadata.assembly
    for (const entry of assembly.diagnostics ?? []) {
      if (!['MVU_RESOURCE_VERSION', 'WORLD_BOOK_MVU_VARIABLE_VERSION'].includes(entry.code)) continue
      const worldBook = entry.code === 'WORLD_BOOK_MVU_VARIABLE_VERSION'
      const included = assembly.nodes?.some(node => Number.isSafeInteger(node.start) && Number.isSafeInteger(node.count) && node.count > 0 && node.start >= 0 && node.start + node.count <= options.messages.length && (
        (node.source?.resourceId === (worldBook ? entry.blockResourceId : entry.resourceId) && (!worldBook || node.source?.sourceId === 'worldbook') && node.id.endsWith(`:${entry.blockId}`))
        || node.children?.some(child => child.source?.resourceId === entry.resourceId && child.name === entry.blockId)))
      if (!included) continue
      const fact = { id: entry.resourceId, eventId: `${session.id}:${event.seq}:${entry.blockId}`, requestId: `${session.id}:${event.seq}`, sessionId: session.id, turn: event.data.turn, turnKind: 'unknown', revision: entry.revision, configRevision: entry.configRevision, detail: 'dsh-request-observed' }
      for (const phase of ['started', 'triggered', 'applied', 'completed']) this.#emit({ ...fact, phase })
    }
  }
  dispose() { this.#disposed = true; for (const entry of this.#processors.values()) entry.dispose(); this.#listeners.clear(); this.#usage.dispose(); this.#cardBindings.clear(); for (const pending of this.#cardCreations.values()) pending.cancelled = true }
}
