import { httpError } from './http.js'
import { parseCatalogJson, validatePlayDocument } from './timeline.js'

export function readCreationFile(store, path) {
  try { return store.readFile(path) }
  catch (error) { if (error.code !== 'PLAY_PATH_NOT_FOUND') throw error; return null }
}

export function nextPlaythroughNumber(catalog, characterId) {
  let maximum = 0, ordinal = 0
  for (const row of catalog?.playthroughs ?? []) {
    const meta = row.ext?.pmpDshTavern
    if (meta?.characterId !== characterId) continue
    ordinal++
    const number = meta.playthroughNumber
    maximum = Math.max(maximum, Number.isSafeInteger(number) && number > 0 ? number : ordinal)
  }
  return maximum + 1
}

export const creationConflict = () => httpError(409, 'Creation destination or checkpoint changed. Inspect Repair playthrough.', 'PLAY_CREATION_CONFLICT')

export function creationRow(catalog, id, path, meta) {
  const rows = catalog.playthroughs.filter(row => row.id === id || row.path === path)
  if (!rows.length) return null
  const row = rows[0], actual = row.ext?.pmpDshTavern
  if (rows.length !== 1 || row.id !== id || row.path !== path || actual?.characterId !== meta.characterId
    || (meta.draftId && actual.draftId !== meta.draftId) || (meta.rootSessionId && actual.rootSessionId !== meta.rootSessionId)) throw creationConflict()
  return row
}

// A caller holds its durable intent before entering. Directory creation is part
// of the workspace store's create-only timeline write. Replays accept its exact
// contents and merge the new row into the latest catalog with a revision check.
export function publishCreation(store, { id, path, meta, content, createdAt, scope }, beforeWrite) {
  const file = readCreationFile(store, 'catalog.json')
  const catalog = file ? parseCatalogJson(file.content) : { playthroughs: [] }
  const existing = creationRow(catalog, id, path, meta)
  const timeline = readCreationFile(store, path)
  const options = { validate: validatePlayDocument, expectedRevisionPresent: true, expectedWorkspaceScope: scope }
  if (timeline) {
    if (timeline.content !== content) throw creationConflict()
  } else {
    if (existing) throw creationConflict()
    beforeWrite?.(null, path)
    store.writeFile(path, content, { ...options, expectedRevision: null })
  }
  if (store.readFile(path).content !== content) throw creationConflict()
  if (existing) return existing
  const number = nextPlaythroughNumber(catalog, meta.characterId)
  const row = { id, path, title: number + '周目', lastOpenedAt: createdAt, ext: { pmpDshTavern: { ...meta, playthroughNumber: number, autoTitle: true } } }
  beforeWrite?.(file, 'catalog.json')
  store.writeFile('catalog.json', JSON.stringify({ ...catalog, playthroughs: [...catalog.playthroughs, row] }), { ...options, expectedRevision: file?.revision ?? null })
  const saved = creationRow(parseCatalogJson(store.readFile('catalog.json').content), id, path, meta)
  if (!saved) throw creationConflict()
  return saved
}
