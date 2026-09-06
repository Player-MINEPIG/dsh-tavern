// DSH 0.1.2-rc.1 public Chat timeline: the newest turn boundary is authoritative,
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
