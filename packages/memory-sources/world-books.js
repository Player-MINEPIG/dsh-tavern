import { join } from 'node:path'
import { SourcePolicy, hash, fail, localScope, validateConfig, optionCatalog } from './policy.js'
export class WorldBookMemorySource {
  #checks = new WeakMap()
  id = 'tavern.world-books'; name = '世界书 / World books'; authority = 'local'; strategyOwner = 'source'
  optionCatalog = optionCatalog('world-book', '世界书激活与装配 / Activate and assemble world book', 'tavern.worldbook')
  constructor({ storageDir, store }) {
    this.store = store
    this.policy = new SourcePolicy(join(storageDir, 'world-book-ownership.json'), 'world-book')
  }
  observe = listener => this.policy.observe(listener)
  registerUsage = listener => this.policy.registerUsage(listener)
  validateConfig = config => validateConfig('world-book', config)
  #document(id) {
    if (typeof id !== 'string' || !id.startsWith('world-book:')) return null
    try { return this.store.get(id.slice(11)) } catch (e) { if (e.code === 'WORLD_BOOK_NOT_FOUND') return null; throw e }
  }
  read({ id, scope, signal } = {}) {
    localScope(scope); signal?.throwIfAborted()
    const document = this.#document(id)
    return document ? { id, name: document.name, type: 'world-book', authority: 'local', content: document, revision: this.policy.revision(id, document), managementMode: this.policy.mode(id),
      execution: { owner: 'source', event: 'before_model_request', sourceId: 'worldbook', activation: 'tavern-world-book-policy', managedRequiresAssembly: true,
        nativeSuppressedWhenManaged: true, unavailableManager: 'deny', bindingRequired: true, embeddedBooks: 'native-only' } } : null
  }
  list({ scope, signal } = {}) { localScope(scope); return this.store.list().map(row => this.read({ id: `world-book:${row.id}`, scope, signal })) }
  setManagementMode(args) {
    const document = this.#document(args.id)
    if (!document) fail('NOT_FOUND', 'Standalone world book not found')
    this.policy.setMode(args, document)
    return this.read(args)
  }
  allowNative(id, requestAssembly) { return this.policy.mode(`world-book:${id}`) !== 'managed' || requestAssembly === true }
  snapshots(context) {
    return (context.assets.worldBookIds ?? []).flatMap(id => {
      const doc = this.#document(`world-book:${id}`)
      return doc ? [{ id: doc.id, name: doc.name, entries: doc.book.entries }] : []
    })
  }
  validateResolved = context => { if ((this.#checks.get(context) ?? []).some(check => !check())) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before assembly') }
  async filter(context, output) {
    const blocks = [], diagnostics = [...(output.diagnostics ?? [])], checks = []
    const ids = [...new Set(output.blocks.map(b => b.source?.resourceId))]
    for (const id of ids) {
      const sourceBlocks = output.blocks.filter(b => b.source?.resourceId === id), resourceId = `world-book:${id}`
      const row = this.read({ id: resourceId, signal: context.signal })
      // Embedded books have separate character ownership, explicitly native-only.
      if (!row) {
        if (typeof id === 'string' && id.startsWith('character:') && id.endsWith(':embedded-world-book')) { blocks.push(...sourceBlocks); continue }
        fail('SOURCE_CONTENT_CHANGED', 'Standalone world book is no longer available')
      }
      if (row.managementMode === 'managed' && context.preset?.rules.some(r => r.kind === 'worldbook' && r.enabled && r.lifetime === 'snapshot')) fail('MANAGED_WORLD_BOOK_SNAPSHOT_UNSUPPORTED', 'Managed world books require request lifetime')
      if (context.assets.worldBookRevisions?.[id] !== hash(row.content)) fail('SOURCE_CONTENT_CHANGED', 'World book changed after activation')
      const decision = await this.policy.decision(row, context, () => this.read({ id: resourceId })?.revision)
      if (!decision.enabled) { diagnostics.push({ code: 'WORLD_BOOK_POLICY_SKIPPED', resourceId }); continue }
      if (!decision.checkCurrent()) fail('SOURCE_POLICY_CHANGED', 'World-book policy changed before provide')
      checks.push(decision.checkCurrent)
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
