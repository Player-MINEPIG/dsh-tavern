import { createHash, randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError } from './http.js'
import { isSafeCatalogSegment, parseTimelineJson, validatePlayDocument } from './timeline.js'

const EXTENSION_KEY = 'pmpDshTavern'
const BRANCH_HEADS_KEY = 'branchHeads'

function adoptedVariant(node) {
  return node?.variants?.find(variant => variant.id === node.adoptedVariantId) ?? null
}

function effectiveParent(nodes, index) {
  const node = nodes[index]
  if (Object.hasOwn(node, 'parentVariantId')) return node.parentVariantId
  return index === 0 ? null : adoptedVariant(nodes[index - 1])?.id ?? null
}

function cleanTimelineExtension(timeline, survivingVariantIds, clearImportContext) {
  const extension = timeline.ext
  if (extension === undefined) return undefined
  const known = extension[EXTENSION_KEY]
  if (known === undefined) return extension
  const branchHeads = Array.isArray(known[BRANCH_HEADS_KEY])
    ? known[BRANCH_HEADS_KEY].filter(value => (
      value !== null
      && typeof value === 'object'
      && survivingVariantIds.has(value.branchVariantId)
      && survivingVariantIds.has(value.variantId)
    ))
    : undefined
  const nextKnown = { ...known }
  if (branchHeads === undefined || branchHeads.length === 0) delete nextKnown[BRANCH_HEADS_KEY]
  else nextKnown[BRANCH_HEADS_KEY] = branchHeads
  if (clearImportContext) delete nextKnown.importContextPath
  const next = { ...extension }
  if (Object.keys(nextKnown).length === 0) delete next[EXTENSION_KEY]
  else next[EXTENSION_KEY] = nextKnown
  return Object.keys(next).length === 0 ? undefined : next
}

function fallbackHead(nodes) {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const variant = adoptedVariant(nodes[index])
    if (variant !== null) return { sessionId: variant.sessionId, nodeId: nodes[index].id, variantId: variant.id }
  }
  return null
}

/**
 * Remove every variant stored by `sessionId` and every descendant variant.
 * Sibling branches are preserved and no surviving history is reparented.
 */
export function detachSessionFromTimeline(timeline, sessionId, { clearImportContext = false } = {}) {
  const normalized = parseTimelineJson(JSON.stringify(timeline))
  const removedVariantIds = new Set()
  const detachedSessionIds = new Set([sessionId])

  for (const node of normalized.nodes) {
    for (const variant of node.variants) {
      if (variant.sessionId === sessionId) removedVariantIds.add(variant.id)
    }
  }

  for (const [index, node] of normalized.nodes.entries()) {
    const parentVariantId = effectiveParent(normalized.nodes, index)
    if (parentVariantId !== null && removedVariantIds.has(parentVariantId)) {
      for (const variant of node.variants) removedVariantIds.add(variant.id)
    }
  }

  const nodes = []
  for (const node of normalized.nodes) {
    const variants = node.variants.filter(variant => {
      if (!removedVariantIds.has(variant.id)) return true
      detachedSessionIds.add(variant.sessionId)
      return false
    })
    if (variants.length === 0) continue
    nodes.push({
      ...node,
      adoptedVariantId: variants.some(variant => variant.id === node.adoptedVariantId)
        ? node.adoptedVariantId
        : variants[0].id,
      variants,
    })
  }

  const survivingVariantIds = new Set(nodes.flatMap(node => node.variants.map(variant => variant.id)))
  const currentHead = normalized.head
  const head = currentHead !== undefined && survivingVariantIds.has(currentHead.variantId)
    ? currentHead
    : fallbackHead(nodes)
  const ext = cleanTimelineExtension(normalized, survivingVariantIds, clearImportContext)
  const next = {
    nodes,
    ...(head === null ? {} : { head }),
    ...(ext === undefined ? {} : { ext }),
  }
  return {
    timeline: parseTimelineJson(JSON.stringify(next)),
    changed: removedVariantIds.size > 0 || (clearImportContext && normalized.ext?.[EXTENSION_KEY]?.importContextPath !== undefined),
    detachedSessionIds: [...detachedSessionIds],
    removedVariantIds: [...removedVariantIds],
  }
}

function withoutRoot(playthrough) {
  const ext = { ...(playthrough.ext ?? {}) }
  const known = { ...(ext[EXTENSION_KEY] ?? {}) }
  delete known.rootSessionId
  delete known.importContextPath
  if (Object.keys(known).length === 0) delete ext[EXTENSION_KEY]
  else ext[EXTENSION_KEY] = known
  return {
    ...playthrough,
    ...(Object.keys(ext).length === 0 ? { ext: undefined } : { ext }),
  }
}

// One private intent per playthrough survives Host restart and optional log rotation.
// Keep only membership IDs and revisions. The verified input files reproduce each edit.
const INTENT_LIMIT = 2 * 1024 * 1024
const digest = text => createHash('sha256').update(text).digest('hex')
const rowDigest = row => digest(JSON.stringify(row))
const changed = () => httpError(409, 'The playthrough changed during root detachment', 'PLAY_FILE_REVISION_CONFLICT')

function intentLocation(store, id) {
  const { workspaceId, rootPath } = store.get()
  return {
    playthroughId: id,
    scope: JSON.stringify([workspaceId, rootPath]),
    path: join(store.storageDir, 'playthrough-detaches', digest(JSON.stringify([workspaceId, rootPath, id])) + '.json'),
  }
}

function readIntent(path) {
  try { return readJsonFile(path, INTENT_LIMIT) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

export function hasPendingDetachIntent(store, id) {
  return Boolean(readIntent(intentLocation(store, id).path))
}

export function dismissDetachIntent(store, id, operationId, scope) {
  const location = intentLocation(store, id)
  if (!store.get().rootPath || location.scope !== scope) throw httpError(409, 'The RP workspace changed', 'PLAY_WORKSPACE_CHANGED')
  const intent = readIntent(location.path)
  if (!isSafeCatalogSegment(id) || !intent || intent.playthroughId !== id
    || typeof operationId !== 'string' || intent.operationId !== operationId) {
    throw httpError(409, 'No pending root detachment matches this operation ID', 'PLAY_DETACH_PENDING')
  }
  unlinkSync(location.path)
}

function writeDocument(store, file, content, scope) {
  return store.writeFile(file.path, content, {
    expectedRevision: file.revision, expectedRevisionPresent: true, expectedWorkspaceScope: scope, validate: validatePlayDocument,
  })
}

function inspectIntent(service, location, intent) {
  const { workspaceId, rootPath } = service.workspaceStore.get()
  if (JSON.stringify([workspaceId, rootPath]) !== location.scope) throw changed()
  if (intent.playthroughId !== location.playthroughId || !['prepared', 'timeline-verified'].includes(intent.stage)) throw changed()
  const catalog = service.readCatalog()
  const row = catalog.catalog.playthroughs.find(item => item.id === intent.playthroughId)
  if (!row || row.path !== intent.path) throw changed()
  const rowRevision = rowDigest(row)
  const catalogDone = rowRevision === intent.rowAfter
  if (!catalogDone && rowRevision !== intent.rowBefore) throw changed()

  const file = service.workspaceStore.readFile(row.path)
  const timelineDone = file.revision === intent.timelineAfter
  if (!timelineDone && (intent.stage !== 'prepared' || catalogDone || file.revision !== intent.timelineBefore)) {
    throw changed()
  }
  return { catalog, file, timelineDone, catalogDone }
}

function completeIntent(service, location, intent, { apply, beforeWrite, signal, operation }) {
  const store = service.workspaceStore
  const state = () => {
    signal?.throwIfAborted()
    if (readIntent(location.path)?.operationId !== intent.operationId) throw changed()
    return inspectIntent(service, location, intent)
  }
  let current = state()
  if (!apply) return
  const writeTimeline = !current.timelineDone
  if (writeTimeline) {
    const result = detachSessionFromTimeline(JSON.parse(current.file.content), intent.sessionId, { clearImportContext: true })
    const content = JSON.stringify(result.timeline)
    if (digest(content) !== intent.timelineAfter) throw changed()
    if (beforeWrite) {
      beforeWrite(current.file, intent.path)
      state()
    }
    writeDocument(store, current.file, content, location.scope)
    current = state()
    if (!current.timelineDone) throw changed()
  }
  if (intent.stage !== 'timeline-verified') {
    atomicJson(location.path, { ...intent, stage: 'timeline-verified' }, INTENT_LIMIT)
    intent.stage = 'timeline-verified'
  }
  if (writeTimeline) operation?.checkpoint('playthrough.timeline.updated', { playthroughId: intent.playthroughId, sessionId: intent.sessionId })
  current = state()
  if (!current.catalogDone) {
    // Other playthroughs can change while this intent is pending. Preserve their
    // current contents and CAS the complete catalog read for this attempt.
    const catalog = JSON.parse(current.catalog.file.content)
    catalog.playthroughs = catalog.playthroughs.map(item => item.id === intent.playthroughId ? withoutRoot(item) : item)
    if (beforeWrite) {
      beforeWrite(current.catalog.file, 'catalog.json')
      state()
    }
    writeDocument(store, current.catalog.file, JSON.stringify(catalog), location.scope)
    operation?.checkpoint('playthrough.catalog.updated', { playthroughId: intent.playthroughId, sessionId: intent.sessionId })
  }
  if (!state().catalogDone) throw changed()
  unlinkSync(location.path)
}

function pendingError(error, intent) {
  return httpError(error.status ?? 500,
    error.message + ' · 解绑检查点 ' + intent.stage + '，操作 ' + intent.operationId + '。请打开「修复周目」核对。',
    error.code ?? 'PLAY_DETACH_PENDING')
}

export function repairDetachIntent(service, row, { apply = false, beforeWrite, signal } = {}) {
  const location = intentLocation(service.workspaceStore, row.id)
  const intent = readIntent(location.path)
  if (!intent) return null
  const details = () => ({ operationId: intent.operationId, playthroughId: row.id, sessionId: intent.sessionId, stage: intent.stage })
  let code = 'PLAY_DETACH_PENDING'
  try {
    completeIntent(service, location, intent, { apply, beforeWrite, signal })
    if (apply) return { changes: [{ kind: 'detach-recovered', ...details() }], remaining: [] }
  } catch (error) {
    signal?.throwIfAborted()
    code = error.code ?? 'repair-unavailable'
  }
  return { changes: [], remaining: [{ reason: 'detach-pending', code, ...details() }] }
}

export function detachSession(service, playthroughId, sessionId, operation) {
  const store = service.workspaceStore
  const catalog = service.readCatalog()
  const row = catalog.catalog.playthroughs.find(item => item.id === playthroughId)
  if (!row) throw httpError(404, 'playthrough not found', 'PLAYTHROUGH_NOT_FOUND')
  const location = intentLocation(store, playthroughId)
  let intent = readIntent(location.path)
  if (intent && intent.sessionId !== sessionId) {
    throw pendingError(httpError(409, 'A different root detachment needs repair', 'PLAY_DETACH_PENDING'), intent)
  }
  if (!intent) {
    const root = row.ext?.[EXTENSION_KEY]?.rootSessionId === sessionId
    const { timeline, file } = service.readTimeline(row)
    const result = detachSessionFromTimeline(timeline, sessionId, { clearImportContext: root })
    const empty = result.timeline.nodes.length === 0
    if (!root) {
      if (result.changed) {
        writeDocument(store, file, JSON.stringify(result.timeline), location.scope)
        operation?.checkpoint('playthrough.timeline.updated', { playthroughId, sessionId })
      }
      return { ok: true, detached: result.changed, playthroughId, sessionId, detachedSessionIds: result.changed ? result.detachedSessionIds : [], empty }
    }
    store.assertPlaythroughAvailable?.(row, 'detach')
    intent = {
      stage: 'prepared', operationId: operation?.operationId ?? randomUUID(), playthroughId, sessionId, path: row.path,
      timelineBefore: file.revision, timelineAfter: result.changed ? digest(JSON.stringify(result.timeline)) : file.revision,
      rowBefore: rowDigest(row), rowAfter: rowDigest(withoutRoot(row)), detachedSessionIds: result.detachedSessionIds, empty,
    }
    atomicJson(location.path, intent, INTENT_LIMIT)
  }
  try { completeIntent(service, location, intent, { apply: true, operation }) }
  catch (error) { throw pendingError(error, intent) }
  return { ok: true, detached: true, playthroughId, sessionId, detachedSessionIds: intent.detachedSessionIds, empty: intent.empty }
}
