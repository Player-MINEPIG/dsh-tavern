import { Buffer } from 'node:buffer'
import { API_V1, escapeRegExp } from '../../identity.js'

const API_PREFIX = `${API_V1}/session-templates`
const TEMPLATE_ID_ROUTE = new RegExp(`^${escapeRegExp(API_PREFIX)}/([^/]+)$`)
const CONFIG_PREVIEW_PATH = `${API_V1}/session-configurations/preview`
const CONFIG_APPLY_PATH = `${API_V1}/session-configurations/apply`
const MAX_BODY_BYTES = 64 * 1024

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
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
        const error = new Error(`Session-template request exceeds the ${MAX_BODY_BYTES} byte limit`)
        error.code = 'SESSION_TEMPLATE_BODY_TOO_LARGE'
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

function templateRoute(path) {
  const match = TEMPLATE_ID_ROUTE.exec(path)
  return match === null ? null : decodeURIComponent(match[1])
}

function errorResponse(error) {
  const code = error?.code ?? (error instanceof TypeError || error instanceof URIError
    ? 'INVALID_SESSION_TEMPLATE_REQUEST'
    : 'SESSION_TEMPLATE_API_ERROR')
  const status = error?.status
    ?? (code === 'SESSION_TEMPLATE_NOT_FOUND' ? 404
      : code === 'SESSION_TEMPLATE_ID_EXISTS' || code === 'SESSION_TEMPLATE_LIMIT_REACHED' ? 409
        : code === 'SESSION_TEMPLATE_BODY_TOO_LARGE' || code === 'SESSION_TEMPLATE_STORAGE_LIMIT_REACHED' ? 413
          : error instanceof TypeError || error instanceof URIError ? 400 : 500)
  return {
    status,
    payload: {
      ok: false,
      error: {
        code,
        message: error instanceof Error ? error.message : String(error),
        ...(Array.isArray(error?.diagnostics) ? { diagnostics: error.diagnostics } : {}),
      },
    },
  }
}

function requireSessionId(value, field = 'sessionId') {
  if (typeof value !== 'string' || value === '') throw new TypeError(`${field} must be a non-empty string`)
  return value
}

export function createSessionTemplateApiHandler(store, configurations, options = {}) {
  const onChange = options.onChange ?? (() => {})
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = String(req.method ?? 'GET').toUpperCase()
      const id = templateRoute(path)

      if (method === 'GET' && path === API_PREFIX) {
        const templates = store.list().map(template => ({
          ...template,
          contents: configurations.contents(template.selection),
          diagnostics: configurations.diagnostics(template.selection),
        }))
        return sendJson(res, 200, { ok: true, selectedId: store.state.selectedId, templates })
      }
      if (method === 'POST' && path === API_PREFIX) {
        const body = await readJson(req)
        const template = configurations.createTemplate(body.name, requireSessionId(body.sourceSessionId, 'sourceSessionId'))
        onChange({ kind: 'session-template-created', templateId: template.id })
        return sendJson(res, 201, { ok: true, template })
      }
      if (method === 'POST' && path === `${API_PREFIX}/select`) {
        const body = await readJson(req)
        if (body.id !== null && typeof body.id !== 'string') throw new TypeError('id must be a string or null')
        const template = store.select(body.id)
        onChange({ kind: 'session-template-selected', templateId: template?.id ?? null })
        return sendJson(res, 200, { ok: true, selectedId: template?.id ?? null, template })
      }
      if (method === 'POST' && path === CONFIG_PREVIEW_PATH) {
        const body = await readJson(req)
        return sendJson(res, 200, { ok: true, ...configurations.preview(body.source) })
      }
      if (method === 'POST' && path === CONFIG_APPLY_PATH) {
        const body = await readJson(req)
        const targetSessionId = requireSessionId(body.targetSessionId, 'targetSessionId')
        const applied = configurations.apply(targetSessionId, body.source)
        onChange({ kind: 'session-configuration-applied', sessionId: targetSessionId })
        return sendJson(res, 200, { ok: true, ...applied })
      }
      if (id !== null && method === 'GET') {
        const template = store.get(id)
        return sendJson(res, 200, {
          ok: true,
          template,
          contents: configurations.contents(template.selection),
          diagnostics: configurations.diagnostics(template.selection),
        })
      }
      if (id !== null && method === 'PATCH') {
        const template = configurations.updateTemplate(id, await readJson(req))
        onChange({ kind: 'session-template-updated', templateId: id })
        return sendJson(res, 200, {
          ok: true,
          template,
          contents: configurations.contents(template.selection),
          diagnostics: configurations.diagnostics(template.selection),
        })
      }
      if (id !== null && method === 'DELETE') {
        store.delete(id)
        onChange({ kind: 'session-template-deleted', templateId: id })
        return sendJson(res, 200, { ok: true })
      }
      return sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'not found' } })
    } catch (error) {
      const response = errorResponse(error)
      return sendJson(res, response.status, response.payload)
    }
  }
}

export function isSessionTemplateApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === API_PREFIX
    || path.startsWith(`${API_PREFIX}/`)
    || path === CONFIG_PREVIEW_PATH
    || path === CONFIG_APPLY_PATH
}

export const sessionTemplateApiConstants = Object.freeze({
  apiPrefix: API_PREFIX,
  maxBodyBytes: MAX_BODY_BYTES,
})
