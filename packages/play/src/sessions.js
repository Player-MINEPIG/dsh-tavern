import { httpError, readBoundedJson, sendJson } from './http.js'
import { deriveFocus, parseCatalogJson, parseTimelineJson } from './timeline.js'

const MAX_BODY_BYTES = 64 * 1024
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const MAX_HISTORY_PAGES = 32

function requireSessionId(value) {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    throw httpError(400, 'Invalid session id', 'PLAY_SESSION_INVALID')
  }
  return value
}

export function hasOpenTurn(events) {
  let open = false
  if (!Array.isArray(events)) return false
  for (const entry of events) {
    const event = entry?.event ?? entry
    if (event?.type === 'turn/start') open = true
    else if (event?.type === 'turn/end') open = false
  }
  return open
}

export function eventRecord(entry) {
  return entry?.event ?? entry
}

export function projectMessages(messages, events) {
  const seqById = new Map()
  for (const entry of events ?? []) {
    const event = eventRecord(entry)
    const id = event?.data?.id ?? event?.data?.message?.id
    if (typeof id === 'string' && Number.isSafeInteger(event.seq)) seqById.set(id, event.seq)
  }
  return (messages ?? []).map(message => ({
    id: message.id,
    role: message.role,
    content: message.content,
    seq: seqById.get(message.id) ?? null,
  }))
}

export function messagesFromEvents(events) {
  const messages = []
  for (const entry of events ?? []) {
    const event = eventRecord(entry)
    if (event?.type !== 'user/message' && event?.type !== 'assistant/message') continue
    const message = event.data?.role ? event.data : event.data?.message
    if (typeof message?.id === 'string') messages.push(message)
  }
  return messages
}

export function formatPlaySessionTitle(characterName, now = new Date()) {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ')
  const name = typeof characterName === 'string' && characterName.trim() !== '' ? characterName.trim() : 'Play'
  return `${name} ${stamp}`
}

async function readAllHistory(host, sessionId) {
  const collected = []
  let beforeSeq
  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const result = await host.history({ sessionId, beforeSeq })
    const events = result?.events ?? []
    collected.unshift(...events)
    if (result?.hasMore !== true) break
    const oldest = eventRecord(events[0])
    if (!Number.isSafeInteger(oldest?.seq)) break
    beforeSeq = oldest.seq
  }
  return collected
}

function requireBoundWorkspace(workspaceStore) {
  const binding = workspaceStore.get()
  if (typeof binding.rootPath !== 'string' || binding.rootPath === '') {
    throw httpError(409, 'play workspace root is not bound', 'PLAY_WORKSPACE_UNBOUND')
  }
  return binding
}

async function readTimelineForFocus(workspaceStore, relativePath) {
  const path = relativePath
    ?? workspaceStore.get().activeTimelinePath
    ?? null
  if (path === null) {
    try {
      const catalog = parseCatalogJson(workspaceStore.readFile('catalog.json').content)
      const opened = [...catalog.playthroughs].sort((left, right) => String(right.lastOpenedAt ?? '').localeCompare(String(left.lastOpenedAt ?? '')))[0]
      if (opened?.path) return { path: opened.path, timeline: parseTimelineJson(workspaceStore.readFile(opened.path).content) }
    } catch (error) {
      if (error?.status === 409 || error?.code === 'PLAY_PATH_NOT_FOUND' || error?.code === 'PLAY_CATALOG_INVALID') {
        return { path: null, timeline: { nodes: [] } }
      }
      throw error
    }
    return { path: null, timeline: { nodes: [] } }
  }
  return { path, timeline: parseTimelineJson(workspaceStore.readFile(path).content) }
}

export function createSessionApiHandler({ host, workspaceStore, now = () => new Date() } = {}) {
  if (host === undefined) throw new TypeError('host is required')
  if (workspaceStore === undefined) throw new TypeError('workspaceStore is required')

  return {
    async create(req, res) {
      const body = await readBoundedJson(req, MAX_BODY_BYTES)
      const binding = requireBoundWorkspace(workspaceStore)
      const sourceId = body?.selectionFromSessionId === undefined || body.selectionFromSessionId === null
        ? null
        : requireSessionId(body.selectionFromSessionId)
      const characterName = sourceId !== null && typeof host.characterName === 'function'
        ? host.characterName(sourceId)
        : (typeof host.characterName === 'function' ? host.characterName(null) : null)
      const title = formatPlaySessionTitle(characterName, now())
      const created = await host.createSession({
        workspaceId: binding.workspaceId,
        cwd: binding.rootPath,
        title,
      })
      const sessionId = requireSessionId(created?.sessionId)
      if (sourceId !== null && typeof host.copySelection === 'function') {
        host.copySelection(sourceId, sessionId)
      }
      return sendJson(res, 201, { ok: true, sessionId, title })
    },

    async branch(req, res, sessionId) {
      const body = await readBoundedJson(req, MAX_BODY_BYTES)
      requireSessionId(sessionId)
      if (!Number.isSafeInteger(body?.atEventId) || body.atEventId < 0) {
        throw httpError(400, 'atEventId must be a non-negative event seq', 'PLAY_EVENT_INVALID')
      }
      const created = await host.forkSession({ sessionId, atSeq: body.atEventId })
      return sendJson(res, 201, { ok: true, sessionId: requireSessionId(created?.sessionId) })
    },

    async userMessage(req, res, sessionId) {
      const body = await readBoundedJson(req, MAX_BODY_BYTES)
      requireSessionId(sessionId)
      if (typeof body?.text !== 'string') throw httpError(400, 'text must be a string', 'PLAY_MESSAGE_INVALID')
      await host.promptSession({
        sessionId,
        mode: 'queue',
        text: body.text,
      })
      return sendJson(res, 200, { ok: true, accepted: true })
    },

    async messages(_req, res, sessionId) {
      requireSessionId(sessionId)
      const events = await readAllHistory(host, sessionId)
      const derived = typeof host.deriveMessages === 'function'
        ? await host.deriveMessages({ sessionId, events })
        : messagesFromEvents(events)
      return sendJson(res, 200, {
        ok: true,
        messages: projectMessages(derived ?? messagesFromEvents(events), events),
        incompleteTurn: hasOpenTurn(events),
      })
    },

    async focus(req, res, searchParams) {
      requireBoundWorkspace(workspaceStore)
      const requested = searchParams.get('path')
      const { path, timeline } = await readTimelineForFocus(workspaceStore, requested)
      const focus = deriveFocus(timeline)
      return sendJson(res, 200, { ok: true, sessionId: focus.sessionId, path, nodeId: focus.nodeId })
    },
  }
}

export const playSessionConstants = Object.freeze({
  sessionIdPattern: SESSION_ID_PATTERN,
  maxBodyBytes: MAX_BODY_BYTES,
})
