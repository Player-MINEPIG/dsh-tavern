import { join } from 'node:path'
import { embeddedWorldBookDocument } from './embedded-document.js'
import { SourcePolicy, hash, fail, localScope, validateConfig, optionCatalog } from './policy.js'
export class WorldBookMemorySource {
  #checks = new WeakMap()
  id = 'tavern.world-books'; name = '世界书 / World books'; authority = 'local'; strategyOwner = 'source'
  optionCatalog = optionCatalog('world-book', '世界书激活与装配 / Activate and assemble world book', 'tavern.worldbook')
  constructor({ storageDir, store, characters, getSelection }) {
    this.store = store; this.characters = characters; this.getSelection = getSelection
    this.policy = new SourcePolicy(join(storageDir, 'world-book-ownership.json'), 'world-book')
  }
  observe = listener => this.policy.observe(listener)
  registerUsage = listener => this.policy.registerUsage(listener)
  validateConfig = config => validateConfig('world-book', config)
  #document(id) {
    if (typeof id !== 'string' || !id.startsWith('world-book:')) return null
    const embedded = /^world-book:character:(.+):embedded-world-book$/.exec(id)
    try { return embedded ? embeddedWorldBookDocument(this.characters?.get(embedded[1])) : this.store.get(id.slice(11)) }
    catch (e) { if (['WORLD_BOOK_NOT_FOUND', 'CHARACTER_NOT_FOUND'].includes(e.code)) return null; throw e }
  }
  read({ id, scope, signal } = {}) {
    localScope(scope); signal?.throwIfAborted()
    const document = this.#document(id)
    return document ? { id, name: document.name, type: 'world-book', authority: 'local', content: document, revision: this.policy.revision(id, document), managementMode: this.policy.mode(id),
      origin: document.ownerCharacterId ? { kind: 'embedded-character-book', characterId: document.ownerCharacterId } : { kind: 'standalone' },
      execution: { owner: 'source', event: 'before_model_request', sourceId: 'worldbook', activation: 'tavern-world-book-policy', managedRequiresAssembly: true,
        nativeSuppressedWhenManaged: true, unavailableManager: 'deny', bindingRequired: true, managementModes: ['native', 'managed'], dependencyRead: 'activated-entries-only' } } : null
  }
  list({ scope, signal } = {}) {
    localScope(scope)
    const ids = [...this.store.list().map(row => `world-book:${row.id}`), ...(this.characters?.list() ?? []).map(row => `world-book:character:${row.id}:embedded-world-book`)]
    return ids.map(id => this.read({ id, scope, signal })).filter(Boolean)
  }
  setManagementMode(args) {
    const document = this.#document(args.id)
    if (!document) fail('NOT_FOUND', 'World book not found')
    this.policy.setMode(args, document)
    return this.read(args)
  }
  allowNative(id, requestAssembly) { return this.policy.mode(`world-book:${id}`) !== 'managed' || requestAssembly === true }
  selectionLease(context) {
    if (!this.getSelection) return () => true
    const current = this.getSelection(context.sessionId), token = hash(current)
    if (hash(current.worldBookIds) !== hash(context.assets.worldBookIds ?? []) || current.characterId !== (context.assets.character?.id ?? null)) fail('SOURCE_SELECTION_CHANGED', 'World-book selection changed after activation')
    return () => hash(this.getSelection(context.sessionId)) === token
  }
  #selectedIds(context) {
    const embedded = context.assets.character?.data?.characterBook ? [`world-book:character:${context.assets.character.id}:embedded-world-book`] : []
    return [...embedded, ...(context.assets.worldBookIds ?? []).map(id => `world-book:${id}`)]
  }
  catalog(context) {
    this.selectionLease(context)
    // Lookup metadata contains no source bodies, variables or raw import documents.
    return this.#selectedIds(context).flatMap(id => {
      const doc = this.#document(id)
      return doc ? [{ id, sourceId: doc.id, name: doc.name, entries: doc.book.entries.map(e => ({ uid:e.uid, comment:e.comment })) }] : []
    })
  }
  async resolvePromptDependency({ id, context, event }) {
    if (!context.sessionId || !this.#selectedIds(context).includes(id)) fail('TEMPLATE_DEPENDENCY_SCOPE', 'World book is not selected')
    const selectionCurrent = this.selectionLease(context), row = this.read({ id, signal: context.signal })
    if (!row) fail('TEMPLATE_DEPENDENCY_MISSING', 'World book is unavailable')
    if (context.assets.worldBookRevisions?.[row.content.id] !== hash(row.content)) fail('SOURCE_CONTENT_CHANGED', 'World book changed after activation')
    const decision = await this.policy.decision(row, { ...context, dependencyEvent: event }, () => this.read({ id })?.revision)
    if (!decision.enabled) fail('TEMPLATE_DEPENDENCY_DENIED', 'World-book prompt usage denied')
    const checkCurrent = () => selectionCurrent() && decision.checkCurrent()
    if (!checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'World-book dependency changed')
    // Reuse this request's native activation, never re-roll probability or expand raw inactive entries.
    const active = new Set((context.assets.loreEntries ?? []).filter(e => e.resourceId === row.content.id).map(e => String(e.uid)))
    return { id, adapterId:this.id, content:row.content.book.entries.filter(e => active.has(String(e.uid))).map(e=>({uid:e.uid,content:e.content})), revision:row.revision, configRevision:decision.configRevision, checkCurrent }
  }
  validateResolved = context => { if ((this.#checks.get(context) ?? []).some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before assembly') }
  async filter(context, output) {
    const blocks = [], diagnostics = [...(output.diagnostics ?? [])], checks = []
    const ids = [...new Set(output.blocks.map(b => b.source?.resourceId))]
    for (const id of ids) {
      const sourceBlocks = output.blocks.filter(b => b.source?.resourceId === id), resourceId = `world-book:${id}`
      const row = this.read({ id: resourceId, signal: context.signal })
      if (!row) fail('SOURCE_CONTENT_CHANGED', 'World book is no longer available')
      if (row.managementMode === 'managed' && context.preset?.rules.some(r => r.kind === 'worldbook' && r.enabled && r.lifetime === 'snapshot')) fail('MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED', 'Managed world books require request lifetime')
      if (context.assets.worldBookRevisions?.[id] !== hash(row.content)) fail('SOURCE_CONTENT_CHANGED', 'World book changed after activation')
      const selectionCurrent = this.selectionLease(context)
      const decision = await this.policy.decision(row, context, () => this.read({ id: resourceId })?.revision)
      if (!decision.enabled) { diagnostics.push({ code: 'WORLD_BOOK_POLICY_SKIPPED', resourceId }); continue }
      const checkCurrent = () => selectionCurrent() && decision.checkCurrent()
      if (!checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before provide')
      checks.push(checkCurrent)
      blocks.push(...sourceBlocks)
      for (const block of sourceBlocks) diagnostics.push({ code: 'TAVERN_MEMORY_RESOURCE_VERSION', adapterId: this.id, sourceId: 'worldbook', resourceId, blockResourceId: id, blockId: block.id, revision: row.revision, configRevision: decision.configRevision })
    }
    context.signal?.throwIfAborted()
    if (checks.some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed during source resolution')
    this.#checks.set(context, checks)
    return { ...output, blocks, diagnostics }
  }
  dispose() { this.policy.dispose() }
}
