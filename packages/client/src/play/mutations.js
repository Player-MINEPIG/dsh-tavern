/**
 * Run a catalog/timeline read-modify-write through the live CAS primitive when
 * available. Older/custom clients only expose get and put methods; keep those clients
 * usable with the historical single-attempt fallback.
 */
export async function updateCatalog(client, mutator, options) {
  if (typeof client?.updateCatalog === 'function') return client.updateCatalog(mutator, options)
  const current = await readCatalogOrEmpty(client)
  const next = await mutator(current)
  const saved = await client.putCatalog(next)
  return saved ?? next
}

export async function updateTimeline(client, playthrough, mutator, options) {
  if (typeof client?.updateTimeline === 'function') return client.updateTimeline(playthrough, mutator, options)
  const current = options?.initial ?? await client.getTimeline(playthrough)
  const next = await mutator(current)
  const saved = await client.putTimeline(playthrough, next)
  return saved ?? next
}

async function readCatalogOrEmpty(client) {
  try {
    return await client.getCatalog()
  } catch (error) {
    if (error?.code === 'PLAY_PATH_NOT_FOUND' && (error?.status === undefined || error?.status === 404)) return { playthroughs: [] }
    throw error
  }
}
