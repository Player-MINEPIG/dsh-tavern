import { characterIdFromSelection } from './sidebar-model.js'
import { loadPlaythroughImportContext } from './import.js'
import { updateCatalog } from './mutations.js'

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

function safeSegment(value, label) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`)
  }
  return value
}

function safeSessionId(value) {
  if (typeof value !== 'string' || !SAFE_SESSION_ID.test(value)) {
    throw new TypeError('session.id must be a valid DSH session id')
  }
  return value
}

function isoNow(now) {
  const value = now()
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) throw new TypeError('now must return a valid Date')
  return value.toISOString()
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
}

export function nextPlaythroughNumber(catalog, characterId) {
  let maximum = 0
  let legacyOrdinal = 0
  for (const playthrough of catalog?.playthroughs ?? []) {
    if (playthroughCharacterId(playthrough) !== characterId) continue
    legacyOrdinal += 1
    const explicit = playthrough?.ext?.pmpDshTavern?.playthroughNumber
    maximum = Math.max(maximum, Number.isSafeInteger(explicit) && explicit > 0 ? explicit : legacyOrdinal)
  }
  return maximum + 1
}

export async function renamePlaythrough(client, playthrough, title) {
  if (client == null) throw new TypeError('playClient.required')
  const normalized = typeof title === 'string' ? title.trim() : ''
  if (normalized === '' || normalized.length > 120) throw new TypeError('play.rename.invalid')
  const saved = await updateCatalog(client, current => {
    const freshIndex = current.playthroughs.findIndex(item => item.id === playthrough?.id && item.path === playthrough?.path)
    if (freshIndex < 0) throw new TypeError('play.rename.missing')
    const freshPlaythroughs = [...current.playthroughs]
    freshPlaythroughs[freshIndex] = { ...freshPlaythroughs[freshIndex], title: normalized }
    return { ...current, playthroughs: freshPlaythroughs }
  })
  const verified = saved?.playthroughs === undefined ? await client.getCatalog() : saved
  const renamed = verified.playthroughs.find(item => item.id === playthrough.id && item.path === playthrough.path)
  if (renamed?.title !== normalized) throw new Error('play.rename.verificationFailed')
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

export async function createCharacterPlaythrough(client, {
  character,
  selectionFromSessionId = null,
  configureSession = null,
  now = () => new Date(),
  randomUUID = () => globalThis.crypto.randomUUID(),
} = {}) {
  if (client == null) throw new TypeError('playClient.required')
  const characterId = safeSegment(character?.id, 'character.id')
  const createdAt = isoNow(now)
  const playthroughId = safeSegment(`playthrough-${randomUUID()}`, 'playthrough.id')
  const directory = `${characterId}/${playthroughId}`
  const path = `${directory}/timeline.json`
  const sourceId = typeof selectionFromSessionId === 'string' && selectionFromSessionId !== ''
    ? selectionFromSessionId
    : null
  const catalog = await catalogOrEmpty(client)
  const latest = latestCharacterPlaythrough(catalog, characterId)
  if (latest !== null && await playthroughIsReusable(client, latest)) {
    const existingRoot = rootSessionId(latest)
    if (existingRoot !== null) {
      if (typeof configureSession === 'function') await configureSession(existingRoot)
      await ensureCharacterSelection(client, existingRoot, characterId)
      return { sessionId: existingRoot, playthrough: latest, reused: true }
    }
    const created = await client.postSession(sourceId)
    const sessionId = safeSessionId(created?.sessionId)
    if (typeof configureSession === 'function') await configureSession(sessionId)
    await ensureCharacterSelection(client, sessionId, characterId)
    let attached
    const savedCatalog = await updateCatalog(client, fresh => {
      const index = fresh.playthroughs.findIndex(item => item.id === latest.id && item.path === latest.path)
      if (index < 0) throw new Error('playthrough.create.missingVacancy')
      const current = fresh.playthroughs[index]
      const currentRoot = rootSessionId(current)
      if (currentRoot !== null && currentRoot !== sessionId) throw new Error('playthrough.create.identityConflict')
      attached = {
        ...current,
        lastOpenedAt: createdAt,
        ext: {
          ...(current.ext ?? {}),
          pmpDshTavern: {
            ...(current.ext?.pmpDshTavern ?? {}),
            characterId,
            rootSessionId: sessionId,
          },
        },
      }
      const playthroughs = [...fresh.playthroughs]
      playthroughs[index] = attached
      return { ...fresh, playthroughs }
    })
    attached ??= savedCatalog?.playthroughs?.find(item => item.id === latest.id && item.path === latest.path)
    if (rootSessionId(attached) !== sessionId) throw new Error('playthrough vacancy attachment did not persist')
    return { sessionId, playthrough: attached, reused: true, reattached: true }
  }
  const created = await client.postSession(sourceId)
  const sessionId = safeSessionId(created?.sessionId)
  if (typeof configureSession === 'function') await configureSession(sessionId)
  await ensureCharacterSelection(client, sessionId, characterId)

  const playthrough = {
    id: playthroughId,
    path,
    title: '周目',
    lastOpenedAt: createdAt,
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId,
        playthroughNumber: 0,
      },
    },
  }

  await client.createDirs(directory)
  await client.putTimeline(playthrough, { nodes: [] })
  let saved
  const savedCatalog = await updateCatalog(client, fresh => {
    const existing = fresh.playthroughs.find(item => item.id === playthroughId && item.path === path)
    if (existing !== undefined) {
      if (existing.ext?.pmpDshTavern?.rootSessionId !== sessionId) throw new Error('playthrough.create.identityConflict')
      saved = existing
      return fresh
    }
    const playthroughNumber = nextPlaythroughNumber(fresh, characterId)
    const row = {
      ...playthrough,
      title: `${playthroughNumber}周目`,
      ext: {
        ...playthrough.ext,
        pmpDshTavern: { ...playthrough.ext.pmpDshTavern, playthroughNumber },
      },
    }
    saved = row
    return { ...fresh, playthroughs: [...fresh.playthroughs, row] }
  })
  const savedTimeline = await client.getTimeline(playthrough)
  saved ??= savedCatalog?.playthroughs?.find(item => item.id === playthroughId && item.path === path)
  if (saved?.ext?.pmpDshTavern?.rootSessionId !== sessionId || savedTimeline.nodes.length !== 0) {
    throw new Error('playthrough verification failed')
  }
  return { sessionId, playthrough: saved, reused: false }
}

export function createPlaythroughController(client, dependencies = {}) {
  const inFlight = new Map()
  let tail = Promise.resolve()
  return {
    create(args) {
      const characterId = safeSegment(args?.character?.id, 'character.id')
      const existing = inFlight.get(characterId)
      if (existing !== undefined) return existing
      const task = tail.catch(() => {}).then(() => createCharacterPlaythrough(client, {
        ...dependencies,
        ...args,
      }))
      tail = task
      inFlight.set(characterId, task)
      task.finally(() => {
        if (inFlight.get(characterId) === task) inFlight.delete(characterId)
      }).catch(() => {})
      return task
    },
  }
}
