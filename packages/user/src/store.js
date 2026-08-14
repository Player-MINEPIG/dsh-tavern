import { randomUUID } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/
const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 100_000

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function validateId(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new TypeError('Invalid user id')
  return value
}

function text(value, field, maximum) {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  if (value.length > maximum) throw new TypeError(`${field} exceeds the ${maximum} character limit`)
  return value
}

function name(value) {
  const normalized = text(value, 'name', MAX_NAME_LENGTH).trim()
  if (normalized === '') throw new TypeError('name must not be empty')
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new TypeError('name must not contain control characters')
  return normalized
}

function description(value = '') {
  return text(value, 'description', MAX_DESCRIPTION_LENGTH)
}

function assertOnlyFields(value, allowed) {
  if (!isRecord(value)) throw new TypeError('User resource must be an object')
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected !== undefined) throw new TypeError(`Unsupported user field "${unexpected}"`)
}

function normalizeDocument(value) {
  assertOnlyFields(value, new Set(['id', 'name', 'description']))
  return {
    id: validateId(value.id),
    name: name(value.name),
    description: description(value.description),
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
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

function missing(id) {
  const error = new Error(`User "${id}" not found`)
  error.code = 'USER_NOT_FOUND'
  return error
}

export class UserStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.usersDir = join(this.storageDir, 'users')
    mkdirSync(this.usersDir, { recursive: true })
  }

  userPath(id) {
    return join(this.usersDir, `${validateId(id)}.json`)
  }

  list() {
    return readdirSync(this.usersDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap(entry => {
        try {
          return [normalizeDocument(readJson(join(this.usersDir, entry.name)))]
        } catch {
          return []
        }
      })
      .toSorted((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
      .map(clone)
  }

  get(id) {
    const value = readJson(this.userPath(id))
    if (value === undefined) throw missing(id)
    return clone(normalizeDocument(value))
  }

  create(input) {
    assertOnlyFields(input, new Set(['id', 'name', 'description']))
    const document = normalizeDocument({
      id: input.id ?? `user-${randomUUID()}`,
      name: input.name,
      description: input.description ?? '',
    })
    try {
      this.get(document.id)
      const error = new Error(`User id "${document.id}" already exists`)
      error.code = 'USER_ID_EXISTS'
      throw error
    } catch (error) {
      if (error?.code !== 'USER_NOT_FOUND') throw error
    }
    atomicJson(this.userPath(document.id), document)
    return clone(document)
  }

  update(id, patch) {
    assertOnlyFields(patch, new Set(['name', 'description']))
    const current = this.get(id)
    const document = normalizeDocument({
      id: current.id,
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
    })
    atomicJson(this.userPath(id), document)
    return clone(document)
  }

  delete(id) {
    this.get(id)
    unlinkSync(this.userPath(id))
  }
}

export const userStoreConstants = Object.freeze({
  maxNameLength: MAX_NAME_LENGTH,
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
})
