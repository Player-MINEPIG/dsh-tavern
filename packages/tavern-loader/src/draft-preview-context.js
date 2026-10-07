import { AsyncLocalStorage } from 'node:async_hooks'

// A resource scope, never a Session: asynchronous previews cannot borrow the
// active conversation's selections or leak their overrides into real requests.
export function createDraftPreviewContext() {
  const storage = new AsyncLocalStorage()
  return {
    current: () => { const entry = storage.getStore(); return entry?.active ? entry.record : undefined },
    async run(record, callback) {
      const entry = { record, active: true }
      try { return await storage.run(entry, callback) } finally { entry.active = false }
    },
  }
}
