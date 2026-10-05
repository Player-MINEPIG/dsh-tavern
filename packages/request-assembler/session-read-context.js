import { AsyncLocalStorage } from 'node:async_hooks'

// Private Host composition. A cold Session already resolved by the preview API
// is visible to read providers only while that exact assembly is in flight.
// It never enters the live Session store and grants no transaction capability.
export function createSessionReadContext(getLiveSession) {
  const storage = new AsyncLocalStorage()
  let disposed = false
  const getSession = id => {
    if (disposed) return undefined
    const live = getLiveSession(id), entry = storage.getStore()
    return live ?? (entry?.active && entry.session.id === id ? entry.session : undefined)
  }
  return { getSession, isActive: () => !disposed && storage.getStore()?.active === true,
    async run(session, callback) {
      if (disposed) throw Object.assign(new Error('Preview session reader is unloaded'), { code: 'PREVIEW_SESSION_UNAVAILABLE', status: 409 })
      if (!session || session.id !== session.header?.id) throw Object.assign(new Error('Preview requires a resolved Session identity'), { code: 'PREVIEW_SESSION_SCOPE', status: 403 })
      const entry = { session, active: true }
      try { return await storage.run(entry, callback) } finally { entry.active = false }
    },
    dispose() { disposed = true },
  }
}
