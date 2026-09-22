import { CLIENT_REFRESH_EVENT } from '../../../identity.js'

// UI-only ownership while a real DSH session is generating. Durable variants
// still require actual user/assistant coordinates before they can be committed.
const clients = new WeakMap()
const key = playthrough => JSON.stringify([playthrough?.id ?? null, playthrough?.path ?? null])
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
}
export function pendingSwipes(client) {
  return [...(clients.get(client)?.values() ?? [])]
}
export function pendingSwipe(client, playthrough) {
  return clients.get(client)?.get(key(playthrough)) ?? null
}
export function pendingSwipeForSession(client, sessionId) {
  return pendingSwipes(client).find(item => item.sessionId === sessionId) ?? null
}
export function beginPendingSwipe(client, value) {
  let entries = clients.get(client)
  if (!entries) clients.set(client, entries = new Map())
  const pending = { ...value, error: null }
  entries.set(key(value.playthrough), pending)
  notify()
  return pending
}
export function finishPendingSwipe(client, pending, error = null) {
  const entries = clients.get(client)
  if (entries?.get(key(pending.playthrough)) !== pending) return
  if (error === null) entries.delete(key(pending.playthrough))
  else pending.error = error instanceof Error ? error.message : String(error)
  notify()
}

export function pendingSwipeTimeline(timeline, entries, sourceIndex, sessionId) {
  const prefix = entries.slice(0, sourceIndex)
  const parent = prefix.at(-1)
  return {
    ...timeline,
    nodes: prefix.map(({ node, variant }) => ({ ...node, adoptedVariantId: variant.id })),
    head: parent ? { sessionId, nodeId: parent.node.id, variantId: parent.variant.id } : null,
  }
}
