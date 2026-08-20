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

function finiteDepth(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function stringList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

function nativePlacement(value) {
  const placement = Array.isArray(value.placement)
    ? [...value.placement]
    : typeof value.placement === 'number'
      ? [value.placement]
      : []
  let markdownOnly = value.markdownOnly === true
  let promptOnly = value.promptOnly === true

  // Match SillyTavern's migration of deprecated MD Display/sendAs placements.
  if (placement.includes(0)) {
    placement.splice(0, placement.length, ...(placement.length === 1
      ? [1, 2, 3, 5, 6]
      : placement.filter(item => item !== 0)))
    markdownOnly = true
    promptOnly = true
  }
  if (placement.includes(4)) {
    placement.splice(0, placement.length, ...(placement.length === 1
      ? [3]
      : placement.filter(item => item !== 4)))
  }

  return { placement, markdownOnly, promptOnly }
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
  const { placement } = nativePlacement(value)
  if (placement.length === 0) return 'assistant'
  const user = placement.some(item => item === 1 || item === 'user' || item === 'user_input')
  const assistant = placement.some(item => item === 2 || item === 'assistant' || item === 'ai_output')
  if (user && assistant) return 'both'
  if (user) return 'user'
  return 'assistant'
}

function displayImportCandidate(value) {
  if (!isRecord(value)) return false
  const native = nativePlacement(value)
  if (native.promptOnly && !native.markdownOnly) return false
  if (native.placement.length === 0) return true
  return native.placement.some(item => item === 1 || item === 2
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
  const native = nativePlacement(value)
  return {
    id: stringValue(value.id) || generatedId(),
    name: stringValue(value.name, value.script_name, value.scriptName) || 'Regex',
    enabled: importedEnabled(value),
    find: source,
    replace: stringValue(value.replace, value.replaceString, value.replacement),
    flags: stringValue(value.flags),
    target: importedTarget(value),
    scope: normalizeScope(value.scope, scope),
    placement: native.placement,
    trimStrings: stringList(value.trimStrings),
    markdownOnly: native.markdownOnly,
    promptOnly: native.promptOnly,
    runOnEdit: value.runOnEdit === true,
    substituteRegex: [0, 1, 2].includes(Number(value.substituteRegex))
      ? Number(value.substituteRegex)
      : 0,
    minDepth: finiteDepth(value.minDepth),
    maxDepth: finiteDepth(value.maxDepth),
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

function expression(rule, context) {
  const source = rule.substituteRegex !== 0 && typeof context?.substituteRegex === 'function'
    ? context.substituteRegex(rule.find, { escaped: rule.substituteRegex === 2 })
    : rule.find
  if (source.startsWith('/')) {
    const closing = source.lastIndexOf('/')
    if (closing > 0) {
      const pattern = source.slice(1, closing)
      const flags = rule.flags || source.slice(closing + 1)
      return new RegExp(pattern, flags)
    }
  }
  return new RegExp(source, rule.flags || 'g')
}

function applies(rule, bindings, target, context) {
  if (!rule.enabled || (rule.target !== 'both' && rule.target !== target)) return false
  if (typeof context?.depth === 'number') {
    if (rule.minDepth !== null && rule.minDepth >= -1 && context.depth < rule.minDepth) return false
    if (rule.maxDepth !== null && rule.maxDepth >= 0 && context.depth > rule.maxDepth) return false
  }
  if (rule.scope.kind === 'global') return true
  if (rule.scope.kind === 'preset') return rule.scope.resourceId === bindings?.presetId
  return rule.scope.resourceId === bindings?.characterId
}

function replacement(rule, context) {
  return function replaceMatch(match, ...args) {
    const groups = isRecord(args.at(-1)) ? args.at(-1) : null
    let value = rule.replace.replace(/\{\{match\}\}/gi, '$0')
    value = value.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_token, number, groupName) => {
      const captureIndex = Number(number)
      const captured = groupName === undefined
        ? captureIndex === 0 ? match : args[captureIndex - 1]
        : groups?.[groupName]
      if (!captured) return ''
      return rule.trimStrings.reduce(
        (result, trim) => result.replaceAll(trim, ''),
        String(captured),
      )
    })
    return typeof context?.substituteReplacement === 'function'
      ? context.substituteReplacement(value)
      : value
  }
}

export function applyDisplayRegex(text, rules, bindings, target = 'assistant', context = {}) {
  let output = String(text ?? '')
  const diagnostics = []
  for (const rule of rules ?? []) {
    if (!applies(rule, bindings, target, context)) continue
    try {
      output = output.replace(expression(rule, context), replacement(rule, context))
    } catch (error) {
      diagnostics.push({ ruleId: rule.id, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { text: output, diagnostics }
}
