import { API_V1 } from '../../../identity.js'
import { tavernFetch } from '../api-fetch.js'

function copy(value) { return JSON.parse(JSON.stringify(value)) }
function immutable(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(immutable) }; return value }

/** Host-owned scope; do not pass this binding or its transport into a card VM. */
export async function createMvuCardBinding({ client, scope, pollMs = 1000, signal } = {}) {
  signal?.throwIfAborted()
  const bound = immutable(copy(scope))
  if (typeof bound.sessionId !== 'string' || !bound.sessionId) throw new TypeError('MVU session scope is required')
  const controller = new AbortController(), listeners = new Set()
  let disposed = false, timer, current, polling = false
  const dispose = () => { disposed = true; clearTimeout(timer); listeners.clear(); controller.abort(); signal?.removeEventListener('abort', dispose) }
  signal?.addEventListener('abort', dispose, { once: true })
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
  try { current = validate(await read()); signal?.throwIfAborted() } catch (error) { dispose(); throw error }
  const poll = async () => {
    if (disposed || polling || !listeners.size) return
    polling = true
    try {
      const next = validate(await read())
      if (!disposed && JSON.stringify(next) !== JSON.stringify(current)) { current = next; for (const listener of listeners) { try { listener(copy(current)) } catch {} } }
    } catch (error) {
      if (!disposed) {
        current = immutable({ version: 1, scope: bound, revision: 0, status: 'unavailable', variables: {}, error: 'MVU_READ_FAILED' })
        for (const listener of listeners) { try { listener(copy(current)) } catch {} }
      }
    } finally { polling = false; if (!disposed && listeners.size) timer = setTimeout(poll, Math.max(250, pollMs)) }
  }
  return Object.freeze({
    getSnapshot: () => { if (disposed) throw new Error('MVU binding is disposed'); return copy(current) },
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
