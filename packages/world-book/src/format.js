import { assertWorldBookStructure } from './limits.js'

const SCHEMA_VERSION = 1

export const WORLD_BOOK_FORMATS = Object.freeze({
  SILLY_TAVERN: 'sillytavern-world-info',
  CHARACTER_BOOK: 'character-book-v2',
})

export const WORLD_BOOK_POSITIONS = Object.freeze([
  'before_character_definition',
  'after_character_definition',
  'before_author_note',
  'after_author_note',
  'at_depth',
  'before_example_messages',
  'after_example_messages',
  'outlet',
])

export const WORLD_BOOK_ROLES = Object.freeze(['system', 'user', 'assistant'])
export const SECONDARY_LOGIC = Object.freeze(['and_any', 'not_all', 'not_any', 'and_all'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function diagnostic(severity, code, path, message, value) {
  const result = { severity, code, path, message }
  if (value !== undefined) result.value = clone(value)
  return result
}

function warning(diagnostics, code, path, message, value) {
  diagnostics.push(diagnostic('warning', code, path, message, value))
}

function error(diagnostics, code, path, message, value) {
  diagnostics.push(diagnostic('error', code, path, message, value))
}

function parseJsonInput(input, diagnostics) {
  if (typeof input !== 'string') return input
  try {
    return JSON.parse(input)
  } catch (cause) {
    error(diagnostics, 'invalid-json', '$', `Invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
    return undefined
  }
}

function pathKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(String(key))
    ? `.${key}`
    : `[${JSON.stringify(String(key))}]`
}

function optionalString(value, fallback, diagnostics, path) {
  if (value === undefined) return fallback
  if (typeof value === 'string') return value
  warning(diagnostics, 'invalid-string', path, 'Expected a string; using the compatibility default', value)
  return fallback
}

function optionalBoolean(value, fallback, diagnostics, path) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  warning(diagnostics, 'invalid-boolean', path, 'Expected a boolean; using the compatibility default', value)
  return fallback
}

function optionalNumber(value, fallback, diagnostics, path, { min = -Infinity, max = Infinity, integer = false, nullable = false } = {}) {
  if (value === undefined) return fallback
  if (value === null && nullable) return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const coerced = Number(value)
    if (Number.isFinite(coerced) && coerced >= min && coerced <= max && (!integer || Number.isInteger(coerced))) {
      warning(diagnostics, 'coerced-number', path, 'Accepted a numeric string for SillyTavern compatibility', value)
      return coerced
    }
  }
  warning(diagnostics, 'invalid-number', path, 'Expected a finite number in the supported range; using the compatibility default', value)
  return fallback
}

function optionalStringArray(value, fallback, diagnostics, path) {
  if (value === undefined) return clone(fallback)
  if (!Array.isArray(value)) {
    warning(diagnostics, 'invalid-string-array', path, 'Expected an array of strings; using the compatibility default', value)
    return clone(fallback)
  }
  const strings = value.filter(item => typeof item === 'string')
  if (strings.length !== value.length) warning(diagnostics, 'invalid-string-array-item', path, 'Non-string array items were ignored', value)
  return strings
}

function optionalRecord(value, fallback, diagnostics, path) {
  if (value === undefined) return clone(fallback)
  if (isRecord(value)) return clone(value)
  warning(diagnostics, 'invalid-object', path, 'Expected an object; using the compatibility default', value)
  return clone(fallback)
}

function firstDefined(...values) {
  return values.find(value => value !== undefined)
}

function normalizeUid(value, fallback, diagnostics, path) {
  if (Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && value !== '') return value
  if (value !== undefined) warning(diagnostics, 'invalid-uid', path, 'Expected a non-negative integer or non-empty string; using the entry position', value)
  return fallback
}

function normalizePosition(value, fallback, diagnostics, path) {
  if (Number.isInteger(value) && WORLD_BOOK_POSITIONS[value] !== undefined) return WORLD_BOOK_POSITIONS[value]
  if (WORLD_BOOK_POSITIONS.includes(value)) return value
  if (value === 'before_char') return 'before_character_definition'
  if (value === 'after_char') return 'after_character_definition'
  if (value !== undefined && value !== null) warning(diagnostics, 'unknown-position', path, 'Unknown insertion position; using before_character_definition', value)
  return fallback
}

function normalizeRole(value, diagnostics, path) {
  if (Number.isInteger(value) && WORLD_BOOK_ROLES[value] !== undefined) return WORLD_BOOK_ROLES[value]
  if (WORLD_BOOK_ROLES.includes(value)) return value
  if (value !== undefined && value !== null) warning(diagnostics, 'unknown-role', path, 'Unknown insertion role; using system', value)
  return 'system'
}

function normalizeSecondaryLogic(value, diagnostics, path) {
  if (Number.isInteger(value) && SECONDARY_LOGIC[value] !== undefined) return SECONDARY_LOGIC[value]
  if (SECONDARY_LOGIC.includes(value)) return value
  if (value !== undefined && value !== null) warning(diagnostics, 'unknown-secondary-logic', path, 'Unknown secondary-key logic; using and_any', value)
  return 'and_any'
}

function normalizeCharacterFilter(value, diagnostics, path) {
  if (value === undefined || value === null) return null
  if (!isRecord(value)) {
    warning(diagnostics, 'invalid-character-filter', path, 'Expected an object; ignoring the character filter', value)
    return null
  }
  return {
    isExclude: optionalBoolean(value.isExclude, false, diagnostics, `${path}.isExclude`),
    names: optionalStringArray(value.names, [], diagnostics, `${path}.names`),
    tags: optionalStringArray(value.tags, [], diagnostics, `${path}.tags`),
    raw: clone(value),
  }
}

function normalizeEntry(rawEntry, source, diagnostics) {
  const { format, index, key: sourceKey, path } = source
  if (format === WORLD_BOOK_FORMATS.CHARACTER_BOOK) {
    for (const fieldName of ['keys', 'content', 'extensions', 'enabled', 'insertion_order']) {
      if (!Object.hasOwn(rawEntry, fieldName)) {
        warning(diagnostics, 'missing-required-field', `${path}.${fieldName}`, `Character Book V2 requires ${fieldName}; using the compatibility default`)
      }
    }
  }
  const extensions = optionalRecord(rawEntry.extensions, {}, diagnostics, `${path}.extensions`)
  const characterShape = format === WORLD_BOOK_FORMATS.CHARACTER_BOOK
  const field = (standalone, embedded, extension) => characterShape
    ? firstDefined(rawEntry[embedded], extensions[extension])
    : firstDefined(rawEntry[standalone], extensions[extension])

  const uid = normalizeUid(characterShape ? rawEntry.id : rawEntry.uid, characterShape ? index : sourceKey, diagnostics, `${path}.${characterShape ? 'id' : 'uid'}`)
  const keys = optionalStringArray(characterShape ? rawEntry.keys : rawEntry.key, [], diagnostics, `${path}.${characterShape ? 'keys' : 'key'}`)
  const secondaryKeys = optionalStringArray(characterShape ? rawEntry.secondary_keys : rawEntry.keysecondary, [], diagnostics, `${path}.${characterShape ? 'secondary_keys' : 'keysecondary'}`)
  const content = optionalString(rawEntry.content, '', diagnostics, `${path}.content`)
  const enabled = characterShape
    ? optionalBoolean(rawEntry.enabled, false, diagnostics, `${path}.enabled`)
    : !optionalBoolean(rawEntry.disable, false, diagnostics, `${path}.disable`)

  const constant = optionalBoolean(rawEntry.constant, false, diagnostics, `${path}.constant`)
  const vectorized = optionalBoolean(field('vectorized', 'vectorized', 'vectorized'), false, diagnostics, `${path}.extensions.vectorized`)
  const rawPosition = characterShape
    ? firstDefined(extensions.position, rawEntry.position)
    : firstDefined(rawEntry.position, extensions.position)
  const position = normalizePosition(rawPosition, characterShape ? 'after_character_definition' : 'before_character_definition', diagnostics, `${path}.position`)

  return {
    uid,
    keys,
    secondaryKeys,
    comment: optionalString(firstDefined(rawEntry.comment, rawEntry.name), '', diagnostics, `${path}.comment`),
    content,
    enabled,
    constant,
    selective: optionalBoolean(rawEntry.selective, characterShape ? false : true, diagnostics, `${path}.selective`),
    vectorized,
    insertionOrder: optionalNumber(characterShape ? rawEntry.insertion_order : rawEntry.order, 100, diagnostics, `${path}.${characterShape ? 'insertion_order' : 'order'}`),
    position,
    depth: optionalNumber(field('depth', 'depth', 'depth'), 4, diagnostics, `${path}.extensions.depth`, { min: 0, integer: true }),
    role: normalizeRole(field('role', 'role', 'role'), diagnostics, `${path}.extensions.role`),
    selectiveLogic: normalizeSecondaryLogic(field('selectiveLogic', 'selectiveLogic', 'selectiveLogic'), diagnostics, `${path}.extensions.selectiveLogic`),
    probability: optionalNumber(field('probability', 'probability', 'probability'), 100, diagnostics, `${path}.extensions.probability`, { min: 0, max: 100 }),
    useProbability: optionalBoolean(field('useProbability', 'useProbability', 'useProbability'), true, diagnostics, `${path}.extensions.useProbability`),
    scanDepth: optionalNumber(field('scanDepth', 'scan_depth', 'scan_depth'), null, diagnostics, `${path}.extensions.scan_depth`, { min: 0, integer: true, nullable: true }),
    caseSensitive: optionalBoolean(field('caseSensitive', 'case_sensitive', 'case_sensitive'), null, diagnostics, `${path}.extensions.case_sensitive`),
    matchWholeWords: optionalBoolean(field('matchWholeWords', 'match_whole_words', 'match_whole_words'), null, diagnostics, `${path}.extensions.match_whole_words`),
    useGroupScoring: optionalBoolean(field('useGroupScoring', 'use_group_scoring', 'use_group_scoring'), null, diagnostics, `${path}.extensions.use_group_scoring`),
    displayIndex: optionalNumber(field('displayIndex', 'display_index', 'display_index'), index, diagnostics, `${path}.extensions.display_index`),
    outletName: optionalString(field('outletName', 'outlet_name', 'outlet_name'), '', diagnostics, `${path}.extensions.outlet_name`),
    group: {
      name: optionalString(field('group', 'group', 'group'), '', diagnostics, `${path}.extensions.group`),
      override: optionalBoolean(field('groupOverride', 'group_override', 'group_override'), false, diagnostics, `${path}.extensions.group_override`),
      weight: optionalNumber(field('groupWeight', 'group_weight', 'group_weight'), 100, diagnostics, `${path}.extensions.group_weight`, { min: 0 }),
    },
    recursion: {
      exclude: optionalBoolean(field('excludeRecursion', 'exclude_recursion', 'exclude_recursion'), false, diagnostics, `${path}.extensions.exclude_recursion`),
      prevent: optionalBoolean(field('preventRecursion', 'prevent_recursion', 'prevent_recursion'), false, diagnostics, `${path}.extensions.prevent_recursion`),
      delayUntil: firstDefined(field('delayUntilRecursion', 'delay_until_recursion', 'delay_until_recursion'), false),
    },
    effects: {
      sticky: optionalNumber(field('sticky', 'sticky', 'sticky'), null, diagnostics, `${path}.extensions.sticky`, { min: 0, integer: true, nullable: true }),
      cooldown: optionalNumber(field('cooldown', 'cooldown', 'cooldown'), null, diagnostics, `${path}.extensions.cooldown`, { min: 0, integer: true, nullable: true }),
      delay: optionalNumber(field('delay', 'delay', 'delay'), null, diagnostics, `${path}.extensions.delay`, { min: 0, integer: true, nullable: true }),
    },
    automationId: optionalString(field('automationId', 'automation_id', 'automation_id'), '', diagnostics, `${path}.extensions.automation_id`),
    ignoreBudget: optionalBoolean(field('ignoreBudget', 'ignore_budget', 'ignore_budget'), false, diagnostics, `${path}.extensions.ignore_budget`),
    matchSources: {
      personaDescription: optionalBoolean(field('matchPersonaDescription', 'match_persona_description', 'match_persona_description'), false, diagnostics, `${path}.extensions.match_persona_description`),
      characterDescription: optionalBoolean(field('matchCharacterDescription', 'match_character_description', 'match_character_description'), false, diagnostics, `${path}.extensions.match_character_description`),
      characterPersonality: optionalBoolean(field('matchCharacterPersonality', 'match_character_personality', 'match_character_personality'), false, diagnostics, `${path}.extensions.match_character_personality`),
      characterDepthPrompt: optionalBoolean(field('matchCharacterDepthPrompt', 'match_character_depth_prompt', 'match_character_depth_prompt'), false, diagnostics, `${path}.extensions.match_character_depth_prompt`),
      scenario: optionalBoolean(field('matchScenario', 'match_scenario', 'match_scenario'), false, diagnostics, `${path}.extensions.match_scenario`),
      creatorNotes: optionalBoolean(field('matchCreatorNotes', 'match_creator_notes', 'match_creator_notes'), false, diagnostics, `${path}.extensions.match_creator_notes`),
    },
    triggers: optionalStringArray(field('triggers', 'triggers', 'triggers'), [], diagnostics, `${path}.extensions.triggers`),
    characterFilter: normalizeCharacterFilter(firstDefined(rawEntry.characterFilter, rawEntry.character_filter), diagnostics, `${path}.character_filter`),
    extensions,
    source: {
      key: sourceKey,
      index,
      raw: clone(rawEntry),
    },
  }
}

function detectRawFormat(raw) {
  if (!isRecord(raw) || !Object.hasOwn(raw, 'entries')) return null
  if (Array.isArray(raw.entries)) return WORLD_BOOK_FORMATS.CHARACTER_BOOK
  if (isRecord(raw.entries)) return WORLD_BOOK_FORMATS.SILLY_TAVERN
  return null
}

function normalizeBook(raw, format, options, diagnostics) {
  const characterShape = format === WORLD_BOOK_FORMATS.CHARACTER_BOOK
  if (characterShape && !Object.hasOwn(raw, 'extensions')) {
    warning(diagnostics, 'missing-required-field', '$.extensions', 'Character Book V2 requires extensions; using an empty object')
  }
  const rawEntries = characterShape
    ? raw.entries.map((entry, index) => [String(index), entry])
    : Object.entries(raw.entries)
  const entries = []

  rawEntries.forEach(([key, entry], index) => {
    const path = characterShape ? `$.entries[${index}]` : `$.entries${pathKey(key)}`
    if (!isRecord(entry)) {
      error(diagnostics, 'invalid-entry', path, 'World book entries must be objects', entry)
      return
    }
    entries.push(normalizeEntry(entry, { format, index, key, path }, diagnostics))
  })

  const seen = new Map()
  entries.forEach((entry, index) => {
    const key = `${typeof entry.uid}:${String(entry.uid)}`
    if (seen.has(key)) warning(diagnostics, 'duplicate-uid', `$.entries[${index}]`, `Normalized UID duplicates entry ${seen.get(key)}`, entry.uid)
    else seen.set(key, index)
  })

  const extensions = optionalRecord(raw.extensions, {}, diagnostics, '$.extensions')
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'world-book',
    name: optionalString(options.name ?? raw.name, '', diagnostics, '$.name'),
    description: optionalString(raw.description, '', diagnostics, '$.description'),
    settings: {
      scanDepth: optionalNumber(raw.scan_depth, undefined, diagnostics, '$.scan_depth', { min: 0, integer: true }),
      tokenBudget: optionalNumber(raw.token_budget, undefined, diagnostics, '$.token_budget', { min: 0, integer: true }),
      recursiveScanning: optionalBoolean(raw.recursive_scanning, undefined, diagnostics, '$.recursive_scanning'),
      extensions,
    },
    entries,
    source: {
      format,
      entryContainer: characterShape ? 'array' : 'object-map',
      raw: clone(raw),
    },
    diagnostics,
  }
}

export class WorldBookValidationError extends TypeError {
  constructor(message, diagnostics) {
    super(message)
    this.name = 'WorldBookValidationError'
    this.diagnostics = clone(diagnostics)
  }
}

function inspect(input, options = {}) {
  const diagnostics = []
  const raw = parseJsonInput(input, diagnostics)
  if (!isRecord(raw)) {
    if (raw !== undefined) error(diagnostics, 'invalid-root', '$', 'World book JSON must be an object', raw)
    return { raw, format: null, diagnostics, model: null }
  }

  try {
    assertWorldBookStructure(raw, options.limits)
  } catch (cause) {
    error(diagnostics, cause?.code ?? 'world-book-limit', '$', cause instanceof Error ? cause.message : String(cause))
    return { raw, format: null, diagnostics, model: null }
  }

  const detected = detectRawFormat(raw)
  const requested = options.format ?? 'auto'
  if (requested !== 'auto' && !Object.values(WORLD_BOOK_FORMATS).includes(requested)) {
    error(diagnostics, 'unknown-requested-format', '$', `Unsupported requested format: ${requested}`)
  }
  if (!Object.hasOwn(raw, 'entries')) error(diagnostics, 'missing-entries', '$.entries', 'World book must contain an entries collection')
  else if (detected === null) error(diagnostics, 'invalid-entries', '$.entries', 'entries must be an object map or an array', raw.entries)

  const format = requested === 'auto' ? detected : requested
  if (detected !== null && requested !== 'auto' && detected !== requested) {
    error(diagnostics, 'format-shape-mismatch', '$.entries', `Requested ${requested}, but the entries shape identifies ${detected}`)
  }
  if (diagnostics.some(item => item.severity === 'error') || format === null) return { raw, format, diagnostics, model: null }
  const model = normalizeBook(raw, format, options, diagnostics)
  return { raw, format, diagnostics, model }
}

export function detectWorldBookFormat(input) {
  const diagnostics = []
  return detectRawFormat(parseJsonInput(input, diagnostics))
}

export function validateWorldBook(input, options = {}) {
  const result = inspect(input, options)
  return {
    valid: !result.diagnostics.some(item => item.severity === 'error'),
    format: result.format,
    diagnostics: clone(result.diagnostics),
  }
}

export function parseWorldBook(input, options = {}) {
  const result = inspect(input, options)
  const errors = result.diagnostics.filter(item => item.severity === 'error')
  if (errors.length > 0 || result.model === null) {
    throw new WorldBookValidationError(errors[0]?.message ?? 'Invalid world book', result.diagnostics)
  }
  return result.model
}

export function parseSillyTavernWorldBook(input, options = {}) {
  return parseWorldBook(input, { ...options, format: WORLD_BOOK_FORMATS.SILLY_TAVERN })
}

export function parseCharacterBook(input, options = {}) {
  return parseWorldBook(input, { ...options, format: WORLD_BOOK_FORMATS.CHARACTER_BOOK })
}

function ensureModel(model) {
  if (!isRecord(model) || model.schemaVersion !== SCHEMA_VERSION || model.kind !== 'world-book' || !Array.isArray(model.entries)) {
    throw new TypeError('Unsupported WorldBookModel document')
  }
}

function positionNumber(position) {
  const index = WORLD_BOOK_POSITIONS.indexOf(position)
  return index < 0 ? 0 : index
}

function roleNumber(role) {
  const index = WORLD_BOOK_ROLES.indexOf(role)
  return index < 0 ? 0 : index
}

function secondaryLogicNumber(logic) {
  const index = SECONDARY_LOGIC.indexOf(logic)
  return index < 0 ? 0 : index
}

function standaloneEntry(entry) {
  const raw = isRecord(entry?.source?.raw) ? clone(entry.source.raw) : {}
  Object.assign(raw, {
    uid: entry.uid,
    key: clone(entry.keys),
    keysecondary: clone(entry.secondaryKeys),
    comment: entry.comment,
    content: entry.content,
    constant: entry.constant,
    vectorized: entry.vectorized,
    selective: entry.selective,
    selectiveLogic: secondaryLogicNumber(entry.selectiveLogic),
    order: entry.insertionOrder,
    position: positionNumber(entry.position),
    disable: !entry.enabled,
    ignoreBudget: entry.ignoreBudget,
    excludeRecursion: entry.recursion.exclude,
    preventRecursion: entry.recursion.prevent,
    delayUntilRecursion: clone(entry.recursion.delayUntil),
    probability: entry.probability,
    useProbability: entry.useProbability,
    depth: entry.depth,
    outletName: entry.outletName,
    group: entry.group.name,
    groupOverride: entry.group.override,
    groupWeight: entry.group.weight,
    scanDepth: entry.scanDepth,
    caseSensitive: entry.caseSensitive,
    matchWholeWords: entry.matchWholeWords,
    useGroupScoring: entry.useGroupScoring,
    automationId: entry.automationId,
    role: roleNumber(entry.role),
    sticky: entry.effects.sticky,
    cooldown: entry.effects.cooldown,
    delay: entry.effects.delay,
    displayIndex: entry.displayIndex,
    matchPersonaDescription: entry.matchSources.personaDescription,
    matchCharacterDescription: entry.matchSources.characterDescription,
    matchCharacterPersonality: entry.matchSources.characterPersonality,
    matchCharacterDepthPrompt: entry.matchSources.characterDepthPrompt,
    matchScenario: entry.matchSources.scenario,
    matchCreatorNotes: entry.matchSources.creatorNotes,
    triggers: clone(entry.triggers),
  })
  if (entry.characterFilter === null) delete raw.characterFilter
  else raw.characterFilter = {
    ...clone(entry.characterFilter.raw ?? {}),
    isExclude: entry.characterFilter.isExclude,
    names: clone(entry.characterFilter.names),
    tags: clone(entry.characterFilter.tags),
  }
  if (Object.keys(entry.extensions ?? {}).length > 0 || Object.hasOwn(raw, 'extensions')) raw.extensions = clone(entry.extensions ?? {})
  return raw
}

function characterExtensions(entry) {
  return {
    ...clone(entry.extensions ?? {}),
    position: positionNumber(entry.position),
    exclude_recursion: entry.recursion.exclude,
    prevent_recursion: entry.recursion.prevent,
    delay_until_recursion: clone(entry.recursion.delayUntil),
    display_index: entry.displayIndex,
    probability: entry.probability,
    useProbability: entry.useProbability,
    depth: entry.depth,
    selectiveLogic: secondaryLogicNumber(entry.selectiveLogic),
    outlet_name: entry.outletName,
    group: entry.group.name,
    group_override: entry.group.override,
    group_weight: entry.group.weight,
    scan_depth: entry.scanDepth,
    match_whole_words: entry.matchWholeWords,
    use_group_scoring: entry.useGroupScoring,
    case_sensitive: entry.caseSensitive,
    automation_id: entry.automationId,
    role: roleNumber(entry.role),
    vectorized: entry.vectorized,
    sticky: entry.effects.sticky,
    cooldown: entry.effects.cooldown,
    delay: entry.effects.delay,
    match_persona_description: entry.matchSources.personaDescription,
    match_character_description: entry.matchSources.characterDescription,
    match_character_personality: entry.matchSources.characterPersonality,
    match_character_depth_prompt: entry.matchSources.characterDepthPrompt,
    match_scenario: entry.matchSources.scenario,
    match_creator_notes: entry.matchSources.creatorNotes,
    triggers: clone(entry.triggers),
    ignore_budget: entry.ignoreBudget,
  }
}

function embeddedEntry(entry) {
  const raw = isRecord(entry?.source?.raw) ? clone(entry.source.raw) : {}
  Object.assign(raw, {
    id: entry.uid,
    keys: clone(entry.keys),
    secondary_keys: clone(entry.secondaryKeys),
    comment: entry.comment,
    content: entry.content,
    constant: entry.constant,
    selective: entry.selective,
    insertion_order: entry.insertionOrder,
    enabled: entry.enabled,
    position: entry.position === 'before_character_definition' ? 'before_char' : 'after_char',
    case_sensitive: entry.caseSensitive ?? false,
    extensions: characterExtensions(entry),
  })
  if (entry.characterFilter !== null) raw.character_filter = {
    ...clone(entry.characterFilter.raw ?? {}),
    isExclude: entry.characterFilter.isExclude,
    names: clone(entry.characterFilter.names),
    tags: clone(entry.characterFilter.tags),
  }
  return raw
}

function applyBookFields(output, model) {
  if (model.name !== '' || Object.hasOwn(output, 'name')) output.name = model.name
  if (model.description !== '' || Object.hasOwn(output, 'description')) output.description = model.description
  if (model.settings.scanDepth !== undefined || Object.hasOwn(output, 'scan_depth')) output.scan_depth = model.settings.scanDepth
  if (model.settings.tokenBudget !== undefined || Object.hasOwn(output, 'token_budget')) output.token_budget = model.settings.tokenBudget
  if (model.settings.recursiveScanning !== undefined || Object.hasOwn(output, 'recursive_scanning')) output.recursive_scanning = model.settings.recursiveScanning
  if (Object.keys(model.settings.extensions ?? {}).length > 0 || Object.hasOwn(output, 'extensions')) output.extensions = clone(model.settings.extensions ?? {})
}

export function exportSillyTavernWorldBook(model) {
  ensureModel(model)
  const output = model.source?.format === WORLD_BOOK_FORMATS.SILLY_TAVERN && isRecord(model.source.raw)
    ? clone(model.source.raw)
    : {}
  applyBookFields(output, model)
  const used = new Set()
  const pairs = []
  model.entries.forEach((entry, index) => {
    let key = model.source?.format === WORLD_BOOK_FORMATS.SILLY_TAVERN ? entry.source?.key : undefined
    if (typeof key !== 'string' || key === '' || used.has(key)) key = String(entry.uid)
    if (used.has(key)) key = `${key}-${index}`
    used.add(key)
    pairs.push([key, standaloneEntry(entry)])
  })
  output.entries = Object.fromEntries(pairs)
  return output
}

export function exportCharacterBook(model) {
  ensureModel(model)
  const output = model.source?.format === WORLD_BOOK_FORMATS.CHARACTER_BOOK && isRecord(model.source.raw)
    ? clone(model.source.raw)
    : {}
  applyBookFields(output, model)
  output.extensions = clone(model.settings.extensions ?? {})
  output.entries = model.entries.map(embeddedEntry)
  return output
}

function stableValue(value, seen) {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) throw new TypeError('Cannot stable-stringify cyclic data')
  seen.add(value)
  const result = Array.isArray(value)
    ? value.map(item => stableValue(item, seen))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key], seen)]))
  seen.delete(value)
  return result
}

export function stableStringify(value, space = 2) {
  return JSON.stringify(stableValue(value, new Set()), null, space)
}

export const worldBookConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  defaultDepth: 4,
  defaultInsertionOrder: 100,
  defaultGroupWeight: 100,
})
