import { Buffer } from 'node:buffer'

const MAX_BODY_BYTES = 256 * 1024

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function apiError(error) {
  const code = error?.code ?? (error instanceof TypeError || error instanceof URIError ? 'INVALID_USER_REQUEST' : 'USER_API_ERROR')
  const status = error?.status
    ?? (code === 'USER_NOT_FOUND' ? 404
      : code === 'USER_ID_EXISTS' ? 409
        : error instanceof TypeError || error instanceof URIError ? 400 : 500)
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
  const match = /^\/dsh-tavern\/api\/users\/([^/]+)$/.exec(path)
  return match === null ? null : decodeURIComponent(match[1])
}

function selectionPayload(store, sessionId, selectionPolicy) {
  const selection = selectionPolicy.selection(sessionId)
  if (selection === null) return { selection: null, user: null }
  return { selection, user: store.get(selection.userId) }
}

export function createUserApiHandler(store, options = {}) {
  const onChange = options.onChange ?? (() => {})
  const beforeSelectionChange = options.beforeSelectionChange ?? (() => {})
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
      const id = userRoute(path)

      if (method === 'GET' && path === '/dsh-tavern/api/users') {
        return sendJson(res, 200, { ok: true, users: store.list() })
      }
      if (method === 'POST' && path === '/dsh-tavern/api/users') {
        const user = store.create(await readJson(req))
        onChange({ kind: 'user-created', userId: user.id })
        return sendJson(res, 201, { ok: true, user })
      }
      if (id !== null && method === 'GET') {
        return sendJson(res, 200, { ok: true, user: store.get(id) })
      }
      if (id !== null && method === 'PATCH') {
        const user = store.update(id, await readJson(req))
        onChange({ kind: 'user-updated', userId: id })
        return sendJson(res, 200, { ok: true, user })
      }
      if (id !== null && method === 'DELETE') {
        store.delete(id)
        selectionPolicy.clearResource?.('user', id)
        onChange({ kind: 'user-deleted', userId: id })
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'GET' && path === '/dsh-tavern/api/user-selection') {
        const sessionId = url.searchParams.get('sessionId')
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, sessionId, selectionPolicy) })
      }
      if (method === 'POST' && path === '/dsh-tavern/api/user-selection') {
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
