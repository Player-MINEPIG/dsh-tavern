import { join } from 'node:path'
import { renderTemplate } from './runtime.js'
import { inspectTemplateMetadata } from './metadata.js'
import { SourcePolicy, atomicJson, readJson, hash, fail, localScope, validateConfig, optionCatalog } from '../memory-sources/policy.js'
import { boundScope, boundSnapshot } from '../memory-sources/bound-metadata.js'
export const TEMPLATE_SOURCE = 'pmp-dsh-tavern/prompt-template'
const idPattern = /^prompt-template:[a-zA-Z0-9_.-]{1,100}$/
function normalize(resource) {
  if (!resource || !idPattern.test(resource.id) || typeof resource.name !== 'string' || resource.name.length > 200 || typeof resource.content !== 'string' || resource.content.length > 131072) fail('VALIDATION_FAILED', 'Template requires stable prompt-template ID, name and bounded content')
  if (resource.enabled === true && !inspectTemplateMetadata(resource).supported) fail('UNSUPPORTED_EVENT', 'Template metadata requests unsupported semantics')
  if (!Array.isArray(resource.sessionIds) || !resource.sessionIds.length || resource.sessionIds.some(id => typeof id !== 'string' || !id)) fail('VALIDATION_FAILED', 'Template requires explicit sessionIds (or *)')
  if (resource.variableResourceId !== undefined && (typeof resource.variableResourceId !== 'string' || !resource.variableResourceId.startsWith('mvu:'))) fail('VALIDATION_FAILED', 'Expected MVU variableResourceId')
  return { id: resource.id, name: resource.name, content: resource.content, enabled: resource.enabled === true, sessionIds: [...new Set(resource.sessionIds)], variables: structuredClone(resource.variables ?? {}), ...(resource.variableResourceId ? { variableResourceId: resource.variableResourceId } : {}) }
}
export class PromptTemplateService {
  #checks = new WeakMap()
  #boundDisposed = false
  id = 'tavern.prompt-templates'; name = '提示词模板 / Prompt templates'; authority = 'local'; strategyOwner = 'source'
  optionCatalog = optionCatalog('prompt-template', '隔离只读模板展开 / Isolated read-only expansion', 'tavern.prompt-template')
  constructor({ storageDir, resources = [], resolveVariables, worldBooks }) {
    this.path = join(storageDir, 'prompt-templates.json')
    const stored = readJson(this.path, null)
    this.state = stored ?? { version: 1, resources: resources.map(normalize), operations: [] }
    if (this.state.version !== 1 || !Array.isArray(this.state.resources) || new Set(this.state.resources.map(r => r.id)).size !== this.state.resources.length) fail('VALIDATION_FAILED', 'Invalid template resource file')
    this.state.resources = this.state.resources.map(normalize)
    if (!Array.isArray(this.state.operations)) fail('VALIDATION_FAILED', 'Invalid template operations')
    if (!stored) atomicJson(this.path, this.state)
    this.policy = new SourcePolicy(join(storageDir, 'prompt-template-ownership.json'), 'prompt-template')
    this.resolveVariables = resolveVariables; this.worldBooks = worldBooks
  }
  observe = listener => this.policy.observe(listener)
  registerUsage = (listener, options) => this.policy.registerUsage(listener, options)
  getManagementDefaults({ id, scope = {} } = {}) {
    scope = structuredClone(scope)
    const resource = this.#definition(id, scope)
    return resource ? this.policy.defaults(id, () => !this.#boundDisposed && this.#definition(id, scope) === resource) : null
  }
  validateConfig = config => validateConfig('prompt-template', config)
  #definition(id, scope = {}) {
    localScope(scope)
    const resource = this.state.resources.find(r => r.id === id)
    if (!resource) return null
    if (scope.sessionId && !resource.sessionIds.some(s => s === '*' || s === scope.sessionId)) fail('FORBIDDEN', 'Template not bound to this session')
    return resource
  }
  read({ id, scope, signal } = {}) {
    signal?.throwIfAborted()
    const resource = this.#definition(id, scope)
    return resource ? { id, name: resource.name, type: 'prompt-template', authority: 'local', content: resource.content, revision: this.policy.revision(id, resource), managementMode: this.policy.mode(id), storedManagementMode: this.policy.storedMode(id), enabled: resource.enabled, metadata: inspectTemplateMetadata({name:resource.name,content:resource.content}),
      execution: { owner: 'source', event: 'before_model_request', sourceId: TEMPLATE_SOURCE, isolation: 'quickjs', sideEffects: false, requiresAssemblySelection: true } } : null
  }
  list({ scope = {}, signal } = {}) {
    localScope(scope)
    return this.state.resources.filter(r => !scope.sessionId || r.sessionIds.includes('*') || r.sessionIds.includes(scope.sessionId)).map(r => this.read({ id: r.id, scope, signal }))
  }
  listBound({ scope, signal } = {}) {
    scope = boundScope(scope); signal?.throwIfAborted()
    if (this.#boundDisposed) fail('SOURCE_UNAVAILABLE', 'Template source is unloaded')
    const rows = this.state.resources.filter(r => r.sessionIds.includes('*') || r.sessionIds.includes(scope.sessionId)).map(resource => ({
      id: resource.id, adapterId: this.id, name: resource.name, type: 'prompt-template', revision: this.policy.revision(resource.id, resource), managementMode: this.policy.mode(resource.id), enabled: resource.enabled,
      binding: { sessionId: scope.sessionId, kind: resource.sessionIds.includes('*') ? 'all-sessions' : 'session' } }))
    const revision = hash(rows), lifecycle = this.policy.captureLifecycle(), checkCurrent = () => {
      try { return !this.#boundDisposed && lifecycle() && hash(this.state.resources.filter(r => r.sessionIds.includes('*') || r.sessionIds.includes(scope.sessionId)).map(resource => ({
        id: resource.id, adapterId: this.id, name: resource.name, type: 'prompt-template', revision: this.policy.revision(resource.id, resource), managementMode: this.policy.mode(resource.id), enabled: resource.enabled,
        binding: { sessionId: scope.sessionId, kind: resource.sessionIds.includes('*') ? 'all-sessions' : 'session' } }))) === revision } catch { return false }
    }
    return boundSnapshot(rows, revision, checkCurrent)
  }
  update({ id, scope, signal, content, expectedRevision, operationId }) {
    signal?.throwIfAborted()
    const current = this.#definition(id, scope)
    if (!current) fail('NOT_FOUND', 'Template not found')
    if (typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('VALIDATION_FAILED', 'operationId required')
    const fingerprint = hash({ id, content, expectedRevision, scope: scope ?? {} })
    const prior = this.state.operations.find(op => op.id === operationId)
    if (prior) { if (prior.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'Operation ID reused'); return structuredClone(prior.result) }
    if (this.policy.revision(id, current) !== expectedRevision) fail('REVISION_CONFLICT', 'Template revision changed')
    const next = normalize({ ...current, content }), result = { ...this.read({ id, scope }), content, revision: this.policy.revision(id, next) }
    const state = { ...this.state, resources: this.state.resources.map(r => r.id === id ? next : r), operations: [...this.state.operations, { id: operationId, fingerprint, result }] }
    atomicJson(this.path, state); this.state = state
    return structuredClone(result)
  }
  copy({ id, newId, scope, signal }) {
    signal?.throwIfAborted()
    const resource = this.#definition(id, scope)
    if (!resource) fail('NOT_FOUND', 'Template not found')
    if (!idPattern.test(newId) || this.#definition(newId)) fail('VALIDATION_FAILED', 'Copy requires an unused prompt-template ID')
    // Copies start disabled, and never silently transfer managed execution rights.
    const state = { ...this.state, resources: [...this.state.resources, { ...resource, id: newId, enabled: false }] }
    atomicJson(this.path, state); this.state = state
    return this.read({ id: newId, scope })
  }
  setManagementMode(args) {
    const resource = this.#definition(args.id, args.scope)
    if (!resource) fail('NOT_FOUND', 'Template not found')
    this.policy.setMode(args, resource)
    return this.read(args)
  }
  validateResolved = context => { if ([...(this.#checks.get(context)?.values() ?? [])].flat().some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'Template policy changed before assembly') }
  #captureChecks(context, key, checks) {
    const captured = this.#checks.get(context) ?? new Map()
    captured.set(key, checks); this.#checks.set(context, captured)
  }
  hasModule({ sessionId } = {}) {
    return !!sessionId && !this.#boundDisposed && this.state.resources.some(r => r.enabled && r.sessionIds.some(id => id === '*' || id === sessionId) && inspectTemplateMetadata(r).supported)
  }
  async parseText(context, rule) {
    if (!context.sessionId) fail('TEMPLATE_SESSION_REQUIRED', 'Template text requires a session')
    const checks = [], blocks = [], diagnostics = []
    const definition = { content: rule.text, variables: context.assets.context ?? {} }
    const row = { id: 'text:' + rule.id, name: rule.name || 'Template text', revision: hash(rule.text) }
    const decision = { enabled: true, configRevision: null, checkCurrent: () => !this.#boundDisposed }
    await this.#renderText(context, definition, row, decision, checks, blocks, diagnostics)
    for (const block of blocks) { block.source = { field: rule.id }; for (const child of block.children ?? []) child.source = { field: rule.id, representation: 'original' } }
    const references = diagnostics.filter(d => d.code !== 'TAVERN_MEMORY_RESOURCE_VERSION').map(d => ({ ...d, consumerId: null, consumerField: rule.id }))
    this.#captureChecks(context, 'text:' + rule.id, checks); this.validateResolved(context)
    return { blocks, diagnostics: references }
  }
  async #renderText(context, definition, row, decision, checks, blocks, diagnostics) {
    const dependencies = new Map(), assets = context.assets
    const event = { preview: context.preview === true, turn: context.turn ?? null, step: context.step ?? null,
      usage: 'prompt-template-dependency', consumer: { adapterId:this.id, id:row.id } }
    const selectionCurrent = this.worldBooks?.selectionLease(context) ?? (() => true)
    const accept = (id, proof) => {
      if (!decision.checkCurrent() || !selectionCurrent() || [...dependencies.values()].some(p => !p.checkCurrent())) fail('SOURCE_POLICY_CHANGED', 'Template policy changed during dependency lookup')
      if (!proof || proof.id !== id || proof.adapterId !== (id.startsWith('mvu:') ? 'tavern.mvu' : 'tavern.world-books') || typeof proof.checkCurrent !== 'function') fail('TEMPLATE_DEPENDENCY_UNAVAILABLE', 'Source does not provide a prompt-use lease')
      if (!proof.checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'Template dependency lease expired')
      dependencies.set(id, proof)
      return proof
    }
    const resolveDependency = async ({ kind, args }) => {
      if (!decision.checkCurrent() || !selectionCurrent() || [...dependencies.values()].some(p => !p.checkCurrent())) fail('SOURCE_POLICY_CHANGED', 'Template dependency changed during expansion')
      if (kind === 'variables' && args.length === 0) {
        if (!definition.variableResourceId) return definition.variables
        const id = definition.variableResourceId
        const proof = dependencies.get(id) ?? accept(id, await this.resolveVariables?.({ id,
          scope: { authority:'local', sessionId:context.sessionId }, event, signal:context.signal }))
        return proof.content
      }
      if (kind === 'worldbook-catalog' && args.length === 0) return this.worldBooks?.catalog(context) ?? []
      if (kind === 'worldbook-entry' && args.length === 2) {
        const [id, uid] = args
        const proof = dependencies.get(id) ?? accept(id, await this.worldBooks?.resolvePromptDependency({ id, context, event }))
        const entry = proof.content.find(e => String(e.uid) === String(uid))
        if (!entry) fail('TEMPLATE_DEPENDENCY_NOT_ACTIVE', 'World-book dependency entry is not active in this request')
        return entry.content
      }
      // These helpers expose only selected fragments; no card/preset raw document enters the VM.
      if (kind === 'preset-catalog' && args.length === 0) return (assets.preset?.prompts ?? []).map(p => ({id:p.identifier,name:p.name}))
      if (kind === 'preset-entry' && args.length === 1) return assets.preset?.prompts?.find(p => p.identifier === args[0])?.content ?? ''
      if (kind === 'character-catalog' && args.length === 0) return assets.character ? {id:assets.character.id,name:assets.character.name}:null
      if (kind === 'character-description' && args.length === 1) return assets.character?.id === args[0] ? assets.character.data?.description ?? '' : ''
      fail('TEMPLATE_DEPENDENCY_INVALID', 'Unsupported template dependency request')
    }
    const text = await renderTemplate(definition.content, {}, { signal: context.signal, resolveDependency })
    const dependencyProofs = [...dependencies.values()]
    if (!selectionCurrent() || dependencyProofs.some(p => !p.checkCurrent())) fail('SOURCE_POLICY_CHANGED', 'Template dependency changed before provide')
    checks.push(selectionCurrent, ...dependencyProofs.map(p => p.checkCurrent))
    if (!decision.checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'Template or policy changed before provide')
    checks.push(decision.checkCurrent)
    const blockId = `template-${hash([row.id, row.revision, decision.configRevision])}`
    blocks.push({ type: 'text', id: blockId, name: row.name, text, source: { resourceId: row.id, field: 'content' },
      children: [{ id: `${blockId}:original`, name: 'Template source', text: definition.content, locked: true, source: { resourceId: row.id, field: 'content', representation: 'original' } }] })
    for (const proof of dependencyProofs) diagnostics.push({ code:'TAVERN_MEMORY_DEPENDENCY_VERSION', adapterId:proof.adapterId, resourceId:proof.id, revision:proof.revision, configRevision:proof.configRevision, consumerId:row.id, sourceId:TEMPLATE_SOURCE, blockId })
    diagnostics.push({ code: 'TAVERN_MEMORY_RESOURCE_VERSION', adapterId: this.id, sourceId: TEMPLATE_SOURCE, resourceId: row.id, blockId, revision: row.revision, configRevision: decision.configRevision })
  }
  async resolve(context) {
    if (!context.sessionId) return { blocks: [], diagnostics: [{ code: 'TEMPLATE_SESSION_REQUIRED' }] }
    const blocks = [], diagnostics = [], checks = []
    for (const row of this.list({ scope: { sessionId: context.sessionId }, signal: context.signal })) {
      if (!row.enabled) continue
      const definition = structuredClone(this.#definition(row.id)), decision = await this.policy.decision(row, context, () => this.read({ id: row.id })?.revision)
      if (!decision.enabled) { diagnostics.push({ code: 'TEMPLATE_POLICY_SKIPPED', resourceId: row.id }); continue }
      await this.#renderText(context, definition, row, decision, checks, blocks, diagnostics)
    }
    context.signal?.throwIfAborted()
    if (checks.some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'Template or policy changed during source resolution')
    this.#captureChecks(context, 'module', checks)
    return { blocks, diagnostics }
  }
  dispose() { this.#boundDisposed = true; this.policy.dispose() }
}
