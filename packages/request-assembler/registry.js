export const ASSEMBLY_SERVICE = 'tavernRequestSources'
export const SOURCE_PROTOCOL_VERSION = 1
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child) }
  return value
}
function aborted(signal) { signal?.throwIfAborted() }
async function abortable(value, signal) {
  aborted(signal)
  if (!signal) return value
  let stop
  try { return await Promise.race([Promise.resolve(value), new Promise((_, reject) => { stop = () => reject(signal.reason); signal.addEventListener('abort', stop, { once: true }) })]) }
  finally { signal.removeEventListener('abort', stop) }
}
/** Host-side content sources. Built-ins register through exactly this contract. */
export class RequestSourceRegistry {
  get version() { return SOURCE_PROTOCOL_VERSION }
  #sources = new Map()
  register(source) {
    if (!source || !idPattern.test(source.id) || !idPattern.test(source.pluginId) || typeof source.name !== 'string' || !source.name || typeof source.resolve !== 'function') throw new TypeError('Source requires id, pluginId, name and resolve')
    if (this.#sources.has(source.id)) throw new TypeError(`Duplicate assembly source: ${source.id}`)
    const descriptor = freeze(structuredClone({ id: source.id, pluginId: source.pluginId, name: source.name, version: source.version ?? 1,
      stability: source.stability ?? 'conversation', dependencies: source.dependencies ?? [], multiple: source.multiple === true,
      roles: source.roles ?? ['preserve', 'system', 'user', 'assistant'], lifetimes: source.lifetimes ?? ['request', 'snapshot'], depth: source.depth !== false,
      generationRequiresPlugin: source.generationRequiresPlugin !== false, recordedContentSurvivesRemoval: true,
    }))
    if (!Array.isArray(descriptor.dependencies) || descriptor.dependencies.some(id => !idPattern.test(id)) || !['asset', 'conversation', 'evaluation', 'assembly', 'snapshot'].includes(descriptor.stability)) throw new TypeError('Invalid source descriptor')
    if (!Number.isInteger(descriptor.version) || descriptor.version < 1 || !Array.isArray(descriptor.roles) || !descriptor.roles.length || descriptor.roles.some(r => !['preserve', 'system', 'user', 'assistant'].includes(r)) || !Array.isArray(descriptor.lifetimes) || !descriptor.lifetimes.length || descriptor.lifetimes.some(l => !['request', 'snapshot'].includes(l))) throw new TypeError('Invalid source capabilities')
    if (source.validateResolved !== undefined && typeof source.validateResolved !== 'function') throw new TypeError('validateResolved must be a function')
    const entry = { descriptor, resolve: source.resolve, validateResolved: source.validateResolved }
    this.#sources.set(source.id, entry)
    return () => { if (this.#sources.get(source.id) === entry) this.#sources.delete(source.id) }
  }
  list() { return structuredClone([...this.#sources.values()].map(s => s.descriptor)) }
  #jobs(context) {
    // Capture registrations and a detached read-only request once: unload/reload only
    // changes the next request, never half of an in-flight resolution.
    const sources = new Map(this.#sources), jobs = [], visiting = new Set(), done = new Set(), diagnostics = []
    const visit = rule => {
      if (done.has(rule.id)) return
      if (visiting.has(rule.kind)) throw new TypeError(`Cyclic source dependencies: ${rule.kind}`)
      const source = sources.get(rule.kind)
      if (!source) { diagnostics.push({ code: 'ASSEMBLY_SOURCE_UNAVAILABLE', sourceId: rule.kind, ruleId: rule.id }); done.add(rule.id); return }
      const d = source.descriptor
      if (!d.roles.includes(rule.role) || !d.lifetimes.includes(rule.lifetime) || (!d.depth && rule.depth != null)) throw new TypeError(`Unsupported rule settings for ${rule.kind}`)
      if (!d.multiple && context.preset.rules.filter(r => r.kind === rule.kind).length > 1) throw new TypeError(`Duplicate source rule: ${rule.kind}`)
      visiting.add(rule.kind)
      for (const id of d.dependencies) visit(context.preset.rules.find(r => r.kind === id) ?? { id: `reference-${id}`, kind: id, enabled: false, role: 'preserve', lifetime: 'request', depth: null, text: '', name: '' })
      visiting.delete(rule.kind); done.add(rule.id); jobs.push({ rule, ...source })
    }
    for (const rule of context.preset.rules.filter(r => r.enabled)) visit(rule)
    const { signal, ...data } = context
    return { jobs, context: Object.freeze({ ...freeze(structuredClone(data)), signal }), diagnostics }
  }
  #result(job, output) {
    if (!output || !Array.isArray(output.blocks) || output.blocks.length > 10000) throw new TypeError(`Invalid blocks from ${job.descriptor.id}`)
    // Functions, undefined fields and non-JSON state are not a wire contract.
    const json = JSON.stringify(output)
    if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new TypeError(`Source output exceeds 8 MiB: ${job.descriptor.id}`)
    const result = JSON.parse(json), ids = new Set()
    for (const block of result.blocks) {
      if (!block || typeof block.id !== 'string' || !block.id || ids.has(block.id) || !['text', 'native', 'reference'].includes(block.type)) throw new TypeError(`Invalid/duplicate block from ${job.descriptor.id}`)
      ids.add(block.id)
      if (block.type === 'text' && typeof block.text !== 'string') throw new TypeError('Text block requires text')
      if (block.type === 'native' && (!Array.isArray(block.messageIds) || block.messageIds.some(id => typeof id !== 'string'))) throw new TypeError('Native block requires messageIds')
      if (block.type === 'reference' && (!idPattern.test(block.sourceId) || (block.blockIds !== undefined && (!Array.isArray(block.blockIds) || block.blockIds.some(id => typeof id !== 'string'))))) throw new TypeError('Invalid source reference')
      if (block.depth != null && (!Number.isInteger(block.depth) || block.depth < 0 || block.depth > 10000)) throw new TypeError('Invalid block depth')
      if (block.role !== undefined && !['system', 'user', 'assistant'].includes(block.role)) throw new TypeError('Invalid block role')
    }
    return freeze({ ...result, rule: job.rule, descriptor: job.descriptor })
  }
  #validateResolved(request) {
    for (const job of request.jobs) {
      const value = job.validateResolved?.(request.context)
      if (value?.then) { value.catch?.(() => {}); throw new TypeError('validateResolved must be synchronous') }
    }
  }
  resolveSync(context) {
    const request = this.#jobs(context), resolved = []
    for (const job of request.jobs) {
      aborted(context.signal)
      const output = job.resolve(request.context, freeze(structuredClone(job.rule)))
      if (output?.then) { output.catch?.(() => {}); throw new TypeError('Async source requires assembleRequestAsync') }
      resolved.push(this.#result(job, output))
    }
    this.#validateResolved(request)
    return { context: request.context, resolved, diagnostics: request.diagnostics }
  }
  async resolve(context) {
    const request = this.#jobs(context), resolved = []
    for (const job of request.jobs) {
      aborted(context.signal)
      const output = await abortable(job.resolve(request.context, freeze(structuredClone(job.rule))), context.signal)
      aborted(context.signal); resolved.push(this.#result(job, output))
    }
    this.#validateResolved(request)
    return { context: request.context, resolved, diagnostics: request.diagnostics }
  }
}
