import { Buffer } from 'node:buffer'
import { characterStoreConstants } from './store.js'

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

export function fileName(value, fallback) {
  if (typeof value !== 'string') return fallback
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return cleaned === '' ? fallback : cleaned
}

function attachment(value) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(value).replaceAll("'", '%27')}`
}

export function sendArtifact(res, status, payload) {
  const body = typeof payload.body === 'string' ? Buffer.from(payload.body, 'utf8') : Buffer.from(payload.body)
  res.statusCode = status
  res.setHeader('Content-Type', payload.mediaType)
  res.setHeader('Content-Length', body.byteLength)
  res.setHeader('Content-Disposition', attachment(fileName(payload.fileName, 'character.bin')))
  if (payload.sha256 !== undefined) res.setHeader('ETag', `"sha256-${payload.sha256}"`)
  res.end(body)
}

export function readBytes(req, limit = characterStoreConstants.maxArtifactBytes, options = {}) {
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

export async function readJson(req, limit = 1024 * 1024, options = {}) {
  const bytes = await readBytes(req, limit, options)
  try {
    return bytes.length === 0 ? {} : JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new TypeError(`Invalid JSON request: ${error instanceof Error ? error.message : String(error)}`)
  }
}
