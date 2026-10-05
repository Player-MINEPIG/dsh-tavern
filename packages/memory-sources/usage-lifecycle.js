/** Trusted Host policy registrations. This is the single source of actual delegation. */
export class UsageLifecycle {
  #registrations = new Set(); #epoch = 0; #disposed = false
  get epoch() { return this.#epoch }
  get size() { return this.#registrations.size }
  get managementMode() { return [...this.#registrations].some(r => r.providerId === 'dsh-memory-manager') ? 'managed' : 'native' }
  register(handler, options = {}) {
    if (this.#disposed || typeof handler !== 'function') throw new TypeError('Active Host usage handler required')
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(k => k !== 'providerId')
      || (options.providerId !== undefined && options.providerId !== 'dsh-memory-manager')) throw new TypeError('Unsupported usage provider')
    const registration = { handler, providerId: options.providerId ?? null }
    this.#registrations.add(registration); this.#epoch++
    return () => { if (this.#registrations.delete(registration)) this.#epoch++ }
  }
  current(epoch) { return !this.#disposed && epoch === this.#epoch }
  [Symbol.iterator]() { return this.#registrations[Symbol.iterator]() }
  dispose() { this.#disposed = true; this.#epoch++; this.#registrations.clear() }
}
