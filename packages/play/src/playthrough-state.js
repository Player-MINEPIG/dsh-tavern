/** Archive state belongs to the playthrough, not to its DSH sessions. */
export function isPlaythroughArchived(playthrough) {
  return typeof playthrough?.ext?.pmpDshTavern?.archivedAt === 'string'
}

export function withPlaythroughArchive(playthrough, archivedAt) {
  if (isPlaythroughArchived(playthrough) === (archivedAt !== null)) return playthrough
  const known = { ...playthrough.ext?.pmpDshTavern }
  if (archivedAt === null) delete known.archivedAt
  else known.archivedAt = archivedAt
  const ext = { ...playthrough.ext }
  if (Object.keys(known).length === 0) delete ext.pmpDshTavern
  else ext.pmpDshTavern = known
  const updated = { ...playthrough }
  if (Object.keys(ext).length === 0) delete updated.ext
  else updated.ext = ext
  return updated
}

export function isArchiveTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
}
