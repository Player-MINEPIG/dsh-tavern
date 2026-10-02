import JSON5 from 'json5'
import { parseDocument } from 'yaml'
import { numericExpression } from './schema.js'
import { fail, json } from './value.js'

export function parseMvuData(text) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) fail('MVU_LIMIT', 'Data exceeds 1 MiB')
  const document = parseDocument(text, { schema: 'core', uniqueKeys: true, customTags: [], maxAliasCount: 0 })
  if (document.errors.length || document.warnings.length) fail('MVU_PARSE', 'Invalid YAML data or unsupported tag')
  return json(document.toJS({ maxAliasCount: 0 }))
}
export function parseCommandValue(text) {
  const trimmed = text.trim()
  try { return json(JSON5.parse(trimmed)) } catch (error) { if (error.code?.startsWith('MVU_')) throw error }
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) return trimmed.slice(1, -1)
  if (/[()+*/%^]|^(?:Math|math)\./.test(trimmed) || /^-?\d.*[+-]/.test(trimmed)) return numericExpression(trimmed)
  return parseMvuData(trimmed)
}
