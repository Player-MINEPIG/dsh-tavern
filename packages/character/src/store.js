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
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createBlankCharacterCard,
  editCharacterCard,
  exportCharacterCardJson,
  exportCharacterCardPng,
  isPng,
  parseSillyTavernCharacterCard,
  readNativeRegexScripts,
  replaceNativeRegexScripts,
  stripCharacterCardPng,
} from '../../tavern-format/src/index.js'
import {
  WORLD_BOOK_LIMITS,
  assertWorldBookStructure,
  parseCharacterBook,
} from '../../world-book/src/index.js'

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/
const MAX_CHARACTER_ORDER_ENTRIES = 4096
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024
const MAX_EDITED_WORLD_BOOK_BYTES = 4 * 1024 * 1024
const MAX_CHARACTER_DOCUMENT_BYTES = 16 * 1024 * 1024
const MAX_WORLD_BOOK_ENTRIES = WORLD_BOOK_LIMITS.maxEntries
const PLACEHOLDER_PNG_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../tavern-format/assets/character-placeholder.png')

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

function compareDefaultSummaries(left, right) {
  const updated = right.updatedAt.localeCompare(left.updatedAt)
  if (updated !== 0) return updated
  const named = compareNames(left, right)
  return named !== 0 ? named : left.id.localeCompare(right.id)
}

function compareNames(left, right) {
  const named = left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' })
  return named !== 0 ? named : left.id.localeCompare(right.id)
}

const CHARACTER_SORT_MODES = new Set(['updated', 'name', 'custom'])
const MAX_MISSING_CHARACTERS = 4096

function stateShape(selections, characterSortMode = 'updated', characterOrder = [], missingCharacters = []) {
  return { schemaVersion: 1, selectedBySessionId: selections, characterSortMode, characterOrder, missingCharacters }
}

function normalizeState(value) {
  const selections = Object.create(null)
  const characterOrder = []
  const missingCharacters = []
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.selectedBySessionId)) {
    return stateShape(selections, 'updated', characterOrder, missingCharacters)
  }
  for (const [sessionId, selection] of Object.entries(value.selectedBySessionId)) {
    try {
      validateSessionId(sessionId)
      validateId(selection?.characterCardId)
      if (isRecord(selection?.character)) selections[sessionId] = clone(selection)
    } catch {}
  }
  const seen = new Set()
  for (const id of Array.isArray(value.characterOrder) ? value.characterOrder : []) {
    try {
      validateId(id)
      if (!seen.has(id) && characterOrder.length < MAX_CHARACTER_ORDER_ENTRIES) characterOrder.push(id)
      seen.add(id)
    } catch {}
  }
  const characterSortMode = CHARACTER_SORT_MODES.has(value.characterSortMode)
    ? value.characterSortMode
    : characterOrder.length > 0 ? 'custom' : 'updated'
  const missingIds = new Set()
  for (const item of Array.isArray(value.missingCharacters) ? value.missingCharacters : []) {
    try {
      validateId(item?.id)
      if (missingIds.has(item.id) || typeof item.name !== 'string' || item.name.trim() === '') continue
      missingIds.add(item.id)
      missingCharacters.push({
        id: item.id,
        name: item.name.slice(0, 200),
        ...(typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(item.sha256) ? { sha256: item.sha256.toLowerCase() } : {}),
      })
      if (missingCharacters.length >= MAX_MISSING_CHARACTERS) break
    } catch {}
  }
  return stateShape(selections, characterSortMode, characterOrder, missingCharacters)
}

function greetingCount(character) {
  return 1 + (Array.isArray(character.data?.alternateGreetings) ? character.data.alternateGreetings.length : 0)
}

function clampGreetingIndex(character, greetingIndex) {
  const maxIndex = Math.max(0, greetingCount(character) - 1)
  if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0) return 0
  return Math.min(greetingIndex, maxIndex)
}

function normalizeSelection(character, patch = {}, options = {}) {
  const values = isRecord(patch.character) ? patch.character : {}
  const requested = values.greetingIndex === undefined ? 0 : Number(values.greetingIndex)
  const maxIndex = Math.max(0, greetingCount(character) - 1)
  let greetingIndex = requested
  if (options.clampGreetingIndex === true) {
    greetingIndex = clampGreetingIndex(character, requested)
  } else if (!Number.isSafeInteger(requested) || requested < 0 || requested > maxIndex) {
    throw new TypeError(`greetingIndex must be between 0 and ${maxIndex}`)
  }
  return {
    characterCardId: character.id,
    character: {
      greetingIndex,
      preferCharacterSystemPrompt: values.preferCharacterSystemPrompt !== false,
      preferCharacterPostHistory: values.preferCharacterPostHistory !== false,
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
    this.state = normalizeState(readJson(this.statePath, stateShape({})))
  }

  characterPath(id) {
    return join(this.charactersDir, `${validateId(id)}.json`)
  }

  artifactPath(id) {
    return join(this.artifactsDir, `${validateId(id)}.bin`)
  }

  list() {
    const characters = readdirSync(this.charactersDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap((entry) => {
        try {
          return [summary(validateDocument(readJson(join(this.charactersDir, entry.name))))]
        } catch {
          return []
        }
      })
    if (this.state.characterSortMode === 'updated') return characters.toSorted(compareDefaultSummaries)
    if (this.state.characterSortMode === 'name') return characters.toSorted(compareNames)
    const order = new Map(this.state.characterOrder.map((id, index) => [id, index]))
    return characters.toSorted((left, right) => {
      const leftIndex = order.get(left.id)
      const rightIndex = order.get(right.id)
      if (leftIndex === undefined && rightIndex === undefined) return compareDefaultSummaries(left, right)
      if (leftIndex === undefined) return 1
      if (rightIndex === undefined) return -1
      return leftIndex - rightIndex
    })
  }

  sorting() {
    return { mode: this.state.characterSortMode }
  }

  missing() {
    return clone(this.state.missingCharacters)
  }

  recoveryFor(id) {
    const character = summary(this.get(id))
    const byHash = typeof character.sha256 === 'string'
      ? this.state.missingCharacters.filter(item => item.sha256 === character.sha256)
      : []
    if (byHash.length === 1) return { previousId: byHash[0].id, characterId: id, match: 'sha256' }
    const normalizedName = character.name.trim().toLocaleLowerCase('zh-CN')
    const missingByName = this.state.missingCharacters.filter(item => item.name.trim().toLocaleLowerCase('zh-CN') === normalizedName)
    const currentByName = this.list().filter(item => item.name.trim().toLocaleLowerCase('zh-CN') === normalizedName)
    return missingByName.length === 1 && currentByName.length === 1
      ? { previousId: missingByName[0].id, characterId: id, match: 'name' }
      : null
  }

  resolveMissing(id) {
    validateId(id)
    const next = this.state.missingCharacters.filter(item => item.id !== id)
    if (next.length === this.state.missingCharacters.length) return false
    this.state.missingCharacters = next
    this.saveState()
    return true
  }

  setSorting(mode, characterIds) {
    if (!CHARACTER_SORT_MODES.has(mode)) throw new TypeError(`Unsupported character sort mode "${mode}"`)
    if (mode !== 'custom') {
      if (characterIds !== undefined) throw new TypeError('characterIds is only supported in custom sort mode')
      this.state.characterSortMode = mode
      this.saveState()
      return { characters: this.list(), sorting: this.sorting() }
    }
    if (characterIds === undefined) {
      const current = this.list()
      const knownIds = new Set(current.map(character => character.id))
      const next = this.state.characterOrder.filter(id => knownIds.has(id))
      const retained = new Set(next)
      for (const character of current) {
        if (!retained.has(character.id)) next.push(character.id)
      }
      this.state.characterSortMode = 'custom'
      this.state.characterOrder = next
      this.saveState()
      return { characters: this.list(), sorting: this.sorting() }
    }
    if (!Array.isArray(characterIds)) throw new TypeError('characterIds must be an array')
    if (characterIds.length > MAX_CHARACTER_ORDER_ENTRIES) {
      throw new TypeError(`characterIds cannot contain more than ${MAX_CHARACTER_ORDER_ENTRIES} entries`)
    }
    const knownIds = new Set(this.list().map(character => character.id))
    const next = []
    for (const id of characterIds) {
      validateId(id)
      if (!knownIds.has(id)) throw new TypeError(`Unknown character id "${id}"`)
      if (next.includes(id)) throw new TypeError(`Duplicate character id "${id}"`)
      next.push(id)
    }
    if (next.length !== knownIds.size) throw new TypeError('characterIds must contain every stored character exactly once')
    this.state.characterSortMode = 'custom'
    this.state.characterOrder = next
    this.saveState()
    return { characters: this.list(), sorting: this.sorting() }
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
    const bytes = inputBytes(input)
    if (bytes.byteLength > (options.maxArtifactBytes ?? MAX_ARTIFACT_BYTES)) {
      const error = new TypeError(`Character artifact exceeds the ${options.maxArtifactBytes ?? MAX_ARTIFACT_BYTES} byte limit`)
      error.code = 'ARTIFACT_TOO_LARGE'
      throw error
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const character = parseSillyTavernCharacterCard(bytes, {
      id: options.id,
      name: options.name,
      fileName: options.fileName,
      now: options.now,
      sha256,
      byteLength: bytes.byteLength,
      png: options.png,
    })
    const documentPath = this.characterPath(character.id)
    const coverPath = this.artifactPath(character.id)
    if (existsSync(documentPath)) {
      const error = new Error(`Character id "${character.id}" already exists`)
      error.code = 'CHARACTER_ID_EXISTS'
      throw error
    }
    const cover = isPng(bytes) ? stripCharacterCardPng(bytes, options.png) : null
    try {
      if (cover !== null) atomicBytes(coverPath, cover)
      atomicJson(documentPath, character)
      if (this.state.characterSortMode === 'custom') {
        this.state.characterOrder.push(character.id)
        this.saveState()
      }
    } catch (error) {
      try { unlinkSync(documentPath) } catch {}
      try { unlinkSync(coverPath) } catch {}
      throw error
    }
    return character
  }

  create(options = {}) {
    const character = createBlankCharacterCard(options)
    const documentPath = this.characterPath(character.id)
    if (existsSync(documentPath)) {
      const error = new Error(`Character id "${character.id}" already exists`)
      error.code = 'CHARACTER_ID_EXISTS'
      throw error
    }
    atomicJson(documentPath, character)
    if (this.state.characterSortMode === 'custom') {
      this.state.characterOrder.push(character.id)
      this.saveState()
    }
    return character
  }

  coverImage(id) {
    this.get(id)
    try {
      const bytes = readFileSync(this.artifactPath(id))
      if (isPng(bytes)) return bytes
      try { unlinkSync(this.artifactPath(id)) } catch {}
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    return null
  }

  json(id) {
    const character = this.get(id)
    return {
      text: exportCharacterCardJson(character),
      fileName: `${character.name || 'character'}.json`,
    }
  }

  png(id) {
    const character = this.get(id)
    const image = this.coverImage(id) ?? readFileSync(PLACEHOLDER_PNG_PATH)
    return {
      bytes: exportCharacterCardPng(character, image),
      mediaType: 'image/png',
      fileName: `${character.name || 'character'}.png`,
    }
  }

  persistCharacter(id, character) {
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

  clampGreetingSelections(id, character) {
    let changed = false
    for (const [sessionId, selection] of Object.entries(this.state.selectedBySessionId)) {
      if (selection?.characterCardId !== id || !isRecord(selection.character)) continue
      const greetingIndex = clampGreetingIndex(character, Number(selection.character.greetingIndex ?? 0))
      if (greetingIndex === selection.character.greetingIndex) continue
      this.state.selectedBySessionId[sessionId] = {
        ...selection,
        character: { ...selection.character, greetingIndex },
      }
      changed = true
    }
    if (changed) this.saveState()
  }

  update(id, patch, options = {}) {
    const character = editCharacterCard(this.get(id), patch, options)
    this.persistCharacter(id, character)
    this.clampGreetingSelections(id, character)
    return character
  }

  regexScripts(id) {
    return readNativeRegexScripts(this.get(id))
  }

  replaceRegexScripts(id, regexScripts, options = {}) {
    const character = replaceNativeRegexScripts(this.get(id), regexScripts, {
      ...options,
      kind: 'character',
    })
    return this.persistCharacter(id, character)
  }

  delete(id) {
    validateId(id)
    const character = this.get(id)
    const deletedSummary = summary(character)
    try { unlinkSync(this.characterPath(id)) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    try { unlinkSync(this.artifactPath(id)) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    let changed = false
    const missingIndex = this.state.missingCharacters.findIndex(item => item.id === id)
    const missing = {
      id,
      name: deletedSummary.name,
      ...(typeof deletedSummary.sha256 === 'string' ? { sha256: deletedSummary.sha256 } : {}),
    }
    if (missingIndex === -1) {
      this.state.missingCharacters.push(missing)
      if (this.state.missingCharacters.length > MAX_MISSING_CHARACTERS) this.state.missingCharacters.shift()
    } else {
      this.state.missingCharacters[missingIndex] = missing
    }
    changed = true
    const orderIndex = this.state.characterOrder.indexOf(id)
    if (orderIndex !== -1) {
      this.state.characterOrder.splice(orderIndex, 1)
      changed = true
    }
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
      return normalizeSelection(character, selection, { clampGreetingIndex: true })
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
    this.persistCharacter(id, character)
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
  maxCharacterOrderEntries: MAX_CHARACTER_ORDER_ENTRIES,
})
