import { randomUUID } from 'node:crypto'
import { lstatSync, readdirSync, renameSync } from 'node:fs'
import { dirname, isAbsolute, relative } from 'node:path'
import { httpError } from './http.js'
import { posixPlayPath, resolvePlayPath } from './paths.js'
import { parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'

const TRASH = '.tavern-trash'
const BACKUP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function conflict(message) {
  throw httpError(409, message, 'PLAY_CLEANUP_CONFLICT')
}

function ownedDirectory(row, catalog) {
  const path = posixPlayPath(row.path)
  const directory = dirname(path)
  if (directory === '.' || directory.split('/').at(-1) !== row.id || !row.id.startsWith('playthrough-')) {
    conflict('Cleanup requires a dedicated playthrough directory')
  }
  if (catalog.playthroughs.some(other => other.id !== row.id && (
    posixPlayPath(other.path).startsWith(directory + '/')
    || directory.startsWith(dirname(posixPlayPath(other.path)) + '/')
  ))) conflict('The playthrough directory is shared')
  if (directory === TRASH || directory.startsWith(TRASH + '/')) conflict('Cannot clean a recovery directory')
  return directory
}

function assertDirectoryTree(path) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) conflict('Cleanup directory must be a real directory')
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) conflict('Cleanup directory contains a symlink')
    if (entry.isDirectory()) assertDirectoryTree(path + '/' + entry.name)
    else if (!entry.isFile()) conflict('Cleanup directory contains a special file')
  }
}

function exists(path) {
  try { return lstatSync(path) !== undefined } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function within(directory, path) {
  const suffix = relative(directory.normalize('NFC').toLowerCase(), path.normalize('NFC').toLowerCase())
  return suffix === '' || !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('../') && !suffix.startsWith('..\\')
}

/** Recovery records and moved files remain inside the bound RP workspace. */
export class PlayCleanupService {
  constructor({ workspaceStore, maintenance, protectedPaths = () => [], now = () => new Date().toISOString() }) {
    this.workspace = workspaceStore
    this.maintenance = maintenance
    this.protectedPaths = protectedPaths
    this.now = now
  }

  catalog() {
    const file = this.workspace.readFile('catalog.json', { validate: validatePlayDocument })
    return { file, value: parseCatalogJson(file.content) }
  }

  saveCatalog(value, revision) {
    return this.workspace.writeFile('catalog.json', JSON.stringify(value, null, 2), {
      validate: validatePlayDocument, expectedRevision: revision, expectedRevisionPresent: true,
    })
  }

  assertExclusiveDirectory(row, catalog, sessionIds = []) {
    const directory = ownedDirectory(row, catalog)
    const root = this.workspace.get().rootPath
    const absolute = resolvePlayPath(root, directory)
    for (const other of catalog.playthroughs) {
      if (other.id === row.id) continue
      const path = resolvePlayPath(root, other.path)
      const imported = other.ext?.pmpDshTavern?.importContextPath
      if (within(absolute, path) || within(dirname(path), absolute)
        || imported && within(absolute, resolvePlayPath(root, imported))) {
        conflict('The playthrough directory is shared')
      }
      let timeline
      try { timeline = parseTimelineJson(this.workspace.readFile(other.path).content) } catch (error) {
        if (error.code !== 'PLAY_PATH_NOT_FOUND') throw error
      }
      const timelineImport = timeline?.ext?.pmpDshTavern?.importContextPath
      if (timelineImport && within(absolute, resolvePlayPath(root, timelineImport))) conflict('The playthrough directory contains shared import context')
    }
    for (const path of this.protectedPaths({ playthrough: row, sessionIds })) {
      if (within(absolute, resolvePlayPath(root, path))) conflict('The playthrough directory contains referenced data')
    }
    return directory
  }

  record(backupId) {
    if (!BACKUP_ID.test(backupId)) throw httpError(400, 'Invalid cleanup backup ID', 'PLAY_CLEANUP_INVALID')
    const path = `${TRASH}/${backupId}/record.json`
    const value = JSON.parse(this.workspace.readFile(path).content)
    if (value.schemaVersion !== 1 || value.backupId !== backupId || typeof value.createdAt !== 'string'
      || typeof value.timelineRevision !== 'string') conflict('Invalid cleanup recovery record')
    const row = parseCatalogJson(JSON.stringify({ playthroughs: [value.playthrough] })).playthroughs[0]
    if (ownedDirectory(row, { playthroughs: [row] }) !== value.directory) conflict('Invalid recovery directory')
    return { ...value, playthrough: row }
  }

  list() {
    let entries
    try { entries = this.workspace.list(TRASH).list } catch (error) {
      if (error.code === 'PLAY_PATH_NOT_FOUND') return []
      throw error
    }
    return entries.filter(entry => entry.type === 'dir' && BACKUP_ID.test(entry.path.split('/').at(-1))).map(entry => {
      const backupId = entry.path.split('/').at(-1)
      try {
        const record = this.record(backupId)
        const root = this.workspace.get().rootPath
        const original = exists(resolvePlayPath(root, record.directory))
        const moved = exists(resolvePlayPath(root, `${TRASH}/${backupId}/files`))
        const status = original ? moved ? 'conflict' : 'retained' : moved ? 'cleaned' : 'unavailable'
        return { backupId, id: record.playthrough.id, createdAt: record.createdAt, status }
      } catch (error) { return { backupId, status: 'unavailable', code: error.code ?? 'PLAY_CLEANUP_INVALID' } }
    })
  }

  finishMove(record) {
    const root = this.workspace.get().rootPath
    const source = resolvePlayPath(root, record.directory)
    const destination = resolvePlayPath(root, `${TRASH}/${record.backupId}/files`)
    const sourceExists = exists(source), destinationExists = exists(destination)
    if (sourceExists && destinationExists) conflict('Both original and recovery directories exist; neither was overwritten')
    if (!sourceExists && !destinationExists) conflict('Original and recovery directories are missing')
    if (sourceExists) { assertDirectoryTree(source); renameSync(source, destination) }
    return { id: record.playthrough.id, status: 'cleaned', backupId: record.backupId }
  }

  async clean(id, { signal, expectedWorkspaceScope } = {}) {
    signal?.throwIfAborted()
    const { value: current } = this.catalog()
    if (!current.playthroughs.some(row => row.id === id)) {
      const previous = this.list().filter(row => row.id === id && ['cleaned', 'retained'].includes(row.status))
      if (previous.length === 1) {
        const record = this.record(previous[0].backupId)
        const root = this.workspace.get().rootPath
        const source = resolvePlayPath(root, record.directory)
        const payload = resolvePlayPath(root, `${TRASH}/${record.backupId}/files`)
        return { id, status: !exists(source) && exists(payload) ? 'cleaned' : 'recovery-required', backupId: record.backupId }
      }
      return { id, status: 'unavailable', reason: 'playthrough-not-found' }
    }
    return this.maintenance.withInvalid(id, ({ catalog, file, playthrough, timelineFile, sessionIds }) => {
      signal?.throwIfAborted()
      const directory = this.assertExclusiveDirectory(playthrough, catalog, sessionIds)
      assertDirectoryTree(resolvePlayPath(this.workspace.get().rootPath, directory, { mustExist: true }))
      const backupId = randomUUID()
      const record = { schemaVersion: 1, backupId, createdAt: this.now(), directory, playthrough, timelineRevision: timelineFile.revision }
      this.workspace.writeFile(`${TRASH}/${backupId}/record.json`, JSON.stringify(record, null, 2))
      this.saveCatalog({ ...catalog, playthroughs: catalog.playthroughs.filter(row => row.id !== id) }, file.revision)
      return this.finishMove(record)
    }, { signal, expectedWorkspaceScope, includeArchived: true })
  }

  restore(backupId, { signal } = {}) {
    signal?.throwIfAborted()
    const record = this.record(backupId)
    const { file, value: catalog } = this.catalog()
    const row = record.playthrough
    const existing = catalog.playthroughs.find(item => item.id === row.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(row)) conflict('A different playthrough already uses this identity')
    ownedDirectory(row, { ...catalog, playthroughs: catalog.playthroughs.filter(item => item.id !== row.id).concat(row) })
    const root = this.workspace.get().rootPath
    const source = resolvePlayPath(root, `${TRASH}/${backupId}/files`)
    const destination = resolvePlayPath(root, record.directory)
    const sourceExists = exists(source), destinationExists = exists(destination)
    if (sourceExists && destinationExists) conflict('Restore would overwrite an existing directory')
    if (!sourceExists && !destinationExists) conflict('Recovery files are missing')
    if (sourceExists) {
      assertDirectoryTree(source)
      if (dirname(record.directory) !== '.') resolvePlayPath(root, dirname(record.directory), { mustExist: true })
      renameSync(source, destination)
    }
    const restored = this.workspace.readFile(row.path)
    if (restored.revision !== record.timelineRevision) conflict('Timeline changed since cleanup; original metadata was not reapplied')
    if (!existing) this.saveCatalog({ ...catalog, playthroughs: [...catalog.playthroughs, row] }, file.revision)
    return { id: row.id, status: 'restored', backupId }
  }
}
