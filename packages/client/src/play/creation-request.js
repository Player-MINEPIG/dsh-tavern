// Retain only the request identity until the Host acknowledges publication.
// The scoped key lets a remounted view retry a lost response with the same ID.
const adapters = new WeakMap()
export async function creationRequest(client, action, creationId, run, reusable) {
  const deadline = AbortSignal.timeout(35_000)
  let onAbort
  const timeout = new Promise((_, reject) => {
    onAbort = () => reject(Object.assign(new Error('Creation timed out. Retry the same action or open Repair playthrough to check its status.'), { code: 'PLAY_CREATION_TIMEOUT' }))
    deadline.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([submit(client, action, creationId, run, reusable, deadline), timeout]) }
  finally { deadline.removeEventListener('abort', onAbort) }
}

async function submit(client, action, creationId, run, reusable, signal) {
  const binding = await client.getWorkspace?.({ signal })
  signal.throwIfAborted()
  const scope = binding && JSON.stringify([binding.workspaceId, binding.rootPath])
  const key = 'pmp-dsh-tavern:creation:' + JSON.stringify([client.apiRoot, scope, action])
  let storage
  if (typeof window !== 'undefined') {
    storage = window.localStorage
    if (!storage) throw new Error('Playthrough creation requires browser storage for retry recovery.')
  } else {
    if (!adapters.has(client)) adapters.set(client, new Map())
    const records = adapters.get(client)
    storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) }
  }
  const previous = storage.getItem(key)
  if (!previous && !creationId && reusable) {
    const found = await reusable()
    if (found) return found
  }
  signal.throwIfAborted()
  const id = creationId ?? storage.getItem(key) ?? globalThis.crypto.randomUUID()
  storage.setItem(key, id)
  const acknowledge = () => { if (storage.getItem(key) === id) storage.removeItem(key) }
  try {
    const result = await run({ creationId: id, ...(scope ? { expectedWorkspaceScope: scope } : {}) }, { signal })
    signal.throwIfAborted()
    acknowledge()
    return result
  } catch (error) {
    if (error.code === 'PLAY_CREATION_DISMISSED') acknowledge()
    throw error
  }
}
