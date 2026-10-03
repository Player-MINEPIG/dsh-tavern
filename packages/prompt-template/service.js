import { join } from 'node:path'
import { renderTemplate } from './runtime.js'
import { inspectTemplateMetadata } from './metadata.js'
import { SourcePolicy, atomicJson, readJson, hash, fail, localScope, validateConfig, optionCatalog } from '../memory-sources/policy.js'
export const TEMPLATE_SOURCE = 'pmp-dsh-tavern/prompt-template'
const idPattern = /^prompt-template:[a-zA-Z0-9_.-]{1,100}$/
function normalize(resource) {
  if (!resource || !idPattern.test(resource.id) || typeof resource.name !== 'string' || resource.name.length > 200 || typeof resource.content !== 'string' || resource.content.length > 131072) fail('VALIDATION_FAILED', 'Template requires stable prompt-template ID, name and bounded content')
  if (resource.enabled === true && !inspectTemplateMetadata(resource).supported) fail('UNSUPPORTED_EVENT', 'Template title requests an unsupported lifecycle')
  if (!Array.isArray(resource.sessionIds) || !resource.sessionIds.length || resource.sessionIds.some(id => typeof id !== 'string' || !id)) fail('VALIDATION_FAILED', 'Template requires explicit sessionIds (or *)')
  if (resource.variableResourceId !== undefined && (typeof resource.variableResourceId !== 'string' || !resource.variableResourceId.startsWith('mvu:'))) fail('VALIDATION_FAILED', 'Expected MVU variableResourceId')
  return { id: resource.id, name: resource.name, content: resource.content, enabled: resource.enabled === true, sessionIds: [...new Set(resource.sessionIds)], variables: structuredClone(resource.variables ?? {}), ...(resource.variableResourceId ? { variableResourceId: resource.variableResourceId } : {}) }
}
export class PromptTemplateService {
  #checks = new WeakMap()
  id = 'tavern.prompt-templates'; name = '提示词模板 / Prompt templates'; authority = 'local'; strategyOwner = 'source'
  optionCatalog = optionCatalog('prompt-template', '隔离只读模板展开 / Isolated read-only expansion', 'tavern.prompt-template')
  constructor({ storageDir, resources = [], getVariables, worldBooks }) {
    this.path = join(storageDir, 'prompt-templates.json')
    const stored = readJson(this.path, null)
    this.state = stored ?? { version: 1, resources: resources.map(normalize), operations: [] }
    if (this.state.version !== 1 || !Array.isArray(this.state.resources) || new Set(this.state.resources.map(r => r.id)).size !== this.state.resources.length) fail('VALIDATION_FAILED', 'Invalid template resource file')
    this.state.resources = this.state.resources.map(normalize)
    if (!Array.isArray(this.state.operations)) fail('VALIDATION_FAILED', 'Invalid template operations')
    if (!stored) atomicJson(this.path, this.state)
    this.policy = new SourcePolicy(join(storageDir, 'prompt-template-ownership.json'), 'prompt-template')
    this.getVariables = getVariables; this.worldBooks = worldBooks
  }
  observe = listener => this.policy.observe(listener)
  registerUsage = listener => this.policy.registerUsage(listener)
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
    return resource ? { id, name: resource.name, type: 'prompt-template', authority: 'local', content: resource.content, revision: this.policy.revision(id, resource), managementMode: this.policy.mode(id), enabled: resource.enabled,
      execution: { owner: 'source', event: 'before_model_request', sourceId: TEMPLATE_SOURCE, isolation: 'quickjs', sideEffects: false, requiresAssemblySelection: true } } : null
  }
  list({ scope = {}, signal } = {}) {
    localScope(scope)
    return this.state.resources.filter(r => !scope.sessionId || r.sessionIds.includes('*') || r.sessionIds.includes(scope.sessionId)).map(r => this.read({ id: r.id, scope, signal }))
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
  validateResolved = context => { if ((this.#checks.get(context) ?? []).some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'Template policy changed before assembly') }
  async resolve(context) {
    if (!context.sessionId) return { blocks: [], diagnostics: [{ code: 'TEMPLATE_SESSION_REQUIRED' }] }
    const blocks = [], diagnostics = [], checks = []
    for (const row of this.list({ scope: { sessionId: context.sessionId }, signal: context.signal })) {
      if (!row.enabled) continue
      const definition = structuredClone(this.#definition(row.id)), decision = await this.policy.decision(row, context, () => this.read({ id: row.id })?.revision)
      if (!decision.enabled) { diagnostics.push({ code: 'TEMPLATE_POLICY_SKIPPED', resourceId: row.id }); continue }
      let variables = definition.variables
      if (definition.variableResourceId) {
        const snapshot = await this.getVariables?.({ id: definition.variableResourceId, scope: { authority: 'local', sessionId: context.sessionId }, signal: context.signal })
        if (!snapshot) fail('TEMPLATE_VARIABLES_UNAVAILABLE', 'Bound variable snapshot unavailable')
        variables = snapshot.content
      }
      const assets = context.assets, snapshot = { variables, character: assets.character, preset: assets.preset, worldBooks: this.worldBooks?.snapshots(context) ?? [] }
      const text = await renderTemplate(definition.content, snapshot, { signal: context.signal })
      if (!decision.checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'Template or policy changed before provide')
      checks.push(decision.checkCurrent)
      const blockId = `template-${hash([row.id, row.revision, decision.configRevision])}`
      blocks.push({ type: 'text', id: blockId, name: row.name, text, source: { resourceId: row.id, field: 'content' },
        children: [{ id: `${blockId}:original`, name: 'Template source', text: definition.content, locked: true, source: { resourceId: row.id, field: 'content', representation: 'original' } }] })
      diagnostics.push({ code: 'TAVERN_MEMORY_RESOURCE_VERSION', adapterId: this.id, sourceId: TEMPLATE_SOURCE, resourceId: row.id, blockId, revision: row.revision, configRevision: decision.configRevision })
    }
    context.signal?.throwIfAborted()
    if (checks.some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'Template or policy changed during source resolution')
    this.#checks.set(context, checks)
    return { blocks, diagnostics }
  }
  dispose() { this.policy.dispose() }
}
