import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { UsageLifecycle } from './usage-lifecycle.js'
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const fail = (code, message) => { throw Object.assign(new Error(message), { code, committed: false }) }
export function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return fallback; throw e } }
export function atomicJson(path, value) {
  const text = JSON.stringify(value)
  if (Buffer.byteLength(text) > 8 * 1024 * 1024) fail('SOURCE_LIMIT', 'Source state exceeds 8 MiB')
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  try { writeFileSync(temp, text, { mode: 0o600 }); renameSync(temp, path) } finally { try { unlinkSync(temp) } catch {} }
}
export function localScope(scope = {}) {
  if (scope.authority && scope.authority !== 'local') fail('FORBIDDEN', 'This source is local')
  if (Object.keys(scope).some(k => !['authority', 'sessionId'].includes(k))) fail('FORBIDDEN', 'Historical or remote resource mutation is not supported')
}
export const chains = Object.freeze({ 'world-book': ['worldbook.activate', 'worldbook.emit'], 'prompt-template': ['prompt_template.expand', 'prompt_template.emit'] })
export function validateStrategy(type, strategy) {
  const expected = chains[type]
  if (!Array.isArray(strategy) || strategy.length !== expected.length || strategy.some((s, i) => s?.operation !== expected[i] || Object.keys(s).some(k => k !== 'operation'))) fail('UNSUPPORTED_STRATEGY', `Expected ordered ${type} source strategy`)
}
export function validateConfig(type, config) {
  if (config.type && config.type !== type) fail('TYPE_MISMATCH', `Expected ${type}`)
  if (config.store !== undefined) fail('UNSUPPORTED_POLICY', `${type} does not expose managed storage`)
  if (config.retrieve) {
    if (typeof config.retrieve !== 'object' || Array.isArray(config.retrieve)) fail('UNSUPPORTED_POLICY', 'Expected a retrieve policy object')
    if (Object.keys(config.retrieve).length === 0) return
    const on = Array.isArray(config.retrieve.on) ? config.retrieve.on : [config.retrieve.on]
    if (on.length !== 1 || on[0] !== 'before_model_request') fail('UNSUPPORTED_EVENT', 'Only before_model_request is supported')
    validateStrategy(type, config.retrieve.strategy)
  }
}
export function optionCatalog(type, label, prefix) {
  const strategy = chains[type].map(operation => ({ operation }))
  return { version: 1, types: [{ id: type, label }], events: [{ id: 'before_model_request', label: '模型请求装配前 / Before request assembly', mode: 'retrieve' }],
    strategies: [{ id: `${prefix}.retrieve`, label, mode: 'retrieve', events: ['before_model_request'], value: strategy }],
    presets: [{ id: type === 'world-book' ? 'builtin:worldbook-retrieve' : 'builtin:prompt-template-retrieve', label, configuration: { type, retrieve: { on: 'before_model_request', rule: true, strategy } } }],
    modes: { store: { supported: false, reason: 'The source exposes read-only request expansion, not managed storage.' }, retrieve: { supported: true, onSelection: 'single', strategySelection: 'fixed' } } }
}
/** Saved preferences remain durable; active Host registration determines actual delegation. */
export class SourcePolicy {
  #listeners = new Set(); #usage = new UsageLifecycle(); #epoch = 0; #disposed = false
  constructor(path, type) {
    this.path = path; this.type = type
    this.state = readJson(path, { version: 1, resources: {} })
    if (this.state.version !== 1 || !this.state.resources || Array.isArray(this.state.resources) || typeof this.state.resources !== 'object'
      || Object.values(this.state.resources).some(r => !r || !['native', 'managed'].includes(r.mode) || !Array.isArray(r.operations))) throw new TypeError('Invalid source ownership file')
  }
  mode(_id) { return this.#usage.managementMode }
  captureLifecycle() { const epoch = this.#epoch; return () => !this.#disposed && this.#epoch === epoch }
  storedMode(id) { return this.state.resources[id]?.mode ?? 'native' }
  defaults(id, checkBinding = () => true) {
    if (this.#disposed || checkBinding() !== true) return null
    const epoch = this.#epoch
    const configuration = { type: this.type, retrieve: { on: 'before_model_request', rule: true, strategy: chains[this.type].map(operation => ({ operation })) } }
    const revision = hash(configuration)
    return { protocolVersion: 1, revision, configuration, scopePolicy: 'source-bound',
      checkCurrent: () => { try { return !this.#disposed && this.#epoch === epoch && hash(configuration) === revision && checkBinding() === true } catch { return false } } }
  }
  revision(id, content) { return hash([content, this.state.resources[id] ?? null]) }
  observe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener) }
  emit(fact) { if (!this.#disposed) for (const listener of this.#listeners) { try { listener(structuredClone(fact)) } catch {} } }
  registerUsage(listener, options) {
    if (this.#disposed) fail('SOURCE_UNAVAILABLE', 'Source is unavailable')
    const stop = this.#usage.register(listener, options); this.#epoch++
    return () => { const epoch = this.#usage.epoch; stop(); if (this.#usage.epoch !== epoch) this.#epoch++ }
  }
  setMode({ id, mode, expectedRevision, operationId, signal, scope }, content) {
    signal?.throwIfAborted(); localScope(scope)
    if (this.#disposed) fail('SOURCE_UNAVAILABLE', 'Source is unavailable')
    if (!['native', 'managed'].includes(mode) || typeof operationId !== 'string' || !operationId || operationId.length > 200) fail('VALIDATION_FAILED', 'Explicit mode and operationId required')
    const previous = this.state.resources[id], fingerprint = hash({ mode, expectedRevision, scope: scope ?? {} })
    const prior = previous?.operations?.find(op => op.id === operationId)
    if (prior) { if (prior.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'Operation ID reused'); return }
    if (this.revision(id, content) !== expectedRevision) fail('REVISION_CONFLICT', 'Source revision changed')
    const next = { ...this.state, resources: { ...this.state.resources, [id]: { mode, operations: [...(previous?.operations ?? []), { id: operationId, fingerprint }] } } }
    atomicJson(this.path, next); this.state = next; this.#epoch++
  }
  async decision(row, context, currentRevision) {
    const epoch = this.#epoch, revision = row.revision, mode = this.mode(row.id)
    const current = () => !this.#disposed && epoch === this.#epoch && currentRevision() === revision
    const dependency = context.dependencyEvent?.usage === 'prompt-template-dependency'
    if (this.#usage.size === 0) return { enabled: true, configRevision: null, checkCurrent: current }
    const leases = [], revisions = []
    for (const { handler, providerId } of [...this.#usage]) {
      const response = await handler({ id: row.id, on: 'before_model_request', managementMode: mode,
        scope: { authority: 'local', sessionId: context.sessionId }, event: { ...(context.dependencyEvent ?? {}), preview: context.preview === true, turn: context.turn ?? null, step: context.step ?? null } })
      context.signal?.throwIfAborted()
      if (!current()) fail('SOURCE_POLICY_CHANGED', 'Source changed during policy evaluation')
      if (response === undefined) { if (dependency || providerId === 'dsh-memory-manager') return {enabled:false,reason:providerId === 'dsh-memory-manager' ? 'manager-decision-required' : 'dependency-lease-required'}; continue }
      if (!response || response.enabled !== true) return { enabled: false, reason: response?.reason ?? 'denied' }
      validateStrategy(this.type, response.strategy)
      if (typeof response.checkCurrent !== 'function') fail('SOURCE_LEASE_REQUIRED', 'Managed execution needs a current policy lease')
      leases.push(response.checkCurrent); revisions.push(response.configRevision ?? null)
    }
    return { enabled: leases.length > 0 || mode !== 'managed', configRevision: revisions, checkCurrent: () => current() && leases.every(check => check() === true) }
  }
  dispose() { this.#disposed = true; this.#epoch++; this.#listeners.clear(); this.#usage.dispose() }
}
