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

// The navigation owner knows which rendered Session initiated the swipe.
// Record that explicit source so another retained surface cannot seed it.
export function setSwipeTransitionSource(sessionId, sourceSessionId) {
  const intent = pending.get(sessionId)
  if (intent !== undefined && typeof sourceSessionId === 'string' && sourceSessionId !== '') {
    pending.set(sessionId, { ...intent, sourceSessionId })
  }
}

export function peekSwipeTransition(sessionId) {
  return pending.get(sessionId) ?? null
}
