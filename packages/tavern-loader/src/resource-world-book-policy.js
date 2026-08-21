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
const RESOURCE_KINDS = Object.freeze(['preset', 'character'])
const MAX_WORLD_BOOKS_PER_RESOURCE = 100
const DEFAULT_MAX_BINDINGS = 4096
const HARD_MAX_BINDINGS = 8192
const DEFAULT_MAX_STATE_BYTES = 4 * 1024 * 1024
const HARD_MAX_STATE_BYTES = 8 * 1024 * 1024
const HARD_MAX_READ_BYTES = 16 * 1024 * 1024

function clone(value) {
  return structuredClone(value)
}

function boundedOption(value, fallback, hardMaximum) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, hardMaximum) : fallback
}

function resourceKind(value) {
  if (!RESOURCE_KINDS.includes(value)) throw new TypeError('Resource kind must be preset or character')
  return value
}

function resourceId(value, field = 'resource id') {
  if (typeof value !== 'string' || !RESOURCE_ID_PATTERN.test(value)) throw new TypeError(`Invalid ${field}`)
  return value
}

function normalizeWorldBookIds(value) {
  if (!Array.isArray(value)) throw new TypeError('worldBookIds must be an array')
  if (value.length > MAX_WORLD_BOOKS_PER_RESOURCE) {
    throw new TypeError(`A resource can bind at most ${MAX_WORLD_BOOKS_PER_RESOURCE} world books`)
  }
  return [...new Set(value.map(item => resourceId(item, 'world-book id')))]
}

function timestamp(value, fallback) {
  if (typeof value !== 'string') return fallback
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : fallback
}

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bindings: { preset: Object.create(null), character: Object.create(null) },
  }
}

function serializedState(state) {
  return `${JSON.stringify(state, null, 2)}\n`
}

export class ResourceWorldBookBindingLimitError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ResourceWorldBookBindingLimitError'
    this.code = code
  }
}

function assertStateBounds(state, maxBindings, maxStateBytes) {
  const count = RESOURCE_KINDS.reduce((total, kind) => total + Object.keys(state.bindings[kind]).length, 0)
  if (count > maxBindings) {
    throw new ResourceWorldBookBindingLimitError(
      'RESOURCE_WORLD_BOOK_BINDING_LIMIT_REACHED',
      `Preset and character world-book bindings contain ${count} resources; the configured limit is ${maxBindings}`,
    )
  }
  const serialized = serializedState(state)
  const bytes = Buffer.byteLength(serialized, 'utf8')
  if (bytes > maxStateBytes) {
    throw new ResourceWorldBookBindingLimitError(
      'RESOURCE_WORLD_BOOK_BINDING_STORAGE_LIMIT_REACHED',
      `Preset and character world-book bindings require ${bytes} bytes; the configured limit is ${maxStateBytes} bytes`,
    )
  }
  return serialized
}

function readState(path, options) {
  try {
    const fileBytes = statSync(path).size
    if (fileBytes > HARD_MAX_READ_BYTES) {
      throw new ResourceWorldBookBindingLimitError(
        'RESOURCE_WORLD_BOOK_BINDING_FILE_TOO_LARGE',
        `Resource world-book binding storage is ${fileBytes} bytes; files above ${HARD_MAX_READ_BYTES} bytes are not parsed`,
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
    const state = emptyState()
    let migrated = fileBytes > options.maxStateBytes
    for (const kind of RESOURCE_KINDS) {
      const storedBindings = parsed.bindings[kind]
      if (storedBindings === null || typeof storedBindings !== 'object' || Array.isArray(storedBindings)) {
        if (storedBindings !== undefined) migrated = true
        continue
      }
      for (const [ownerId, stored] of Object.entries(storedBindings)) {
        try {
          const id = resourceId(ownerId, `${kind} id`)
          const worldBookIds = normalizeWorldBookIds(stored?.worldBookIds)
          const updatedAt = timestamp(stored?.updatedAt, now)
          if (worldBookIds.length > 0) state.bindings[kind][id] = { worldBookIds, updatedAt }
          if (worldBookIds.length === 0
            || JSON.stringify(stored?.worldBookIds) !== JSON.stringify(worldBookIds)
            || stored?.updatedAt !== updatedAt) migrated = true
        } catch {
          migrated = true
        }
      }
    }
    assertStateBounds(state, options.maxBindings, options.maxStateBytes)
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
 * Tavern-owned relations for standalone world books. These ids are deliberately
 * not written into ST preset or character-card source documents.
 */
export class ResourceWorldBookBindingStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'resource-world-book-bindings.json')
    this.maxBindings = boundedOption(options.maxBindings, DEFAULT_MAX_BINDINGS, HARD_MAX_BINDINGS)
    this.maxStateBytes = boundedOption(options.maxStateBytes, DEFAULT_MAX_STATE_BYTES, HARD_MAX_STATE_BYTES)
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString()
    mkdirSync(this.storageDir, { recursive: true })
    const loaded = readState(this.statePath, {
      maxBindings: this.maxBindings,
      maxStateBytes: this.maxStateBytes,
      now: this.now,
    })
    this.state = loaded.state
    if (loaded.migrated) this.persist()
  }

  get(kind, ownerId) {
    const normalizedKind = resourceKind(kind)
    const id = resourceId(ownerId, `${normalizedKind} id`)
    return clone(this.state.bindings[normalizedKind][id]?.worldBookIds ?? [])
  }

  set(kind, ownerId, worldBookIds) {
    const normalizedKind = resourceKind(kind)
    const id = resourceId(ownerId, `${normalizedKind} id`)
    const normalized = normalizeWorldBookIds(worldBookIds)
    this.commit(next => {
      if (normalized.length === 0) delete next.bindings[normalizedKind][id]
      else next.bindings[normalizedKind][id] = { worldBookIds: normalized, updatedAt: this.now() }
    })
    return this.get(normalizedKind, id)
  }

  clearOwner(kind, ownerId) {
    const normalizedKind = resourceKind(kind)
    const id = resourceId(ownerId, `${normalizedKind} id`)
    if (!Object.hasOwn(this.state.bindings[normalizedKind], id)) return false
    this.commit(next => { delete next.bindings[normalizedKind][id] })
    return true
  }

  clearWorldBook(worldBookId) {
    const id = resourceId(worldBookId, 'world-book id')
    let changed = false
    this.commit(next => {
      for (const kind of RESOURCE_KINDS) {
        for (const [ownerId, binding] of Object.entries(next.bindings[kind])) {
          if (!binding.worldBookIds.includes(id)) continue
          const worldBookIds = binding.worldBookIds.filter(item => item !== id)
          if (worldBookIds.length === 0) delete next.bindings[kind][ownerId]
          else next.bindings[kind][ownerId] = { worldBookIds, updatedAt: this.now() }
          changed = true
        }
      }
    })
    return changed
  }

  commit(mutator) {
    const next = clone(this.state)
    mutator(next)
    const serialized = assertStateBounds(next, this.maxBindings, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
    this.state = next
  }

  persist() {
    const serialized = assertStateBounds(this.state, this.maxBindings, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
  }
}

export const resourceWorldBookPolicyConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  resourceKinds: RESOURCE_KINDS,
  maxWorldBooksPerResource: MAX_WORLD_BOOKS_PER_RESOURCE,
  defaultMaxBindings: DEFAULT_MAX_BINDINGS,
  hardMaxBindings: HARD_MAX_BINDINGS,
  defaultMaxStateBytes: DEFAULT_MAX_STATE_BYTES,
  hardMaxStateBytes: HARD_MAX_STATE_BYTES,
  hardMaxReadBytes: HARD_MAX_READ_BYTES,
})
