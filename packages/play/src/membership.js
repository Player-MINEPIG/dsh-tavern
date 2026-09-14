import { httpError } from './http.js'
import { parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'

const EXTENSION_KEY = 'pmpDshTavern'
const BRANCH_HEADS_KEY = 'branchHeads'
/** Tombstone list of deleted playthroughs, kept inside `catalog.ext`. */
const DELETED_KEY = 'deletedPlaythroughs'
/** POSIX relative directory that receives backed-up playthrough trees. */
const DEFAULT_TRASH_DIR = '.dtavern-trash'
/** Tombstones are a breadcrumb trail, not a ledger — keep the tail only. */
const MAX_DELETED_PLAYTHROUGHS = 50

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

/**
 * Every session id the timeline references, adopted or not.
 *
 * Exported so the loader can pre-check liveness (a running agent) before the
 * files it would delete are gone.
 */
export function sessionIdsInTimeline(timeline) {
  return new Set(timeline.nodes.flatMap(node => node.variants.map(variant => variant.sessionId)))
}

/** The directory holding one playthrough (`<characterId>/playthrough-<id>`), or null. */
function directoryOf(playthrough) {
  if (typeof playthrough.path !== 'string' || playthrough.path === '') return null
  const segments = playthrough.path.split('/')
  if (segments.length < 2) return null
  return segments.slice(0, -1).join('/')
}

/** `2026-09-14T08-30-00-000Z` — filename-safe, sortable, no colons (Windows). */
function trashStamp(now) {
  return now().replaceAll(':', '-').replace(/\.\d+Z$/u, 'Z')
}

function playthroughWithCharacter(playthrough, character) {
  const ext = { ...(playthrough.ext ?? {}) }
  ext[EXTENSION_KEY] = {
    ...(ext[EXTENSION_KEY] ?? {}),
    characterId: character.id,
    characterName: character.name,
    ...(typeof character.sha256 === 'string' ? { characterSha256: character.sha256 } : {}),
  }
  return { ...playthrough, ext }
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

function workspaceDocumentAbsent(error) {
  return error?.status === 404
    || error?.code === 'PLAY_PATH_NOT_FOUND'
    || error?.code === 'PLAY_WORKSPACE_UNBOUND'
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
      if (allowMissing && workspaceDocumentAbsent(error)) return null
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

  relinkCharacter(previousCharacterId, character, { selectionPolicy, operation } = {}) {
    if (typeof previousCharacterId !== 'string' || previousCharacterId === '') throw new TypeError('previousCharacterId is required')
    if (typeof character?.id !== 'string' || character.id === '' || typeof character.name !== 'string') throw new TypeError('character is required')
    let catalogDocument
    try {
      catalogDocument = this.readCatalog()
    } catch (error) {
      if (error?.code === 'PLAY_PATH_NOT_FOUND') return { relinkedPlaythroughCount: 0, relinkedSessionCount: 0 }
      throw error
    }
    const matches = catalogDocument.catalog.playthroughs.filter(item => characterIdFor(item) === previousCharacterId)
    if (matches.length === 0) return { relinkedPlaythroughCount: 0, relinkedSessionCount: 0 }

    return this.relinkMatches(catalogDocument, matches, character, { selectionPolicy, operation })
  }

  relinkPlaythrough(playthroughId, character, { selectionPolicy, operation } = {}) {
    if (typeof playthroughId !== 'string' || playthroughId === '') throw new TypeError('playthroughId is required')
    if (typeof character?.id !== 'string' || character.id === '' || typeof character.name !== 'string') throw new TypeError('character is required')
    const catalogDocument = this.readCatalog()
    const playthrough = catalogDocument.catalog.playthroughs.find(item => item.id === playthroughId)
    if (playthrough === undefined) throw httpError(404, 'playthrough not found', 'PLAYTHROUGH_NOT_FOUND')
    const previousCharacterId = characterIdFor(playthrough)
    if (previousCharacterId === character.id) {
      return {
        ok: true,
        playthroughId,
        previousCharacterId,
        characterId: character.id,
        relinkedPlaythroughCount: 0,
        relinkedSessionCount: 0,
      }
    }
    const result = this.relinkMatches(catalogDocument, [playthrough], character, { selectionPolicy, operation })
    return {
      ok: true,
      playthroughId,
      previousCharacterId,
      characterId: character.id,
      ...result,
    }
  }

  relinkMatches(catalogDocument, matches, character, { selectionPolicy, operation } = {}) {
    const matchedIds = new Set(matches.map(item => item.id))
    const previousCharacterIds = new Set(matches.map(characterIdFor).filter(Boolean))

    const sessionIds = new Set()
    for (const playthrough of matches) {
      const root = playthrough.ext?.[EXTENSION_KEY]?.rootSessionId
      if (typeof root === 'string' && root !== '') sessionIds.add(root)
      const { timeline } = this.readTimeline(playthrough)
      for (const id of sessionIdsInTimeline(timeline)) sessionIds.add(id)
    }
    for (const sessionId of sessionIds) {
      const selected = selectionPolicy?.selection?.(sessionId)
      if (selected !== null
        && selected !== undefined
        && selected.characterCardId !== character.id
        && !previousCharacterIds.has(selected.characterCardId)) {
        throw httpError(409, `session "${sessionId}" is already bound to another character`, 'PLAY_CHARACTER_RELINK_CONFLICT')
      }
    }

    const nextCatalog = {
      ...catalogDocument.catalog,
      playthroughs: catalogDocument.catalog.playthroughs.map(item => (
        matchedIds.has(item.id) ? playthroughWithCharacter(item, character) : item
      )),
    }
    operation?.stage('catalog.character-relink.begin', {
      previousCharacterIds: [...previousCharacterIds],
      characterId: character.id,
      playthroughIds: [...matchedIds],
      playthroughCount: matches.length,
    })
    const written = this.workspaceStore.writeFile('catalog.json', JSON.stringify(nextCatalog), {
      expectedRevision: catalogDocument.file.revision,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    try {
      const patch = { characterCardId: character.id, character: { greetingIndex: 0 } }
      if (sessionIds.size > 0) {
        if (typeof selectionPolicy?.selectMany === 'function') selectionPolicy.selectMany([...sessionIds], patch)
        else if (typeof selectionPolicy?.select === 'function') {
          for (const sessionId of sessionIds) selectionPolicy.select(sessionId, patch)
        } else throw new Error('Character selection policy is not installed')
      }
    } catch (error) {
      try {
        this.workspaceStore.writeFile('catalog.json', JSON.stringify(catalogDocument.catalog), {
          expectedRevision: written.revision,
          expectedRevisionPresent: true,
          validate: validatePlayDocument,
        })
      } catch (rollbackError) {
        error.rollbackError = rollbackError
      }
      throw error
    }
    operation?.stage('catalog.character-relink.committed', {
      previousCharacterIds: [...previousCharacterIds],
      characterId: character.id,
      playthroughIds: [...matchedIds],
      sessionCount: sessionIds.size,
    })
    return { relinkedPlaythroughCount: matches.length, relinkedSessionCount: sessionIds.size }
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

  /**
   * Delete one playthrough for good.
   *
   * The directory is first **parked** in the workspace trash (a same-volume rename,
   * so nothing is copied and nothing is lost), then the catalog entry is dropped and
   * a tombstone is appended to `catalog.ext`, mirroring `CharacterStore.delete`:
   * every downstream surface can report the id as *deleted* instead of silently
   * losing a reference.
   *
   * DSH session logs are deliberately out of scope — the persistence seam has no
   * deletion API, so the caller decides what to do with the bound sessions.
   *
   * @param playthroughId - The catalog id to remove.
   * @param options.operation - Optional mutation operation for stage tracing.
   * @param options.backup - `false` removes the tree outright instead of parking it.
   * @param options.trashDir - POSIX relative trash directory (default `.dtavern-trash`).
   * @param options.now - Clock, injectable for tests.
   * @returns the deleted playthrough summary, its backup location, and its session ids.
   */
  removePlaythrough(playthroughId, { operation, backup = true, trashDir = DEFAULT_TRASH_DIR, now = () => new Date().toISOString() } = {}) {
    const catalogDocument = this.readCatalog()
    const index = catalogDocument.catalog.playthroughs.findIndex(item => item.id === playthroughId)
    if (index < 0) throw httpError(404, 'playthrough not found', 'PLAYTHROUGH_NOT_FOUND')
    const playthrough = catalogDocument.catalog.playthroughs[index]

    // A half-removed playthrough must still be deletable: read what is readable, and
    // fall back to the root session id recorded in the catalog when the timeline is gone.
    const sessionIds = new Set()
    try {
      for (const id of sessionIdsInTimeline(this.readTimeline(playthrough).timeline)) sessionIds.add(id)
    } catch (error) {
      if (!workspaceDocumentAbsent(error)) throw error
    }
    const rootSessionId = playthrough.ext?.[EXTENSION_KEY]?.rootSessionId
    if (typeof rootSessionId === 'string' && rootSessionId !== '') sessionIds.add(rootSessionId)

    const directory = directoryOf(playthrough)
    const characterId = characterIdFor(playthrough)
    const title = typeof playthrough.title === 'string' ? playthrough.title : null
    let backupDir = null
    let removal = null
    let directoryExisted = false
    if (directory !== null) {
      try {
        this.workspaceStore.list(directory)
        directoryExisted = true
      } catch (error) {
        if (!workspaceDocumentAbsent(error)) throw error
      }
    }

    operation?.stage('playthrough.delete.checked', { playthroughId, directory, sessionCount: sessionIds.size, directoryExisted })
    if (directoryExisted) {
      if (backup) {
        const target = trashDir + '/' + trashStamp(now) + '-' + playthroughId
        operation?.stage('playthrough.trash.begin', { playthroughId, from: directory, to: target })
        this.workspaceStore.move(directory, target)
        backupDir = target
        operation?.stage('playthrough.trash.committed', { playthroughId, to: target })
      } else {
        operation?.stage('playthrough.remove.begin', { playthroughId, path: directory })
        removal = this.workspaceStore.removeTree(directory)
        operation?.stage('playthrough.remove.committed', { playthroughId, path: directory, files: removal.removedFiles.length })
      }
    }

    // A dangling `activeTimelinePath` would keep pointing into a directory that no
    // longer exists, so clear it in the same mutation.
    const binding = this.workspaceStore.get()
    if (directory !== null && typeof binding.activeTimelinePath === 'string' && binding.activeTimelinePath.startsWith(directory + '/')) {
      this.workspaceStore.setActiveTimelinePath(null)
      operation?.stage('playthrough.active-cleared', { playthroughId, path: binding.activeTimelinePath })
    }

    const catalog = catalogDocument.catalog
    const tombstone = {
      id: playthroughId,
      ...(title === null ? {} : { title }),
      ...(characterId === null ? {} : { characterId }),
      ...(typeof rootSessionId === 'string' && rootSessionId !== '' ? { rootSessionId } : {}),
      sessionIds: [...sessionIds],
      deletedAt: now(),
      ...(backupDir === null ? {} : { backupDir }),
    }
    const ext = { ...(catalog.ext ?? {}) }
    const known = { ...(ext[EXTENSION_KEY] ?? {}) }
    const previous = Array.isArray(known[DELETED_KEY]) ? known[DELETED_KEY] : []
    known[DELETED_KEY] = [...previous.filter(item => item?.id !== playthroughId), tombstone].slice(-MAX_DELETED_PLAYTHROUGHS)
    ext[EXTENSION_KEY] = known
    const nextCatalog = {
      ...catalog,
      playthroughs: catalog.playthroughs.filter(item => item.id !== playthroughId),
      ext,
    }
    operation?.stage('catalog.playthrough-delete.begin', { playthroughId, path: 'catalog.json' })
    this.workspaceStore.writeFile('catalog.json', JSON.stringify(nextCatalog), {
      expectedRevision: catalogDocument.file.revision,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    operation?.stage('catalog.playthrough-delete.committed', { playthroughId, path: 'catalog.json' })

    return {
      ok: true,
      playthroughId,
      removed: true,
      directoryExisted,
      characterId,
      title,
      backupDir,
      removedFileCount: removal === null ? 0 : removal.removedFiles.length,
      sessionIds: [...sessionIds],
      tombstone,
    }
  }
}
