// DSH public Chat timeline: the newest turn boundary is authoritative,
// including empty/cancelled turns that may not produce an assistant message.
export function latestTurnFailed(chat) {
  const { timeline } = chat
  const latest = timeline.turns.get(timeline.turnOrder.at(-1))
  return latest?.end?.data.reason.kind === 'error'
}

export function sessionFailed(session) {
  return session.promptError != null || session.lastAgentError != null || session.openError != null
}

export function submissionInProgress(session) {
  return session.running === true || session.awaitingFirstTurn === true
    || (session.pendingSubmissions?.length ?? 0) > 0
}

// Keep selectors primitive so useSession/useChat subscriptions remain stable.
// An empty detail still denotes a failure; null denotes no failure.
export function errorDetail(error) {
  if (typeof error === 'string') return error.trim()
  if (!error || typeof error !== 'object') return ''
  return [error.code, error.message].filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim()).join(': ')
}

export function sessionFailureDetail(session) {
  const errors = [session.promptError?.error, session.openError, session.lastAgentError]
    .map(errorDetail).filter(Boolean)
  return sessionFailed(session) ? [...new Set(errors)].join('\n') : null
}

export function latestTurnFailureDetail(chat) {
  const latest = chat.timeline.turns.get(chat.timeline.turnOrder.at(-1))
  return latestTurnFailed(chat) ? errorDetail(latest.end.data.reason.error) : null
}
