import { httpError, readBoundedJson, sendJson } from './http.js'
import { deriveFocus, parseCatalogJson, parseTimelineJson } from './timeline.js'

const MAX_BODY_BYTES = 64 * 1024
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

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
  for (;;) {
    const result = await host.history({ sessionId, beforeSeq })
    const events = result?.events ?? []
    collected.unshift(...events)
    if (result?.hasMore !== true) break
    if (events.length === 0) {
      throw httpError(502, 'Host history cursor stalled: hasMore=true with an empty page', 'PLAY_HISTORY_CURSOR_STALLED')
    }
    const oldest = eventRecord(events[0])
    if (!Number.isSafeInteger(oldest?.seq)) {
      throw httpError(502, 'Host history cursor stalled: page has no valid oldest sequence', 'PLAY_HISTORY_CURSOR_STALLED')
    }
    if (beforeSeq !== undefined && oldest.seq >= beforeSeq) {
      throw httpError(502, 'Host history cursor stalled: oldest sequence did not move backward', 'PLAY_HISTORY_CURSOR_STALLED')
    }
    beforeSeq = oldest.seq
  }
  return collected
}

async function requireMutableImportContext(host, sessionId) {
  const binding = typeof host.getImportContextBinding === 'function'
    ? await host.getImportContextBinding(sessionId)
    : null
  if (binding?.state === 'consumed') {
    throw httpError(409, 'import context is locked after use', 'PLAY_IMPORT_CONTEXT_LOCKED')
  }
  const events = await readAllHistory(host, sessionId)
  const derived = typeof host.deriveMessages === 'function'
    ? await host.deriveMessages({ sessionId, events })
    : messagesFromEvents(events)
  const messages = derived ?? messagesFromEvents(events)
  if (hasOpenTurn(events) || messages.some(message => message?.role === 'user' || message?.role === 'assistant')) {
    throw httpError(409, 'import context is locked after conversation starts', 'PLAY_IMPORT_CONTEXT_LOCKED')
  }
  return binding
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
      const preparedImport = body?.importContextRef === undefined
        ? null
        : await host.prepareImportContext(body.importContextRef)
      const characterName = typeof host.characterName === 'function'
        ? host.characterName(sourceId)
        : null
      const title = typeof characterName === 'string' && characterName.trim() !== ''
        ? formatPlaySessionTitle(characterName, now())
        : undefined
      const created = await host.createSession({
        workspaceId: binding.workspaceId,
        cwd: binding.rootPath,
        title,
      })
      const sessionId = requireSessionId(created?.sessionId)
      if (preparedImport !== null) {
        host.bindImportContext(sessionId, preparedImport)
      }
      if (sourceId !== null && typeof host.copySelection === 'function') {
        host.copySelection(sourceId, sessionId)
      }
      return sendJson(res, 201, title === undefined ? { ok: true, sessionId } : { ok: true, sessionId, title })
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

    async importContext(req, res, sessionId, method) {
      requireSessionId(sessionId)
      if (typeof host.getImportContextBinding !== 'function') {
        throw httpError(501, 'Host import context is unavailable', 'PLAY_HOST_UNAVAILABLE')
      }
      if (method === 'GET') {
        const binding = await host.getImportContextBinding(sessionId)
        return sendJson(res, 200, { ok: true, binding })
      }
      await requireMutableImportContext(host, sessionId)
      if (method === 'DELETE') {
        if (typeof host.unbindImportContext !== 'function') {
          throw httpError(501, 'Host import context is unavailable', 'PLAY_HOST_UNAVAILABLE')
        }
        await host.unbindImportContext(sessionId)
        return sendJson(res, 200, { ok: true, binding: null })
      }
      const body = await readBoundedJson(req, MAX_BODY_BYTES)
      if (body?.reference === undefined) {
        throw httpError(400, 'reference is required', 'PLAY_IMPORT_CONTEXT_INVALID')
      }
      const prepared = await host.prepareImportContext(body.reference)
      const binding = await host.bindImportContext(sessionId, prepared)
      return sendJson(res, 200, { ok: true, binding })
    },

    async focus(req, res, searchParams) {
      requireBoundWorkspace(workspaceStore)
      const requested = searchParams.get('path')
      const { timeline } = await readTimelineForFocus(workspaceStore, requested)
      const focus = deriveFocus(timeline)
      return sendJson(res, 200, { ok: true, sessionId: focus.sessionId })
    },
  }
}

export const playSessionConstants = Object.freeze({
  sessionIdPattern: SESSION_ID_PATTERN,
  maxBodyBytes: MAX_BODY_BYTES,
})
