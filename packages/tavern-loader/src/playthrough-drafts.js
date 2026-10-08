import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'
import { httpError } from '../../play/src/http.js'
import { parseCatalogJson, validatePlayDocument } from '../../play/src/timeline.js'
import { isPlaythroughArchived } from '../../play/src/playthrough-state.js'
import { validateTemplateSelection } from '../../session-template/src/model.js'
import { createCharacterCardResource } from '../../character/src/resource.js'
import { applyMvuGreetingInitialization } from '../../mvu-adapter/src/greeting-initialization.js'
import { mvuResourceFromCharacter } from '../../mvu-adapter/src/character.js'
import { compileMvuSchema, applyMvuSchema } from '../../mvu-adapter/src/schema.js'
import { applyMvuUpdate, normalizeVariables, parseMvuUpdate } from '../../mvu-adapter/src/updates.js'
import { commandHookSourceFromCharacter } from '../../mvu-adapter/src/command-hook-declaration.js'
import { createCommandProcessor } from '../../mvu-adapter/src/command-processor.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = (code, message, status = 409) => { throw httpError(status, message, code) }
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)
const copy = structuredClone

/** Plugin-owned openings. No draft identity is passed to a DSH Session API. */
export class PlaythroughDrafts {
  constructor({ storageDir, workspace, characters, configurations, selections, assembly, mvu, controller, workspaces, agents, renderingAuthority, reconcileRp, releaseRp, previewAssembly, onError = () => {} }) {
    Object.assign(this, { workspace, characters, configurations, selections, assembly, mvu, controller, workspaces, agents, renderingAuthority, reconcileRp, releaseRp, previewAssembly, onError })
    this.path = join(storageDir, 'playthrough-drafts.json')
    this.state = existsSync(this.path) ? readJsonFile(this.path, 32 * 1024 * 1024) : { version: 1, records: {} }
    if (this.state.version !== 1 || !this.state.records || typeof this.state.records !== 'object' || Array.isArray(this.state.records)) throw Error('Invalid playthrough draft storage')
    this.cancellations = new Map(); this.tasks = new Map(); this.admissions = new Map(); this.bindings = new Map(); this.pendingBindings = new Map(); this.processors = new Map(); this.disposed = false
  }
  persist() { if (this.disposed) fail('PLAY_DRAFT_DISPOSED', 'Draft service stopped'); atomicJson(this.path, this.state, 32 * 1024 * 1024) }
  catalog() {
    try { const file = this.workspace.readFile('catalog.json'); return { value: parseCatalogJson(file.content), revision: file.revision } }
    catch (error) { if (error.code !== 'PLAY_PATH_NOT_FOUND') throw error; return { value: { playthroughs: [] }, revision: null } }
  }
  saveCatalog(value, revision) { return this.workspace.writeFile('catalog.json', JSON.stringify(value), { validate: validatePlayDocument, expectedRevision: revision, expectedRevisionPresent: true }) }
  record(id) {
    if (this.disposed) fail('PLAY_DRAFT_DISPOSED', 'Draft service stopped')
    if (!safeId(id)) fail('PLAY_DRAFT_INVALID', 'Invalid draft identity', 400)
    const record = this.state.records[id], binding = this.workspace.get()
    if (!record || record.id !== id || record.rootPath !== binding.rootPath) fail('PLAY_DRAFT_NOT_FOUND', 'Draft does not belong to this workspace', 404)
    const playthrough = this.catalog().value.playthroughs.find(row => row.id === id && row.path === record.path && row.ext?.pmpDshTavern?.draftId === id)
    if (!playthrough || playthrough.ext.pmpDshTavern.characterId !== record.selection.characterCardId) fail('PLAY_DRAFT_NOT_FOUND', 'Draft playthrough reference changed', 404)
    if (isPlaythroughArchived(playthrough)) fail('PLAY_DRAFT_ARCHIVED', 'This playthrough is archived')
    if (playthrough.ext.pmpDshTavern.rootSessionId && playthrough.ext.pmpDshTavern.rootSessionId !== record.claim?.sessionId) fail('PLAY_DRAFT_IDENTITY_CHANGED', 'Playthrough session identity changed')
    return record
  }
  validateSelection(selection) {
    const normalized = validateTemplateSelection(selection), diagnostics = this.configurations.diagnostics(normalized)
    if (!normalized.characterCardId || diagnostics.length) fail('PLAY_DRAFT_CONFIGURATION_UNAVAILABLE', diagnostics[0]?.message ?? 'A character card is required')
    return normalized
  }
  initial(character, greetingIndex = 0) {
    let resource
    try { resource = mvuResourceFromCharacter(character, {}) } catch (error) { if (error.code === 'MVU_INITIALIZATION_MISSING') return null; throw error }
    let initial = resource.initial
    if (resource.schemaSource) {
      const definition = compileMvuSchema(resource.schemaSource)
      initial = { ...initial, stat_data: applyMvuSchema(initial.stat_data, definition), mvu_schema: definition, schema: { type: 'object', properties: {}, extensible: true, strictSet: true } }
    }
    const greeting = createCharacterCardResource(character, { characterCardId: character.id, character: { greetingIndex } }).greeting
    return applyMvuGreetingInitialization(normalizeVariables(initial), greeting.text)
  }
  create({ characterId, source, selection, assemblyPresetId } = {}) {
    const binding = this.workspace.get()
    if (!binding.rootPath) fail('PLAY_WORKSPACE_UNBOUND', 'Select an RP workspace first')
    let value = selection ?? (source ? this.configurations.preview(source).selection : this.selections.get(null))
    if (characterId) value = { ...value, characterCardId: characterId, character: value.characterCardId === characterId ? value.character : { greetingIndex: 0 } }
    value = this.validateSelection(value)
    const character = this.characters.get(value.characterCardId), id = `playthrough-${randomUUID()}`, directory = `${value.characterCardId}/${id}`
    const { value: catalog, revision } = this.catalog()
    let number = 0, ordinal = 0
    for (const row of catalog.playthroughs) if (row.ext?.pmpDshTavern?.characterId === value.characterCardId) { ordinal++; number = Math.max(number, row.ext.pmpDshTavern.playthroughNumber ?? ordinal) }
    const preset = assemblyPresetId !== undefined ? (assemblyPresetId === null ? null : this.assembly.get(assemblyPresetId))
      : source?.mode === 'current' ? this.assembly.selection(source.sessionId) : this.assembly.get(this.assembly.defaultPresetId ?? 'builtin-native-slots')
    const record = { id, path: `${directory}/timeline.json`, rootPath: binding.rootPath, selection: value, assembly: preset, characterHash: hash(character), variables: this.initial(character, value.character.greetingIndex ?? 0), revision: 0, variableRevision: 0, phase: 'draft', claim: null, receipts: [] }
    record.greetingVariables = { [value.character.greetingIndex ?? 0]: copy(record.variables) }
    this.workspace.writeFile(record.path, JSON.stringify({ nodes: [] }), { validate: validatePlayDocument, expectedRevision: null, expectedRevisionPresent: true })
    this.state.records[id] = record; this.persist()
    const playthrough = { id, path: record.path, title: `${number + 1}周目`, lastOpenedAt: new Date().toISOString(), ext: { pmpDshTavern: { characterId: value.characterCardId, characterName: character.name, ...(character.sha256 ? { characterSha256: character.sha256 } : {}), draftId: id, playthroughNumber: number + 1, autoTitle: true } } }
    this.saveCatalog({ ...catalog, playthroughs: [...catalog.playthroughs, playthrough] }, revision)
    return { draft: copy(record), playthrough, sessionId: null }
  }
  async read(id) {
    const record = this.record(id)
    if (record.claim && (record.phase !== 'started' || !record.claim.published)) {
      let inspection
      try { inspection = await this.controller.inspect(record.claim.sessionId) } catch (error) { if (error.code !== 'session/not-found') throw error }
      if (inspection?.events) await this.finish(record, inspection.events)
    }
    return { draft: copy(record), playthrough: this.catalog().value.playthroughs.find(row => row.id === id) }
  }
  async preview(id, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['expectedRevision', 'preset'].includes(key))) fail('PLAY_DRAFT_INVALID', 'Unsupported preview field', 400)
    const { expectedRevision, preset } = options
    const record = this.record(id)
    if (record.phase !== 'draft') fail('PLAY_DRAFT_LOCKED', 'Opening preview requires an unstarted draft')
    if (record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'Draft changed before preview')
    this.validateSelection(record.selection); this.currentCharacter(record)
    const result = await this.previewAssembly(copy(record), preset ?? record.assembly)
    if (this.record(id) !== record || record.revision !== expectedRevision || record.phase !== 'draft') fail('REVISION_CONFLICT', 'Draft changed during preview')
    this.currentCharacter(record)
    return { ...result, scope: 'opening-draft', draftId: id, draftRevision: record.revision, pendingInputsIncluded: false }
  }
  currentCharacter(record) {
    const character = this.characters.get(record.selection.characterCardId)
    if (hash(character) !== record.characterHash) fail('PLAY_DRAFT_CHARACTER_CHANGED', 'The character changed; reload its initial variables explicitly before sending')
    return character
  }
  update(id, patch) {
    const record = this.record(id)
    if (record.phase !== 'draft') fail('PLAY_DRAFT_LOCKED', 'First send is already being prepared; retry the same input')
    if (!patch || Object.keys(patch).some(key => !['expectedRevision', 'selection', 'assemblyPresetId', 'variables', 'importContextRef', 'resetVariables'].includes(key))) fail('PLAY_DRAFT_INVALID', 'Unsupported draft field', 400)
    if (patch.expectedRevision !== record.revision) fail('REVISION_CONFLICT', 'Draft changed in another view')
    const next = copy(record), previousGreeting = record.selection.character.greetingIndex ?? 0
    next.greetingVariables ??= {}
    next.greetingVariables[previousGreeting] = copy(record.variables)
    if (patch.selection) { next.selection = this.validateSelection(patch.selection); if (next.selection.characterCardId !== record.selection.characterCardId) fail('PLAY_DRAFT_INVALID', 'Start a new playthrough to change its character', 400) }
    if (Object.hasOwn(patch, 'assemblyPresetId')) next.assembly = patch.assemblyPresetId === null ? null : this.assembly.get(patch.assemblyPresetId)
    const greetingIndex = next.selection.character.greetingIndex ?? 0
    if (patch.resetVariables === true) { const character = this.characters.get(record.selection.characterCardId); next.variables = this.initial(character, greetingIndex); if (hash(character) !== record.characterHash) next.greetingVariables = {}; next.characterHash = hash(character); next.variableRevision++ }
    else {
      const character = this.currentCharacter(record)
      if (greetingIndex !== previousGreeting) { next.variables = Object.hasOwn(next.greetingVariables, greetingIndex) ? copy(next.greetingVariables[greetingIndex]) : this.initial(character, greetingIndex); next.variableRevision++ }
    }
    if (Object.hasOwn(patch, 'variables')) { next.variables = this.replaceVariables(next.variables, patch.variables); next.variableRevision++ }
    if (Object.hasOwn(patch, 'importContextRef')) {
      if (patch.importContextRef === null) delete next.importContextRef
      else { const prepared = this.prepareImport(patch.importContextRef); next.importContextRef = { path: prepared.path } }
    }
    next.greetingVariables[greetingIndex] = copy(next.variables)
    next.revision++; this.state.records[id] = next; this.persist()
    return { draft: copy(next), playthrough: this.catalog().value.playthroughs.find(row => row.id === id) }
  }
  replaceVariables(baseline, value) {
    if (!baseline || !value || typeof value !== 'object' || Array.isArray(value)) fail('MVU_SCOPE', 'This draft has no editable MVU source', 400)
    let variables = normalizeVariables({ ...value, schema: baseline.schema, ...(baseline.mvu_schema ? { mvu_schema: baseline.mvu_schema } : {}) })
    if (!baseline.mvu_schema) delete variables.mvu_schema
    if (baseline.mvu_schema) { variables.stat_data = applyMvuSchema(variables.stat_data, baseline.mvu_schema); variables.display_data = copy(variables.stat_data) }
    return variables
  }
  prepareImport(reference) { return this.importContexts.prepare(reference) }
  scopeRecord(scope) {
    if (scope?.mode !== 'draft' || Object.keys(scope).some(key => !['mode', 'playthroughId', 'characterId', 'greetingIndex', 'selectionToken'].includes(key))) fail('MVU_SCOPE', 'Invalid draft scope', 400)
    const record = this.record(scope.playthroughId)
    if (record.phase !== 'draft' || record.selection.characterCardId !== scope.characterId || (record.selection.character.greetingIndex ?? 0) !== scope.greetingIndex) fail('MVU_READ_ONLY', 'Opening draft selection changed', 403)
    this.currentCharacter(record)
    if (scope.selectionToken !== undefined && scope.selectionToken !== this.selectionToken(record)) fail('MVU_READ_ONLY', 'Opening draft selection token changed', 403)
    return record
  }
  selectionToken(record) { return hash({ id: record.id, rootPath: record.rootPath, selection: record.selection, characterHash: record.characterHash }) }
  async snapshot(scope) {
    const record = this.scopeRecord(scope), character = this.currentCharacter(record)
    const source = commandHookSourceFromCharacter(character)
    let commandProcessor
    if (source) {
      const key = hash(source)
      let pending = this.processors.get(key)
      if (!pending) { pending = createCommandProcessor(source).then(processor => ({ processor, receipt: { protocolVersion: 1, registered: true, registrationId: randomUUID(), source, sha256: createHash('sha256').update(source).digest('hex'), listenerCount: processor.listenerCount } })); this.processors.set(key, pending); pending.catch(() => this.processors.delete(key)) }
      commandProcessor = (await pending).receipt
    }
    // A source/schema reload while an interpreter initializes invalidates this read.
    if (this.scopeRecord(scope) !== record) fail('MVU_READ_ONLY', 'Draft changed during snapshot', 403)
    return { version: 1, scope: copy(scope), revision: record.variableRevision, currentRevision: record.variableRevision, status: record.variables ? 'available' : 'unavailable', variables: copy(record.variables ?? {}), resourceId: `mvu:draft-${record.id}`, viewIdentity: { greetingIndex: scope.greetingIndex, selectionToken: this.selectionToken(record) }, ...(commandProcessor ? { commandProcessor } : {}) }
  }
  async createCardBinding({ scope, grantId, sourceIdentity, bindingId, signal }) {
    signal?.throwIfAborted()
    const record = this.scopeRecord(scope), authority = await this.renderingAuthority.resolve({ grantId, sourceIdentity })
    if (!scope.selectionToken || !authority?.valid || !authority.write || hash(authority.scope) !== hash(scope)) fail('MVU_WRITE_DENIED', 'Exact downloaded source execution required', 403)
    if (typeof bindingId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(bindingId)) fail('MVU_SCOPE', 'Invalid binding identity', 400)
    const key = `draft:${bindingId}`, value = { scope: copy(scope), grantId, sourceIdentity: copy(sourceIdentity) }, existing = this.bindings.get(key)
    if (existing && hash(existing) !== hash(value)) fail('MVU_IDEMPOTENCY_CONFLICT', 'Binding identity changed')
    if (new Set([...this.bindings.keys(), ...this.pendingBindings.keys()]).size >= 128 && !existing && !this.pendingBindings.has(key)) fail('MVU_LIMIT', 'Too many draft card bindings', 400)
    const pending = this.pendingBindings.get(key) ?? { cancelled: false, count: 0, fingerprint: hash(value) }
    if (pending.fingerprint !== hash(value)) fail('MVU_IDEMPOTENCY_CONFLICT', 'Binding identity changed')
    pending.count++; this.pendingBindings.set(key, pending)
    try {
      const snapshot = await this.snapshot(scope)
      signal?.throwIfAborted()
      if (pending.cancelled || record !== this.scopeRecord(scope) || !this.renderingAuthority.isCurrent({ grantId, sourceIdentity })) fail('MVU_WRITE_DENIED', 'Source execution changed', 403)
      this.bindings.set(key, value)
      return { capability: bindingId, snapshot }
    } finally { if (--pending.count === 0) this.pendingBindings.delete(key) }
  }
  ownsBinding(capability) { return this.bindings.has(`draft:${capability}`) }
  revokeCardBinding(capability) { const key = `draft:${capability}`; this.bindings.delete(key); const pending = this.pendingBindings.get(key); if (pending) pending.cancelled = true }
  async cardWrite({ capability, operation, value, expectedRevision, operationId, cause, signal }) {
    const binding = this.bindings.get(`draft:${capability}`)
    if (!binding || !this.renderingAuthority.isCurrent(binding)) fail('MVU_WRITE_DENIED', 'Draft source execution stopped', 403)
    signal?.throwIfAborted()
    const record = this.scopeRecord(binding.scope)
    if (!['patch', 'replace'].includes(operation) || !['user-interaction', 'script', 'interval'].includes(cause) || !safeId(operationId) || !Number.isSafeInteger(expectedRevision)) fail('MVU_OPERATION', 'Invalid variable update', 400)
    const fingerprint = hash({ operation, value, expectedRevision, operationId, cause, sourceIdentity: binding.sourceIdentity })
    const previous = record.receipts.find(row => row.operationId === operationId)
    if (previous) { if (previous.fingerprint !== fingerprint) fail('MVU_IDEMPOTENCY_CONFLICT', 'Operation identity changed'); return copy(previous.result) }
    if (record.variableRevision !== expectedRevision) fail('REVISION_CONFLICT', 'Draft variables changed')
    if (record.receipts.length >= 512) fail('MVU_LIMIT', 'Draft variable operation limit reached', 400)
    const variables = operation === 'replace' ? this.replaceVariables(record.variables, value) : applyMvuUpdate(record.variables, parseMvuUpdate(`<JSONPatch>${JSON.stringify(value)}</JSONPatch>`))
    const next = copy(record); next.variables = variables; next.greetingVariables ??= {}; next.greetingVariables[record.selection.character.greetingIndex ?? 0] = copy(variables); next.variableRevision++; next.revision++
    const result = { version: 1, scope: copy(binding.scope), revision: next.variableRevision, currentRevision: next.variableRevision, status: 'available', variables: copy(variables), resourceId: `mvu:draft-${record.id}` }
    next.receipts.push({ operationId, fingerprint, result }); this.state.records[record.id] = next; this.persist()
    return result
  }
  materialize(id, { expectedRevision, operationId, text, signal } = {}) {
    if (!safeId(operationId) || typeof text !== 'string' || !text.trim() || text.length > 64000) fail('PLAY_DRAFT_INPUT_INVALID', 'First input must be non-empty text', 400)
    const record = this.record(id)
    if (record.claim && (record.claim.operationId !== operationId || record.claim.text !== text)) fail('PLAY_DRAFT_CLAIM_CONFLICT', 'Another first input owns this draft; reopen it to retry that input')
    if (!record.claim && record.revision !== expectedRevision) fail('REVISION_CONFLICT', 'Draft changed before first send')
    const pending = this.tasks.get(id)
    if (pending) return pending
    const work = this.prepare(record, { operationId, text, signal })
    this.tasks.set(id, work); work.finally(() => { if (this.tasks.get(id) === work) this.tasks.delete(id) }).catch(() => {})
    return work
  }
  async prepare(record, { operationId, text, signal }) {
    if (record.phase === 'started') { await this.finish(record); return { sessionId: record.claim.sessionId, requestId: record.claim.requestId, accepted: true } }
    signal?.throwIfAborted(); this.validateSelection(record.selection); this.currentCharacter(record)
    if (typeof this.workspaces?.archiveSession !== 'function' || typeof this.workspaces?.unarchiveSession !== 'function' || typeof this.assembly?.applySnapshot !== 'function') fail('PLAY_DRAFT_HOST_UNAVAILABLE', 'Draft preparation requires public archive and assembly snapshot APIs', 501)
    if (!record.claim) { record.claim = { operationId, sessionId: `session-${randomUUID()}`, requestId: randomUUID(), text, step: 'reserved' }; record.phase = 'preparing'; record.revision++; this.persist() }
    const claim = record.claim
    const binding = this.workspace.get()
    await this.controller.create({ sessionId: claim.sessionId, ...(binding.workspaceId ? { workspaceId: binding.workspaceId } : { cwd: record.rootPath }) })
    this.record(record.id)
    const inspection = await this.controller.inspect(claim.sessionId)
    if (await this.finish(record, inspection.events)) return { sessionId: claim.sessionId, requestId: claim.requestId, accepted: true }
    if ((inspection.events ?? []).some(event => ['turn/start', 'user/message'].includes(event.type))) fail('PLAY_DRAFT_SESSION_OCCUPIED', 'Prepared session contains a different conversation; it will not be rebound')
    await this.workspaces.archiveSession({ sessionId: claim.sessionId })
    this.record(record.id)
    // Archive precedes attaching any Tavern resource. Failures leave a visible
    // draft retry path and a durable native archive marker, never a reusable RP blank.
    this.selections.set(claim.sessionId, record.selection); this.reconcileRp(claim.sessionId)
    await this.mvu.flush()
    this.record(record.id)
    if (record.variables && !claim.variablesDone) {
      const row = (await this.mvu.list({ scope: { sessionId: claim.sessionId } })).find(row => row.source?.characterId === record.selection.characterCardId)
      if (!row) fail('PLAY_DRAFT_MVU_UNAVAILABLE', 'Character MVU instance is unavailable')
      if (claim.transferRevision === undefined) { claim.transferRevision = row.revision; this.persist() }
      // Transfer editable data, never the draft's interpreter descriptor.
      const content = copy(record.variables); delete content.mvu_schema; delete content.schema
      await this.mvu.update({ id: row.id, scope: { sessionId: claim.sessionId }, content, expectedRevision: claim.transferRevision, operationId: `draft-transfer:${record.id}` })
      this.record(record.id)
      claim.variablesDone = true; this.persist()
    }
    this.assembly.applySnapshot(claim.sessionId, record.assembly)
    if (record.importContextRef) this.importContexts.bind(claim.sessionId, this.prepareImport(record.importContextRef))
    claim.step = 'prepared'; this.persist()
    // An aborted view must not start a model request. Preparation is resumable.
    signal?.throwIfAborted()
    if (claim.cancelled) fail('PLAY_DRAFT_PREPARATION_CANCELLED', 'First send preparation cancelled')
    return { sessionId: claim.sessionId, requestId: claim.requestId, accepted: false }
  }
  beforePrompt({ sessionId, text, requestId }) {
    const record = Object.values(this.state.records).find(record => record.claim?.sessionId === sessionId)
    if (!record) return
    if (record.phase === 'started') { if (requestId === record.claim.requestId && text !== record.claim.text) fail('PLAY_DRAFT_INPUT_CHANGED', 'First request input changed'); return }
    this.record(record.id)
    if (record.claim.cancelled || record.claim.step !== 'prepared' || record.claim.text !== text || record.claim.requestId !== requestId) fail('PLAY_DRAFT_INPUT_CHANGED', 'Prepared first input identity does not match')
  }
  async admitPrompt(input, admit) {
    this.beforePrompt(input)
    const record = Object.values(this.state.records).find(record => record.claim?.sessionId === input.sessionId && record.phase !== 'started')
    if (!record) return admit()
    const existing = this.admissions.get(record.id)
    if (existing) return existing
    // Register before calling the asynchronous public controller. Cancellation
    // waits for admission to settle before deciding whether the blank is reusable.
    const work = Promise.resolve().then(() => { this.beforePrompt(input); return admit() }).then(() => this.accepted(input.sessionId))
    this.admissions.set(record.id, work)
    try { return await work } finally { if (this.admissions.get(record.id) === work) this.admissions.delete(record.id) }
  }
  async finish(record, events) {
    const claim = record.claim
    if (record.phase === 'started') {
      if (!claim.published) { await this.workspaces.unarchiveSession({ sessionId: claim.sessionId }); claim.published = true; this.persist() }
      return true
    }
    if (!claim || !events?.some(event => event.type === 'turn/start')) return false
    const agent = this.agents?.get?.(claim.sessionId)
    const messages = [...(agent?.inbox?.nextTurn ?? []), ...(agent?.inbox?.nextStep ?? []), ...events.filter(event => event.type === 'user/message').map(event => event.data?.message ?? event.data)]
    if (!messages.some(message => message.source?.rpcId === claim.requestId && message.content?.some(part => part.type === 'text' && part.text === claim.text))) return false
    const { value: catalog, revision } = this.catalog()
    const row = catalog.playthroughs.find(row => row.id === record.id && row.ext?.pmpDshTavern?.draftId === record.id)
    if (!row || record.rootPath !== this.workspace.get().rootPath) fail('PLAY_DRAFT_IDENTITY_CHANGED', 'Draft workspace changed during first send')
    if (row.ext.pmpDshTavern.rootSessionId && row.ext.pmpDshTavern.rootSessionId !== claim.sessionId) fail('PLAY_DRAFT_IDENTITY_CHANGED', 'Draft root changed during first send')
    this.saveCatalog({ ...catalog, playthroughs: catalog.playthroughs.map(item => item.id === row.id ? { ...item, ext: { ...item.ext, pmpDshTavern: { ...item.ext.pmpDshTavern, rootSessionId: claim.sessionId } } } : item) }, revision)
    // State commits synchronously before yielding to the public archive command.
    record.phase = 'started'; claim.step = 'accepted'; record.revision++; this.persist()
    await this.workspaces.unarchiveSession({ sessionId: claim.sessionId })
    claim.published = true; this.persist()
    try { await this.controller.rename({ sessionId: claim.sessionId, title: `${this.characters.get(record.selection.characterCardId).name} · ${row.title}` }) } catch (error) { this.onError(error) }
    return true
  }
  observe(session, event) {
    if (event.type !== 'turn/start') return
    const record = Object.values(this.state.records).find(record => record.claim?.sessionId === session.id && record.phase !== 'started')
    if (record) void this.finish(record, session.snapshotEvents()).catch(this.onError)
  }
  async beforeStep(agent) {
    const record = Object.values(this.state.records).find(record => record.claim?.sessionId === agent?.id)
    if (record && record.claim && (!record.claim.published || record.phase !== 'started')) await this.finish(record, agent.session.snapshotEvents())
  }
  async accepted(sessionId) {
    const record = Object.values(this.state.records).find(record => record.claim?.sessionId === sessionId)
    if (record) { await this.finish(record, (await this.controller.inspect(sessionId)).events); if (record.claim?.cancelled) this.controller.cancel({ sessionId }) }
  }
  cancel(id) {
    const pending = this.cancellations.get(id)
    if (pending) return pending
    const work = this.rollback(id)
    this.cancellations.set(id, work)
    work.finally(() => { if (this.cancellations.get(id) === work) this.cancellations.delete(id) }).catch(() => {})
    return work
  }
  async rollback(id) {
    let record = this.record(id)
    if (!record.claim) return { draft: copy(record), sessionId: null }
    record.claim.cancelled = true; this.persist()
    await this.tasks.get(id)?.catch(() => {})
    await this.admissions.get(id)?.catch(() => {})
    record = this.record(id)
    const sessionId = record.claim.sessionId
    let inspection
    try { inspection = await this.controller.inspect(sessionId) } catch (error) { if (error.code !== 'session/not-found') throw error }
    if (await this.finish(record, inspection?.events)) { this.controller.cancel({ sessionId }); return { draft: copy(record), sessionId } }
    const agent = this.agents?.get?.(sessionId)
    if ((agent?.inbox?.nextTurn?.length ?? 0) || (agent?.inbox?.nextStep?.length ?? 0) || inspection?.events?.some(event => ['turn/start', 'user/message'].includes(event.type))) fail('PLAY_DRAFT_SESSION_OCCUPIED', 'Input is already admitted; keep the native conversation')
    if (inspection) {
      this.releaseRp?.(sessionId)
      this.selections.set(sessionId, { presetId: null, userId: null, characterCardId: null, worldBookIds: [], character: {}, rp: { active: false, followSuppressed: true } })
      this.assembly.applySnapshot(sessionId, null); this.importContexts.unbind(sessionId)
      await this.workspaces.unarchiveSession({ sessionId })
    }
    record.lastInput = record.claim.text
    record.claim = null; record.phase = 'draft'; record.revision++; this.persist()
    return { draft: copy(record), sessionId: null }
  }
  dispose() { this.disposed = true; this.bindings.clear(); for (const pending of this.pendingBindings.values()) pending.cancelled = true; for (const promise of this.processors.values()) void promise.then(value => value.processor.dispose(), () => {}); this.processors.clear() }
}
