import { embedCharacterCardPng, extractCharacterCardPng, isPng } from './png-card.js'

const CHARACTER_SCHEMA_VERSION = 1
const KNOWN_MACROS = new Set([
  'char', 'user', 'original', 'description', 'personality', 'scenario', 'mesexamples',
  'lastusermessage', 'lastcharmessage', 'trim',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function makeId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `character-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function displayName(value, fallback = 'Imported character') {
  const name = text(value).trim()
  return (name === '' ? fallback : name).slice(0, 200)
}

function sourceFileName(value, fallback) {
  const name = text(value).replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (name === '' ? fallback : name).slice(0, 255)
}

function diagnostic(code, message, path) {
  return { code, message, ...(path === undefined ? {} : { path }) }
}

function parseJson(input) {
  if (isRecord(input)) return clone(input)
  if (typeof input !== 'string') throw new TypeError('Character card must be a JSON object, JSON string, or PNG bytes')
  try {
    const parsed = JSON.parse(input)
    if (!isRecord(parsed)) throw new TypeError('Character card JSON must be an object')
    return parsed
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Character card JSON must be an object') throw error
    throw new TypeError(`Invalid character-card JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function decodeBytes(input) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input)
  } catch {
    throw new TypeError('Character-card JSON is not valid UTF-8')
  }
}

function detectVersion(raw) {
  const spec = text(raw.spec)
  const specVersion = text(raw.spec_version)
  if (spec === 'chara_card_v3' || /^3(?:\.|$)/.test(specVersion)) {
    if (!isRecord(raw.data)) throw new TypeError('V3 character card must contain a data object')
    return { kind: 'v3', format: 'character-card-v3', specVersion: specVersion || '3.0', data: raw.data }
  }
  if (spec === 'chara_card_v2' || /^2(?:\.|$)/.test(specVersion)) {
    if (!isRecord(raw.data)) throw new TypeError('V2 character card must contain a data object')
    return { kind: 'v2', format: 'sillytavern-v2', specVersion: specVersion || '2.0', data: raw.data }
  }
  return { kind: 'v1', format: 'sillytavern-v1', specVersion: undefined, data: raw }
}

function checkFieldTypes(data, version) {
  const fields = [
    'name', 'nickname', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
    'creator_notes', 'system_prompt', 'post_history_instructions', 'creator', 'character_version',
  ]
  for (const field of fields) {
    if (data[field] !== undefined && typeof data[field] !== 'string') {
      throw new TypeError(`${version.toUpperCase()} character-card field data.${field} must be a string`)
    }
  }
  for (const field of ['alternate_greetings', 'group_only_greetings', 'tags']) {
    if (data[field] !== undefined && (!Array.isArray(data[field]) || data[field].some((item) => typeof item !== 'string'))) {
      throw new TypeError(`${version.toUpperCase()} character-card field data.${field} must be an array of strings`)
    }
  }
  if (data.extensions !== undefined && !isRecord(data.extensions)) {
    throw new TypeError(`${version.toUpperCase()} character-card field data.extensions must be an object`)
  }
  if (data.character_book !== undefined && data.character_book !== null && !isRecord(data.character_book)) {
    throw new TypeError(`${version.toUpperCase()} character-card field data.character_book must be an object or null`)
  }
  if (data.assets !== undefined && !Array.isArray(data.assets)) {
    throw new TypeError(`${version.toUpperCase()} character-card field data.assets must be an array`)
  }
}

function unknownMacros(data) {
  const found = new Set()
  const fields = [
    data.description, data.personality, data.scenario, data.first_mes, data.mes_example,
    data.system_prompt, data.post_history_instructions, ...(data.alternate_greetings ?? []),
    ...(data.group_only_greetings ?? []),
  ]
  for (const field of fields) {
    if (typeof field !== 'string') continue
    for (const match of field.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      const body = match[1].trim()
      const name = body.split(/::|\s/, 1)[0].toLowerCase()
      if (!KNOWN_MACROS.has(name) && !name.startsWith('//') && name !== 'setvar' && name !== 'getvar' && name !== 'random' && name !== 'roll') found.add(name)
    }
  }
  return [...found].filter(Boolean).toSorted()
}

function normalizeData(data, version, warnings, unsupportedFeatures) {
  checkFieldTypes(data, version)
  if (text(data.name).trim() === '') warnings.push(diagnostic('missing-name', 'The character name is empty.', 'data.name'))
  if (version === 'v3' && Array.isArray(data.assets) && data.assets.length > 0) {
    unsupportedFeatures.push(diagnostic('v3-assets-pass-through', 'V3 assets are preserved but are not fetched or executed.', 'data.assets'))
  }
  if (isRecord(data.extensions) && Object.keys(data.extensions).length > 0) {
    unsupportedFeatures.push(diagnostic('extensions-pass-through', 'Extensions are preserved as inert compatibility data.', 'data.extensions'))
  }
  if (isRecord(data.character_book)) {
    unsupportedFeatures.push(diagnostic('embedded-character-book-pass-through', 'Embedded character_book is exposed to the loader/world-book module but is not activated by the character module.', 'data.character_book'))
  }
  if (text(data.post_history_instructions) !== '') {
    unsupportedFeatures.push(diagnostic('post-history-runtime-required', 'Post-history instructions require loader placement policy.', 'data.post_history_instructions'))
  }
  if (isRecord(data.extensions?.depth_prompt)) {
    unsupportedFeatures.push(diagnostic('depth-prompt-runtime-required', 'Depth prompt is preserved for a loader that supports an appropriate insertion seam.', 'data.extensions.depth_prompt'))
  }

  return {
    name: text(data.name),
    nickname: text(data.nickname),
    description: text(data.description),
    personality: text(data.personality),
    scenario: text(data.scenario),
    firstMessage: text(data.first_mes),
    messageExample: text(data.mes_example),
    creatorNotes: text(data.creator_notes ?? data.creatorcomment),
    systemPrompt: text(data.system_prompt),
    postHistoryInstructions: text(data.post_history_instructions),
    alternateGreetings: strings(data.alternate_greetings),
    groupOnlyGreetings: strings(data.group_only_greetings),
    tags: strings(data.tags),
    creator: text(data.creator),
    characterVersion: text(data.character_version),
    characterBook: isRecord(data.character_book) ? clone(data.character_book) : null,
    assets: Array.isArray(data.assets) ? clone(data.assets) : [],
    extensions: isRecord(data.extensions) ? clone(data.extensions) : {},
  }
}

export function parseSillyTavernCharacterCard(input, options = {}) {
  let container = options.container
  let png
  let raw
  if (input instanceof Uint8Array || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    const value = input instanceof Uint8Array
      ? input
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    if (isPng(value)) {
      png = extractCharacterCardPng(value, options.png)
      raw = parseJson(png.jsonText)
      container = 'png'
    } else {
      raw = parseJson(decodeBytes(value))
      container = container ?? 'json'
    }
  } else {
    raw = parseJson(input)
    container = container ?? 'json'
  }

  const detected = detectVersion(raw)
  const warnings = []
  const unsupportedFeatures = []
  if (detected.kind === 'v3' && !/^3\.0(?:\.|$)/.test(detected.specVersion)) {
    warnings.push(diagnostic('newer-v3-version', `Character Card V3 version ${detected.specVersion} may contain newer fields.`, 'spec_version'))
  }
  if (png?.keyword === 'chara' && detected.kind === 'v3') {
    warnings.push(diagnostic('v3-in-legacy-chunk', 'A V3 card was stored in the legacy chara PNG chunk.', 'png.chara'))
  }
  if (png?.availableKeywords.length === 2) {
    warnings.push(diagnostic('png-v3-precedence', 'Both chara and ccv3 chunks are present; ccv3 was selected.', 'png.ccv3'))
  }

  const data = normalizeData(detected.data, detected.kind, warnings, unsupportedFeatures)
  const now = options.now ?? new Date().toISOString()
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: options.id ?? makeId(),
    name: displayName(options.name ?? data.name),
    createdAt: now,
    updatedAt: now,
    source: {
      format: detected.format,
      container,
      specVersion: detected.specVersion,
      importedAt: now,
      fileName: sourceFileName(options.fileName, container === 'png' ? 'character.png' : 'character.json'),
      ...(typeof options.sha256 === 'string' ? { sha256: options.sha256 } : {}),
      ...(Number.isSafeInteger(options.byteLength) ? { byteLength: options.byteLength } : {}),
      ...(png === undefined ? {} : { pngKeyword: png.keyword }),
      raw: clone(raw),
    },
    data,
    compatibility: {
      warnings,
      unsupportedFeatures,
      unknownMacroNames: unknownMacros(detected.data),
    },
  }
}

export function exportCharacterCardJson(character, options = {}) {
  if (!isRecord(character?.source?.raw)) throw new TypeError('Character document does not contain preserved source JSON')
  const space = options.pretty === false ? undefined : 2
  return `${JSON.stringify(character.source.raw, null, space)}${space === undefined ? '' : '\n'}`
}

const EDITABLE_STRING_FIELDS = [
  ['name', 'name'],
  ['nickname', 'nickname'],
  ['description', 'description'],
  ['personality', 'personality'],
  ['scenario', 'scenario'],
  ['firstMessage', 'first_mes'],
  ['messageExample', 'mes_example'],
  ['creatorNotes', 'creator_notes'],
  ['systemPrompt', 'system_prompt'],
  ['postHistoryInstructions', 'post_history_instructions'],
  ['creator', 'creator'],
  ['characterVersion', 'character_version'],
]

const EDITABLE_STRING_ARRAY_FIELDS = [
  ['alternateGreetings', 'alternate_greetings'],
  ['tags', 'tags'],
]

const EDITABLE_PATCH_KEYS = new Set([
  ...EDITABLE_STRING_FIELDS.map(([camel]) => camel),
  ...EDITABLE_STRING_ARRAY_FIELDS.map(([camel]) => camel),
])

function rawDataRoot(character) {
  if (!isRecord(character?.source?.raw)) throw new TypeError('Character document does not contain editable source JSON')
  if (character.source.format === 'sillytavern-v1') return character.source.raw
  if (!isRecord(character.source.raw.data)) throw new TypeError('Character document does not contain editable source JSON')
  return character.source.raw.data
}

function refreshNameWarning(warnings, name) {
  const next = (Array.isArray(warnings) ? warnings : []).filter((item) => item?.code !== 'missing-name')
  if (text(name).trim() === '') next.push(diagnostic('missing-name', 'The character name is empty.', 'data.name'))
  return next
}

export function editCharacterCard(existing, patch, options = {}) {
  if (!isRecord(existing) || existing.schemaVersion !== CHARACTER_SCHEMA_VERSION) {
    throw new TypeError('Unsupported character document')
  }
  if (!isRecord(patch)) throw new TypeError('Character update must be an object')
  const unexpected = Object.keys(patch).find((key) => !EDITABLE_PATCH_KEYS.has(key))
  if (unexpected !== undefined) throw new TypeError(`Unsupported character field "${unexpected}"`)

  const next = clone(existing)
  const rawRoot = rawDataRoot(next)

  for (const [camel, snake] of EDITABLE_STRING_FIELDS) {
    if (patch[camel] === undefined) continue
    if (typeof patch[camel] !== 'string') throw new TypeError(`${camel} must be a string`)
    next.data[camel] = patch[camel]
    rawRoot[snake] = patch[camel]
  }
  if (typeof patch.creatorNotes === 'string' && next.source.format === 'sillytavern-v1') {
    rawRoot.creatorcomment = patch.creatorNotes
  }
  for (const [camel, snake] of EDITABLE_STRING_ARRAY_FIELDS) {
    if (patch[camel] === undefined) continue
    if (!Array.isArray(patch[camel]) || patch[camel].some((item) => typeof item !== 'string')) {
      throw new TypeError(`${camel} must be an array of strings`)
    }
    next.data[camel] = [...patch[camel]]
    rawRoot[snake] = [...patch[camel]]
  }

  next.name = displayName(next.data.name)
  next.updatedAt = options.now ?? new Date().toISOString()
  next.compatibility = {
    ...clone(existing.compatibility ?? { warnings: [], unsupportedFeatures: [], unknownMacroNames: [] }),
    warnings: refreshNameWarning(existing.compatibility?.warnings, next.data.name),
    unknownMacroNames: unknownMacros(rawRoot),
  }
  return next
}

export function exportCharacterCardPng(character, pngInput, options = {}) {
  if (!isRecord(character?.source?.raw)) throw new TypeError('Character document does not contain preserved source JSON')
  const keywords = character.source?.format === 'character-card-v3' ? ['ccv3', 'chara'] : ['chara']
  return embedCharacterCardPng(pngInput, JSON.stringify(character.source.raw), { ...options, keywords })
}

export function createBlankCharacterCard(options = {}) {
  const name = displayName(options.name, 'Untitled character')
  return parseSillyTavernCharacterCard({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name,
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: '',
      character_version: '',
      extensions: {},
    },
  }, {
    id: options.id,
    name,
    now: options.now,
    fileName: options.fileName ?? 'character.json',
    container: 'json',
  })
}

export function embeddedCharacterBookResource(character) {
  if (!isRecord(character) || character.schemaVersion !== CHARACTER_SCHEMA_VERSION) {
    throw new TypeError('Unsupported character document')
  }
  if (!isRecord(character.data?.characterBook)) return null
  return {
    kind: 'embedded-character-book',
    ownerCharacterId: character.id,
    ownerCharacterName: character.name,
    sourceFormat: character.source?.format ?? 'unknown',
    book: clone(character.data.characterBook),
  }
}

export const characterCardConstants = Object.freeze({
  schemaVersion: CHARACTER_SCHEMA_VERSION,
})
