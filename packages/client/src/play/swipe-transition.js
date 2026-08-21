const MAX_PENDING_TRANSITIONS = 32
const pending = new Map()

export function queueSwipeTransition(sessionId, direction) {
  if (typeof sessionId !== 'string' || sessionId === '') return
  if (direction !== 'previous' && direction !== 'next') return
  pending.delete(sessionId)
  pending.set(sessionId, direction)
  while (pending.size > MAX_PENDING_TRANSITIONS) {
    pending.delete(pending.keys().next().value)
  }
}

export function consumeSwipeTransition(sessionId) {
  const direction = pending.get(sessionId) ?? null
  pending.delete(sessionId)
  return direction
}
