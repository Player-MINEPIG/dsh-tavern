/** Archive state belongs to the playthrough, not to its DSH sessions. */
export function isPlaythroughArchived(playthrough) {
  return typeof playthrough?.ext?.pmpDshTavern?.archivedAt === 'string'
}

export function isArchiveTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}
