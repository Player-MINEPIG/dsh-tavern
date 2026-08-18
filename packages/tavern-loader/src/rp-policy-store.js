import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { API_V1 } from '../../identity.js'
import { DEFAULT_RP_SECTION } from './rp-mode.js'

const POLICY_FILE = 'rp-policy.json'
const MAX_POLICY_BYTES = 16 * 1024
const SCHEMA_VERSION = 1

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeRpPolicySection(value, fallback = DEFAULT_RP_SECTION) {
  if (value === undefined || value === null) {
    if (typeof fallback !== 'string') throw new TypeError('RP policy fallback must be a string')
    return fallback.replace(/\r\n/g, '\n')
  }
  if (typeof value !== 'string') throw new TypeError('RP policy must be a string')
  const section = value.replace(/\r\n/g, '\n')
  if (section.trim() === '') return ''
  if (Buffer.byteLength(section, 'utf8') > MAX_POLICY_BYTES) {
    throw new TypeError(`RP policy exceeds the ${MAX_POLICY_BYTES} byte limit`)
  }
  return section
}

function cloneDefault(fallback) {
  return normalizeRpPolicySection(undefined, fallback)
}

function readPolicy(path, fallback) {
  try {
    if (statSync(path).size > MAX_POLICY_BYTES) return { section: cloneDefault(fallback), custom: false }
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (!isRecord(parsed)) return { section: cloneDefault(fallback), custom: false }
    return { section: normalizeRpPolicySection(parsed.section, fallback), custom: true }
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError || error instanceof TypeError) {
      return { section: cloneDefault(fallback), custom: false }
    }
    throw error
  }
}

function atomicJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (Buffer.byteLength(text, 'utf8') > MAX_POLICY_BYTES) throw new TypeError('RP policy exceeds the storage limit')
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

export class RpPolicyStore {
  constructor(storageDir, { defaultSection = DEFAULT_RP_SECTION } = {}) {
    this.storageDir = resolve(storageDir)
    this.path = join(this.storageDir, POLICY_FILE)
    this.defaultSection = cloneDefault(defaultSection)
    mkdirSync(this.storageDir, { recursive: true })
    const loaded = readPolicy(this.path, this.defaultSection)
    this.section = loaded.section
    this.custom = loaded.custom
  }

  get() {
    return this.section
  }

  view() {
    return {
      section: this.section,
      defaultSection: this.defaultSection,
      custom: this.custom === true,
    }
  }

  set(section) {
    if (typeof section !== 'string') throw new TypeError('RP policy must be a string')
    const normalized = normalizeRpPolicySection(section, this.defaultSection)
    atomicJson(this.path, { schemaVersion: SCHEMA_VERSION, section: normalized })
    this.section = normalized
    this.custom = true
    return this.get()
  }

  reset() {
    try { unlinkSync(this.path) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    this.section = this.defaultSection
    this.custom = false
    return this.get()
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function readBoundedJson(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0
    const chunks = []
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', chunk => {
      bytes += chunk.length
      if (bytes > MAX_POLICY_BYTES) {
        const error = new Error(`RP policy request exceeds ${MAX_POLICY_BYTES} bytes`)
        error.status = 413
        fail(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        settled = true
        resolve(parsed)
      } catch (error) {
        error.status = 400
        fail(error)
      }
    })
    req.on('error', fail)
  })
}

export function isRpPolicyApiPath(url) {
  return new URL(url ?? '/', 'http://localhost').pathname === `${API_V1}/rp-policy`
}

export function createRpPolicyApiHandler(store, { onChange = () => {} } = {}) {
  return async (req, res) => {
    try {
      const method = String(req.method ?? 'GET').toUpperCase()
      if (method === 'GET') return sendJson(res, 200, { ok: true, ...store.view() })
      if (method === 'PUT') {
        const body = await readBoundedJson(req)
        store.set(body.section)
        onChange()
        return sendJson(res, 200, { ok: true, ...store.view() })
      }
      if (method === 'DELETE') {
        store.reset()
        onChange()
        return sendJson(res, 200, { ok: true, ...store.view() })
      }
      return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    } catch (error) {
      const status = error?.status ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500)
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export const rpPolicyStoreConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  maxPolicyBytes: MAX_POLICY_BYTES,
  fileName: POLICY_FILE,
})
