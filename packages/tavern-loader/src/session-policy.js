import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const SCHEMA_VERSION = 2
const LEGACY_SCHEMA_VERSION = 1
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const MAX_RESOURCE_ID_CHARACTERS = 200
const MAX_WORLD_BOOKS_PER_SESSION = 100
const DEFAULT_MAX_SESSIONS = 2048
const HARD_MAX_SESSIONS = 4096
const DEFAULT_MAX_STATE_BYTES = 4 * 1024 * 1024
const HARD_MAX_READ_BYTES = 8 * 1024 * 1024

function clone(value) {
  return structuredClone(value)
}

function boundedOption(value, fallback, hardMaximum) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, hardMaximum) : fallback
}

function stringOrNull(value) {
  return typeof value === 'string' && value !== '' && value.length <= MAX_RESOURCE_ID_CHARACTERS
    ? value
    : null
}

function normalizeWorldBookIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(item => (
    typeof item === 'string'
      && item !== ''
      && item.length <= MAX_RESOURCE_ID_CHARACTERS
  )))].slice(0, MAX_WORLD_BOOKS_PER_SESSION)
}

function normalizeCharacterOptions(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  if (Number.isSafeInteger(value.greetingIndex) && value.greetingIndex >= 0) result.greetingIndex = value.greetingIndex
  if (typeof value.preferCharacterSystemPrompt === 'boolean') result.preferCharacterSystemPrompt = value.preferCharacterSystemPrompt
  if (typeof value.preferCharacterPostHistory === 'boolean') result.preferCharacterPostHistory = value.preferCharacterPostHistory
  return result
}

export function normalizeSelection(value = {}) {
  return {
    presetId: stringOrNull(value?.presetId),
    characterCardId: stringOrNull(value?.characterCardId),
    userId: stringOrNull(value?.userId),
    worldBookIds: normalizeWorldBookIds(value?.worldBookIds),
    character: normalizeCharacterOptions(value?.character),
  }
}

function sessionId(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) throw new TypeError('Invalid session id')
  return value
}

function timestamp(value, fallback) {
  if (typeof value !== 'string') return fallback
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : fallback
}

function serializedState(state) {
  return `${JSON.stringify(state, null, 2)}\n`
}

export class SessionSelectionLimitError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SessionSelectionLimitError'
    this.code = code
  }
}

function assertStateBounds(state, maxSessions, maxStateBytes) {
  const count = Object.keys(state.sessions).length
  if (count > maxSessions) {
    throw new SessionSelectionLimitError(
      'SESSION_SELECTION_LIMIT_REACHED',
      `Session selections contain ${count} sessions; the hard configured limit is ${maxSessions}`,
    )
  }
  const serialized = serializedState(state)
  const bytes = Buffer.byteLength(serialized, 'utf8')
  if (bytes > maxStateBytes) {
    throw new SessionSelectionLimitError(
      'SESSION_SELECTION_STORAGE_LIMIT_REACHED',
      `Session selections require ${bytes} bytes; the hard configured limit is ${maxStateBytes} bytes`,
    )
  }
  return serialized
}

function readState(path, options) {
  try {
    const fileBytes = statSync(path).size
    if (fileBytes > HARD_MAX_READ_BYTES) {
      throw new SessionSelectionLimitError(
        'SESSION_SELECTION_FILE_TOO_LARGE',
        `Session selection storage is ${fileBytes} bytes; files above ${HARD_MAX_READ_BYTES} bytes are not parsed`,
      )
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    const now = options.now()
    const sessions = Object.create(null)
    const legacy = parsed?.schemaVersion === LEGACY_SCHEMA_VERSION
    let migrated = legacy || fileBytes > options.maxStateBytes
    if ((parsed?.schemaVersion !== SCHEMA_VERSION && !legacy)
      || parsed.sessions === null
      || typeof parsed.sessions !== 'object'
      || Array.isArray(parsed.sessions)) {
      return { state: { schemaVersion: SCHEMA_VERSION, sessions }, migrated: false }
    }
    for (const [id, stored] of Object.entries(parsed.sessions)) {
      try {
        const key = sessionId(id)
        if (key === null) continue
        const selection = normalizeSelection(legacy ? stored : stored?.selection)
        const updatedAt = legacy ? now : timestamp(stored?.updatedAt, now)
        sessions[key] = { selection, updatedAt }
        if (!legacy && (
          JSON.stringify(stored?.selection) !== JSON.stringify(selection)
          || stored?.updatedAt !== updatedAt
        )) migrated = true
      } catch {
        migrated = true
      }
    }
    const state = { schemaVersion: SCHEMA_VERSION, sessions }
    assertStateBounds(state, options.maxSessions, options.maxStateBytes)
    return { state, migrated }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { state: { schemaVersion: SCHEMA_VERSION, sessions: Object.create(null) }, migrated: false }
    }
    throw error
  }
}

function atomicJson(path, serialized) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, serialized, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

/**
 * Durable, loader-owned selection policy. Resource stores remain responsible
 * for their documents; this store only records which ids a DSH session uses.
 * Entries are never silently evicted because that could reactivate global
 * defaults for an old session. Capacity failures are explicit until DSH
 * exposes an authoritative session deletion lifecycle.
 */
export class SessionSelectionStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'session-selections.json')
    this.defaultSelection = typeof options.defaultSelection === 'function'
      ? options.defaultSelection
      : () => ({})
    this.maxSessions = boundedOption(options.maxSessions, DEFAULT_MAX_SESSIONS, HARD_MAX_SESSIONS)
    this.maxStateBytes = boundedOption(options.maxStateBytes, DEFAULT_MAX_STATE_BYTES, DEFAULT_MAX_STATE_BYTES)
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString()
    mkdirSync(this.storageDir, { recursive: true })
    const loaded = readState(this.statePath, {
      maxSessions: this.maxSessions,
      maxStateBytes: this.maxStateBytes,
      now: this.now,
    })
    this.state = loaded.state
    if (loaded.migrated) this.persist()
  }

  defaults() {
    return normalizeSelection(this.defaultSelection())
  }

  has(id) {
    const key = sessionId(id)
    return key !== null && Object.hasOwn(this.state.sessions, key)
  }

  get(id) {
    const key = sessionId(id)
    if (key === null) return this.defaults()
    const stored = this.state.sessions[key]
    return stored === undefined ? this.defaults() : clone(stored.selection)
  }

  commit(mutator) {
    const next = clone(this.state)
    mutator(next)
    const serialized = assertStateBounds(next, this.maxSessions, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
    this.state = next
  }

  set(id, patch) {
    const key = sessionId(id)
    if (key === null) throw new TypeError('A non-empty session id is required')
    const selection = normalizeSelection({ ...this.get(key), ...clone(patch) })
    this.commit((next) => {
      next.sessions[key] = { selection, updatedAt: this.now() }
    })
    return this.get(key)
  }

  ensureAgent(agent) {
    const key = sessionId(agent?.id)
    if (key === null) return this.defaults()
    if (this.has(key)) return this.get(key)

    const header = agent?.session?.header ?? {}
    const delegationDepth = Number.isSafeInteger(header.delegationDepth) ? header.delegationDepth : 0
    let selection
    if (delegationDepth > 0) {
      selection = normalizeSelection()
    } else if (sessionId(header.parentSession) !== null) {
      selection = this.get(header.parentSession)
    } else {
      selection = this.defaults()
    }
    this.commit((next) => {
      next.sessions[key] = { selection, updatedAt: this.now() }
    })
    return this.get(key)
  }

  clearResource(kind, id) {
    let changed = false
    this.commit((next) => {
      for (const record of Object.values(next.sessions)) {
        const selection = record.selection
        let updated = null
        if (kind === 'preset' && selection.presetId === id) {
          updated = { ...selection, presetId: null }
        } else if (kind === 'character-card' && selection.characterCardId === id) {
          updated = { ...selection, characterCardId: null, character: {} }
        } else if (kind === 'user' && selection.userId === id) {
          updated = { ...selection, userId: null }
        } else if (kind === 'world-book' && selection.worldBookIds.includes(id)) {
          updated = { ...selection, worldBookIds: selection.worldBookIds.filter(item => item !== id) }
        }
        if (updated !== null) {
          record.selection = normalizeSelection(updated)
          record.updatedAt = this.now()
          changed = true
        }
      }
    })
    return changed
  }

  deleteSession(id) {
    const key = sessionId(id)
    if (key === null || !this.has(key)) return false
    this.commit((next) => { delete next.sessions[key] })
    return true
  }

  persist() {
    const serialized = assertStateBounds(this.state, this.maxSessions, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
  }
}

export const sessionPolicyConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  defaultMaxSessions: DEFAULT_MAX_SESSIONS,
  hardMaxSessions: HARD_MAX_SESSIONS,
  defaultMaxStateBytes: DEFAULT_MAX_STATE_BYTES,
  hardMaxReadBytes: HARD_MAX_READ_BYTES,
  maxWorldBooksPerSession: MAX_WORLD_BOOKS_PER_SESSION,
})
