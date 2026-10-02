import { API_V1 } from '../../../identity.js'
import { tavernFetch } from '../api-fetch.js'

function copy(value) { return JSON.parse(JSON.stringify(value)) }
function immutable(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(immutable) }; return value }

/** Host-owned scope; do not pass this binding or its transport into a card VM. */
export async function createMvuCardBinding({ client, scope, pollMs = 1000, signal, writeGrant } = {}) {
  signal?.throwIfAborted()
  const bound = immutable(copy(scope))
  if (typeof bound.sessionId !== 'string' || !bound.sessionId) throw new TypeError('MVU session scope is required')
  const controller = new AbortController(), listeners = new Set()
  let disposed = false, timer, current, polling = false, capability, generation = 0
  const dispose = () => { if (capability) { const revoked = capability; capability = undefined; post('card-binding/revoke', { capability: revoked }, null).catch(() => {}) }; disposed = true; clearTimeout(timer); listeners.clear(); controller.abort(); signal?.removeEventListener('abort', dispose) }
  signal?.addEventListener('abort', dispose, { once: true })
  const post = async (path, body, requestSignal = controller.signal) => {
    if (client?.postMvuOperation) return client.postMvuOperation(path, body, { signal: requestSignal })
    const response = await tavernFetch(`${API_V1}/mvu/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'MVU write rejected'), { code: result.code })
    return result
  }
  const read = async () => {
    if (client?.getMvuSnapshot) return client.getMvuSnapshot(bound, { signal: controller.signal })
    const response = await tavernFetch(`${API_V1}/mvu/snapshot?scope=${encodeURIComponent(JSON.stringify(bound))}`, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`MVU snapshot: HTTP ${response.status}`)
    return response.json()
  }
  const validate = input => {
    if (input?.version !== 1 || !['available', 'unavailable'].includes(input.status) || !input.variables || typeof input.variables !== 'object' || Array.isArray(input.variables)
      || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new TypeError('Invalid MVU snapshot')
    for (const [key, value] of Object.entries(bound)) if (input.scope?.[key] !== value) throw new TypeError('MVU snapshot scope mismatch')
    if (input.status === 'available' && (!input.variables.stat_data || !input.variables.schema)) throw new TypeError('Invalid MVU variables')
    return immutable(copy(input))
  }
  try {
    current = validate(await read()); signal?.throwIfAborted()
    if (writeGrant) { const binding = await post('card-binding', { scope: bound, grantId: writeGrant.grantId, sourceIdentity: writeGrant.sourceIdentity }); capability = binding.capability; current = validate(binding.snapshot); signal?.throwIfAborted() }
  } catch (error) { dispose(); throw error }
  const poll = async () => {
    if (disposed || polling || !listeners.size) return
    polling = true
    const issuedGeneration = generation
    try {
      const next = validate(await read())
      if (!disposed && issuedGeneration === generation && next.revision >= current.revision && JSON.stringify(next) !== JSON.stringify(current)) { current = next; for (const listener of listeners) { try { listener(copy(current)) } catch {} } }
    } catch (error) {
      if (!disposed && issuedGeneration === generation) {
        current = immutable({ version: 1, scope: bound, revision: 0, status: 'unavailable', variables: {}, error: 'MVU_READ_FAILED' })
        for (const listener of listeners) { try { listener(copy(current)) } catch {} }
      }
    } finally { polling = false; if (!disposed && listeners.size) timer = setTimeout(poll, Math.max(250, pollMs)) }
  }
  return Object.freeze({
    getSnapshot: () => { if (disposed) throw new Error('MVU binding is disposed'); return { ...copy(current), writable: Boolean(capability) } },
    async write({ operation, value, expectedRevision, operationId, cause = 'script', signal: writeSignal } = {}) {
      if (disposed) throw new Error('MVU binding is disposed')
      if (!capability) throw Object.assign(new Error('MVU binding is read-only'), { code: 'MVU_WRITE_DENIED' })
      writeSignal?.throwIfAborted()
      const pending = new AbortController(), abort = () => pending.abort()
      controller.signal.addEventListener('abort', abort, { once: true }); writeSignal?.addEventListener('abort', abort, { once: true })
      try {
        const next = validate(await post('card-write', { capability, operation, value, expectedRevision, operationId, cause }, pending.signal))
        if (disposed || pending.signal.aborted) throw new DOMException('MVU write cancelled', 'AbortError')
        if (next.revision >= current.revision) { current = next; generation++ }
        for (const listener of listeners) { try { listener(copy(current)) } catch {} }
        return copy(current)
      } finally { controller.signal.removeEventListener('abort', abort); writeSignal?.removeEventListener('abort', abort) }
    },
    subscribe(listener) {
      if (disposed) throw new Error('MVU binding is disposed')
      if (typeof listener !== 'function') throw new TypeError('Listener is required')
      const first = listeners.size === 0
      listeners.add(listener)
      if (first && !polling) timer = setTimeout(poll, Math.max(250, pollMs))
      return () => { listeners.delete(listener); if (!listeners.size) clearTimeout(timer) }
    },
    dispose,
  })
}
