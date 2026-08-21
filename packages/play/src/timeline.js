import { httpError } from './http.js'
import { timelineHead } from './timeline-tree.js'

const NODE_KEYS = new Set([
  'id',
  'kind',
  'hidden',
  'displayOverride',
  'parentVariantId',
  'adoptedVariantId',
  'variants',
  'ext',
])
const VARIANT_KEYS = new Set(['id', 'sessionId', 'startEventId', 'endEventId', 'ext'])
const TIMELINE_KEYS = new Set(['nodes', 'head', 'ext'])
const HEAD_KEYS = new Set(['sessionId', 'nodeId', 'variantId'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rejectFocusField(record, label, code = 'PLAY_TIMELINE_INVALID') {
  if (Object.hasOwn(record, 'focusSessionId')) {
    throw httpError(400, `${label} must not store focusSessionId`, code)
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) {
    throw httpError(400, `${label} must be a non-empty id`, 'PLAY_TIMELINE_INVALID')
  }
  return value
}

function requireSeq(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw httpError(400, `${label} must be a non-negative event seq`, 'PLAY_TIMELINE_INVALID')
  }
  return value
}

function unexpectedKey(record, allowed, label, code = 'PLAY_TIMELINE_INVALID') {
  const unexpected = Object.keys(record).find(key => !allowed.has(key))
  if (unexpected !== undefined) {
    throw httpError(400, `${label} has unsupported field "${unexpected}"`, code)
  }
}

export function normalizeVariant(value, label = 'variant') {
  if (!isRecord(value)) throw httpError(400, `${label} must be an object`, 'PLAY_TIMELINE_INVALID')
  rejectFocusField(value, label)
  unexpectedKey(value, VARIANT_KEYS, label)
  const startEventId = requireSeq(value.startEventId, `${label}.startEventId`)
  const endEventId = requireSeq(value.endEventId, `${label}.endEventId`)
  if (startEventId > endEventId) {
    throw httpError(400, `${label} startEventId must be <= endEventId`, 'PLAY_TIMELINE_INVALID')
  }
  return {
    id: requireId(value.id, `${label}.id`),
    sessionId: requireId(value.sessionId, `${label}.sessionId`),
    startEventId,
    endEventId,
    ...(value.ext === undefined ? {} : { ext: normalizeExt(value.ext, `${label}.ext`) }),
  }
}

function normalizeExt(value, label) {
  if (!isRecord(value)) throw httpError(400, `${label} must be an object`, 'PLAY_TIMELINE_INVALID')
  rejectFocusField(value, label)
  return value
}

export function normalizeNode(value, label = 'node') {
  if (!isRecord(value)) throw httpError(400, `${label} must be an object`, 'PLAY_TIMELINE_INVALID')
  rejectFocusField(value, label)
  unexpectedKey(value, NODE_KEYS, label)
  if (value.kind !== 'qa') {
    throw httpError(400, `${label}.kind must be qa`, 'PLAY_TIMELINE_INVALID')
  }
  if (value.hidden !== undefined && typeof value.hidden !== 'boolean') {
    throw httpError(400, `${label}.hidden must be a boolean`, 'PLAY_TIMELINE_INVALID')
  }
  if (value.displayOverride !== undefined && value.displayOverride !== null && typeof value.displayOverride !== 'string') {
    throw httpError(400, `${label}.displayOverride must be a string or null`, 'PLAY_TIMELINE_INVALID')
  }
  if (!Array.isArray(value.variants) || value.variants.length === 0) {
    throw httpError(400, `${label}.variants must be a non-empty array`, 'PLAY_TIMELINE_INVALID')
  }
  const variants = value.variants.map((variant, index) => normalizeVariant(variant, `${label}.variants[${index}]`))
  const variantIds = new Set()
  for (const variant of variants) {
    if (variantIds.has(variant.id)) {
      throw httpError(400, `${label} variant ids must be unique`, 'PLAY_TIMELINE_INVALID')
    }
    variantIds.add(variant.id)
  }
  const adoptedVariantId = requireId(value.adoptedVariantId, `${label}.adoptedVariantId`)
  if (!variantIds.has(adoptedVariantId)) {
    throw httpError(400, `${label}.adoptedVariantId must match a variant`, 'PLAY_TIMELINE_INVALID')
  }
  return {
    id: requireId(value.id, `${label}.id`),
    kind: value.kind,
    hidden: value.hidden === true,
    displayOverride: value.displayOverride === undefined ? null : value.displayOverride,
    ...(Object.hasOwn(value, 'parentVariantId') ? {
      parentVariantId: value.parentVariantId === null
        ? null
        : requireId(value.parentVariantId, `${label}.parentVariantId`),
    } : {}),
    adoptedVariantId,
    variants,
    ...(value.ext === undefined ? {} : { ext: normalizeExt(value.ext, `${label}.ext`) }),
  }
}

export function normalizeTimeline(value) {
  if (!isRecord(value)) throw httpError(400, 'timeline must be an object', 'PLAY_TIMELINE_INVALID')
  rejectFocusField(value, 'timeline')
  unexpectedKey(value, TIMELINE_KEYS, 'timeline')
  if (!Array.isArray(value.nodes)) throw httpError(400, 'timeline.nodes must be an array', 'PLAY_TIMELINE_INVALID')
  const nodes = value.nodes.map((node, index) => normalizeNode(node, `nodes[${index}]`))
  const ids = new Set()
  const variantOwners = new Map()
  for (const node of nodes) {
    if (ids.has(node.id)) throw httpError(400, 'timeline node ids must be unique', 'PLAY_TIMELINE_INVALID')
    ids.add(node.id)
    for (const variant of node.variants) {
      if (variantOwners.has(variant.id) && (value.head !== undefined || nodes.some(item => Object.hasOwn(item, 'parentVariantId')))) {
        throw httpError(400, 'tree timeline variant ids must be globally unique', 'PLAY_TIMELINE_INVALID')
      }
      variantOwners.set(variant.id, node.id)
    }
  }
  for (const [index, node] of nodes.entries()) {
    if (!Object.hasOwn(node, 'parentVariantId') || node.parentVariantId === null) continue
    const parentNodeId = variantOwners.get(node.parentVariantId)
    if (parentNodeId === undefined) throw httpError(400, `nodes[${index}].parentVariantId is unknown`, 'PLAY_TIMELINE_INVALID')
    const parentIndex = nodes.findIndex(item => item.id === parentNodeId)
    if (parentIndex >= index) throw httpError(400, `nodes[${index}].parentVariantId must reference an earlier node`, 'PLAY_TIMELINE_INVALID')
  }
  let head
  if (value.head !== undefined) {
    if (!isRecord(value.head)) throw httpError(400, 'timeline.head must be an object', 'PLAY_TIMELINE_INVALID')
    unexpectedKey(value.head, HEAD_KEYS, 'timeline.head')
    head = {
      sessionId: requireId(value.head.sessionId, 'timeline.head.sessionId'),
      nodeId: requireId(value.head.nodeId, 'timeline.head.nodeId'),
      variantId: requireId(value.head.variantId, 'timeline.head.variantId'),
    }
    const owner = variantOwners.get(head.variantId)
    if (owner === undefined || owner !== head.nodeId) {
      throw httpError(400, 'timeline.head must reference a variant on its node', 'PLAY_TIMELINE_INVALID')
    }
  }
  return {
    nodes,
    ...(head === undefined ? {} : { head }),
    ...(value.ext === undefined ? {} : { ext: validateKnownTimelineExt(normalizeExt(value.ext, 'timeline.ext'), 'timeline.ext') }),
  }
}

export function parseTimelineJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw httpError(400, 'timeline.json must be valid JSON', 'PLAY_TIMELINE_INVALID')
  }
  return normalizeTimeline(parsed)
}

/**
 * Focus is the session of the adopted variant on the last still-rendered QA node.
 * Hidden QA nodes are not rendered. Empty timelines have no focus session.
 */
export function deriveFocus(timeline) {
  const normalized = Array.isArray(timeline?.nodes) ? timeline : normalizeTimeline(timeline)
  const explicit = timelineHead(normalized)
  if (normalized.head !== undefined && explicit !== null) return explicit
  const nodes = normalized.nodes
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.hidden === true) continue
    const adopted = node.variants.find(variant => variant.id === node.adoptedVariantId)
    if (adopted === undefined) {
      throw httpError(400, 'adopted variant is missing', 'PLAY_TIMELINE_INVALID')
    }
    return { sessionId: adopted.sessionId, nodeId: node.id, variantId: adopted.id }
  }
  return { sessionId: null, nodeId: null, variantId: null }
}

const CATALOG_KEYS = new Set(['playthroughs', 'ext'])
const PLAYTHROUGH_KEYS = new Set(['id', 'path', 'lastOpenedAt', 'title', 'ext'])
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

function catalogError(message) {
  throw httpError(400, message, 'PLAY_CATALOG_INVALID')
}

export function isSafeCatalogSegment(value) {
  return typeof value === 'string' && SAFE_SEGMENT.test(value)
}

function safeSegment(value, label, code = 'PLAY_CATALOG_INVALID') {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
    throw httpError(400, `${label} must be a safe path segment`, code)
  }
  return value
}

function safeSessionId(value, label, code = 'PLAY_CATALOG_INVALID') {
  if (typeof value !== 'string' || !SAFE_SESSION_ID.test(value)) {
    throw httpError(400, `${label} must be a valid DSH session id`, code)
  }
  return value
}

function safeRelativePath(value, label, suffix, code = 'PLAY_CATALOG_INVALID') {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\') || value.includes('\u0000')) {
    throw httpError(400, `${label} must be a safe POSIX relative path`, code)
  }
  const segments = value.split('/')
  if (segments.length < 2 || segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw httpError(400, `${label} must be a safe POSIX relative path`, code)
  }
  if (segments.some(segment => !SAFE_SEGMENT.test(segment))) {
    throw httpError(400, `${label} contains an unsafe path segment`, code)
  }
  if (segments.at(-1) !== suffix) {
    throw httpError(400, `${label} must end with /${suffix}`, code)
  }
  return value
}

function validateKnownPlaythroughExt(ext, label) {
  if (ext === undefined) return undefined
  if (!isRecord(ext)) catalogError(`${label} must be an object`)
  const known = ext.pmpDshTavern
  if (known !== undefined) {
    if (!isRecord(known)) catalogError(`${label}.pmpDshTavern must be an object`)
    if (known.characterId !== undefined) safeSegment(known.characterId, `${label}.pmpDshTavern.characterId`)
    if (known.rootSessionId !== undefined) safeSessionId(known.rootSessionId, `${label}.pmpDshTavern.rootSessionId`)
    if (known.playthroughNumber !== undefined && (!Number.isSafeInteger(known.playthroughNumber) || known.playthroughNumber < 1)) {
      catalogError(`${label}.pmpDshTavern.playthroughNumber must be a positive safe integer`)
    }
    if (known.importContextPath !== undefined) {
      safeRelativePath(known.importContextPath, `${label}.pmpDshTavern.importContextPath`, 'import-context.json')
    }
  }
  return ext
}

function validateKnownTimelineExt(ext, label) {
  if (ext === undefined) return undefined
  if (!isRecord(ext)) throw httpError(400, `${label} must be an object`, 'PLAY_TIMELINE_INVALID')
  const known = ext.pmpDshTavern
  if (known !== undefined) {
    if (!isRecord(known)) throw httpError(400, `${label}.pmpDshTavern must be an object`, 'PLAY_TIMELINE_INVALID')
    if (known.importContextPath !== undefined) {
      safeRelativePath(known.importContextPath, `${label}.pmpDshTavern.importContextPath`, 'import-context.json', 'PLAY_TIMELINE_INVALID')
    }
  }
  return ext
}

export function normalizeCatalog(value) {
  if (!isRecord(value)) throw httpError(400, 'catalog must be an object', 'PLAY_CATALOG_INVALID')
  rejectFocusField(value, 'catalog', 'PLAY_CATALOG_INVALID')
  unexpectedKey(value, CATALOG_KEYS, 'catalog', 'PLAY_CATALOG_INVALID')
  if (!Array.isArray(value.playthroughs)) {
    throw httpError(400, 'catalog.playthroughs must be an array', 'PLAY_CATALOG_INVALID')
  }
  const ids = new Set()
  const paths = new Set()
  const playthroughs = value.playthroughs.map((item, index) => {
    if (!isRecord(item)) throw httpError(400, `playthroughs[${index}] must be an object`, 'PLAY_CATALOG_INVALID')
    rejectFocusField(item, `playthroughs[${index}]`, 'PLAY_CATALOG_INVALID')
    unexpectedKey(item, PLAYTHROUGH_KEYS, `playthroughs[${index}]`, 'PLAY_CATALOG_INVALID')
    const id = safeSegment(item.id, `playthroughs[${index}].id`)
    if (ids.has(id)) catalogError(`playthroughs contains duplicate id "${id}"`)
    ids.add(id)
    const path = safeRelativePath(item.path, `playthroughs[${index}].path`, 'timeline.json')
    if (paths.has(path)) catalogError(`playthroughs contains duplicate path "${path}"`)
    paths.add(path)
    return {
      id,
      path,
      ...(typeof item.title === 'string' ? { title: item.title } : {}),
      ...(typeof item.lastOpenedAt === 'string' ? { lastOpenedAt: item.lastOpenedAt } : {}),
      ...(item.ext === undefined ? {} : { ext: validateKnownPlaythroughExt(item.ext, `playthroughs[${index}].ext`) }),
    }
  })
  return {
    playthroughs,
    ...(value.ext === undefined ? {} : { ext: validateKnownPlaythroughExt(value.ext, 'catalog.ext') }),
  }
}

export function parseCatalogJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw httpError(400, 'catalog.json must be valid JSON', 'PLAY_CATALOG_INVALID')
  }
  return normalizeCatalog(parsed)
}

export function validatePlayDocument(relativePath, content) {
  const base = relativePath.split('/').at(-1)
  if (base === 'timeline.json') {
    parseTimelineJson(content)
    return
  }
  if (base === 'catalog.json') {
    parseCatalogJson(content)
  }
}
