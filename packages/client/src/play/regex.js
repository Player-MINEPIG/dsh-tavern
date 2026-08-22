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
  let markdownOnly = value.markdownOnly === true || value.markdown_only === true
  let promptOnly = value.promptOnly === true || value.prompt_only === true

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
  if (isRecord(value) && [value.find, value.findRegex, value.find_regex, value.regex].some(item => typeof item === 'string')) {
    return [value]
  }
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
  const source = stringValue(value.find, value.findRegex, value.find_regex, value.regex)
  const native = nativePlacement(value)
  return {
    id: stringValue(value.id) || generatedId(),
    name: stringValue(value.name, value.script_name, value.scriptName) || 'Regex',
    enabled: importedEnabled(value),
    find: source,
    replace: stringValue(value.replace, value.replaceString, value.replace_string, value.replacement),
    flags: stringValue(value.flags),
    target: importedTarget(value),
    scope: normalizeScope(value.scope, scope),
    placement: native.placement,
    trimStrings: stringList(value.trimStrings ?? value.trim_strings),
    markdownOnly: native.markdownOnly || value.markdown_only === true,
    promptOnly: native.promptOnly || value.prompt_only === true,
    runOnEdit: value.runOnEdit === true || value.run_on_edit === true,
    substituteRegex: [0, 1, 2].includes(Number(value.substituteRegex ?? value.substitute_regex))
      ? Number(value.substituteRegex ?? value.substitute_regex)
      : 0,
    minDepth: finiteDepth(value.minDepth ?? value.min_depth),
    maxDepth: finiteDepth(value.maxDepth ?? value.max_depth),
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
  return candidates.map((rule, sourceIndex) => ({
    ...normalizeRegexRule(rule, { scope }),
    sourceDisplayEligible: displayImportCandidate(rule),
    sourceIndex,
    sourceRaw: structuredClone(rule),
  }))
}

function writeNativeField(target, aliases, canonical, value) {
  const existing = aliases.filter(key => Object.hasOwn(target, key))
  for (const key of existing.length === 0 ? [canonical] : existing) target[key] = structuredClone(value)
}

function nativePlacementFor(rule) {
  const placement = Array.isArray(rule.placement) ? rule.placement : []
  const retained = placement.filter(item => ![1, 2, 'user', 'assistant', 'user_input', 'ai_output'].includes(item))
  if (rule.target === 'user' || rule.target === 'both') retained.push(1)
  if (rule.target === 'assistant' || rule.target === 'both') retained.push(2)
  return retained
}

function findWithFlags(source, flags) {
  if (!source.startsWith('/') || flags === '') return source
  const closing = source.lastIndexOf('/')
  if (closing <= 0 || !/^[dgimsuvy]*$/.test(flags)) return source
  return `${source.slice(0, closing + 1)}${flags}`
}

export function nativeRegexScript(rule) {
  const source = isRecord(rule?.sourceRaw) ? structuredClone(rule.sourceRaw) : {}
  const original = isRecord(rule?.sourceRaw)
    ? normalizeRegexRule(rule.sourceRaw, { scope: rule.scope })
    : null
  if (original === null) source.id = rule.id
  if (original === null || rule.name !== original.name) {
    writeNativeField(source, ['scriptName', 'script_name', 'name'], 'scriptName', rule.name)
  }
  if (original === null || rule.find !== original.find || rule.flags !== original.flags) {
    writeNativeField(source, ['findRegex', 'find_regex', 'find', 'regex'], 'findRegex', findWithFlags(rule.find, rule.flags))
  }
  if (original === null || rule.replace !== original.replace) {
    writeNativeField(source, ['replaceString', 'replace_string', 'replace', 'replacement'], 'replaceString', rule.replace)
  }
  if (original === null || rule.enabled !== original.enabled) {
    writeNativeField(source, ['disabled'], 'disabled', !rule.enabled)
    if (Object.hasOwn(source, 'enabled')) source.enabled = rule.enabled
  }
  if (original === null || rule.target !== original.target) {
    writeNativeField(source, ['placement'], 'placement', nativePlacementFor(rule))
  }
  if (original === null) {
    source.trimStrings = structuredClone(rule.trimStrings)
    source.markdownOnly = rule.markdownOnly
    source.promptOnly = rule.promptOnly
    source.runOnEdit = rule.runOnEdit
    source.substituteRegex = rule.substituteRegex
    source.minDepth = rule.minDepth
    source.maxDepth = rule.maxDepth
  }
  return source
}

export function exportNativeRegexScripts(rules) {
  if (!Array.isArray(rules)) throw new TypeError('regex rules must be an array')
  return rules.map(nativeRegexScript)
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
