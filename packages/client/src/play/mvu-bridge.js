import { API_V1 } from '../../../identity.js'
import { tavernFetch } from '../api-fetch.js'
import { renderingWriteRequests } from './rendering-write-requests.js'

function copy(value) { return JSON.parse(JSON.stringify(value)) }
function immutable(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(immutable) }; return value }

/** Host-owned scope; do not pass this binding or its transport into a card VM. */
export async function createMvuCardBinding({ client, scope, pollMs = 1000, signal, writeGrant } = {}) {
  signal?.throwIfAborted()
  const bound = immutable(copy(scope))
  if ((typeof bound.sessionId !== 'string' || !bound.sessionId) && !(bound.mode === 'draft' && typeof bound.playthroughId === 'string' && !Object.hasOwn(bound, 'sessionId'))) throw new TypeError('MVU session or explicit draft scope is required')
  const controller = new AbortController(), listeners = new Set()
  const bindingId = writeGrant ? crypto.randomUUID() : undefined
  let disposed = false, timer, current, polling = false, capability, creating = false, generation = 0, readFailed=false
  const dispose = () => { if (disposed) return; if (capability || creating) { const revoked = capability ?? bindingId; capability = undefined; creating = false; void renderingWriteRequests.revokeMvuBinding(revoked, () => post('card-binding/revoke', { capability: revoked }, AbortSignal.timeout(10000))) }; disposed = true; clearTimeout(timer); listeners.clear(); controller.abort(); signal?.removeEventListener('abort', dispose) }
  signal?.addEventListener('abort', dispose, { once: true })
  const post = async (path, body, requestSignal = controller.signal) => {
    if (client?.postMvuOperation) return client.postMvuOperation(path, body, { signal: requestSignal, keepalive: path === 'card-binding/revoke' })
    const response = await tavernFetch(`${API_V1}/mvu/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal, keepalive: path === 'card-binding/revoke' })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'MVU write rejected'), { code: result.code })
    return result
  }
  const read = async () => {
    if (client?.getMvuSnapshot) return client.getMvuSnapshot(bound, { signal: controller.signal })
    const response = await tavernFetch(`${API_V1}/mvu/snapshot?scope=${encodeURIComponent(JSON.stringify(bound))}`, { signal: controller.signal, cache: 'no-store' })
    let result
    try{result=await response.json()}catch{throw Object.assign(Error(`MVU snapshot: HTTP ${response.status}`),{status:response.status,...(response.ok?{code:'MVU_INVALID_SNAPSHOT'}:{})})}
    if (!response.ok) throw Object.assign(new Error(result.error??`MVU snapshot: HTTP ${response.status}`),{status:response.status,code:result.code})
    return result
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
    if (writeGrant) { creating = true; const binding = await post('card-binding', { scope: bound, grantId: writeGrant.grantId, sourceIdentity: writeGrant.sourceIdentity, bindingId }); if (binding.capability !== bindingId) throw new TypeError('Invalid MVU binding identity'); capability = binding.capability; creating = false; current = validate(binding.snapshot); signal?.throwIfAborted() }
  } catch (error) { dispose(); throw error }
  const poll = async () => {
    if (disposed || polling || !listeners.size) return
    polling = true
    const issuedGeneration = generation
    let transportFailure=false
    try {
      let input;try{input=await read()}catch(error){transportFailure=true;throw error}
      const next = validate(input)
      if (!disposed && issuedGeneration === generation && next.revision >= current.revision) {
        readFailed=false
        if(JSON.stringify(next)!==JSON.stringify(current)){current=next;for (const listener of listeners) { try { listener(copy(current)) } catch {} }}
      }
    } catch (error) {
      if (!disposed && issuedGeneration === generation) {
        readFailed=true
        // Only transport failures retain the last verified read. Scope/access
        // rejection and malformed replies always invalidate it. No new write
        // may use a retained display until a fresh read succeeds.
        const temporary=transportFailure&&!['AbortError','SyntaxError'].includes(error.name)&&!error.code&&(!error.status||error.status>=500)
        const next = temporary&&current.status==='available'?immutable({...current,readState:'failed',error:'MVU_READ_FAILED'}):immutable({ version: 1, scope: bound, revision: 0, status: 'unavailable', variables: {}, error: 'MVU_READ_FAILED' })
        if(JSON.stringify(next)!==JSON.stringify(current)){current=next;for (const listener of listeners) { try { listener(copy(current)) } catch {} }}
      }
    } finally { polling = false; if (!disposed && listeners.size) timer = setTimeout(poll, Math.max(250, pollMs)) }
  }
  const submit = async ({ operation, value, expectedRevision, operationId, cause = 'script', signal: writeSignal } = {}) => {
    if (disposed) throw new Error('MVU binding is disposed')
    if (!capability) throw Object.assign(new Error('MVU binding is read-only'), { code: 'MVU_WRITE_DENIED' })
    if (readFailed) throw Object.assign(new Error('A fresh MVU snapshot is required before writing'), {code:'MVU_READ_FAILED'})
    if (current.status!=='available') throw Object.assign(new Error('MVU snapshot is unavailable'),{code:'MVU_SNAPSHOT_UNAVAILABLE'})
    writeSignal?.throwIfAborted()
    const pending = new AbortController(), abort = () => pending.abort()
    controller.signal.addEventListener('abort', abort, { once: true }); writeSignal?.addEventListener('abort', abort, { once: true })
    try {
      const next = validate(await post('card-write', { capability, operation, value, expectedRevision, operationId, cause }, pending.signal))
      const receipt = immutable({ operationId, result: copy(next) })
      if (disposed || pending.signal.aborted) throw Object.assign(new DOMException('MVU write cancelled', 'AbortError'), { operationReceipt: receipt })
      if (next.revision >= current.revision) { current = next; generation++ }
      for (const listener of listeners) { try { listener(copy(current)) } catch {} }
      return { snapshot: copy(current), receipt }
    } finally { controller.signal.removeEventListener('abort', abort); writeSignal?.removeEventListener('abort', abort) }
  }
  return Object.freeze({
    getSnapshot: () => { if (disposed) throw new Error('MVU binding is disposed'); return { ...copy(current), writable: Boolean(capability)&&!readFailed&&current.status==='available' } },
    async write(request) { return (await submit(request)).snapshot },
    async writeOperation(request) { return (await submit(request)).receipt },
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
