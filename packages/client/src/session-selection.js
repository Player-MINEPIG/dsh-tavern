// Match the native workspace browser: catalog membership and other retained
// consumers do not select the main conversation.
export function mainSession(snapshot) {
  return Object.values(snapshot?.byId ?? {})
    .find(session => (session.retainedBy?.mainView ?? 0) > 0) ?? null
}

export function mainSessionId(snapshot) {
  return mainSession(snapshot)?.id ?? null
}

export function mainSessionBlank(snapshot) {
  const session = mainSession(snapshot)
  return session === null || session.blank === true
}

export function retainedSessions(snapshot) {
  return Object.values(snapshot?.byId ?? {}).filter(session =>
    Object.values(session.retainedBy ?? {}).some(count => count > 0))
}
