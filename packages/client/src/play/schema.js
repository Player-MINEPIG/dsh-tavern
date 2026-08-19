const CHROME_MODES = new Set(['native', 'play'])
const MESSAGE_ROLES = new Set(['user', 'assistant', 'system'])

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
  return { mode: value.mode }
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
  for (const node of nodes) {
    if (ids.has(node.id)) fail(label, `duplicate node id ${node.id}`)
    ids.add(node.id)
  }
  const ext = extRecord(value.ext, `${label}.ext`)
  return { nodes, ...(ext === undefined ? {} : { ext }) }
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
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      role: item.role,
      content: item.content,
      seq: item.seq,
      text: projectContentText(item.content),
    }
  })
  return { messages, incompleteTurn: value.incompleteTurn }
}

export function normalizeFocus(value, label = 'focus') {
  if (!isRecord(value)) fail(label, 'must be an object')
  if (value.sessionId !== null && (typeof value.sessionId !== 'string' || value.sessionId === '')) {
    fail(label, 'sessionId must be a non-empty string or null')
  }
  return { sessionId: value.sessionId }
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
