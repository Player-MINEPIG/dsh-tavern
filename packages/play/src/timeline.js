import { httpError } from './http.js'

const NODE_KEYS = new Set([
  'id',
  'kind',
  'hidden',
  'displayOverride',
  'adoptedVariantId',
  'variants',
  'ext',
])
const VARIANT_KEYS = new Set(['id', 'sessionId', 'startEventId', 'endEventId', 'ext'])
const TIMELINE_KEYS = new Set(['nodes', 'ext'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rejectFocusField(record, label) {
  if (Object.hasOwn(record, 'focusSessionId')) {
    throw httpError(400, `${label} must not store focusSessionId`, 'PLAY_TIMELINE_INVALID')
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

function unexpectedKey(record, allowed, label) {
  const unexpected = Object.keys(record).find(key => !allowed.has(key))
  if (unexpected !== undefined) {
    throw httpError(400, `${label} has unsupported field "${unexpected}"`, 'PLAY_TIMELINE_INVALID')
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
  for (const node of nodes) {
    if (ids.has(node.id)) throw httpError(400, 'timeline node ids must be unique', 'PLAY_TIMELINE_INVALID')
    ids.add(node.id)
  }
  return {
    nodes,
    ...(value.ext === undefined ? {} : { ext: normalizeExt(value.ext, 'timeline.ext') }),
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
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : normalizeTimeline(timeline).nodes
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

export function normalizeCatalog(value) {
  if (!isRecord(value)) throw httpError(400, 'catalog must be an object', 'PLAY_CATALOG_INVALID')
  rejectFocusField(value, 'catalog')
  unexpectedKey(value, CATALOG_KEYS, 'catalog')
  if (!Array.isArray(value.playthroughs)) {
    throw httpError(400, 'catalog.playthroughs must be an array', 'PLAY_CATALOG_INVALID')
  }
  const playthroughs = value.playthroughs.map((item, index) => {
    if (!isRecord(item)) throw httpError(400, `playthroughs[${index}] must be an object`, 'PLAY_CATALOG_INVALID')
    rejectFocusField(item, `playthroughs[${index}]`)
    unexpectedKey(item, PLAYTHROUGH_KEYS, `playthroughs[${index}]`)
    return {
      id: requireId(item.id, `playthroughs[${index}].id`),
      path: requireId(item.path, `playthroughs[${index}].path`),
      ...(typeof item.title === 'string' ? { title: item.title } : {}),
      ...(typeof item.lastOpenedAt === 'string' ? { lastOpenedAt: item.lastOpenedAt } : {}),
      ...(item.ext === undefined ? {} : { ext: normalizeExt(item.ext, `playthroughs[${index}].ext`) }),
    }
  })
  return {
    playthroughs,
    ...(value.ext === undefined ? {} : { ext: normalizeExt(value.ext, 'catalog.ext') }),
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
