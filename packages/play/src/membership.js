import { detachSession, detachSessionFromTimeline, repairDetachIntent } from './detach.js'
import { httpError } from './http.js'
import { parseCatalogJson, parseTimelineJson, validatePlayDocument } from './timeline.js'

export { detachSessionFromTimeline }

const EXTENSION_KEY = 'pmpDshTavern'

function characterIdFor(playthrough) {
  const declared = playthrough.ext?.[EXTENSION_KEY]?.characterId
  if (typeof declared === 'string' && declared !== '') return declared
  const firstSegment = typeof playthrough.path === 'string' ? playthrough.path.split('/')[0] : null
  return typeof firstSegment === 'string' && firstSegment !== '' ? firstSegment : null
}

function sessionIdsInTimeline(timeline) {
  return new Set(timeline.nodes.flatMap(node => node.variants.map(variant => variant.sessionId)))
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

  /** Covers membership uniqueness and absence across all current/future catalog entries. */
  captureContextLease() {
    const store = this.workspaceStore, check = store.captureMutationLease()
    return () => this.workspaceStore === store && check()
  }

  /** A restored catalog/timeline requires a new lease even when its bytes are identical. */
  captureLease(playthroughId) {
    const playthrough = this.readCatalog().catalog.playthroughs.find(item => item.id === playthroughId)
    if (!playthrough) throw httpError(404, 'playthrough not found', 'PLAYTHROUGH_NOT_FOUND')
    return this.workspaceStore.captureReadLease(['catalog.json', playthrough.path])
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
    const written = this.workspaceStore.writeFile('catalog.json', JSON.stringify(nextCatalog), {
      expectedRevision: catalogDocument.file.revision,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    operation?.checkpoint('playthrough.catalog.updated')
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
        operation?.checkpoint('playthrough.catalog.restored')
      } catch (rollbackError) {
        error.rollbackError = rollbackError
      }
      throw error
    }
    return { relinkedPlaythroughCount: matches.length, relinkedSessionCount: sessionIds.size }
  }

  detach(playthroughId, sessionId, { operation } = {}) {
    return detachSession(this, playthroughId, sessionId, operation)
  }

  repairDetach(row, options = {}) {
    return repairDetachIntent(this, row, options)
  }
}
