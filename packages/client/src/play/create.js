import { creationRequest } from './creation-request.js'
import { characterIdFromSelection } from './sidebar-model.js'
import { loadPlaythroughImportContext } from './import.js'
import { updateCatalog } from './mutations.js'
import { isPlaythroughArchived } from '../../../play/src/playthrough-state.js'
import { normalizeTemplateSelection } from '../../../session-template/src/model.js'

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

function safeSegment(value, label) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`)
  }
  return value
}

async function catalogOrEmpty(client) {
  try {
    return await client.getCatalog()
  } catch (reason) {
    if (reason?.code === 'PLAY_PATH_NOT_FOUND') return { playthroughs: [] }
    throw reason
  }
}

function playthroughCharacterId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.characterId
  return typeof value === 'string' && value !== '' ? value : null
}

function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId
  return typeof value === 'string' && value !== '' ? value : null
}

async function ensureCharacterSelection(client, sessionId, characterId) {
  const current = await client.getCharacterSelection(sessionId)
  if (characterIdFromSelection(current) !== characterId) {
    await client.putCharacterSelection(sessionId, characterId, { greetingIndex: 0 })
  }
  const verified = await client.getCharacterSelection(sessionId)
  if (characterIdFromSelection(verified) !== characterId) {
    throw new Error('playthrough character selection did not persist')
  }
  return verified
}

function latestCharacterPlaythrough(catalog, characterId) {
  let latest = null
  let latestNumber = 0
  let ordinal = 0
  for (const playthrough of catalog?.playthroughs ?? []) {
    if (playthroughCharacterId(playthrough) !== characterId) continue
    ordinal += 1
    const explicit = playthrough?.ext?.pmpDshTavern?.playthroughNumber
    const number = Number.isSafeInteger(explicit) && explicit > 0 ? explicit : ordinal
    if (latest === null || number >= latestNumber) {
      latest = playthrough
      latestNumber = number
    }
  }
  return latest
}

export async function playthroughIsReusable(client, playthrough) {
  if (isPlaythroughArchived(playthrough)) return false
  try {
    const sessionId = rootSessionId(playthrough)
    const timeline = await client.getTimeline(playthrough)
    if ((timeline?.nodes?.length ?? 0) > 0) return false
    if (sessionId === null) {
      return playthrough?.ext?.pmpDshTavern?.importContextPath === undefined
        && timeline?.ext?.pmpDshTavern?.importContextPath === undefined
    }

    const imported = await loadPlaythroughImportContext(client, sessionId, playthrough, timeline)
    if (Array.isArray(imported.document?.qa) && imported.document.qa.length > 0) return false

    const history = await client.getMessages(sessionId)
    if (history?.incompleteTurn === true) return false
    return !(history?.messages ?? []).some(message => message?.role === 'user' || message?.role === 'assistant')
  } catch (reason) {
    // A workspace can outlive the DSH home that owns its sessions. Preserve its
    // references for recovery, but do not let a missing session block a new run.
    if (reason?.code === 'PLAY_SESSION_NOT_FOUND') return false
    throw reason
  }
}

export { nextPlaythroughNumber } from '../../../play/src/creation-publication.js'

export async function renamePlaythrough(client, playthrough, title) {
  if (client == null) throw new TypeError('playClient.required')
  const normalized = typeof title === 'string' ? title.trim() : ''
  if (normalized === '' || normalized.length > 120) throw new TypeError('play.rename.invalid')
  const saved = await updateCatalog(client, current => {
    const freshIndex = current.playthroughs.findIndex(item => item.id === playthrough?.id && item.path === playthrough?.path)
    if (freshIndex < 0) throw new TypeError('play.rename.missing')
    const freshPlaythroughs = [...current.playthroughs]
    const fresh = freshPlaythroughs[freshIndex]
    freshPlaythroughs[freshIndex] = {
      ...fresh,
      title: normalized,
      ext: {
        ...fresh.ext,
        pmpDshTavern: { ...fresh.ext?.pmpDshTavern, autoTitle: false },
      },
    }
    return { ...current, playthroughs: freshPlaythroughs }
  })
  const verified = saved?.playthroughs === undefined ? await client.getCatalog() : saved
  const renamed = verified.playthroughs.find(item => item.id === playthrough.id && item.path === playthrough.path)
  if (renamed?.title !== normalized || renamed.ext?.pmpDshTavern?.autoTitle !== false) {
    throw new Error('play.rename.verificationFailed')
  }
  return renamed
}

export function sourceSessionIdForCharacter(character) {
  const activePlaythrough = character?.playthroughs?.find(item => item.active && typeof item.rootSessionId === 'string')
  if (activePlaythrough !== undefined) return activePlaythrough.rootSessionId
  const activeLoose = character?.unassigned?.find(item => item.active)
  if (activeLoose !== undefined) return activeLoose.id
  const loose = character?.unassigned?.find(item => typeof item.id === 'string')
  if (loose !== undefined) return loose.id
  const rooted = character?.playthroughs?.find(item => typeof item.rootSessionId === 'string')
  return rooted?.rootSessionId ?? null
}

async function reusableOpeningDraft(client, characterId, configurationSelection) {
  const latest = latestCharacterPlaythrough(await catalogOrEmpty(client), characterId)
  if (!latest || isPlaythroughArchived(latest) || rootSessionId(latest) || latest.ext?.pmpDshTavern?.draftId !== latest.id) return null
  let result
  try { result = await client.getDraft(latest.id) }
  catch (error) {
    if (['PLAY_DRAFT_NOT_FOUND', 'PLAY_DRAFT_ARCHIVED'].includes(error.code)) return null
    throw error
  }
  const { draft, playthrough } = result
  if (draft.phase !== 'draft' || draft.claim || draft.selection.characterCardId !== characterId || isPlaythroughArchived(playthrough) || rootSessionId(playthrough)) return null
  if (configurationSelection && JSON.stringify(normalizeTemplateSelection(draft.selection)) !== JSON.stringify(normalizeTemplateSelection(configurationSelection))) return null
  return { ...result, sessionId: null, reused: true }
}

export async function createCharacterPlaythrough(client, {
  character,
  selectionFromSessionId = null,
  configureSession = null,
  configurationSource = null,
  configurationSelection = null,
  reuseEmpty = true,
  creationId,
} = {}) {
  if (client == null) throw new TypeError('playClient.required')
  if (typeof reuseEmpty !== 'boolean') throw new TypeError('reuseEmpty must be a boolean')
  const characterId = safeSegment(character?.id, 'character.id')
  if (typeof client.postDraft === 'function') {
    const source = configurationSource ?? (selectionFromSessionId ? { mode: 'current', sessionId: selectionFromSessionId } : null)
    return creationRequest(client, ['draft', characterId, source, configurationSelection, reuseEmpty], creationId,
      async (identity, options) => ({ ...await client.postDraft({ characterId, ...(source ? { source } : {}), ...identity }, options), reused: false }),
      reuseEmpty ? () => reusableOpeningDraft(client, characterId, configurationSelection) : null)
  }
  const catalog = reuseEmpty && typeof client.getCatalog === 'function' ? await catalogOrEmpty(client) : null
  let latest = latestCharacterPlaythrough(catalog, characterId)
  let reusable = reuseEmpty && latest !== null && await playthroughIsReusable(client, latest)
  if (reusable) {
    // History/import reads can yield to another tab archiving the candidate.
    const fresh = (await client.getCatalog()).playthroughs.find(item => item.id === latest.id && item.path === latest.path)
    reusable = fresh !== undefined && !isPlaythroughArchived(fresh) && rootSessionId(fresh) === rootSessionId(latest)
    if (reusable) latest = fresh
  }
  if (reusable) {
    const existingRoot = rootSessionId(latest)
    if (existingRoot !== null) {
      if (typeof configureSession === 'function') await configureSession(existingRoot)
      await ensureCharacterSelection(client, existingRoot, characterId)
      return { sessionId: existingRoot, playthrough: latest, reused: true }
    }
  }
  throw Object.assign(new Error('This client requires the Host draft creation API (postDraft) to start a new playthrough safely.'), { code: 'PLAY_CREATION_UNAVAILABLE' })
}

export function createPlaythroughController(client, dependencies = {}) {
  const inFlight = new Map()
  let tail = Promise.resolve()
  return {
    create(args) {
      const characterId = safeSegment(args?.character?.id, 'character.id')
      const reuseEmpty = args?.reuseEmpty === undefined
        ? (dependencies.reuseEmpty === undefined ? true : dependencies.reuseEmpty)
        : args.reuseEmpty
      if (typeof reuseEmpty !== 'boolean') throw new TypeError('reuseEmpty must be a boolean')
      const key = JSON.stringify([characterId, reuseEmpty, args.creationId, args.configurationSource, args.selectionFromSessionId, args.configurationSelection ? normalizeTemplateSelection(args.configurationSelection) : null])
      const existing = inFlight.get(key)
      if (existing !== undefined) return existing
      const task = tail.catch(() => {}).then(() => createCharacterPlaythrough(client, {
        ...dependencies,
        ...args,
        reuseEmpty,
      }))
      tail = task
      inFlight.set(key, task)
      task.finally(() => {
        if (inFlight.get(key) === task) inFlight.delete(key)
      }).catch(() => {})
      return task
    },
  }
}
