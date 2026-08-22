const MAX_PENDING_TRANSITIONS = 32
const pending = new Map()

export function queueSwipeTransition(sessionId, direction, nodeId) {
  if (typeof sessionId !== 'string' || sessionId === '') return
  if (direction !== 'previous' && direction !== 'next') return
  if (typeof nodeId !== 'string' || nodeId === '') return
  pending.delete(sessionId)
  pending.set(sessionId, { direction, nodeId })
  while (pending.size > MAX_PENDING_TRANSITIONS) {
    pending.delete(pending.keys().next().value)
  }
}

export function consumeSwipeTransition(sessionId) {
  const intent = pending.get(sessionId) ?? null
  pending.delete(sessionId)
  return intent
}
