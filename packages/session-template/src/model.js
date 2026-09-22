const MAX_RESOURCE_ID_CHARACTERS = 200
const MAX_WORLD_BOOKS = 100

function stringOrNull(value) {
  return typeof value === 'string' && value !== '' && value.length <= MAX_RESOURCE_ID_CHARACTERS
    ? value
    : null
}

function characterOptions(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  if (Number.isSafeInteger(value.greetingIndex) && value.greetingIndex >= 0) result.greetingIndex = value.greetingIndex
  if (typeof value.preferCharacterSystemPrompt === 'boolean') result.preferCharacterSystemPrompt = value.preferCharacterSystemPrompt
  if (typeof value.preferCharacterPostHistory === 'boolean') result.preferCharacterPostHistory = value.preferCharacterPostHistory
  return result
}

const RP_SOURCES = new Set(['command', 'character-follow'])
const SANDBOX_MODES = new Set(['read-only', 'workspace-write', 'danger-full-access'])

function rpState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { active: false, source: null, followSuppressed: false, sandboxBefore: null }
  }
  return {
    active: value.active === true,
    source: RP_SOURCES.has(value.source) ? value.source : null,
    followSuppressed: value.followSuppressed === true,
    sandboxBefore: SANDBOX_MODES.has(value.sandboxBefore) ? value.sandboxBefore : null,
  }
}

/**
 * Persistent template shape only. The loader remains authoritative when this
 * projection is applied to a real SessionSelectionStore.
 */
export function normalizeTemplateSelection(value = {}) {
  const worldBookIds = Array.isArray(value?.worldBookIds)
    ? [...new Set(value.worldBookIds.filter(item => (
      typeof item === 'string' && item !== '' && item.length <= MAX_RESOURCE_ID_CHARACTERS
    )))].slice(0, MAX_WORLD_BOOKS)
    : []
  return {
    presetId: stringOrNull(value?.presetId),
    characterCardId: stringOrNull(value?.characterCardId),
    userId: stringOrNull(value?.userId),
    worldBookIds,
    character: characterOptions(value?.character),
    rp: rpState(value?.rp),
  }
}

/** Strict validation for new editable/imported documents; old stored projections remain tolerant. */
export function validateTemplateSelection(value) {
  const record = (input, fields, label) => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`${label} must be an object`)
    const extra = Object.keys(input).find(key => !fields.includes(key))
    if (extra !== undefined) throw new TypeError(`Unsupported ${label} field "${extra}"`)
  }
  record(value, ['presetId', 'characterCardId', 'userId', 'worldBookIds', 'character', 'rp'], 'selection')
  for (const key of ['presetId', 'characterCardId', 'userId']) {
    if (value[key] !== undefined && value[key] !== null && stringOrNull(value[key]) === null) throw new TypeError(`Invalid ${key}`)
  }
  if (value.worldBookIds !== undefined && (!Array.isArray(value.worldBookIds)
    || value.worldBookIds.length > MAX_WORLD_BOOKS || value.worldBookIds.some(id => stringOrNull(id) === null)
    || new Set(value.worldBookIds).size !== value.worldBookIds.length)) throw new TypeError('Invalid worldBookIds')
  if (value.character !== undefined) {
    record(value.character, ['greetingIndex', 'preferCharacterSystemPrompt', 'preferCharacterPostHistory'], 'character')
    if (value.character.greetingIndex !== undefined && (!Number.isSafeInteger(value.character.greetingIndex) || value.character.greetingIndex < 0)) throw new TypeError('Invalid greetingIndex')
    for (const key of ['preferCharacterSystemPrompt', 'preferCharacterPostHistory']) {
      if (value.character[key] !== undefined && typeof value.character[key] !== 'boolean') throw new TypeError(`Invalid ${key}`)
    }
  }
  if (value.rp !== undefined) {
    record(value.rp, ['active', 'source', 'followSuppressed', 'sandboxBefore'], 'rp')
    for (const key of ['active', 'followSuppressed']) {
      if (value.rp[key] !== undefined && typeof value.rp[key] !== 'boolean') throw new TypeError(`Invalid ${key}`)
    }
    if (value.rp.source !== undefined && value.rp.source !== null && !RP_SOURCES.has(value.rp.source)) throw new TypeError('Invalid RP source')
    if (value.rp.sandboxBefore !== undefined && value.rp.sandboxBefore !== null && !SANDBOX_MODES.has(value.rp.sandboxBefore)) throw new TypeError('Invalid RP sandboxBefore')
  }
  return normalizeTemplateSelection(value)
}

export const sessionTemplateModelConstants = Object.freeze({
  maxResourceIdCharacters: MAX_RESOURCE_ID_CHARACTERS,
  maxWorldBooks: MAX_WORLD_BOOKS,
})
