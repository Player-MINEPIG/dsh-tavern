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

export const sessionTemplateModelConstants = Object.freeze({
  maxResourceIdCharacters: MAX_RESOURCE_ID_CHARACTERS,
  maxWorldBooks: MAX_WORLD_BOOKS,
})
