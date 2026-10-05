import { join } from 'node:path'
import { embeddedWorldBookDocument } from './embedded-document.js'
import { SourcePolicy, hash, fail, localScope, validateConfig, optionCatalog } from './policy.js'
import { boundScope, boundSnapshot } from './bound-metadata.js'
import { MESSAGE_STATE_MACRO, hasMessageStateMacro, formatMessageState } from './message-variable.js'
export class WorldBookMemorySource {
  #checks = new WeakMap()
  #boundDisposed = false
  id = 'tavern.world-books'; name = '世界书 / World books'; authority = 'local'; strategyOwner = 'source'
  optionCatalog = optionCatalog('world-book', '世界书激活与装配 / Activate and assemble world book', 'tavern.worldbook')
  constructor({ storageDir, store, characters, getSelection, sessionBooks, getMvu }) {
    this.store = store; this.characters = characters; this.getSelection = getSelection
    this.sessionBooks = sessionBooks
    this.getMvu = getMvu
    this.policy = new SourcePolicy(join(storageDir, 'world-book-ownership.json'), 'world-book')
  }
  observe = listener => this.policy.observe(listener)
  registerUsage = (listener, options) => this.policy.registerUsage(listener, options)
  getManagementDefaults({ id, scope = {} } = {}) {
    localScope(scope)
    scope = structuredClone(scope)
    if (!this.#document(id, scope)) return null
    if (!scope.sessionId) return this.policy.defaults(id)
    const bound = this.listBound({ scope })
    if (!bound.items.some(row => row.id === id)) return null
    return this.policy.defaults(id, bound.checkCurrent)
  }
  validateConfig = config => validateConfig('world-book', config)
  #document(id, scope = {}) {
    if (typeof id !== 'string' || !id.startsWith('world-book:')) return null
    const embedded = /^world-book:character:(.+):embedded-world-book$/.exec(id)
    try { return embedded ? embeddedWorldBookDocument(this.characters?.get(embedded[1])) : id.startsWith('world-book:session-opening-') ? this.sessionBooks?.get(id.slice(11), scope.sessionId) ?? null : this.store.get(id.slice(11)) }
    catch (e) { if (['WORLD_BOOK_NOT_FOUND', 'CHARACTER_NOT_FOUND'].includes(e.code)) return null; throw e }
  }
  read({ id, scope, signal } = {}) {
    localScope(scope); signal?.throwIfAborted()
    const document = this.#document(id, scope)
    return document ? { id, name: document.name, type: 'world-book', authority: 'local', content: document, revision: this.policy.revision(id, document), managementMode: this.policy.mode(id), storedManagementMode: this.policy.storedMode(id),
      origin: document.ownerSessionId ? { kind: 'session-opening-book', sessionId: document.ownerSessionId, characterId: document.ownerCharacterId, sourceIdentity: document.openingSourceIdentity } : document.ownerCharacterId ? { kind: 'embedded-character-book', characterId: document.ownerCharacterId } : { kind: 'standalone' },
      execution: { owner: 'source', event: 'before_model_request', sourceId: 'worldbook', activation: 'tavern-world-book-policy', managedRequiresAssembly: false,
        nativeSuppressedWhenManaged: false, unavailableManager: 'source-default', bindingRequired: true, managementModes: ['native', 'managed'], dependencyRead: 'activated-entries-only' } } : null
  }
  list({ scope, signal } = {}) {
    localScope(scope)
    const ids = [...this.store.list().map(row => `world-book:${row.id}`), ...(this.characters?.list() ?? []).map(row => `world-book:character:${row.id}:embedded-world-book`), ...(scope?.sessionId ? this.sessionBooks?.list(scope.sessionId) ?? [] : []).map(row => `world-book:${row.id}`)]
    return ids.map(id => this.read({ id, scope, signal })).filter(Boolean)
  }
  listBound({ scope, signal } = {}) {
    scope = boundScope(scope); signal?.throwIfAborted()
    if (this.#boundDisposed) fail('SOURCE_UNAVAILABLE', 'World-book source is unloaded')
    if (!scope?.sessionId || !this.getSelection) fail('SOURCE_BOUND_SCOPE', 'A current session selection is required')
    const selected = this.getSelection(scope.sessionId), token = hash(selected)
    const ids = [...new Set([...(selected.characterId ? [`world-book:character:${selected.characterId}:embedded-world-book`] : []), ...selected.worldBookIds.map(id => `world-book:${id}`)])]
    // Only selected resources are inspected. No global library/card scan or
    // activation, and no source body is returned to a directory consumer.
    const rowsNow = () => ids.flatMap(id => {
      const doc = this.#document(id, scope)
      return doc ? [{ id, adapterId: this.id, name: doc.name, type: 'world-book', revision: this.policy.revision(id, doc), managementMode: this.policy.mode(id),
        binding: { sessionId: scope.sessionId, kind: doc.ownerSessionId ? 'session-opening' : doc.ownerCharacterId ? 'character-embedded' : 'selected-world-book',
          ...(doc.ownerCharacterId ? { characterId: doc.ownerCharacterId } : {}), ...(selected.worldBookBindings?.[doc.id] ? { origins: selected.worldBookBindings[doc.id] } : {}),
          ...(selected.worldBookBindings?.[doc.id]?.includes('preset') ? { presetId: selected.presetId } : {}),
          ...(selected.worldBookBindings?.[doc.id]?.includes('user') ? { userId: selected.userId } : {}) } }] : []
    })
    const rows = rowsNow(), revision = hash(rows), lifecycle = this.policy.captureLifecycle(), checkCurrent = () => {
      try { return !this.#boundDisposed && lifecycle() && hash(this.getSelection(scope.sessionId)) === token && hash(rowsNow()) === revision } catch { return false }
    }
    if (!checkCurrent()) fail('SOURCE_BOUND_CHANGED', 'Bound world books changed during lookup')
    return boundSnapshot(rows, revision, checkCurrent)
  }
  setManagementMode(args) {
    localScope(args.scope)
    const document = this.#document(args.id, args.scope)
    if (!document) fail('NOT_FOUND', 'World book not found')
    this.policy.setMode(args, document)
    return this.read(args)
  }
  // Activation remains native. The same async filter governs both delivery paths.
  allowNative() { return true }
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
      const doc = this.#document(id, { sessionId: context.sessionId })
      return doc ? [{ id, sourceId: doc.id, name: doc.name, entries: doc.book.entries.map(e => ({ uid:e.uid, comment:e.comment })) }] : []
    })
  }
  async resolvePromptDependency({ id, context, event }) {
    if (!context.sessionId || !this.#selectedIds(context).includes(id)) fail('TEMPLATE_DEPENDENCY_SCOPE', 'World book is not selected')
    const scope = { sessionId: context.sessionId }
    const selectionCurrent = this.selectionLease(context), row = this.read({ id, scope, signal: context.signal })
    if (!row) fail('TEMPLATE_DEPENDENCY_MISSING', 'World book is unavailable')
    if (context.assets.worldBookRevisions?.[row.content.id] !== hash(row.content)) fail('SOURCE_CONTENT_CHANGED', 'World book changed after activation')
    const decision = await this.policy.decision(row, { ...context, dependencyEvent: event }, () => this.read({ id, scope })?.revision)
    if (!decision.enabled) fail('TEMPLATE_DEPENDENCY_DENIED', 'World-book prompt usage denied')
    const checkCurrent = () => selectionCurrent() && decision.checkCurrent()
    if (!checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'World-book dependency changed')
    // Reuse this request's native activation, never re-roll probability or expand raw inactive entries.
    const active = new Set((context.assets.loreEntries ?? []).filter(e => e.resourceId === row.content.id).map(e => String(e.uid)))
    return { id, adapterId:this.id, content:row.content.book.entries.filter(e => active.has(String(e.uid))).map(e=>({uid:e.uid,content:e.content})), revision:row.revision, configRevision:decision.configRevision, checkCurrent }
  }
  validateResolved = context => { if ((this.#checks.get(context) ?? []).some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before assembly') }
  async prepareNative(context) {
    const entries = context.assets.loreEntries ?? []
    const output = await this.filter(context, { blocks: entries.map((entry, index) => ({ type: 'text', id: String(index), text: entry.content, source: { resourceId: entry.resourceId } })) })
    return output.blocks.map(block => ({ ...entries[Number(block.id)], literalMacros: block.literalMacros }))
  }
  async filter(context, output) {
    const blocks = [], diagnostics = [...(output.diagnostics ?? [])], checks = []
    const ids = [...new Set(output.blocks.map(b => b.source?.resourceId))]
    for (const id of ids) {
      const sourceBlocks = output.blocks.filter(b => b.source?.resourceId === id), resourceId = `world-book:${id}`
      const scope = { sessionId: context.sessionId }
      const row = this.read({ id: resourceId, scope, signal: context.signal })
      if (!row) fail('SOURCE_CONTENT_CHANGED', 'World book is no longer available')
      if (row.managementMode === 'managed' && context.preset?.rules.some(r => r.kind === 'worldbook' && r.enabled && r.lifetime === 'snapshot')) fail('MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED', 'Managed world books require request lifetime')
      if (context.assets.worldBookRevisions?.[id] !== hash(row.content)) fail('SOURCE_CONTENT_CHANGED', 'World book changed after activation')
      const selectionCurrent = this.selectionLease(context)
      const decision = await this.policy.decision(row, context, () => this.read({ id: resourceId, scope })?.revision)
      if (!decision.enabled) { diagnostics.push({ code: 'WORLD_BOOK_POLICY_SKIPPED', adapterId: this.id, sourceId: 'worldbook', resourceId,
        revision: row.revision, managementMode: row.managementMode, configRevision: decision.configRevision ?? null, reason: decision.reason ?? 'lease-unavailable' }); continue }
      const checkCurrent = () => selectionCurrent() && decision.checkCurrent()
      if (!checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before provide')
      checks.push(checkCurrent)
      let variables
      if (sourceBlocks.some(block => hasMessageStateMacro(block.text))) {
        const mvu = this.getMvu?.()
        variables = await mvu?.resolvePromptDependency?.({ scope: { authority: 'local', sessionId: context.sessionId }, signal: context.signal,
          event: { usage: 'world-book-variable', preview: context.preview === true, turn: context.turn ?? null, step: context.step ?? null, consumer: { adapterId: this.id, id: resourceId } } })
        if (!variables || variables.adapterId !== 'tavern.mvu' || typeof variables.id !== 'string' || !variables.content?.stat_data
          || typeof variables.checkCurrent !== 'function' || variables.checkCurrent() !== true) fail('WORLD_BOOK_VARIABLE_DENIED', 'World-book variable dependency is unavailable or denied')
        const variableCurrent = () => this.getMvu?.() === mvu && variables.checkCurrent() === true
        checks.push(variableCurrent)
      }
      blocks.push(...sourceBlocks.map(block => hasMessageStateMacro(block.text) ? { ...block, literalMacros: { [MESSAGE_STATE_MACRO]: formatMessageState(variables.content) } } : block))
      if (variables) for (const block of sourceBlocks.filter(block => hasMessageStateMacro(block.text))) diagnostics.push({ code: 'WORLD_BOOK_MVU_VARIABLE_VERSION', resourceId: variables.id,
        blockId: block.id, blockResourceId: id, worldBookId: resourceId, revision: variables.revision, configRevision: variables.configRevision })
      for (const block of sourceBlocks) diagnostics.push({ code: 'TAVERN_MEMORY_RESOURCE_VERSION', adapterId: this.id, sourceId: 'worldbook', resourceId, blockResourceId: id, blockId: block.id, revision: row.revision, configRevision: decision.configRevision })
    }
    context.signal?.throwIfAborted()
    if (checks.some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed during source resolution')
    this.#checks.set(context, checks)
    return { ...output, blocks, diagnostics }
  }
  dispose() { this.#boundDisposed = true; this.policy.dispose() }
}
