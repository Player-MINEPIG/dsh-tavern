import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const SCHEMA_VERSION = 1
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

function clone(value) {
  return structuredClone(value)
}

function stringOrNull(value) {
  return typeof value === 'string' && value !== '' ? value : null
}

function normalizeWorldBookIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string' && item !== ''))]
}

export function normalizeSelection(value = {}) {
  return {
    presetId: stringOrNull(value?.presetId),
    characterCardId: stringOrNull(value?.characterCardId),
    worldBookIds: normalizeWorldBookIds(value?.worldBookIds),
    character: value?.character !== null && typeof value?.character === 'object'
      ? clone(value.character)
      : {},
  }
}

function readState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed?.schemaVersion !== SCHEMA_VERSION || parsed.sessions === null || typeof parsed.sessions !== 'object') {
      return { schemaVersion: SCHEMA_VERSION, sessions: {} }
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      sessions: Object.fromEntries(Object.entries(parsed.sessions).map(([id, selection]) => [id, normalizeSelection(selection)])),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { schemaVersion: SCHEMA_VERSION, sessions: {} }
    throw error
  }
}

function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

function sessionId(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) throw new TypeError('Invalid session id')
  return value
}

/**
 * Durable, loader-owned selection policy. Resource stores remain responsible
 * for their documents; this store only records which ids a DSH session uses.
 */
export class SessionSelectionStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'session-selections.json')
    this.defaultSelection = typeof options.defaultSelection === 'function'
      ? options.defaultSelection
      : () => ({})
    mkdirSync(this.storageDir, { recursive: true })
    this.state = readState(this.statePath)
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
    return stored === undefined ? this.defaults() : clone(stored)
  }

  set(id, patch) {
    const key = sessionId(id)
    if (key === null) throw new TypeError('A non-empty session id is required')
    const current = this.get(key)
    this.state.sessions[key] = normalizeSelection({ ...current, ...clone(patch) })
    this.persist()
    return this.get(key)
  }

  ensureAgent(agent) {
    const key = sessionId(agent?.id)
    if (key === null) return this.defaults()
    if (this.has(key)) return this.get(key)

    const header = agent?.session?.header ?? {}
    const delegationDepth = Number.isSafeInteger(header.delegationDepth) ? header.delegationDepth : 0
    if (delegationDepth > 0) {
      this.state.sessions[key] = normalizeSelection()
    } else if (sessionId(header.parentSession) !== null) {
      this.state.sessions[key] = this.get(header.parentSession)
    } else {
      this.state.sessions[key] = this.defaults()
    }
    this.persist()
    return this.get(key)
  }

  clearResource(kind, id) {
    let changed = false
    for (const [key, selection] of Object.entries(this.state.sessions)) {
      if (kind === 'preset' && selection.presetId === id) {
        this.state.sessions[key] = normalizeSelection({ ...selection, presetId: null })
        changed = true
      } else if (kind === 'character-card' && selection.characterCardId === id) {
        this.state.sessions[key] = normalizeSelection({ ...selection, characterCardId: null, character: {} })
        changed = true
      } else if (kind === 'world-book' && selection.worldBookIds.includes(id)) {
        this.state.sessions[key] = normalizeSelection({
          ...selection,
          worldBookIds: selection.worldBookIds.filter((item) => item !== id),
        })
        changed = true
      }
    }
    if (changed) this.persist()
    return changed
  }

  persist() {
    atomicJson(this.statePath, this.state)
  }
}

export const sessionPolicyConstants = Object.freeze({ schemaVersion: SCHEMA_VERSION })
