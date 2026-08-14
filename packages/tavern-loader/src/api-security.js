import { isIP } from 'node:net'

const API_ROOT = '/dsh-tavern/api'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const JSON_MEDIA_TYPE = 'application/json'
const CHARACTER_IMPORT_MEDIA_TYPES = new Set([
  JSON_MEDIA_TYPE,
  'application/octet-stream',
  'image/png',
])

function sendError(res, status, code, message) {
  const body = JSON.stringify({ ok: false, code, error: message })
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function header(req, name) {
  const value = req.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function hostnameFromAuthority(authority) {
  if (typeof authority !== 'string' || authority.trim() === '') return null
  try {
    return new URL(`http://${authority}`).hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return null
  }
}

function normalizeAllowedHosts(input) {
  if (!Array.isArray(input)) return new Set()
  return new Set(input.map(host => String(host).trim().toLowerCase()).filter(Boolean))
}

function isAllowedHost(hostname, allowedHosts) {
  if (hostname === null) return false
  if (LOOPBACK_HOSTS.has(hostname)) return true
  if (isIP(hostname) !== 0 && hostname.startsWith('127.')) return true
  return allowedHosts.has(hostname)
}

function isMutation(method) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

function requestMediaType(req) {
  return String(header(req, 'content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
}

function isCharacterImport(url) {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname === `${API_ROOT}/characters/import`
  } catch {
    return false
  }
}

function sameOrigin(req) {
  const origin = header(req, 'origin')
  const authority = header(req, 'host')
  if (typeof origin !== 'string' || typeof authority !== 'string') return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.host.toLowerCase() === authority.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Protects the browser-facing API from accidental network exposure, DNS
 * rebinding and cross-site writes. This is an origin boundary, not user
 * authentication: trusted local processes can still make HTTP requests.
 */
export function secureTavernApi(handler, options = {}) {
  if (typeof handler !== 'function') throw new TypeError('handler must be a function')
  const allowedHosts = normalizeAllowedHosts(options.allowedHosts)

  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')

    const hostname = hostnameFromAuthority(header(req, 'host'))
    if (!isAllowedHost(hostname, allowedHosts)) {
      return sendError(
        res,
        403,
        'TAVERN_API_HOST_FORBIDDEN',
        'dsh-tavern API is limited to loopback hosts unless security.allowedHosts explicitly permits this host.',
      )
    }

    const method = String(req.method ?? 'GET').toUpperCase()
    if (isMutation(method)) {
      if (header(req, 'sec-fetch-site') === 'cross-site' || !sameOrigin(req)) {
        return sendError(res, 403, 'TAVERN_API_ORIGIN_FORBIDDEN', 'Mutation requests must come from the same DSH Web origin.')
      }
      const mediaType = requestMediaType(req)
      const allowedTypes = isCharacterImport(req.url) ? CHARACTER_IMPORT_MEDIA_TYPES : new Set([JSON_MEDIA_TYPE])
      if (!allowedTypes.has(mediaType)) {
        return sendError(res, 415, 'TAVERN_API_CONTENT_TYPE_REQUIRED', `Unsupported Content-Type ${JSON.stringify(mediaType || '(missing)')}.`)
      }
    }

    return handler(req, res)
  }
}

export const apiSecurityConstants = Object.freeze({
  apiRoot: API_ROOT,
  loopbackHosts: [...LOOPBACK_HOSTS],
  characterImportMediaTypes: [...CHARACTER_IMPORT_MEDIA_TYPES],
})
