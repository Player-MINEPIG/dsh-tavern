import { createHash } from 'node:crypto'
import {
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  exportCharacterCardJson,
  parseSillyTavernCharacterCard,
} from '../../tavern-format/src/index.js'
import {
  WORLD_BOOK_LIMITS,
  assertWorldBookStructure,
  parseCharacterBook,
} from '../../world-book/src/index.js'

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024
const MAX_EDITED_WORLD_BOOK_BYTES = 4 * 1024 * 1024
const MAX_CHARACTER_DOCUMENT_BYTES = 16 * 1024 * 1024
const MAX_WORLD_BOOK_ENTRIES = WORLD_BOOK_LIMITS.maxEntries

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function validateEditableWorldBookShape(value) {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new TypeError('characterBook must be a Character Book object with an entries array')
  }
  if (value.entries.some(entry => !isRecord(entry))) {
    throw new TypeError('Every Character Book entry must be an object')
  }
  assertWorldBookStructure(value)
}

function validateId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid character id')
  return id
}

function validateSessionId(sessionId) {
  if (typeof sessionId !== 'string'
    || sessionId.length === 0
    || sessionId.length > 256
    || /[\u0000-\u001f\u007f]/.test(sessionId)
    || ['__proto__', 'prototype', 'constructor'].includes(sessionId)) {
    throw new TypeError('Invalid session id')
  }
  return sessionId
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

function temporaryPath(path) {
  return `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
}

function atomicBytes(path, value) {
  const temporary = temporaryPath(path)
  writeFileSync(temporary, value, { mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

function atomicJson(path, value) {
  atomicBytes(path, `${JSON.stringify(value, null, 2)}\n`)
}

function inputBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input)
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  if (isRecord(input)) return new TextEncoder().encode(JSON.stringify(input))
  throw new TypeError('Character import must contain JSON text, an object, or file bytes')
}

function summary(character) {
  return {
    id: character.id,
    name: character.name,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    sourceFormat: character.source?.format ?? 'unknown',
    sourceContainer: character.source?.container ?? 'unknown',
    specVersion: character.source?.specVersion,
    fileName: character.source?.fileName,
    byteLength: character.source?.byteLength,
    sha256: character.source?.sha256,
    tags: Array.isArray(character.data?.tags) ? [...character.data.tags] : [],
    alternateGreetingCount: Array.isArray(character.data?.alternateGreetings) ? character.data.alternateGreetings.length : 0,
    hasEmbeddedCharacterBook: isRecord(character.data?.characterBook),
    warningCount: Array.isArray(character.compatibility?.warnings) ? character.compatibility.warnings.length : 0,
    unsupportedFeatureCount: Array.isArray(character.compatibility?.unsupportedFeatures) ? character.compatibility.unsupportedFeatures.length : 0,
  }
}

function validateDocument(character) {
  if (!isRecord(character)
    || character.schemaVersion !== 1
    || typeof character.id !== 'string'
    || typeof character.name !== 'string'
    || typeof character.updatedAt !== 'string'
    || !isRecord(character.source)
    || !isRecord(character.data)) {
    const error = new Error('Stored character document is invalid')
    error.code = 'CHARACTER_DOCUMENT_INVALID'
    throw error
  }
  validateId(character.id)
  return character
}

function normalizeState(value) {
  const selections = Object.create(null)
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.selectedBySessionId)) {
    return { schemaVersion: 1, selectedBySessionId: selections }
  }
  for (const [sessionId, selection] of Object.entries(value.selectedBySessionId)) {
    try {
      validateSessionId(sessionId)
      validateId(selection?.characterCardId)
      if (isRecord(selection?.character)) selections[sessionId] = clone(selection)
    } catch {}
  }
  return { schemaVersion: 1, selectedBySessionId: selections }
}

function normalizeSelection(character, patch = {}) {
  const options = isRecord(patch.character) ? patch.character : {}
  const greetingIndex = options.greetingIndex === undefined ? 0 : Number(options.greetingIndex)
  const greetingCount = 1 + (character.data?.alternateGreetings?.length ?? 0)
  if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0 || greetingIndex >= greetingCount) {
    throw new TypeError(`greetingIndex must be between 0 and ${greetingCount - 1}`)
  }
  return {
    characterCardId: character.id,
    character: {
      greetingIndex,
      preferCharacterSystemPrompt: options.preferCharacterSystemPrompt !== false,
      preferCharacterPostHistory: options.preferCharacterPostHistory !== false,
    },
  }
}

export class CharacterStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.charactersDir = join(this.storageDir, 'characters')
    this.artifactsDir = join(this.storageDir, 'character-artifacts')
    this.statePath = join(this.storageDir, 'character-state.json')
    mkdirSync(this.charactersDir, { recursive: true })
    mkdirSync(this.artifactsDir, { recursive: true })
    this.state = normalizeState(readJson(this.statePath, { schemaVersion: 1, selectedBySessionId: {} }))
  }

  characterPath(id) {
    return join(this.charactersDir, `${validateId(id)}.json`)
  }

  artifactPath(id) {
    return join(this.artifactsDir, `${validateId(id)}.bin`)
  }

  list() {
    return readdirSync(this.charactersDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap((entry) => {
        try {
          return [summary(validateDocument(readJson(join(this.charactersDir, entry.name))))]
        } catch {
          return []
        }
      })
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  get(id) {
    const character = readJson(this.characterPath(id))
    if (character === undefined) {
      const error = new Error(`Character "${id}" not found`)
      error.code = 'CHARACTER_NOT_FOUND'
      throw error
    }
    return validateDocument(character)
  }

  import(input, options = {}) {
    const artifact = inputBytes(input)
    if (artifact.byteLength > (options.maxArtifactBytes ?? MAX_ARTIFACT_BYTES)) {
      const error = new TypeError(`Character artifact exceeds the ${options.maxArtifactBytes ?? MAX_ARTIFACT_BYTES} byte limit`)
      error.code = 'ARTIFACT_TOO_LARGE'
      throw error
    }
    const sha256 = createHash('sha256').update(artifact).digest('hex')
    const character = parseSillyTavernCharacterCard(artifact, {
      id: options.id,
      name: options.name,
      fileName: options.fileName,
      now: options.now,
      sha256,
      byteLength: artifact.byteLength,
      png: options.png,
    })
    const documentPath = this.characterPath(character.id)
    const artifactPath = this.artifactPath(character.id)
    if (existsSync(documentPath) || existsSync(artifactPath)) {
      const error = new Error(`Character id "${character.id}" already exists`)
      error.code = 'CHARACTER_ID_EXISTS'
      throw error
    }
    try {
      atomicBytes(artifactPath, artifact)
      atomicJson(documentPath, character)
    } catch (error) {
      try { unlinkSync(documentPath) } catch {}
      try { unlinkSync(artifactPath) } catch {}
      throw error
    }
    return character
  }

  artifact(id) {
    const character = this.get(id)
    try {
      return {
        bytes: readFileSync(this.artifactPath(id)),
        mediaType: character.source?.container === 'png' ? 'image/png' : 'application/json',
        fileName: character.source?.fileName ?? (character.source?.container === 'png' ? 'character.png' : 'character.json'),
        sha256: character.source?.sha256,
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const missing = new Error(`Artifact for character "${id}" not found`)
      missing.code = 'ARTIFACT_NOT_FOUND'
      throw missing
    }
  }

  json(id) {
    const character = this.get(id)
    return {
      text: exportCharacterCardJson(character),
      fileName: `${character.name || 'character'}.json`,
    }
  }

  delete(id) {
    validateId(id)
    try { unlinkSync(this.characterPath(id)) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    try { unlinkSync(this.artifactPath(id)) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    let changed = false
    for (const [sessionId, selection] of Object.entries(this.state.selectedBySessionId)) {
      if (selection?.characterCardId === id) {
        delete this.state.selectedBySessionId[sessionId]
        changed = true
      }
    }
    if (changed) this.saveState()
  }

  saveState() {
    atomicJson(this.statePath, this.state)
  }

  selection(sessionId) {
    validateSessionId(sessionId)
    const selection = this.state.selectedBySessionId[sessionId]
    if (!isRecord(selection)) return null
    try {
      const character = this.get(selection.characterCardId)
      return normalizeSelection(character, selection)
    } catch (error) {
      if (error?.code !== 'CHARACTER_NOT_FOUND' && !(error instanceof TypeError)) throw error
      return null
    }
  }

  updateCharacterBook(id, characterBook, options = {}) {
    validateEditableWorldBookShape(characterBook)
    const inputBytes = Buffer.byteLength(JSON.stringify(characterBook), 'utf8')
    if (inputBytes > MAX_EDITED_WORLD_BOOK_BYTES) {
      const error = new Error(`Character Book exceeds the ${MAX_EDITED_WORLD_BOOK_BYTES} byte edit limit`)
      error.code = 'CHARACTER_WORLD_BOOK_TOO_LARGE'
      error.status = 413
      throw error
    }
    // Parse through the shared pure format adapter before preserving the exact
    // edited source shape. Unknown ST extension fields remain round-trippable,
    // but structurally invalid books cannot enter the character store.
    parseCharacterBook(characterBook)
    const nextBook = clone(characterBook)
    const character = clone(this.get(id))
    const rawRoot = character.source?.format === 'sillytavern-v1'
      ? character.source?.raw
      : character.source?.raw?.data
    if (!isRecord(rawRoot)) throw new TypeError('Character document does not contain editable source JSON')

    character.data.characterBook = nextBook
    rawRoot.character_book = clone(nextBook)
    character.updatedAt = options.now ?? new Date().toISOString()
    const documentBytes = Buffer.byteLength(JSON.stringify(character), 'utf8')
    if (documentBytes > MAX_CHARACTER_DOCUMENT_BYTES) {
      const error = new Error(`Updated character document exceeds the ${MAX_CHARACTER_DOCUMENT_BYTES} byte storage limit`)
      error.code = 'CHARACTER_DOCUMENT_TOO_LARGE'
      error.status = 413
      throw error
    }
    atomicJson(this.characterPath(id), character)
    return character
  }

  normalizeSelection(characterCardId, patch = {}) {
    return normalizeSelection(this.get(validateId(characterCardId)), patch)
  }

  select(sessionId, patch) {
    validateSessionId(sessionId)
    if (patch === null || patch?.characterCardId === null) {
      delete this.state.selectedBySessionId[sessionId]
      this.saveState()
      return null
    }
    if (!isRecord(patch)) throw new TypeError('Character selection must be an object or null')
    const selection = this.normalizeSelection(patch.characterCardId, patch)
    this.state.selectedBySessionId[sessionId] = selection
    this.saveState()
    return clone(selection)
  }

  copySelection(parentSessionId, childSessionId) {
    validateSessionId(parentSessionId)
    validateSessionId(childSessionId)
    if (this.state.selectedBySessionId[childSessionId] !== undefined) return this.selection(childSessionId)
    const parent = this.selection(parentSessionId)
    if (parent === null) return null
    this.state.selectedBySessionId[childSessionId] = parent
    this.saveState()
    return clone(parent)
  }

  selectedCharacter(sessionId) {
    const selection = this.selection(sessionId)
    return selection === null ? null : { character: this.get(selection.characterCardId), selection }
  }
}

export const characterStoreConstants = Object.freeze({
  maxArtifactBytes: MAX_ARTIFACT_BYTES,
  maxEditedWorldBookBytes: MAX_EDITED_WORLD_BOOK_BYTES,
  maxCharacterDocumentBytes: MAX_CHARACTER_DOCUMENT_BYTES,
  maxWorldBookEntries: MAX_WORLD_BOOK_ENTRIES,
})
