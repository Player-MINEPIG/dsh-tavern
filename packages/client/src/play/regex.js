export const REGEX_PATH = 'ui/regex.json'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(...values) {
  return values.find(value => typeof value === 'string') ?? ''
}

function importedEnabled(value) {
  if (typeof value.enabled === 'boolean') return value.enabled
  if (typeof value.disabled === 'boolean') return !value.disabled
  return true
}

function normalizeScope(value, fallback = { kind: 'global', resourceId: null }) {
  const source = isRecord(value) ? value : fallback
  const kind = ['global', 'preset', 'character'].includes(source.kind) ? source.kind : fallback.kind
  const resourceId = kind === 'global' ? null : stringValue(source.resourceId, fallback.resourceId)
  return { kind, resourceId: resourceId || null }
}

function normalizeTarget(value) {
  return ['user', 'assistant', 'both'].includes(value) ? value : 'assistant'
}

function importedTarget(value) {
  if (typeof value.target === 'string') return normalizeTarget(value.target)
  if (typeof value.placement === 'string') return normalizeTarget(value.placement)
  if (!Array.isArray(value.placement)) return 'assistant'
  const user = value.placement.some(item => item === 1 || item === 'user' || item === 'user_input')
  const assistant = value.placement.some(item => item === 2 || item === 'assistant' || item === 'ai_output')
  if (user && assistant) return 'both'
  if (user) return 'user'
  return 'assistant'
}

function displayImportCandidate(value) {
  if (!isRecord(value)) return false
  if (value.promptOnly === true && value.markdownOnly !== true) return false
  if (!Array.isArray(value.placement)) return true
  return value.placement.some(item => item === 1 || item === 2
    || item === 'user' || item === 'assistant'
    || item === 'user_input' || item === 'ai_output')
}

function regexCandidates(value) {
  if (Array.isArray(value)) return value
  const candidates = [
    value?.rules,
    value?.regex_scripts,
    value?.extensions?.regex_scripts,
    value?.data?.extensions?.regex_scripts,
    value?.source?.raw?.regex_scripts,
    value?.source?.raw?.extensions?.regex_scripts,
    value?.source?.raw?.data?.extensions?.regex_scripts,
  ]
  return candidates.find(Array.isArray) ?? null
}

function generatedId() {
  return `regex-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

export function normalizeRegexRule(value, { scope } = {}) {
  if (!isRecord(value)) throw new TypeError('regex rule must be an object')
  const source = stringValue(value.find, value.findRegex, value.regex)
  return {
    id: stringValue(value.id) || generatedId(),
    name: stringValue(value.name, value.script_name, value.scriptName) || 'Regex',
    enabled: importedEnabled(value),
    find: source,
    replace: stringValue(value.replace, value.replaceString, value.replacement),
    flags: stringValue(value.flags),
    target: importedTarget(value),
    scope: normalizeScope(value.scope, scope),
    ext: isRecord(value.ext) ? structuredClone(value.ext) : {},
  }
}

export function normalizeRegexDocument(value) {
  if (!isRecord(value)) throw new TypeError('regex document must be an object')
  const rules = Array.isArray(value.rules) ? value.rules : []
  return { schemaVersion: 1, rules: rules.map(rule => normalizeRegexRule(rule)) }
}

export function importRegexDocument(value, { scope = { kind: 'global', resourceId: null } } = {}) {
  const candidates = regexCandidates(value)
  if (candidates === null) throw new TypeError('No regex rules were found')
  return candidates
    .filter(displayImportCandidate)
    .map(rule => normalizeRegexRule(rule, { scope }))
}

export function resourceRegexInventory(value, scope) {
  const candidates = regexCandidates(value)
  if (candidates === null) return []
  return candidates.map(rule => ({
    ...normalizeRegexRule(rule, { scope }),
    sourceDisplayEligible: displayImportCandidate(rule),
  }))
}

export function resourceRegexRules(value, scope) {
  try {
    return importRegexDocument(value, { scope })
  } catch (error) {
    if (error instanceof TypeError && error.message === 'No regex rules were found') return []
    throw error
  }
}

export async function getRegexDocument(client) {
  try {
    const file = await client.getFile(REGEX_PATH)
    return normalizeRegexDocument(JSON.parse(file.content))
  } catch (error) {
    if (error?.status === 404 || error?.code === 'PLAY_FILE_NOT_FOUND') {
      return { schemaVersion: 1, rules: [] }
    }
    throw error
  }
}

export async function putRegexDocument(client, document) {
  const normalized = normalizeRegexDocument(document)
  await client.createDirs('ui')
  await client.putFile(REGEX_PATH, JSON.stringify(normalized, null, 2))
  return normalized
}

function expression(rule) {
  if (rule.find.startsWith('/')) {
    const closing = rule.find.lastIndexOf('/')
    if (closing > 0) {
      const pattern = rule.find.slice(1, closing)
      const flags = rule.flags || rule.find.slice(closing + 1)
      return new RegExp(pattern, flags)
    }
  }
  return new RegExp(rule.find, rule.flags || 'g')
}

function applies(rule, bindings, target) {
  if (!rule.enabled || (rule.target !== 'both' && rule.target !== target)) return false
  if (rule.scope.kind === 'global') return true
  if (rule.scope.kind === 'preset') return rule.scope.resourceId === bindings?.presetId
  return rule.scope.resourceId === bindings?.characterId
}

export function applyDisplayRegex(text, rules, bindings, target = 'assistant') {
  let output = String(text ?? '')
  const diagnostics = []
  for (const rule of rules ?? []) {
    if (!applies(rule, bindings, target)) continue
    try {
      output = output.replace(expression(rule), rule.replace)
    } catch (error) {
      diagnostics.push({ ruleId: rule.id, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { text: output, diagnostics }
}
