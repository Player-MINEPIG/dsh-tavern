import { Buffer } from 'node:buffer'
import { API_V1, escapeRegExp } from '../../identity.js'
import { characterStoreConstants } from './store.js'

export const CHARACTER_API_PREFIX = `${API_V1}/character`
const CHARACTER_ID_ROUTE = new RegExp(`^${escapeRegExp(API_V1)}/characters/([^/]+)(?:/(json|png|world-book|world-books|regex-scripts))?$`)
export const MAX_CHARACTER_BODY_BYTES = characterStoreConstants.maxArtifactBytes
export const MAX_CHARACTER_WORLD_BOOK_BODY_BYTES = characterStoreConstants.maxEditedWorldBookBytes

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
    ?? (code === 'CHARACTER_NOT_FOUND' || code === 'WORLD_BOOK_NOT_FOUND' ? 404
      : code === 'CHARACTER_ID_EXISTS' ? 409
      : code === 'ARTIFACT_TOO_LARGE' || code === 'CHARACTER_DOCUMENT_TOO_LARGE' ? 413
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

function readBytes(req, limit = MAX_CHARACTER_BODY_BYTES, options = {}) {
  return new Promise((resolve, reject) => {
    let length = 0
    const chunks = []
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      length += chunk.length
      if (length > limit) {
        settled = true
        const label = options.label ?? 'Character artifact'
        const error = new Error(`${label} exceeds the ${limit} byte request limit`)
        error.code = options.code ?? 'ARTIFACT_TOO_LARGE'
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

async function readJson(req, limit = 1024 * 1024, options = {}) {
  const bytes = await readBytes(req, limit, options)
  try {
    return bytes.length === 0 ? {} : JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new TypeError(`Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function characterRoute(path) {
  const match = CHARACTER_ID_ROUTE.exec(path)
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

function worldBookIdsBody(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Character world-book binding request must be an object')
  }
  const unexpected = Object.keys(value).find(key => key !== 'worldBookIds')
  if (unexpected !== undefined) throw new TypeError(`Unsupported character world-book binding field "${unexpected}"`)
  if (!Array.isArray(value.worldBookIds)) throw new TypeError('worldBookIds must be an array')
  return value.worldBookIds
}

function worldBookBindingPayload(characterCardId, policy) {
  if (policy?.selection === undefined) throw new Error('Character world-book binding policy is not installed')
  return { binding: { characterCardId, worldBookIds: policy.selection(characterCardId) } }
}

export function createCharacterApiHandler(store, options = {}) {
  const onChange = options.onChange ?? (() => {})
  const beforeSelectionChange = options.beforeSelectionChange ?? (() => {})
  const selectionPolicy = options.selectionPolicy
  const worldBookBindingPolicy = options.worldBookBindingPolicy ?? null
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = req.method ?? 'GET'
      const route = characterRoute(path)

      if (method === 'GET' && path === `${API_V1}/characters`) {
        return sendJson(res, 200, { ok: true, characters: store.list() })
      }

      if (method === 'POST' && path === `${API_V1}/characters`) {
        const body = await readJson(req, 64 * 1024)
        const character = store.create({ name: body.name })
        onChange({ kind: 'character-created', characterCardId: character.id })
        return sendJson(res, 201, {
          ok: true,
          character: store.list().find((item) => item.id === character.id),
        })
      }

      if (method === 'POST' && path === `${API_V1}/characters/import`) {
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

      if (route !== null && method === 'GET' && route.resource === 'json') {
        const json = store.json(route.id)
        return sendArtifact(res, 200, { body: json.text, mediaType: 'application/json; charset=utf-8', fileName: json.fileName })
      }

      if (route !== null && method === 'GET' && route.resource === 'png') {
        const png = store.png(route.id)
        return sendArtifact(res, 200, { body: png.bytes, mediaType: png.mediaType, fileName: png.fileName })
      }

      if (route !== null && method === 'GET' && route.resource === 'regex-scripts') {
        return sendJson(res, 200, { ok: true, regexScripts: store.regexScripts(route.id) })
      }

      if (route !== null && method === 'GET' && route.resource === 'world-books') {
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(route.id, worldBookBindingPolicy) })
      }

      if (route !== null && method === 'PATCH' && route.resource === undefined) {
        const body = await readJson(req, characterStoreConstants.maxCharacterDocumentBytes, {
          code: 'CHARACTER_DOCUMENT_TOO_LARGE',
          label: 'Character edit',
        })
        const character = store.update(route.id, body)
        onChange({ kind: 'character-updated', characterCardId: route.id })
        return sendJson(res, 200, { ok: true, character })
      }

      if (route !== null && method === 'PATCH' && route.resource === 'world-book') {
        const body = await readJson(req, MAX_CHARACTER_WORLD_BOOK_BODY_BYTES, {
          code: 'CHARACTER_WORLD_BOOK_TOO_LARGE',
          label: 'Character Book edit',
        })
        const character = store.updateCharacterBook(route.id, body.characterBook)
        onChange({ kind: 'character-world-book-updated', characterCardId: route.id })
        return sendJson(res, 200, { ok: true, character })
      }

      if (route !== null && method === 'PUT' && route.resource === 'regex-scripts') {
        const body = await readJson(req, characterStoreConstants.maxCharacterDocumentBytes, {
          code: 'CHARACTER_DOCUMENT_TOO_LARGE',
          label: 'Character regex scripts',
        })
        const character = store.replaceRegexScripts(route.id, body.regexScripts)
        onChange({ kind: 'character-regex-scripts-updated', characterCardId: route.id })
        return sendJson(res, 200, { ok: true, regexScripts: store.regexScripts(character.id) })
      }

      if (route !== null && method === 'PUT' && route.resource === 'world-books') {
        if (worldBookBindingPolicy?.select === undefined) throw new Error('Character world-book binding policy is not installed')
        const worldBookIds = await worldBookBindingPolicy.select(route.id, worldBookIdsBody(await readJson(req)))
        onChange({ kind: 'character-world-book-binding-changed', characterCardId: route.id, worldBookIds })
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(route.id, worldBookBindingPolicy) })
      }

      if (route !== null && method === 'DELETE' && route.resource === undefined) {
        store.get(route.id)
        store.delete(route.id)
        selectionPolicy?.clearResource?.('character-card', route.id)
        onChange({ kind: 'character-deleted', characterCardId: route.id })
        return sendJson(res, 200, { ok: true })
      }

      if (method === 'GET' && path === `${API_V1}/character-selection`) {
        const sessionId = url.searchParams.get('sessionId')
        return sendJson(res, 200, { ok: true, ...selectionPayload(store, sessionId, selectionPolicy) })
      }

      if (method === 'POST' && path === `${API_V1}/character-selection`) {
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
