import { randomUUID } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { normalizeTemplateSelection } from './model.js'

const SCHEMA_VERSION = 1
const TEMPLATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const MAX_NAME_CHARACTERS = 120
const MAX_NAME_BYTES = 480
const DEFAULT_MAX_TEMPLATES = 100
const HARD_MAX_TEMPLATES = 200
const DEFAULT_MAX_STATE_BYTES = 512 * 1024
const HARD_MAX_STATE_BYTES = 2 * 1024 * 1024
const HARD_MAX_READ_BYTES = 4 * 1024 * 1024

const clone = value => structuredClone(value)

function boundedOption(value, fallback, maximum) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback
}

function templateId(value) {
  if (typeof value !== 'string' || !TEMPLATE_ID_PATTERN.test(value)) throw new TypeError('Invalid session template id')
  return value
}

function templateName(value) {
  if (typeof value !== 'string') throw new TypeError('Session template name must be a string')
  const name = value.trim()
  if (name === '') throw new TypeError('Session template name must not be empty')
  if (name.length > MAX_NAME_CHARACTERS || Buffer.byteLength(name, 'utf8') > MAX_NAME_BYTES) {
    throw new TypeError(`Session template name exceeds ${MAX_NAME_CHARACTERS} characters or ${MAX_NAME_BYTES} UTF-8 bytes`)
  }
  return name
}

function timestamp(value, fallback) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return fallback
  return new Date(Date.parse(value)).toISOString()
}

function serializedState(state) {
  return `${JSON.stringify(state, null, 2)}\n`
}

export class SessionTemplateLimitError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SessionTemplateLimitError'
    this.code = code
  }
}

function assertBounds(state, maxTemplates, maxStateBytes) {
  if (state.templates.length > maxTemplates) {
    throw new SessionTemplateLimitError(
      'SESSION_TEMPLATE_LIMIT_REACHED',
      `Session templates contain ${state.templates.length} records; the configured limit is ${maxTemplates}`,
    )
  }
  const serialized = serializedState(state)
  const bytes = Buffer.byteLength(serialized, 'utf8')
  if (bytes > maxStateBytes) {
    throw new SessionTemplateLimitError(
      'SESSION_TEMPLATE_STORAGE_LIMIT_REACHED',
      `Session templates require ${bytes} bytes; the configured limit is ${maxStateBytes} bytes`,
    )
  }
  return serialized
}

function atomicJson(path, serialized) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, serialized, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, selectedId: null, templates: [] }
}

function readState(path, options) {
  try {
    const bytes = statSync(path).size
    if (bytes > HARD_MAX_READ_BYTES) {
      throw new SessionTemplateLimitError(
        'SESSION_TEMPLATE_FILE_TOO_LARGE',
        `Session template storage is ${bytes} bytes; files above ${HARD_MAX_READ_BYTES} bytes are not parsed`,
      )
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.templates)) {
      throw new TypeError('Unsupported or invalid session template storage schema')
    }
    const ids = new Set()
    const now = options.now()
    const templates = parsed.templates.map(value => {
      const id = templateId(value?.id)
      if (ids.has(id)) throw new TypeError(`Duplicate session template id: ${id}`)
      ids.add(id)
      const createdAt = timestamp(value?.createdAt, now)
      return {
        id,
        name: templateName(value?.name),
        selection: normalizeTemplateSelection(value?.selection),
        createdAt,
        updatedAt: timestamp(value?.updatedAt, createdAt),
      }
    })
    const selectedId = parsed.selectedId === null ? null : templateId(parsed.selectedId)
    const state = {
      schemaVersion: SCHEMA_VERSION,
      selectedId: selectedId !== null && ids.has(selectedId) ? selectedId : null,
      templates,
    }
    assertBounds(state, options.maxTemplates, options.maxStateBytes)
    return state
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyState()
    throw error
  }
}

export class SessionTemplateStore {
  constructor(storageDir, options = {}) {
    this.storageDir = resolve(storageDir)
    this.statePath = join(this.storageDir, 'session-templates.json')
    this.maxTemplates = boundedOption(options.maxTemplates, DEFAULT_MAX_TEMPLATES, HARD_MAX_TEMPLATES)
    this.maxStateBytes = boundedOption(options.maxStateBytes, DEFAULT_MAX_STATE_BYTES, HARD_MAX_STATE_BYTES)
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString()
    this.id = typeof options.id === 'function' ? options.id : () => randomUUID()
    mkdirSync(this.storageDir, { recursive: true })
    this.state = readState(this.statePath, {
      maxTemplates: this.maxTemplates,
      maxStateBytes: this.maxStateBytes,
      now: this.now,
    })
  }

  list() {
    return clone(this.state.templates)
  }

  get(id) {
    const key = templateId(id)
    const template = this.state.templates.find(item => item.id === key)
    if (template === undefined) {
      const error = new Error(`Session template not found: ${key}`)
      error.code = 'SESSION_TEMPLATE_NOT_FOUND'
      throw error
    }
    return clone(template)
  }

  commit(mutator) {
    const next = clone(this.state)
    const result = mutator(next)
    const serialized = assertBounds(next, this.maxTemplates, this.maxStateBytes)
    atomicJson(this.statePath, serialized)
    this.state = next
    return clone(result)
  }

  create(input = {}) {
    if (this.state.templates.length >= this.maxTemplates) {
      throw new SessionTemplateLimitError(
        'SESSION_TEMPLATE_LIMIT_REACHED',
        `A maximum of ${this.maxTemplates} session templates may be stored`,
      )
    }
    const id = templateId(input.id ?? this.id())
    if (this.state.templates.some(item => item.id === id)) {
      const error = new Error(`Session template id already exists: ${id}`)
      error.code = 'SESSION_TEMPLATE_ID_EXISTS'
      throw error
    }
    const now = timestamp(input.now, this.now())
    const template = {
      id,
      name: templateName(input.name),
      selection: normalizeTemplateSelection(input.selection),
      createdAt: now,
      updatedAt: now,
    }
    return this.commit(next => {
      next.templates.push(template)
      next.selectedId = id
      return template
    })
  }

  update(id, patch = {}) {
    const key = templateId(id)
    return this.commit(next => {
      const index = next.templates.findIndex(item => item.id === key)
      if (index < 0) {
        const error = new Error(`Session template not found: ${key}`)
        error.code = 'SESSION_TEMPLATE_NOT_FOUND'
        throw error
      }
      const current = next.templates[index]
      const updated = {
        ...current,
        ...(Object.hasOwn(patch, 'name') ? { name: templateName(patch.name) } : {}),
        ...(Object.hasOwn(patch, 'selection') ? { selection: normalizeTemplateSelection(patch.selection) } : {}),
        updatedAt: timestamp(patch.now, this.now()),
      }
      next.templates[index] = updated
      return updated
    })
  }

  select(id) {
    const key = id === null ? null : templateId(id)
    if (key !== null) this.get(key)
    this.commit(next => { next.selectedId = key })
    return key === null ? null : this.get(key)
  }

  delete(id) {
    const key = templateId(id)
    this.get(key)
    this.commit(next => {
      next.templates = next.templates.filter(item => item.id !== key)
      if (next.selectedId === key) next.selectedId = null
    })
  }
}

export const sessionTemplateStoreConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  maxNameCharacters: MAX_NAME_CHARACTERS,
  maxNameBytes: MAX_NAME_BYTES,
  defaultMaxTemplates: DEFAULT_MAX_TEMPLATES,
  hardMaxTemplates: HARD_MAX_TEMPLATES,
  defaultMaxStateBytes: DEFAULT_MAX_STATE_BYTES,
  hardMaxStateBytes: HARD_MAX_STATE_BYTES,
  hardMaxReadBytes: HARD_MAX_READ_BYTES,
})
