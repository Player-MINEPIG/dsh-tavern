import { characterIdFromSelection } from './sidebar-model.js'
import { loadPlaythroughImportContext } from './import.js'

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
  if (sessionId === null) return false
  const timeline = await client.getTimeline(playthrough)
  if ((timeline?.nodes?.length ?? 0) > 0) return false

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
  const catalog = await catalogOrEmpty(client)
  const index = catalog.playthroughs.findIndex(item => item.id === playthrough?.id && item.path === playthrough?.path)
  if (index < 0) throw new TypeError('play.rename.missing')
  const playthroughs = [...catalog.playthroughs]
  playthroughs[index] = { ...playthroughs[index], title: normalized }
  await client.putCatalog({ ...catalog, playthroughs })
  const saved = await client.getCatalog()
  const renamed = saved.playthroughs.find(item => item.id === playthrough.id && item.path === playthrough.path)
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
    return { sessionId: rootSessionId(latest), playthrough: latest, reused: true }
  }
  const playthroughNumber = nextPlaythroughNumber(catalog, characterId)

  const created = await client.postSession(sourceId)
  const sessionId = safeSessionId(created?.sessionId)
  if (sourceId === null) {
    await client.putCharacterSelection(sessionId, characterId, { greetingIndex: 0 })
  }
  const selection = await client.getCharacterSelection(sessionId)
  if (characterIdFromSelection(selection) !== characterId) {
    throw new Error('playthrough character selection did not persist')
  }

  const playthrough = {
    id: playthroughId,
    path,
    title: `${playthroughNumber}周目`,
    lastOpenedAt: createdAt,
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId,
        playthroughNumber,
      },
    },
  }

  await client.createDirs(directory)
  await client.putTimeline(playthrough, { nodes: [] })
  await client.putCatalog({
    ...catalog,
    playthroughs: [...catalog.playthroughs, playthrough],
  })

  const [savedCatalog, savedTimeline] = await Promise.all([
    client.getCatalog(),
    client.getTimeline(playthrough),
  ])
  const saved = savedCatalog.playthroughs.find(item => item.id === playthroughId)
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
