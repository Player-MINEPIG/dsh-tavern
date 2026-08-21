import { httpError } from './http.js'
import { parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'

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

function characterIdFor(playthrough) {
  const declared = playthrough.ext?.[EXTENSION_KEY]?.characterId
  if (typeof declared === 'string' && declared !== '') return declared
  const firstSegment = typeof playthrough.path === 'string' ? playthrough.path.split('/')[0] : null
  return typeof firstSegment === 'string' && firstSegment !== '' ? firstSegment : null
}

function sessionIdsInTimeline(timeline) {
  return new Set(timeline.nodes.flatMap(node => node.variants.map(variant => variant.sessionId)))
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

function notFound(error) {
  return error?.status === 404 || error?.code === 'PLAY_PATH_NOT_FOUND'
}

export class PlayMembershipService {
  constructor(workspaceStore) {
    if (workspaceStore === undefined) throw new TypeError('workspaceStore is required')
    this.workspaceStore = workspaceStore
  }

  readCatalog({ allowMissing = false } = {}) {
    try {
      const file = this.workspaceStore.readFile('catalog.json', { validate: validatePlayDocument })
      return { file, catalog: parseCatalogJson(file.content) }
    } catch (error) {
      if (allowMissing && notFound(error)) return null
      throw error
    }
  }

  readTimeline(playthrough) {
    const file = this.workspaceStore.readFile(playthrough.path, { validate: validatePlayDocument })
    return { file, timeline: parseTimelineJson(file.content) }
  }

  conflictsForSelection(sessionId, requestedCharacterId) {
    const catalogDocument = this.readCatalog({ allowMissing: true })
    if (catalogDocument === null) return []
    const conflicts = []
    for (const playthrough of catalogDocument.catalog.playthroughs) {
      const expectedCharacterId = characterIdFor(playthrough)
      if (expectedCharacterId === requestedCharacterId) continue
      const rootSessionId = playthrough.ext?.[EXTENSION_KEY]?.rootSessionId ?? null
      let member = rootSessionId === sessionId
      let descendantSessionCount = 0
      if (!member) {
        const { timeline } = this.readTimeline(playthrough)
        member = sessionIdsInTimeline(timeline).has(sessionId)
        if (member) descendantSessionCount = detachSessionFromTimeline(timeline, sessionId).detachedSessionIds.length - 1
      } else {
        const { timeline } = this.readTimeline(playthrough)
        descendantSessionCount = detachSessionFromTimeline(timeline, sessionId).detachedSessionIds.length - 1
      }
      if (!member) continue
      conflicts.push({
        playthroughId: playthrough.id,
        playthroughTitle: playthrough.title ?? playthrough.id,
        sessionId,
        expectedCharacterId,
        requestedCharacterId,
        descendantSessionCount: Math.max(0, descendantSessionCount),
      })
    }
    return conflicts
  }

  detach(playthroughId, sessionId, { operation } = {}) {
    const catalogDocument = this.readCatalog()
    const index = catalogDocument.catalog.playthroughs.findIndex(item => item.id === playthroughId)
    if (index < 0) throw httpError(404, 'playthrough not found', 'PLAYTHROUGH_NOT_FOUND')
    const playthrough = catalogDocument.catalog.playthroughs[index]
    const rootDetached = playthrough.ext?.[EXTENSION_KEY]?.rootSessionId === sessionId
    const timelineDocument = this.readTimeline(playthrough)
    const result = detachSessionFromTimeline(timelineDocument.timeline, sessionId, { clearImportContext: rootDetached })
    const wasTimelineMember = result.removedVariantIds.length > 0
    if (!rootDetached && !wasTimelineMember) {
      return { ok: true, detached: false, playthroughId, sessionId, detachedSessionIds: [], empty: timelineDocument.timeline.nodes.length === 0 }
    }

    operation?.stage('membership.checked', { playthroughId, sessionId })
    if (result.changed) {
      operation?.stage('timeline.detach.begin', { playthroughId, sessionId, path: playthrough.path })
      this.workspaceStore.writeFile(playthrough.path, JSON.stringify(result.timeline), {
        expectedRevision: timelineDocument.file.revision,
        expectedRevisionPresent: true,
        validate: validatePlayDocument,
      })
      operation?.stage('timeline.detach.committed', { playthroughId, sessionId, path: playthrough.path })
    }

    if (rootDetached) {
      const nextPlaythrough = withoutRoot(playthrough)
      const nextCatalog = {
        ...catalogDocument.catalog,
        playthroughs: catalogDocument.catalog.playthroughs.map((item, itemIndex) => itemIndex === index ? nextPlaythrough : item),
      }
      operation?.stage('catalog.detach.begin', { playthroughId, sessionId, path: 'catalog.json' })
      this.workspaceStore.writeFile('catalog.json', JSON.stringify(nextCatalog), {
        expectedRevision: catalogDocument.file.revision,
        expectedRevisionPresent: true,
        validate: validatePlayDocument,
      })
      operation?.stage('catalog.detach.committed', { playthroughId, sessionId, path: 'catalog.json' })
    }

    return {
      ok: true,
      detached: true,
      playthroughId,
      sessionId,
      detachedSessionIds: result.detachedSessionIds,
      empty: result.timeline.nodes.length === 0,
    }
  }
}
