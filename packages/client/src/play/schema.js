const CHROME_MODES = new Set(['native', 'play'])
const MESSAGE_ROLES = new Set(['user', 'assistant', 'system'])
const MESSAGE_ORIGIN_KINDS = new Set(['user', 'context', 'steering', 'assistant', 'system'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(label, detail) {
  throw new TypeError(`${label}: ${detail}`)
}

function stringId(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(label, 'must be a non-empty string')
  return value
}

function eventSeq(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(label, 'must be a non-negative integer')
  return value
}

function extRecord(value, label) {
  if (value === undefined) return undefined
  if (!isRecord(value)) fail(label, 'must be an object')
  return value
}

export function normalizeChrome(value, label = 'chrome') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (!CHROME_MODES.has(value.mode)) fail(label, 'mode must be native or play')
  if (value.revision !== undefined && value.revision !== null
    && (typeof value.revision !== 'string' || value.revision === '')) {
    fail(label, 'revision must be a non-empty string or null')
  }
  return { mode: value.mode, revision: value.revision ?? null }
}

export function normalizeWorkspace(value, label = 'workspace') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (typeof value.selected !== 'boolean') fail(label, 'selected must be a boolean')
  if (value.rootPath !== null && value.rootPath !== undefined && typeof value.rootPath !== 'string') {
    fail(label, 'rootPath must be a string or null')
  }
  if (!Number.isSafeInteger(value.contractVersion) || value.contractVersion < 1) {
    fail(label, 'contractVersion must be a positive integer')
  }
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter(isRecord).map(item => ({
      code: typeof item.code === 'string' ? item.code : '',
      message: typeof item.message === 'string' ? item.message : '',
    }))
    : []
  return {
    selected: value.selected,
    rootPath: value.rootPath ?? null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    contractVersion: value.contractVersion,
    activeTimelinePath: typeof value.activeTimelinePath === 'string' ? value.activeTimelinePath : null,
    firstSelection: value.firstSelection === true,
    warnings,
  }
}

export function normalizeTimelineVariant(value, label = 'variant') {
  if (!isRecord(value)) fail(label, 'must be an object')
  const startEventId = eventSeq(value.startEventId, `${label}.startEventId`)
  const endEventId = eventSeq(value.endEventId, `${label}.endEventId`)
  if (startEventId > endEventId) fail(label, 'startEventId must not exceed endEventId')
  const ext = extRecord(value.ext, `${label}.ext`)
  return {
    id: stringId(value.id, `${label}.id`),
    sessionId: stringId(value.sessionId, `${label}.sessionId`),
    startEventId,
    endEventId,
    ...(ext === undefined ? {} : { ext }),
  }
}

export function normalizeTimelineNode(value, label = 'node') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (value.kind !== 'qa') fail(label, 'kind must be qa')
  if (!Array.isArray(value.variants) || value.variants.length === 0) {
    fail(label, 'variants must be a non-empty array')
  }
  const variants = value.variants.map((item, index) => normalizeTimelineVariant(item, `${label}.variants[${index}]`))
  const adoptedVariantId = stringId(value.adoptedVariantId, `${label}.adoptedVariantId`)
  if (!variants.some(item => item.id === adoptedVariantId)) fail(label, 'adoptedVariantId must match a variant')
  if (value.hidden !== undefined && typeof value.hidden !== 'boolean') fail(label, 'hidden must be a boolean')
  if (value.displayOverride !== undefined && value.displayOverride !== null && typeof value.displayOverride !== 'string') {
    fail(label, 'displayOverride must be a string or null')
  }
  const ext = extRecord(value.ext, `${label}.ext`)
  return {
    id: stringId(value.id, `${label}.id`),
    kind: 'qa',
    hidden: value.hidden === true,
    displayOverride: value.displayOverride ?? null,
    ...(Object.hasOwn(value, 'parentVariantId') ? {
      parentVariantId: value.parentVariantId === null
        ? null
        : stringId(value.parentVariantId, `${label}.parentVariantId`),
    } : {}),
    adoptedVariantId,
    variants,
    ...(ext === undefined ? {} : { ext }),
  }
}

export function normalizeTimeline(value, label = 'timeline') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (!Array.isArray(value.nodes)) fail(label, 'nodes must be an array')
  const nodes = value.nodes.map((item, index) => normalizeTimelineNode(item, `${label}.nodes[${index}]`))
  const ids = new Set()
  const variantOwners = new Map()
  const tree = value.head !== undefined || nodes.some(node => Object.hasOwn(node, 'parentVariantId'))
  for (const node of nodes) {
    if (ids.has(node.id)) fail(label, `duplicate node id ${node.id}`)
    ids.add(node.id)
    for (const variant of node.variants) {
      if (tree && variantOwners.has(variant.id)) fail(label, `duplicate tree variant id ${variant.id}`)
      variantOwners.set(variant.id, node.id)
    }
  }
  for (const [index, node] of nodes.entries()) {
    if (!Object.hasOwn(node, 'parentVariantId') || node.parentVariantId === null) continue
    const parentNodeId = variantOwners.get(node.parentVariantId)
    if (parentNodeId === undefined) fail(`${label}.nodes[${index}]`, 'parentVariantId is unknown')
    if (nodes.findIndex(item => item.id === parentNodeId) >= index) fail(`${label}.nodes[${index}]`, 'parentVariantId must reference an earlier node')
  }
  let head
  if (value.head !== undefined) {
    if (!isRecord(value.head)) fail(`${label}.head`, 'must be an object')
    head = {
      sessionId: stringId(value.head.sessionId, `${label}.head.sessionId`),
      nodeId: stringId(value.head.nodeId, `${label}.head.nodeId`),
      variantId: stringId(value.head.variantId, `${label}.head.variantId`),
    }
    if (variantOwners.get(head.variantId) !== head.nodeId) fail(`${label}.head`, 'must reference a variant on its node')
  }
  const ext = extRecord(value.ext, `${label}.ext`)
  return { nodes, ...(head === undefined ? {} : { head }), ...(ext === undefined ? {} : { ext }) }
}

export function normalizeCatalog(value, label = 'catalog') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (!Array.isArray(value.playthroughs)) fail(label, 'playthroughs must be an array')
  const playthroughs = value.playthroughs.map((item, index) => {
    const itemLabel = `${label}.playthroughs[${index}]`
    if (!isRecord(item)) fail(itemLabel, 'must be an object')
    const ext = extRecord(item.ext, `${itemLabel}.ext`)
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      path: stringId(item.path, `${itemLabel}.path`),
      ...(typeof item.title === 'string' ? { title: item.title } : {}),
      ...(typeof item.lastOpenedAt === 'string' ? { lastOpenedAt: item.lastOpenedAt } : {}),
      ...(ext === undefined ? {} : { ext }),
    }
  })
  const ext = extRecord(value.ext, `${label}.ext`)
  return { playthroughs, ...(ext === undefined ? {} : { ext }) }
}

export function parseJsonDocument(content, normalize, label) {
  if (typeof content !== 'string') fail(label, 'content must be a JSON string')
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    fail(label, 'content must be valid JSON')
  }
  return normalize(parsed, label)
}

export function projectContentText(content) {
  if (!Array.isArray(content)) return ''
  return content.map(part => {
    if (!isRecord(part)) return ''
    if (typeof part.text === 'string') return part.text
    return typeof part.type === 'string' && part.type !== 'text' ? `⟦${part.type}⟧` : ''
  }).join('')
}

export function normalizeSessionMessages(value, label = 'messages') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (!Array.isArray(value.messages)) fail(label, 'messages must be an array')
  if (typeof value.incompleteTurn !== 'boolean') fail(label, 'incompleteTurn must be a boolean')
  const messages = value.messages.map((item, index) => {
    const itemLabel = `${label}.messages[${index}]`
    if (!isRecord(item)) fail(itemLabel, 'must be an object')
    if (!MESSAGE_ROLES.has(item.role)) fail(itemLabel, 'role is invalid')
    if (!Array.isArray(item.content)) fail(itemLabel, 'content must be an array')
    if (item.seq !== null && (!Number.isSafeInteger(item.seq) || item.seq < 0)) fail(itemLabel, 'seq must be a non-negative integer or null')
    const fallbackKind = item.role === 'assistant' ? 'assistant' : item.role === 'system' ? 'system' : 'user'
    const origin = item.origin === undefined
      ? { kind: fallbackKind }
      : (() => {
          if (!isRecord(item.origin) || !MESSAGE_ORIGIN_KINDS.has(item.origin.kind)) fail(`${itemLabel}.origin`, 'kind is invalid')
          if (item.origin.kind !== 'context') return { kind: item.origin.kind }
          const optional = (field, maximum) => {
            const fieldValue = item.origin[field]
            if (fieldValue !== null && fieldValue !== undefined
              && (typeof fieldValue !== 'string' || fieldValue.length > maximum)) {
              fail(`${itemLabel}.origin.${field}`, `must be a string up to ${maximum} characters or null`)
            }
            return typeof fieldValue === 'string' && fieldValue !== '' ? fieldValue : null
          }
          return {
            kind: 'context',
            producer: optional('producer', 200),
            form: optional('form', 64),
            summary: optional('summary', 1000),
          }
        })()
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      role: item.role,
      content: item.content,
      seq: item.seq,
      text: projectContentText(item.content),
      origin,
    }
  })
  return { messages, incompleteTurn: value.incompleteTurn }
}

export function normalizeFocus(value, label = 'focus') {
  if (!isRecord(value)) fail(label, 'must be an object')
  const nullableId = (field, fieldLabel) => {
    if (value[field] !== null && (typeof value[field] !== 'string' || value[field].trim() === '')) {
      fail(label, `${fieldLabel} must be a non-empty string or null`)
    }
    return value[field]
  }
  return {
    playthroughId: stringId(value.playthroughId, `${label}.playthroughId`),
    sessionId: nullableId('sessionId', 'sessionId'),
    nodeId: nullableId('nodeId', 'nodeId'),
    variantId: nullableId('variantId', 'variantId'),
  }
}

export function timelinePath(value, label = 'timeline path') {
  const path = typeof value === 'string' ? value : value?.path
  stringId(path, label)
  if (!path.endsWith('timeline.json')) fail(label, 'must point to timeline.json')
  return path
}

export function playthroughCharacterId(playthrough) {
  const explicit = playthrough?.ext?.pmpDshTavern?.characterId
  if (typeof explicit === 'string' && explicit !== '') return explicit
  const path = typeof playthrough?.path === 'string' ? playthrough.path.replaceAll('\\', '/') : ''
  const first = path.split('/').filter(Boolean)[0]
  return first || null
}

export { CHROME_MODES }
