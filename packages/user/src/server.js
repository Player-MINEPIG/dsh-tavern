import { Buffer } from 'node:buffer'
import { API_V1, escapeRegExp } from '../../identity.js'

const MAX_BODY_BYTES = 256 * 1024
const USER_ID_ROUTE = new RegExp(`^${escapeRegExp(API_V1)}/users/([^/]+)(?:/(world-books))?$`)

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function apiError(error) {
  const code = error?.code ?? (error instanceof TypeError || error instanceof URIError ? 'INVALID_USER_REQUEST' : 'USER_API_ERROR')
  const knownStatus = {
    USER_NOT_FOUND: 404,
    WORLD_BOOK_NOT_FOUND: 404,
    USER_ID_EXISTS: 409,
    USER_WORLD_BOOK_BINDING_LIMIT_REACHED: 409,
    USER_WORLD_BOOK_BINDING_STORAGE_LIMIT_REACHED: 413,
  }[code]
  const status = error?.status ?? knownStatus ?? (error instanceof TypeError || error instanceof URIError ? 400 : 500)
  return {
    status,
    payload: { ok: false, error: { code, message: error instanceof Error ? error.message : String(error) } },
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let length = 0
    const chunks = []
    let settled = false
    req.on('data', chunk => {
      if (settled) return
      length += chunk.length
      if (length > MAX_BODY_BYTES) {
        settled = true
        const error = new Error(`User request exceeds the ${MAX_BODY_BYTES} byte limit`)
        error.code = 'USER_BODY_TOO_LARGE'
        error.status = 413
        reject(error)
        req.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      try {
        const bytes = Buffer.concat(chunks)
        resolve(bytes.length === 0 ? {} : JSON.parse(bytes.toString('utf8')))
      } catch (error) {
        reject(new TypeError(`Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

function userRoute(path) {
  const match = USER_ID_ROUTE.exec(path)
  return match === null ? null : { id: decodeURIComponent(match[1]), resource: match[2] }
}

function selectionPayload(store, sessionId, selectionPolicy) {
  const selection = selectionPolicy.selection(sessionId)
  if (selection === null) return { selection: null, user: null }
  return { selection, user: store.get(selection.userId) }
}

function worldBookBindingPayload(userId, worldBookBindingPolicy) {
  if (worldBookBindingPolicy === null) throw new Error('User world-book binding policy is not installed')
  return {
    binding: {
      userId,
      worldBookIds: worldBookBindingPolicy.selection(userId),
    },
  }
}

function worldBookIdsBody(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('User world-book binding request must be an object')
  }
  const unexpected = Object.keys(value).find(key => key !== 'worldBookIds')
  if (unexpected !== undefined) throw new TypeError(`Unsupported user world-book binding field "${unexpected}"`)
  if (!Array.isArray(value.worldBookIds)) throw new TypeError('worldBookIds must be an array')
  return value.worldBookIds
}

export function createUserApiHandler(store, options = {}) {
  const onChange = options.onChange ?? (() => {})
  const beforeSelectionChange = options.beforeSelectionChange ?? (() => {})
  const worldBookBindingPolicy = options.worldBookBindingPolicy ?? null
  const selectionPolicy = options.selectionPolicy ?? {
    selection: () => null,
    select: () => null,
    clearResource: () => false,
  }
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = String(req.method ?? 'GET').toUpperCase()
      const matched = userRoute(path)

      if (method === 'GET' && path === `${API_V1}/users`) {
        return sendJson(res, 200, { ok: true, users: store.list() })
      }
      if (method === 'POST' && path === `${API_V1}/users`) {
        const user = store.create(await readJson(req))
        onChange({ kind: 'user-created', userId: user.id })
        return sendJson(res, 201, { ok: true, user })
      }
      if (matched !== null && matched.resource === 'world-books' && method === 'GET') {
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(matched.id, worldBookBindingPolicy) })
      }
      if (matched !== null && matched.resource === 'world-books' && method === 'PUT') {
        if (worldBookBindingPolicy === null) throw new Error('User world-book binding policy is not installed')
        const worldBookIds = await worldBookBindingPolicy.select(matched.id, worldBookIdsBody(await readJson(req)))
        onChange({ kind: 'user-world-book-binding-changed', userId: matched.id, worldBookIds })
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(matched.id, worldBookBindingPolicy) })
      }
      if (matched !== null && matched.resource === undefined && method === 'GET') {
        return sendJson(res, 200, { ok: true, user: store.get(matched.id) })
      }
      if (matched !== null && matched.resource === undefined && method === 'PATCH') {
        const user = store.update(matched.id, await readJson(req))
        onChange({ kind: 'user-updated', userId: matched.id })
        return sendJson(res, 200, { ok: true, user })
      }
      if (matched !== null && matched.resource === undefined && method === 'DELETE') {
        store.delete(matched.id)
        selectionPolicy.clearResource?.('user', matched.id)
        onChange({ kind: 'user-deleted', userId: matched.id })
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'GET' && path === `${API_V1}/user-selection`) {
        const sessionId = url.searchParams.get('sessionId')
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, sessionId, selectionPolicy) })
      }
      if (method === 'POST' && path === `${API_V1}/user-selection`) {
        const body = await readJson(req)
        if (typeof body.sessionId !== 'string') throw new TypeError('sessionId must be a string')
        if (body.userId !== null && typeof body.userId !== 'string') throw new TypeError('userId must be a string or null')
        await beforeSelectionChange({ sessionId: body.sessionId, userId: body.userId ?? null })
        await selectionPolicy.select(body.sessionId, body.userId === null ? null : { userId: body.userId })
        onChange({ kind: 'user-selection-changed', sessionId: body.sessionId, userId: body.userId ?? null })
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, body.sessionId, selectionPolicy) })
      }
      return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'not found' } })
    } catch (error) {
      const response = apiError(error)
      return sendJson(res, response.status, response.payload)
    }
  }
}

export const userApiConstants = Object.freeze({ maxBodyBytes: MAX_BODY_BYTES })
