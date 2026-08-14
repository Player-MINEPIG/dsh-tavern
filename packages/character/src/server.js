import { Buffer } from 'node:buffer'
import { characterStoreConstants } from './store.js'

export const CHARACTER_API_PREFIX = '/dsh-tavern/api/character'
export const MAX_CHARACTER_BODY_BYTES = characterStoreConstants.maxArtifactBytes

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function fileName(value, fallback) {
  if (typeof value !== 'string') return fallback
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return cleaned === '' ? fallback : cleaned
}

function attachment(value) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(value).replaceAll("'", '%27')}`
}

function sendArtifact(res, status, payload) {
  const body = typeof payload.body === 'string' ? Buffer.from(payload.body, 'utf8') : Buffer.from(payload.body)
  res.statusCode = status
  res.setHeader('Content-Type', payload.mediaType)
  res.setHeader('Content-Length', body.byteLength)
  res.setHeader('Content-Disposition', attachment(fileName(payload.fileName, 'character.bin')))
  if (payload.sha256 !== undefined) res.setHeader('ETag', `"sha256-${payload.sha256}"`)
  res.end(body)
}

function apiError(error) {
  const code = error?.code ?? (error instanceof TypeError || error instanceof URIError ? 'INVALID_CHARACTER_REQUEST' : 'CHARACTER_API_ERROR')
  const status = error?.status
    ?? (code === 'CHARACTER_NOT_FOUND' || code === 'ARTIFACT_NOT_FOUND' ? 404
      : code === 'CHARACTER_ID_EXISTS' ? 409
      : code === 'ARTIFACT_TOO_LARGE' ? 413
        : error instanceof TypeError || error instanceof URIError ? 400 : 500)
  return {
    status,
    payload: {
      ok: false,
      error: {
        code,
        message: error instanceof Error ? error.message : String(error),
        ...(typeof error?.field === 'string' ? { field: error.field } : {}),
      },
    },
  }
}

function readBytes(req, limit = MAX_CHARACTER_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let length = 0
    const chunks = []
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      length += chunk.length
      if (length > limit) {
        settled = true
        const error = new Error(`Character artifact exceeds the ${limit} byte request limit`)
        error.code = 'ARTIFACT_TOO_LARGE'
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
    req.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

async function readJson(req, limit = 1024 * 1024) {
  const bytes = await readBytes(req, limit)
  try {
    return bytes.length === 0 ? {} : JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new TypeError(`Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function characterRoute(path) {
  const match = /^\/dsh-tavern\/api\/characters\/([^/]+)(?:\/(artifact|json|world-book))?$/.exec(path)
  if (match === null) return null
  return { id: decodeURIComponent(match[1]), resource: match[2] }
}

function selectionPayload(store, sessionId, selectionPolicy) {
  const selection = selectionPolicy?.selection === undefined
    ? store.selection(sessionId)
    : selectionPolicy.selection(sessionId)
  if (selection === null) {
    return { selection: null, character: null }
  }
  const character = store.get(selection.characterCardId)
  return {
    selection,
    character: {
      id: character.id,
      name: character.name,
      sourceFormat: character.source?.format,
      specVersion: character.source?.specVersion,
    },
  }
}

export function createCharacterApiHandler(store, options = {}) {
  const onChange = options.onChange ?? (() => {})
  const beforeSelectionChange = options.beforeSelectionChange ?? (() => {})
  const selectionPolicy = options.selectionPolicy
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = req.method ?? 'GET'
      const route = characterRoute(path)

      if (method === 'GET' && path === '/dsh-tavern/api/characters') {
        return sendJson(res, 200, { ok: true, characters: store.list() })
      }

      if (method === 'POST' && path === '/dsh-tavern/api/characters/import') {
        const bytes = await readBytes(req)
        if (bytes.length === 0) throw new TypeError('Character import body is empty')
        const character = store.import(bytes, { fileName: fileName(url.searchParams.get('filename'), 'character') })
        onChange({ kind: 'character-imported', characterCardId: character.id })
        return sendJson(res, 201, {
          ok: true,
          character: store.list().find((item) => item.id === character.id),
          compatibility: character.compatibility,
        })
      }

      if (route !== null && method === 'GET' && route.resource === undefined) {
        return sendJson(res, 200, { ok: true, character: store.get(route.id) })
      }

      if (route !== null && method === 'GET' && route.resource === 'artifact') {
        const artifact = store.artifact(route.id)
        return sendArtifact(res, 200, { body: artifact.bytes, ...artifact })
      }

      if (route !== null && method === 'GET' && route.resource === 'json') {
        const json = store.json(route.id)
        return sendArtifact(res, 200, { body: json.text, mediaType: 'application/json; charset=utf-8', fileName: json.fileName })
      }

      if (route !== null && method === 'PATCH' && route.resource === 'world-book') {
        const body = await readJson(req, MAX_CHARACTER_BODY_BYTES)
        const character = store.updateCharacterBook(route.id, body.characterBook)
        onChange({ kind: 'character-world-book-updated', characterCardId: route.id })
        return sendJson(res, 200, { ok: true, character })
      }

      if (route !== null && method === 'DELETE' && route.resource === undefined) {
        store.get(route.id)
        store.delete(route.id)
        selectionPolicy?.clearResource?.('character-card', route.id)
        onChange({ kind: 'character-deleted', characterCardId: route.id })
        return sendJson(res, 200, { ok: true })
      }

      if (method === 'GET' && path === '/dsh-tavern/api/character-selection') {
        const sessionId = url.searchParams.get('sessionId')
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, sessionId, selectionPolicy) })
      }

      if (method === 'POST' && path === '/dsh-tavern/api/character-selection') {
        const body = await readJson(req)
        if (typeof body.sessionId !== 'string') throw new TypeError('sessionId must be a string')
        await beforeSelectionChange({
          sessionId: body.sessionId,
          characterCardId: body.characterCardId ?? null,
          character: body.character ?? {},
          selection: body.characterCardId === null ? null : body,
        })
        if (selectionPolicy?.select === undefined) {
          store.select(body.sessionId, body.characterCardId === null ? null : body)
        } else {
          await selectionPolicy.select(body.sessionId, body.characterCardId === null ? null : body)
        }
        onChange({ kind: 'character-selection-changed', sessionId: body.sessionId, characterCardId: body.characterCardId ?? null })
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, body.sessionId, selectionPolicy) })
      }

      return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'not found' } })
    } catch (error) {
      const response = apiError(error)
      return sendJson(res, response.status, response.payload)
    }
  }
}

export function installCharacterServerRoutes(ctx, store, options = {}) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return undefined
  return webServer.register({
    kind: 'prefix',
    path: CHARACTER_API_PREFIX,
    handler: createCharacterApiHandler(store, options),
  })
}
