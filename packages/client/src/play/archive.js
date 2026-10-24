import { withPlaythroughArchive } from '../../../play/src/playthrough-state.js'
import { updateCatalog } from './mutations.js'

/** One catalog CAS mutation; files, membership and selections remain intact. */
export async function setPlaythroughArchived(client, playthrough, archived, { now = () => new Date() } = {}) {
  if (typeof archived !== 'boolean') throw new TypeError('archived must be a boolean')
  const archivedAt = archived ? now().toISOString() : null
  const catalog = await updateCatalog(client, current => {
    const index = current.playthroughs.findIndex(item => item.id === playthrough.id && item.path === playthrough.path)
    if (index < 0) throw new Error('play.archive.missing')
    const fresh = current.playthroughs[index]
    const updated = withPlaythroughArchive(fresh, archivedAt)
    if (updated === fresh) return current
    const playthroughs = [...current.playthroughs]
    playthroughs[index] = updated
    return { ...current, playthroughs }
  })
  return catalog.playthroughs.find(item => item.id === playthrough.id)
}
