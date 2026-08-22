import { playthroughCharacterId } from './schema.js'

export const SIDEBAR_LOAD_CONCURRENCY = 4

export function characterIdFromSelection(value) {
  const selection = value?.selection ?? value
  const id = selection?.characterCardId
  return typeof id === 'string' && id !== '' ? id : null
}

function rootSessionId(playthrough) {
  const id = playthrough?.ext?.pmpDshTavern?.rootSessionId
  return typeof id === 'string' && id !== '' ? id : null
}

function sessionTitle(session, id) {
  if (typeof session?.displayTitle === 'string' && session.displayTitle !== '') return session.displayTitle
  if (typeof session?.title === 'string' && session.title !== '') return session.title
  return id
}

function historicalCharacterName(playthrough, sessions, fallback) {
  const preserved = playthrough?.ext?.pmpDshTavern?.characterName
  if (typeof preserved === 'string' && preserved.trim() !== '') return preserved
  const root = rootSessionId(playthrough)
  if (root === null) return fallback
  const title = sessionTitle(sessions[root], root)
  const inferred = title.replace(/\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/, '').trim()
  return inferred !== '' && inferred !== root ? inferred : fallback
}

function normalizedCharacterName(value) {
  return String(value ?? '').trim().toLocaleLowerCase('zh-CN')
}

export function assessPlaythroughCharacterRelink({
  playthrough,
  target,
  characters = [],
  missingCharacters = [],
} = {}) {
  const reference = playthrough?.ext?.pmpDshTavern ?? {}
  const currentId = playthroughCharacterId(playthrough)
  if (typeof target?.id !== 'string' || target.id === '') return { automatic: false, reason: 'target-missing' }
  if (target.id === currentId) return { automatic: true, reason: 'unchanged' }

  if (typeof reference.characterSha256 === 'string' && reference.characterSha256 !== '') {
    const shaMatches = characters.filter(character => character.sha256 === reference.characterSha256)
    if (shaMatches.length === 1 && shaMatches[0].id === target.id) return { automatic: true, reason: 'sha256' }
  }

  const name = normalizedCharacterName(reference.characterName)
  if (name !== '') {
    const missingNameMatches = missingCharacters.filter(character => normalizedCharacterName(character.name) === name)
    const currentNameMatches = characters.filter(character => normalizedCharacterName(character.name) === name)
    const missingIdentityIsUnique = missingNameMatches.length === 0
      || (missingNameMatches.length === 1 && missingNameMatches[0].id === currentId)
    if (missingIdentityIsUnique && currentNameMatches.length === 1 && currentNameMatches[0].id === target.id) {
      return { automatic: true, reason: 'name' }
    }
  }
  return { automatic: false, reason: 'manual' }
}

function normalizedPath(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '')
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized
}

export function requiresSystemWorkspaceConfirmation(value) {
  const path = typeof value === 'string' ? value.replaceAll('\\', '/') : ''
  return /^c:\//i.test(path)
    || path === '/'
    || path === '/usr'
    || path.startsWith('/usr/')
    || path === '/System'
    || path.startsWith('/System/')
}

function timelineFor(timelines, playthrough) {
  return timelines?.[playthrough.path] ?? timelines?.[playthrough.id] ?? null
}

function playthroughMembers(playthrough, timeline) {
  const ids = new Set()
  const rootId = rootSessionId(playthrough)
  if (rootId !== null) ids.add(rootId)
  if (typeof timeline?.head?.sessionId === 'string' && timeline.head.sessionId !== '') {
    ids.add(timeline.head.sessionId)
  }
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node?.variants ?? []) {
      if (typeof variant?.sessionId === 'string' && variant.sessionId !== '') ids.add(variant.sessionId)
    }
  }
  return ids
}

export function sessionIdsInRpWorkspace({ workspace, workspaceItems = [], sessions = {} } = {}) {
  const ids = new Set()
  if (workspace?.selected !== true) return ids
  if (typeof workspace.workspaceId === 'string' && workspace.workspaceId !== '') {
    const item = workspaceItems.find(candidate => candidate?.workspaceId === workspace.workspaceId)
    if (item !== undefined) {
      for (const id of item.sessionIds ?? []) if (typeof id === 'string' && id !== '') ids.add(id)
      return ids
    }
  }
  const root = normalizedPath(workspace.rootPath)
  if (root === '') return ids
  for (const [id, session] of Object.entries(sessions)) {
    if (normalizedPath(session?.cwd) === root) ids.add(id)
  }
  return ids
}

export class SessionCharacterBindingCache {
  constructor() {
    this.entries = new Map()
    this.generation = 0
  }

  clear() {
    this.generation += 1
    this.entries.clear()
  }

  get(client, sessionId) {
    const cached = this.entries.get(sessionId)
    if (cached !== undefined) return cached.promise ?? Promise.resolve(cached.value)
    const generation = this.generation
    const readSelection = typeof client.getSelection === 'function'
      ? client.getSelection.bind(client)
      : client.getCharacterSelection.bind(client)
    const promise = readSelection(sessionId).then(characterIdFromSelection, () => null)
    this.entries.set(sessionId, { promise })
    promise.then(value => {
      if (this.generation === generation) this.entries.set(sessionId, { value })
    })
    return promise
  }
}

export async function loadSessionCharacterBindings(client, sessionIds, {
  concurrency = SIDEBAR_LOAD_CONCURRENCY,
  cache = new SessionCharacterBindingCache(),
} = {}) {
  if (client == null
    || (typeof client.getSelection !== 'function' && typeof client.getCharacterSelection !== 'function')) return {}
  const ids = [...new Set(sessionIds)].filter(id => typeof id === 'string' && id !== '')
  const result = {}
  let cursor = 0
  const worker = async () => {
    while (cursor < ids.length) {
      const index = cursor
      cursor += 1
      const id = ids[index]
      result[id] = await cache.get(client, id)
    }
  }
  const requested = Number.isFinite(concurrency) ? Math.floor(concurrency) : SIDEBAR_LOAD_CONCURRENCY
  const workerCount = Math.min(ids.length, Math.max(1, Math.min(SIDEBAR_LOAD_CONCURRENCY, requested)))
  await Promise.all(Array.from({ length: workerCount }, worker))
  return result
}

async function mapConcurrent(values, mapper, concurrency = SIDEBAR_LOAD_CONCURRENCY) {
  const result = new Array(values.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor
      cursor += 1
      result[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(values.length, concurrency) }, worker))
  return result
}

export async function loadPlaySidebarResources(client) {
  if (client == null) throw new TypeError('playClient.required')
  const [workspace, characterResponse] = await Promise.all([
    client.getWorkspace(),
    client.getCharacters(),
  ])
  const characters = Array.isArray(characterResponse?.characters) ? characterResponse.characters : []
  const missingCharacters = Array.isArray(characterResponse?.missingCharacters) ? characterResponse.missingCharacters : []
  const characterSorting = characterResponse?.sorting ?? { mode: 'updated' }
  if (workspace.selected !== true) return { workspace, characters, missingCharacters, characterSorting, catalog: { playthroughs: [] }, timelines: {}, diagnostics: [] }

  let catalog
  try {
    catalog = await client.getCatalog()
  } catch (reason) {
    if (reason?.code !== 'PLAY_PATH_NOT_FOUND') throw reason
    catalog = { playthroughs: [] }
  }
  const timelines = {}
  const diagnostics = []
  await mapConcurrent(catalog.playthroughs, async playthrough => {
    try {
      timelines[playthrough.path] = await client.getTimeline(playthrough)
    } catch (reason) {
      diagnostics.push({
        playthroughId: playthrough.id,
        path: playthrough.path,
        message: reason instanceof Error ? reason.message : String(reason),
      })
    }
  })
  return { workspace, characters, missingCharacters, characterSorting, catalog, timelines, diagnostics }
}

export function projectPlaySidebar({
  workspace = { selected: false },
  workspaceItems = [],
  characters = [],
  missingCharacters = [],
  catalog = { playthroughs: [] },
  timelines = {},
  sessions = {},
  sessionIds = [],
  archivedSessionIds = [],
  currentId = null,
  activePlaythroughId = null,
  sessionCharacters = {},
} = {}) {
  const archived = new Set(archivedSessionIds)
  const rpSessionIds = sessionIdsInRpWorkspace({ workspace, workspaceItems, sessions })
  const characterById = new Map()
  const missingById = new Map(missingCharacters.map(item => [item.id, item]))
  const missingCharacterById = new Map()
  const ensureCharacter = (id, name = id) => {
    if (!characterById.has(id) && !characters.some(item => item?.id === id)) {
      if (!missingCharacterById.has(id)) {
        const missing = missingById.get(id)
        missingCharacterById.set(id, {
          id,
          name: missing?.name ?? name,
          ...(typeof missing?.sha256 === 'string' ? { sha256: missing.sha256 } : {}),
          playthroughs: [],
          unassigned: [],
          missing: true,
        })
      }
      return missingCharacterById.get(id)
    }
    if (!characterById.has(id)) characterById.set(id, { id, name, playthroughs: [], unassigned: [] })
    return characterById.get(id)
  }
  for (const character of characters) {
    if (typeof character?.id !== 'string' || character.id === '') continue
    ensureCharacter(character.id, typeof character.name === 'string' && character.name !== '' ? character.name : character.id)
  }

  const claimedRpSessions = new Set()
  for (const playthrough of catalog.playthroughs ?? []) {
    const rootId = rootSessionId(playthrough)
    const characterId = playthroughCharacterId(playthrough)
    if (characterId === null) continue
    const characterReference = playthrough.ext?.pmpDshTavern ?? {}
    const allMembers = playthroughMembers(playthrough, timelineFor(timelines, playthrough))
    const members = [...allMembers].filter(id => rpSessionIds.has(id) && !archived.has(id))
    for (const id of members) claimedRpSessions.add(id)
    const characterGroup = ensureCharacter(characterId, historicalCharacterName(playthrough, sessions, characterId))
    if (characterGroup.missing === true && characterGroup.sha256 === undefined && typeof characterReference.characterSha256 === 'string') {
      characterGroup.sha256 = characterReference.characterSha256
    }
    characterGroup.playthroughs.push({
      ...playthrough,
      title: typeof playthrough.title === 'string' && playthrough.title !== '' ? playthrough.title : playthrough.id,
      rootSessionId: rootId !== null && members.includes(rootId) ? rootId : null,
      sessionIds: members,
      active: typeof activePlaythroughId === 'string' && activePlaythroughId !== ''
        ? playthrough.id === activePlaythroughId
        : currentId !== null && members.includes(currentId),
      missing: members.length === 0,
    })
  }

  const ids = sessionIds.length > 0 ? sessionIds : Object.keys(sessions)
  const otherSessions = []
  for (const id of ids) {
    const session = sessions[id]
    if (session == null || archived.has(id)) continue
    // DSH exposes durable subagents through the ordinary session mirror so their
    // transcripts can reuse the conversation machinery. They retain a distinct
    // public origin and belong in DSH's subagent catalog, not Tavern's ordinary
    // or unassigned-session groups. Ordinary forks do not carry this origin.
    if (session.origin === 'subagent') continue
    if (!rpSessionIds.has(id)) {
      otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: 'external' })
      continue
    }
    if (claimedRpSessions.has(id)) continue
    const characterId = sessionCharacters[id]
    if (typeof characterId === 'string' && characterId !== '') {
      ensureCharacter(characterId).unassigned.push({ id, title: sessionTitle(session, id), active: currentId === id })
      continue
    }
    otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: 'ordinary' })
  }

  return {
    workspaceReady: workspace.selected === true,
    rpSessionIds: [...rpSessionIds],
    playSessionIds: [...claimedRpSessions],
    characters: [...characterById.values()],
    missingCharacters: [...missingCharacterById.values()],
    otherSessions,
  }
}

export function playthroughFocusTarget({ focus, playthrough, rpSessionIds = [] } = {}) {
  const target = typeof focus?.sessionId === 'string'
    ? focus.sessionId
    : playthrough?.rootSessionId
  return typeof target === 'string' && new Set(rpSessionIds).has(target) ? target : null
}

export function shouldShowUnboundNotice({ workspace, session, selection } = {}) {
  if (workspace == null || session == null) return false
  if (workspace.selected !== true) return true
  const workspacePath = normalizedPath(workspace.rootPath)
  const sessionPath = normalizedPath(session.cwd)
  if (workspacePath === '' || sessionPath !== workspacePath) return true
  return characterIdFromSelection(selection) === null
}
