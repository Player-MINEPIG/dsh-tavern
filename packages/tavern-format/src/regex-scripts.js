const REGEX_SCRIPT_PATHS = Object.freeze([
  Object.freeze(['regex_scripts']),
  Object.freeze(['extensions', 'regex_scripts']),
  Object.freeze(['data', 'extensions', 'regex_scripts']),
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function valueAt(root, path) {
  let value = root
  for (const key of path) {
    if (!isRecord(value)) return undefined
    value = value[key]
  }
  return value
}

function existingPath(raw) {
  return REGEX_SCRIPT_PATHS.find(path => Array.isArray(valueAt(raw, path))) ?? null
}

function canonicalPath(document, kind) {
  if (kind === 'character' && document?.source?.format !== 'sillytavern-v1') {
    return ['data', 'extensions', 'regex_scripts']
  }
  return ['extensions', 'regex_scripts']
}

function setAt(root, path, value) {
  let target = root
  for (const key of path.slice(0, -1)) {
    if (!isRecord(target[key])) target[key] = {}
    target = target[key]
  }
  target[path.at(-1)] = value
}

function validateScripts(value) {
  if (!Array.isArray(value)) throw new TypeError('regexScripts must be an array')
  if (value.some(script => !isRecord(script))) {
    throw new TypeError('Every regex script must be an object')
  }
}

export function readNativeRegexScripts(document) {
  const raw = document?.source?.raw
  if (!isRecord(raw)) return []
  const path = existingPath(raw)
  return path === null ? [] : structuredClone(valueAt(raw, path))
}

export function replaceNativeRegexScripts(document, regexScripts, { kind, now } = {}) {
  if (!isRecord(document)) throw new TypeError('Resource document must be an object')
  if (kind !== 'preset' && kind !== 'character') {
    throw new TypeError('Regex script resource kind must be preset or character')
  }
  validateScripts(regexScripts)

  const next = structuredClone(document)
  if (!isRecord(next.source)) next.source = {}
  if (!isRecord(next.source.raw)) next.source.raw = {}
  const path = existingPath(next.source.raw) ?? canonicalPath(next, kind)
  setAt(next.source.raw, path, structuredClone(regexScripts))
  next.updatedAt = now ?? new Date().toISOString()
  return next
}
