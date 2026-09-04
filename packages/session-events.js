/**
 * Read the public, immutable Session event snapshot exposed by DSH 0.1.2.
 * Keeping this boundary in one place prevents feature modules from depending on
 * the removed mutable `Session.events` array.
 */
export function snapshotSessionEvents(session) {
  if (typeof session?.snapshotEvents !== 'function') return []
  const events = Number.isSafeInteger(session.seq)
    ? session.snapshotEvents(0, session.seq)
    : session.snapshotEvents()
  return Array.isArray(events) ? events : []
}

/** Read only the events owned by this session, excluding inherited seed events. */
export function ownSessionEvents(session) {
  if (typeof session?.ownEvents !== 'function') return []
  const events = session.ownEvents()
  return Array.isArray(events) ? events : []
}
