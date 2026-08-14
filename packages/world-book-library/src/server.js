import { Buffer } from 'node:buffer'
import { worldBookStoreConstants } from './store.js'

export const WORLD_BOOK_API_PREFIX = '/dsh-tavern/api/world-book'
export const MAX_WORLD_BOOK_BODY_BYTES = worldBookStoreConstants.maxArtifactBytes

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function attachment(value) {
  const cleaned = String(value ?? 'world-book.json').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255) || 'world-book.json'
  return `attachment; filename*=UTF-8''${encodeURIComponent(cleaned).replaceAll("'", '%27')}`
}

function readBytes(req, limit = MAX_WORLD_BOOK_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let length = 0
    const chunks = []
    let settled = false
    req.on('data', chunk => {
      if (settled) return
      length += chunk.length
      if (length > limit) {
        settled = true
        const error = new Error(`World-book request exceeds the ${limit} byte limit`)
        error.code = 'WORLD_BOOK_ARTIFACT_TOO_LARGE'
        error.status = 413
        reject(error)
        req.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
    req.on('error', error => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

async function readJson(req) {
  const bytes = await readBytes(req)
  try {
    return bytes.length === 0 ? {} : JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new TypeError(`Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function route(path) {
  const match = /^\/dsh-tavern\/api\/world-books\/([^/]+)(?:\/(json))?$/.exec(path)
  if (match === null) return null
  return { id: decodeURIComponent(match[1]), resource: match[2] }
}

function apiError(error) {
  const code = error?.code ?? (error instanceof TypeError || error instanceof URIError ? 'INVALID_WORLD_BOOK_REQUEST' : 'WORLD_BOOK_API_ERROR')
  const status = error?.status
    ?? (code === 'WORLD_BOOK_NOT_FOUND' ? 404
      : code === 'WORLD_BOOK_ID_EXISTS' ? 409
        : code === 'WORLD_BOOK_ARTIFACT_TOO_LARGE' ? 413
          : error instanceof TypeError || error instanceof URIError ? 400 : 500)
  return {
    status,
    payload: {
      ok: false,
      error: { code, message: error instanceof Error ? error.message : String(error) },
    },
  }
}

function selectionPayload(store, sessionId, policy) {
  if (typeof sessionId !== 'string') throw new TypeError('sessionId must be a string')
  const worldBookIds = policy.selection(sessionId)
  const catalog = new Map(store.list().map(item => [item.id, item]))
  return {
    selection: { worldBookIds },
    worldBooks: worldBookIds.map(id => catalog.get(id) ?? { id, missing: true }),
  }
}

export function createWorldBookApiHandler(store, options = {}) {
  const onChange = options.onChange ?? (() => {})
  const beforeSelectionChange = options.beforeSelectionChange ?? (() => {})
  const selectionPolicy = options.selectionPolicy
  if (selectionPolicy?.selection === undefined || selectionPolicy?.select === undefined) {
    throw new TypeError('World-book API requires a session selection policy')
  }

  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = String(req.method ?? 'GET').toUpperCase()
      const matched = route(path)

      if (method === 'GET' && path === '/dsh-tavern/api/world-books') {
        return sendJson(res, 200, { ok: true, worldBooks: store.list() })
      }
      if (method === 'POST' && path === '/dsh-tavern/api/world-books') {
        const body = await readJson(req)
        const document = store.create({ name: body.name })
        onChange({ kind: 'world-book-created', worldBookId: document.id })
        return sendJson(res, 201, { ok: true, worldBook: document })
      }
      if (method === 'POST' && path === '/dsh-tavern/api/world-books/import') {
        const bytes = await readBytes(req)
        if (bytes.length === 0) throw new TypeError('World-book import body is empty')
        const document = store.import(bytes, { fileName: url.searchParams.get('filename') ?? 'world-book.json' })
        onChange({ kind: 'world-book-imported', worldBookId: document.id })
        return sendJson(res, 201, { ok: true, worldBook: document })
      }
      if (matched !== null && method === 'GET' && matched.resource === undefined) {
        return sendJson(res, 200, { ok: true, worldBook: store.get(matched.id) })
      }
      if (matched !== null && method === 'GET' && matched.resource === 'json') {
        const exported = store.export(matched.id)
        const body = Buffer.from(exported.text, 'utf8')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Content-Length', body.byteLength)
        res.setHeader('Content-Disposition', attachment(exported.fileName))
        res.setHeader('ETag', `"sha256-${exported.sha256}"`)
        return res.end(body)
      }
      if (matched !== null && method === 'PATCH' && matched.resource === undefined) {
        const document = store.update(matched.id, await readJson(req))
        onChange({ kind: 'world-book-updated', worldBookId: document.id })
        return sendJson(res, 200, { ok: true, worldBook: document })
      }
      if (matched !== null && method === 'DELETE' && matched.resource === undefined) {
        store.get(matched.id)
        store.delete(matched.id)
        selectionPolicy.clearResource?.('world-book', matched.id)
        onChange({ kind: 'world-book-deleted', worldBookId: matched.id })
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'GET' && path === '/dsh-tavern/api/world-book-selection') {
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, url.searchParams.get('sessionId'), selectionPolicy) })
      }
      if (method === 'POST' && path === '/dsh-tavern/api/world-book-selection') {
        const body = await readJson(req)
        if (typeof body.sessionId !== 'string') throw new TypeError('sessionId must be a string')
        await beforeSelectionChange({ sessionId: body.sessionId, worldBookIds: body.worldBookIds })
        const worldBookIds = await selectionPolicy.select(body.sessionId, body.worldBookIds)
        onChange({ kind: 'world-book-selection-changed', sessionId: body.sessionId, worldBookIds })
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, body.sessionId, selectionPolicy) })
      }
      return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'not found' } })
    } catch (error) {
      const response = apiError(error)
      return sendJson(res, response.status, response.payload)
    }
  }
}
