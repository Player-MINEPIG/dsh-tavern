import { createHash, randomUUID } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import {
  WORLD_BOOK_FORMATS,
  WORLD_BOOK_POSITIONS,
  exportCharacterBook,
  exportSillyTavernWorldBook,
  parseCharacterBook,
  parseSillyTavernWorldBook,
  parseWorldBook,
  stableStringify,
} from '../../world-book/src/format.js'

const DOCUMENT_SCHEMA_VERSION = 1
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024
const EDITABLE_ENTRY_FIELDS = [
  'keys', 'secondaryKeys', 'comment', 'content', 'enabled', 'constant',
  'selective', 'insertionOrder', 'position', 'selectiveLogic', 'probability',
  'useProbability', 'caseSensitive', 'matchWholeWords',
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function importedName(fileName) {
  if (typeof fileName !== 'string') return ''
  const safe = safeFileName(fileName, '')
  if (safe === '') return ''
  const extension = extname(safe)
  return basename(safe, extension).trim()
}

function validateId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid world-book id')
  return id
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
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

function inputBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input)
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  if (isRecord(input)) return new TextEncoder().encode(JSON.stringify(input))
  throw new TypeError('World-book import must contain JSON text, an object, or file bytes')
}

function safeFileName(value, fallback = 'world-book.json') {
  if (typeof value !== 'string') return fallback
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return cleaned === '' ? fallback : cleaned
}

function validateDocument(document) {
  if (!isRecord(document)
    || document.schemaVersion !== DOCUMENT_SCHEMA_VERSION
    || document.kind !== 'world-book-document'
    || typeof document.id !== 'string'
    || typeof document.name !== 'string'
    || typeof document.createdAt !== 'string'
    || typeof document.updatedAt !== 'string'
    || !isRecord(document.source)
    || !isRecord(document.book)
    || document.book.kind !== 'world-book'
    || !Array.isArray(document.book.entries)) {
    const error = new Error('Stored world-book document is invalid')
    error.code = 'WORLD_BOOK_DOCUMENT_INVALID'
    throw error
  }
  validateId(document.id)
  return document
}

function summary(document) {
  return {
    id: document.id,
    name: document.name,
    description: document.book.description,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    sourceFormat: document.source.format,
    fileName: document.source.fileName,
    byteLength: document.source.byteLength,
    sha256: document.source.sha256,
    entryCount: document.book.entries.length,
    enabledEntryCount: document.book.entries.filter(entry => entry.enabled === true).length,
    warningCount: document.book.diagnostics.filter(item => item.severity === 'warning').length,
  }
}

function defaultEntry(uid, sourceKey, format) {
  if (format === WORLD_BOOK_FORMATS.CHARACTER_BOOK) {
    return parseCharacterBook({
      extensions: {},
      entries: [{
        id: uid,
        keys: [],
        secondary_keys: [],
        comment: '',
        content: '',
        enabled: true,
        constant: false,
        selective: false,
        insertion_order: 100,
        position: 'after_char',
        extensions: { position: 1, probability: 100, useProbability: true },
      }],
    }).entries[0]
  }
  return parseSillyTavernWorldBook({
    entries: {
      [sourceKey]: {
        uid,
        key: [],
        keysecondary: [],
        comment: '',
        content: '',
        disable: false,
        constant: false,
        selective: false,
        order: 100,
        position: 1,
        probability: 100,
        useProbability: true,
      },
    },
  }).entries[0]
}

function sourceIdentity(entry) {
  return `${typeof entry?.uid}:${String(entry?.uid)}\u0000${String(entry?.source?.key ?? '')}`
}

function nextSourceKey(entries, uid, index) {
  const used = new Set(entries.map(entry => String(entry?.source?.key ?? '')))
  // Integer-like object keys are enumerated ahead of string keys by JavaScript,
  // which would reorder a standalone ST object-map after a save/reload.
  const base = `entry-${String(uid ?? index + 1)}`
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function editableEntry(currentEntries, input, index, claimed, format) {
  if (!isRecord(input)) throw new TypeError(`book.entries[${index}] must be an object`)
  const identity = sourceIdentity(input)
  let currentIndex = currentEntries.findIndex((entry, candidateIndex) => !claimed.has(candidateIndex) && sourceIdentity(entry) === identity)
  if (currentIndex < 0) {
    currentIndex = currentEntries.findIndex((entry, candidateIndex) => !claimed.has(candidateIndex)
      && typeof input.uid === typeof entry.uid && input.uid === entry.uid)
  }
  let entry
  if (currentIndex >= 0) {
    claimed.add(currentIndex)
    entry = clone(currentEntries[currentIndex])
  } else {
    const uid = Number.isSafeInteger(input.uid) || (typeof input.uid === 'string' && input.uid !== '')
      ? input.uid
      : `entry-${randomUUID().slice(0, 12)}`
    entry = defaultEntry(uid, nextSourceKey(currentEntries, uid, index), format)
  }
  for (const field of EDITABLE_ENTRY_FIELDS) {
    if (Object.hasOwn(input, field)) entry[field] = clone(input[field])
  }
  if (!WORLD_BOOK_POSITIONS.includes(entry.position)) throw new TypeError(`book.entries[${index}].position is invalid`)
  return entry
}

function applyEdit(document, patch, now) {
  if (!isRecord(patch)) throw new TypeError('World-book update must be an object')
  const input = isRecord(patch.book) ? patch.book : patch
  const book = clone(document.book)
  if (Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string') throw new TypeError('book.name must be a string')
    book.name = input.name
  }
  if (Object.hasOwn(input, 'description')) {
    if (typeof input.description !== 'string') throw new TypeError('book.description must be a string')
    book.description = input.description
  }
  if (Object.hasOwn(input, 'settings')) {
    if (!isRecord(input.settings)) throw new TypeError('book.settings must be an object')
    for (const field of ['scanDepth', 'tokenBudget', 'recursiveScanning']) {
      if (Object.hasOwn(input.settings, field)) book.settings[field] = clone(input.settings[field])
    }
  }
  if (Object.hasOwn(input, 'entries')) {
    if (!Array.isArray(input.entries)) throw new TypeError('book.entries must be an array')
    const claimed = new Set()
    book.entries = input.entries.map((entry, index) => editableEntry(document.book.entries, entry, index, claimed, book.source.format))
  }

  const raw = book.source.format === WORLD_BOOK_FORMATS.CHARACTER_BOOK
    ? exportCharacterBook(book)
    : exportSillyTavernWorldBook(book)
  const normalized = parseWorldBook(raw, { format: book.source.format, name: book.name })
  return validateDocument({
    ...clone(document),
    name: normalized.name || document.name,
    updatedAt: now,
    book: normalized,
  })
}

function generatedId() {
  return `world-book-${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

export class WorldBookStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.booksDir = join(this.storageDir, 'world-books')
    mkdirSync(this.booksDir, { recursive: true })
  }

  bookPath(id) {
    return join(this.booksDir, `${validateId(id)}.json`)
  }

  list() {
    return readdirSync(this.booksDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap(entry => {
        try {
          return [summary(validateDocument(readJson(join(this.booksDir, entry.name))))]
        } catch {
          return []
        }
      })
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  }

  get(id) {
    const document = readJson(this.bookPath(id))
    if (document === undefined) {
      const error = new Error(`World book "${id}" not found`)
      error.code = 'WORLD_BOOK_NOT_FOUND'
      throw error
    }
    return validateDocument(document)
  }

  save(document) {
    validateDocument(document)
    atomicJson(this.bookPath(document.id), document)
    return document
  }

  import(input, options = {}) {
    const bytes = inputBytes(input)
    const limit = options.maxArtifactBytes ?? MAX_ARTIFACT_BYTES
    if (bytes.byteLength > limit) {
      const error = new TypeError(`World-book artifact exceeds the ${limit} byte limit`)
      error.code = 'WORLD_BOOK_ARTIFACT_TOO_LARGE'
      throw error
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const book = parseWorldBook(text, { name: options.name })
    const fallbackName = importedName(options.fileName) || 'Untitled World Book'
    if (book.name === '') book.name = fallbackName
    const id = validateId(options.id ?? generatedId())
    try {
      this.get(id)
      const error = new Error(`World-book id "${id}" already exists`)
      error.code = 'WORLD_BOOK_ID_EXISTS'
      throw error
    } catch (error) {
      if (error?.code !== 'WORLD_BOOK_NOT_FOUND') throw error
    }
    const now = options.now ?? new Date().toISOString()
    return this.save({
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      kind: 'world-book-document',
      id,
      name: book.name || options.name || fallbackName,
      createdAt: now,
      updatedAt: now,
      source: {
        format: book.source.format,
        fileName: safeFileName(options.fileName),
        byteLength: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      book,
    })
  }

  create(options = {}) {
    const name = typeof options.name === 'string' && options.name.trim() !== '' ? options.name.trim() : 'Untitled World Book'
    return this.import(stableStringify({ name, entries: {} }), {
      ...options,
      name,
      fileName: options.fileName ?? `${name}.json`,
    })
  }

  update(id, patch, options = {}) {
    return this.save(applyEdit(this.get(id), patch, options.now ?? new Date().toISOString()))
  }

  export(id) {
    const document = this.get(id)
    const raw = document.book.source.format === WORLD_BOOK_FORMATS.CHARACTER_BOOK
      ? exportCharacterBook(document.book)
      : exportSillyTavernWorldBook(document.book)
    return {
      text: `${stableStringify(raw)}\n`,
      fileName: safeFileName(document.source.fileName, `${document.name || 'world-book'}.json`),
      sha256: createHash('sha256').update(stableStringify(raw)).digest('hex'),
    }
  }

  delete(id) {
    validateId(id)
    try {
      unlinkSync(this.bookPath(id))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}

export const worldBookStoreConstants = Object.freeze({
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  maxArtifactBytes: MAX_ARTIFACT_BYTES,
})
