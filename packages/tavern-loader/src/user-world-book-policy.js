import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const SCHEMA_VERSION = 1
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/
const MAX_WORLD_BOOKS_PER_USER = 100
const DEFAULT_MAX_USERS = 2048
const HARD_MAX_USERS = 4096
const DEFAULT_MAX_STATE_BYTES = 2 * 1024 * 1024
const HARD_MAX_STATE_BYTES = 4 * 1024 * 1024
const HARD_MAX_READ_BYTES = 8 * 1024 * 1024

function clone(value) {
  return structuredClone(value)
}

function boundedOption(value, fallback, hardMaximum) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, hardMaximum) : fallback
}

function resourceId(value, field = 'resource id') {
  if (typeof value !== 'string' || !RESOURCE_ID_PATTERN.test(value)) throw new TypeError(`Invalid ${field}`)
  return value
}

function normalizeWorldBookIds(value) {
  if (!Array.isArray(value)) throw new TypeError('worldBookIds must be an array')
  if (value.length > MAX_WORLD_BOOKS_PER_USER) {
    throw new TypeError(`A user can bind at most ${MAX_WORLD_BOOKS_PER_USER} world books`)
  }
  return [...new Set(value.map(item => resourceId(item, 'world-book id')))]
}

function timestamp(value, fallback) {
  if (typeof value !== 'string') return fallback
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : fallback
}

function serializedState(state) {
  return `${JSON.stringify(state, null, 2)}\n`
}

export class UserWorldBookBindingLimitError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'UserWorldBookBindingLimitError'
    this.code = code
  }
}

function assertStateBounds(state, maxUsers, maxStateBytes) {
  const count = Object.keys(state.bindings).length
  if (count > maxUsers) {
    throw new UserWorldBookBindingLimitError(
      'USER_WORLD_BOOK_BINDING_LIMIT_REACHED',
      `User world-book bindings contain ${count} users; the configured limit is ${maxUsers}`,
    )
  }
  const serialized = serializedState(state)
  const bytes = Buffer.byteLength(serialized, 'utf8')
  if (bytes > maxStateBytes) {
    throw new UserWorldBookBindingLimitError(
      'USER_WORLD_BOOK_BINDING_STORAGE_LIMIT_REACHED',
      `User world-book bindings require ${bytes} bytes; the configured limit is ${maxStateBytes} bytes`,
    )
  }
  return serialized
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, bindings: Object.create(null) }
}

function readState(path, options) {
  try {
    const fileBytes = statSync(path).size
    if (fileBytes > HARD_MAX_READ_BYTES) {
      throw new UserWorldBookBindingLimitError(
        'USER_WORLD_BOOK_BINDING_FILE_TOO_LARGE',
        `User world-book binding storage is ${fileBytes} bytes; files above ${HARD_MAX_READ_BYTES} bytes are not parsed`,
      )
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed?.schemaVersion !== SCHEMA_VERSION
      || parsed.bindings === null
      || typeof parsed.bindings !== 'object'
      || Array.isArray(parsed.bindings)) {
      return { state: emptyState(), migrated: false }
    }
    const now = options.now()
    const bindings = Object.create(null)
    let migrated = fileBytes > options.maxStateBytes
    for (const [userId, stored] of Object.entries(parsed.bindings)) {
      try {
        const id = resourceId(userId, 'user id')
        const worldBookIds = normalizeWorldBookIds(stored?.worldBookIds)
        const updatedAt = timestamp(stored?.updatedAt, now)
        if (worldBookIds.length > 0) bindings[id] = { worldBookIds, updatedAt }
        if (worldBookIds.length === 0
          || JSON.stringify(stored?.worldBookIds) !== JSON.stringify(worldBookIds)
          || stored?.updatedAt !== updatedAt) migrated = true
      } catch {
        migrated = true
      }
    }
    const state = { schemaVersion: SCHEMA_VERSION, bindings }
    assertStateBounds(state, options.maxUsers, options.maxStateBytes)
    return { state, migrated }
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: emptyState(), migrated: false }
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
 * Loader-owned resource relationship. User documents stay exactly
 * {id,name,description}; world-book documents do not contain reverse user ids.
 */
export class UserWorldBookBindingStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'user-world-book-bindings.json')
    this.maxUsers = boundedOption(options.maxUsers, DEFAULT_MAX_USERS, HARD_MAX_USERS)
    this.maxStateBytes = boundedOption(options.maxStateBytes, DEFAULT_MAX_STATE_BYTES, HARD_MAX_STATE_BYTES)
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString()
    mkdirSync(this.storageDir, { recursive: true })
    const loaded = readState(this.statePath, {
      maxUsers: this.maxUsers,
      maxStateBytes: this.maxStateBytes,
      now: this.now,
    })
    this.state = loaded.state
    if (loaded.migrated) this.persist()
  }

  get(userId) {
    const id = resourceId(userId, 'user id')
    return clone(this.state.bindings[id]?.worldBookIds ?? [])
  }

  set(userId, worldBookIds) {
    const id = resourceId(userId, 'user id')
    const normalized = normalizeWorldBookIds(worldBookIds)
    this.commit(next => {
      if (normalized.length === 0) delete next.bindings[id]
      else next.bindings[id] = { worldBookIds: normalized, updatedAt: this.now() }
    })
    return this.get(id)
  }

  clearUser(userId) {
    const id = resourceId(userId, 'user id')
    if (!Object.hasOwn(this.state.bindings, id)) return false
    this.commit(next => { delete next.bindings[id] })
    return true
  }

  clearWorldBook(worldBookId) {
    const id = resourceId(worldBookId, 'world-book id')
    let changed = false
    this.commit(next => {
      for (const [userId, binding] of Object.entries(next.bindings)) {
        if (!binding.worldBookIds.includes(id)) continue
        const worldBookIds = binding.worldBookIds.filter(item => item !== id)
        if (worldBookIds.length === 0) delete next.bindings[userId]
        else next.bindings[userId] = { worldBookIds, updatedAt: this.now() }
        changed = true
      }
    })
    return changed
  }

  commit(mutator) {
    const next = clone(this.state)
    mutator(next)
    const serialized = assertStateBounds(next, this.maxUsers, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
    this.state = next
  }

  persist() {
    const serialized = assertStateBounds(this.state, this.maxUsers, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
  }
}

export function composeWorldBookSelection(
  explicitIds = [],
  userBoundIds = [],
  presetBoundIds = [],
  characterBoundIds = [],
) {
  const explicit = normalizeWorldBookIds(explicitIds)
  const user = normalizeWorldBookIds(userBoundIds)
  const preset = normalizeWorldBookIds(presetBoundIds)
  const character = normalizeWorldBookIds(characterBoundIds)
  const effectiveIds = []
  const seen = new Set()
  const duplicateIds = []
  for (const ids of [explicit, user, preset, character]) {
    for (const id of ids) {
      if (seen.has(id)) {
        if (!duplicateIds.includes(id)) duplicateIds.push(id)
        continue
      }
      seen.add(id)
      effectiveIds.push(id)
    }
  }
  return {
    explicitIds: explicit,
    userBoundIds: user,
    presetBoundIds: preset,
    characterBoundIds: character,
    effectiveIds,
    duplicateIds,
    order: 'session-explicit-then-user-then-preset-then-character',
  }
}

export const userWorldBookPolicyConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  maxWorldBooksPerUser: MAX_WORLD_BOOKS_PER_USER,
  defaultMaxUsers: DEFAULT_MAX_USERS,
  hardMaxUsers: HARD_MAX_USERS,
  defaultMaxStateBytes: DEFAULT_MAX_STATE_BYTES,
  hardMaxStateBytes: HARD_MAX_STATE_BYTES,
  hardMaxReadBytes: HARD_MAX_READ_BYTES,
})
