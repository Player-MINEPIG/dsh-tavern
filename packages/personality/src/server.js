import { API_V1, escapeRegExp, isUnderApiV1, isApiV1Path } from '../../identity.js'
import { fileName, readBytes, readJson, sendArtifact, sendJson } from '../../character/src/card-http.js'
import { readRevisionEvidence } from './evidence.js'
import { characterStoreConstants } from '../../character/src/store.js'

const libraryPath = `${API_V1}/personalities`
const selectionPath = `${API_V1}/personality-selection`
const cardRoute = new RegExp(`^${escapeRegExp(libraryPath)}/([^/]+)(?:/(json|png))?$`)

export function isPersonalityApiPath(url) {
  return isUnderApiV1(url, 'personalities') || isApiV1Path(url, 'personality-selection')
}

const evolutionRoute = new RegExp(`^${escapeRegExp(libraryPath)}/([^/]+)/evolution(/rollback)?$`)

const evidenceRoute = new RegExp(`^${escapeRegExp(libraryPath)}/([^/]+)/evolution/([1-9][0-9]*)/evidence$`)

function selectionPayload(store, sessionId, evolution) {
  const selected = store.selectedSummary(sessionId)
  return {
    ok: true,
    personalityId: selected?.id ?? null,
    notice: selected && evolution ? evolution.notice(selected.id) : null,
    personality: selected ? { id: selected.id, name: selected.name } : null,
  }
}

function sendCardError(res, error) {
  const status = error.status ?? (error.code === 'CHARACTER_NOT_FOUND' ? 404
    : error.code === 'CHARACTER_ID_EXISTS' ? 409
      : error instanceof TypeError || error instanceof URIError ? 400 : 500)
  return sendJson(res, status, { ok: false, error: {
    code: error.code ?? (status === 400 ? 'INVALID_PERSONALITY_REQUEST' : 'PERSONALITY_API_ERROR'),
    message: error.message,
  } })
}

export function createPersonalityApiHandler(store, { onChange = () => {}, isRunning = () => false, evolution, inspectSession, clearSidecars = () => {} } = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const method = req.method ?? 'GET'
      if (url.pathname === libraryPath && method === 'GET') {
        return sendJson(res, 200, { ok: true, personalities: store.list() })
      }
      if (url.pathname === libraryPath && method === 'POST') {
        const body = await readJson(req, 64 * 1024)
        const personality = store.create({ name: body.name })
        return sendJson(res, 201, { ok: true, personality })
      }
      if (url.pathname === `${libraryPath}/import` && method === 'POST') {
        const bytes = await readBytes(req)
        if (!bytes.length) throw new TypeError('Personality import body is empty')
        const personality = store.import(bytes, { fileName: fileName(url.searchParams.get('filename'), 'personality') })
        return sendJson(res, 201, { ok: true, personality, compatibility: personality.compatibility })
      }
      if (url.pathname === selectionPath && method === 'GET') {
        return sendJson(res, 200, selectionPayload(store, url.searchParams.get('sessionId'), evolution))
      }
      if (url.pathname === selectionPath && method === 'POST') {
        const { sessionId, personalityId, defaultIfUnbound } = await readJson(req)
        if (typeof sessionId !== 'string' || (personalityId !== null && typeof personalityId !== 'string')) {
          throw new TypeError('sessionId and a personalityId or null are required')
        }
        if (isRunning(sessionId)) {
          return sendJson(res, 409, { ok: false, error: { code: 'PERSONALITY_AGENT_RUNNING', message: 'Change the personality after the current turn finishes.' } })
        }
        if (defaultIfUnbound !== undefined && typeof defaultIfUnbound !== 'boolean') throw new TypeError('defaultIfUnbound must be a boolean')
        const applied = defaultIfUnbound === true
          ? store.selectDefault(sessionId, personalityId)
          : (store.select(sessionId, personalityId === null ? null : { characterCardId: personalityId }), true)
        if (applied) onChange()
        return sendJson(res, 200, { ...selectionPayload(store, sessionId, evolution), applied })
      }
      const ref = url.pathname.match(evidenceRoute)
      if (ref && evolution && method === 'GET') {
        const evidence = await readRevisionEvidence(evolution, decodeURIComponent(ref[1]), Number(ref[2]), inspectSession, AbortSignal.timeout(10000))
        return sendJson(res, 200, { ok: true, evidence })
      }
      const change = url.pathname.match(evolutionRoute)
      if (change && evolution) {
        const id = decodeURIComponent(change[1]), rollback = !!change[2]
        if (method === 'GET' && !rollback) return sendJson(res, 200, { ok: true, evolution: evolution.view(id) })
        if ((!rollback && method === 'PUT') || (rollback && method === 'POST')) {
          const state = evolution.mutate(id, rollback ? 'rollback' : 'config', await readJson(req, 16 * 1024))
          onChange()
          return sendJson(res, 200, { ok: true, evolution: state })
        }
      }
      const match = cardRoute.exec(url.pathname)
      if (match) {
        const id = decodeURIComponent(match[1])
        if (method === 'GET' && match[2] === 'json') {
          const card = store.json(id)
          return sendArtifact(res, 200, { body: card.text, mediaType: 'application/json; charset=utf-8', fileName: card.fileName })
        }
        if (method === 'GET' && match[2] === 'png') {
          const card = store.png(id)
          return sendArtifact(res, 200, { body: card.bytes, mediaType: card.mediaType, fileName: card.fileName })
        }
        if (!match[2] && method === 'GET') return sendJson(res, 200, { ok: true, personality: store.get(id) })
        if (!match[2] && method === 'PATCH') {
          const patch = await readJson(req, characterStoreConstants.maxCharacterDocumentBytes, { code: 'CHARACTER_DOCUMENT_TOO_LARGE', label: 'Personality edit' })
          const personality = store.update(id, patch)
          onChange()
          return sendJson(res, 200, { ok: true, personality })
        }
        if (!match[2] && method === 'DELETE') {
          try { store.delete(id) } catch (error) {
            if (error.code !== 'CHARACTER_NOT_FOUND') throw error
            // A failed sidecar unlink can be retried after the main resource disappeared.
            clearSidecars(id)
            throw error
          }
          clearSidecars(id)
          onChange()
          return sendJson(res, 200, { ok: true })
        }
      }
      return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'not found' } })
    } catch (error) {
      return sendCardError(res, error)
    }
  }
}
