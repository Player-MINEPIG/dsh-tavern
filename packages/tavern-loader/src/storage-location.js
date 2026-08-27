import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLUGIN_ID } from '../../identity.js'

export const LEGACY_STORAGE_DIR = fileURLToPath(new URL('../../../data', import.meta.url))
export const LEGACY_MIGRATION_MARKER = '.legacy-storage-migrated.json'

function expandHome(path, home) {
  if (path === '~') return home
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2))
  return path
}

export function defaultStorageDir({ environment = process.env, home = homedir() } = {}) {
  const configured = environment.DSH_HOME
  const dshHome = configured !== undefined && configured.trim() !== ''
    ? configured
    : join(home, '.dsh')
  return join(resolve(expandHome(dshHome, home)), PLUGIN_ID)
}

function directoryEntries(path) {
  let stat
  try {
    stat = statSync(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  if (!stat.isDirectory()) throw new Error(`Tavern storage path is not a directory: ${path}`)
  return readdirSync(path)
}

export function prepareStorageDir({
  storageDir,
  legacyStorageDir = LEGACY_STORAGE_DIR,
  environment = process.env,
  home = homedir(),
  logger,
} = {}) {
  const target = resolve(storageDir ?? defaultStorageDir({ environment, home }))
  const legacy = resolve(legacyStorageDir)
  if (target === legacy) return { path: target, migration: 'legacy-location' }

  const legacyEntries = directoryEntries(legacy)
  if (legacyEntries === null || legacyEntries.length === 0) {
    return { path: target, migration: 'not-needed' }
  }

  const targetEntries = directoryEntries(target)
  if (targetEntries?.includes(LEGACY_MIGRATION_MARKER)) {
    return { path: target, migration: 'already-complete' }
  }
  if (targetEntries !== null && targetEntries.length > 0) {
    logger?.warn?.(`dsh-tavern: legacy data remains at ${legacy}; ${target} already contains data and was not overwritten`)
    return { path: target, migration: 'target-not-empty' }
  }

  const parent = dirname(target)
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  const staging = mkdtempSync(join(parent, `.${PLUGIN_ID}-migrate-`))
  try {
    for (const entry of legacyEntries) {
      cpSync(join(legacy, entry), join(staging, entry), {
        recursive: true,
        dereference: true,
        errorOnExist: true,
        force: false,
      })
    }
    writeFileSync(join(staging, LEGACY_MIGRATION_MARKER), '{"schemaVersion":1}\n', {
      encoding: 'utf8',
      mode: 0o600,
    })
    if (targetEntries !== null) rmSync(target)
    renameSync(staging, target)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw new Error(`Unable to migrate legacy Tavern storage from ${legacy} to ${target}: ${error.message}`, {
      cause: error,
    })
  }

  logger?.info?.(`dsh-tavern: migrated legacy data to ${target}; retained the source at ${legacy}`)
  return { path: target, migration: 'migrated' }
}
