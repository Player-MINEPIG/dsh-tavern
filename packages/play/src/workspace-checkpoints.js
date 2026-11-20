import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError } from './http.js'
import { isSafeCatalogSegment, parseCatalogJson } from './timeline.js'

const limit = 128 * 1024
const invalid = () => httpError(400, 'Invalid checkpoint identity, data or revision', 'PLAY_CHECKPOINT_INVALID')
const conflict = () => httpError(409, 'Checkpoint owner or revision changed', 'PLAY_CHECKPOINT_CONFLICT')
const hash = value => createHash('sha256').update(value).digest('hex')

function read(path) {
  try { return readJsonFile(path, limit) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}

// The caller owns its data schema. The Host owns scope, revision, exclusion
// and replay of completed keys. It does not interpret workflow names or stages.
export function createWorkspaceCheckpoints(store) {
  const root = join(store.storageDir, 'play-checkpoints')
  const scope = () => JSON.stringify([store.get().workspaceId, store.get().rootPath])
  function directory(id, expectedScope) {
    if (!isSafeCatalogSegment(id)) throw invalid()
    if (!store.get().rootPath || expectedScope !== scope()) throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
    return join(root, hash(JSON.stringify([expectedScope, id])))
  }
  function get(id, expectedScope, key) {
    const dir = directory(id, expectedScope)
    if (key !== undefined && !isSafeCatalogSegment(key)) throw invalid()
    const current = read(join(dir, 'current.json'))
    if (key === undefined || current?.key === key) return current
    return read(join(dir, hash(key) + '.json'))
  }
  function put(id, request) {
    const { key, owner, expectedRevision, expectedWorkspaceScope, expectedTimelineRevision, data, released = false } = request ?? {}
    if (!isSafeCatalogSegment(key) || !isSafeCatalogSegment(owner) || typeof released !== 'boolean'
      || !(data && typeof data === 'object' && !Array.isArray(data))
      || !(expectedRevision === null || (Number.isSafeInteger(expectedRevision) && expectedRevision > 0))) throw invalid()
    const dir = directory(id, expectedWorkspaceScope)
    const path = join(dir, 'current.json')
    const current = read(path)
    if (expectedRevision === null) {
      if (released || !/^[a-f0-9]{64}$/.test(expectedTimelineRevision)) throw invalid()
      if ((current && !current.released) || get(id, expectedWorkspaceScope, key)) throw conflict()
      const rows = parseCatalogJson(store.readFile('catalog.json').content).playthroughs
      const row = rows.find(item => item.id === id)
      if (!row || row.ext?.pmpDshTavern?.archivedAt
        || store.readFile(row.path).revision !== expectedTimelineRevision) throw conflict()
      const binding = request.expectedBinding
      if (binding !== undefined && (binding?.path !== row.path
        || binding.rootSessionId !== (row.ext?.pmpDshTavern?.rootSessionId ?? null)
        || binding.characterId !== (row.ext?.pmpDshTavern?.characterId ?? null))) throw conflict()
      store.assertPlaythroughAvailable(row, 'checkpoint')
      if (current) atomicJson(join(dir, hash(current.key) + '.json'), current, limit)
    } else if (!current || current.released || current.key !== key || current.owner !== owner || current.revision !== expectedRevision) {
      throw conflict()
    }
    const next = { key, owner, revision: (expectedRevision ?? 0) + 1, released, data }
    if (Buffer.byteLength(JSON.stringify(next, null, 2)) + 1 > limit) throw httpError(413, 'Checkpoint data too large', 'PLAY_CHECKPOINT_TOO_LARGE')
    atomicJson(path, next, limit)
    return next
  }
  function assertOwner(id, key, expectedScope) {
    if (!isSafeCatalogSegment(key)) throw invalid()
    const current = get(id, expectedScope)
    if (!current || current.released || current.key !== key) throw conflict()
    return current
  }
  function active(id) {
    if (!existsSync(root)) return null
    const current = get(id, scope())
    return current && !current.released ? current : null
  }
  return { get, put, assertOwner, active, hasRecords: () => existsSync(root) }
}
