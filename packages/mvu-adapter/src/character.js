import { parseMvuData } from './data.js'
import { fail, json, safeKey } from './value.js'

function merge(left, right) {
  const result = json(left)
  for (const [key, value] of Object.entries(right)) {
    safeKey(key)
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) ? merge(result[key], value) : json(value)
  }
  return result
}
/** Read data/recognized schema declarations only; never fetch or run card scripts. */
export function mvuResourceFromCharacter(character, options) {
  const raw = character?.source?.raw ?? character
  const data = raw?.data ?? raw
  let helper = data?.extensions?.tavern_helper ?? {}
  if (Array.isArray(helper)) helper = Object.fromEntries(helper.filter(row => Array.isArray(row) && row.length === 2))
  const entries = data?.character_book?.entries ?? [], scripts = helper.scripts ?? []
  const initialization = entries.filter(entry => /\[initvar\]/i.test(entry.comment ?? ''))
  let stat_data = {}
  for (const [index, entry] of initialization.entries()) {
    let value
    try { value = parseMvuData(entry.content) } catch (error) { fail('MVU_INITIALIZATION_INVALID', `Initialization entry ${index + 1}: ${error.code ?? 'invalid data'}`) }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MVU_INITIALIZATION_INVALID', 'Initialization must be an object')
    stat_data = merge(stat_data, value)
  }
  const schemas = [...scripts, ...entries].map(item => item.content).filter(text => typeof text === 'string' && /import\s*\{\s*registerMvuSchema\s*\}/.test(text))
  const unique = [...new Set(schemas)]
  if (unique.length > 1) fail('MVU_SCHEMA_CONFLICT', 'Multiple distinct schema declarations require an explicit selection')
  if (!initialization.length && !unique.length) fail('MVU_INITIALIZATION_MISSING', 'No MVU initialization or schema was found')
  return { ...options, initial: { stat_data }, ...(unique.length ? { schemaSource: unique[0] } : {}) }
}
