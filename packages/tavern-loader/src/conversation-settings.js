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

const SETTINGS_FILE = 'conversation-settings.json'
const MAX_SETTINGS_BYTES = 512
const MIN_SCALE = 0.75
const MAX_SCALE = 1.5
const SCALE_STEP = 0.05
const DEFAULT_CONVERSATION_SETTINGS = Object.freeze({
  schemaVersion: 1,
  textScale: 1,
  actionScale: 1,
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeScale(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_SCALE || value > MAX_SCALE) {
    throw new TypeError(`${field} must be a finite number between ${MIN_SCALE} and ${MAX_SCALE}`)
  }
  const stepped = Math.round(value / SCALE_STEP) * SCALE_STEP
  if (Math.abs(stepped - value) > 1e-9) throw new TypeError(`${field} must use ${SCALE_STEP} increments`)
  return Number(stepped.toFixed(2))
}

export function normalizeConversationSettings(value) {
  if (!isRecord(value)) throw new TypeError('Conversation settings must be an object')
  const allowed = new Set(['textScale', 'actionScale'])
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected !== undefined) throw new TypeError(`Unsupported conversation setting "${unexpected}"`)
  return {
    schemaVersion: 1,
    textScale: normalizeScale(value.textScale, 'textScale'),
    actionScale: normalizeScale(value.actionScale, 'actionScale'),
  }
}

function defaults() {
  return { ...DEFAULT_CONVERSATION_SETTINGS }
}

function readSettings(path) {
  try {
    if (statSync(path).size > MAX_SETTINGS_BYTES) return defaults()
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return normalizeConversationSettings({
      textScale: parsed?.textScale,
      actionScale: parsed?.actionScale,
    })
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError || error instanceof TypeError) return defaults()
    throw error
  }
}

function atomicJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (Buffer.byteLength(text) > MAX_SETTINGS_BYTES) throw new TypeError('Conversation settings exceed the storage limit')
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

export class ConversationSettingsStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.path = join(this.storageDir, SETTINGS_FILE)
    mkdirSync(this.storageDir, { recursive: true })
    this.settings = readSettings(this.path)
  }

  get() { return { ...this.settings } }

  set(value) {
    const normalized = normalizeConversationSettings(value)
    atomicJson(this.path, normalized)
    this.settings = normalized
    return this.get()
  }

  reset() {
    return this.set({
      textScale: DEFAULT_CONVERSATION_SETTINGS.textScale,
      actionScale: DEFAULT_CONVERSATION_SETTINGS.actionScale,
    })
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
      if (bytes > MAX_SETTINGS_BYTES) {
        const error = new Error('Conversation settings request exceeds 512 bytes')
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

export function isConversationSettingsApiPath(url) {
  return new URL(url ?? '/', 'http://localhost').pathname === `${API_V1}/conversation-settings`
}

export function createConversationSettingsApiHandler(store) {
  return async (req, res) => {
    try {
      const method = String(req.method ?? 'GET').toUpperCase()
      if (method === 'GET') return sendJson(res, 200, { ok: true, settings: store.get() })
      if (method === 'PUT') return sendJson(res, 200, { ok: true, settings: store.set(await readBoundedJson(req)) })
      if (method === 'DELETE') return sendJson(res, 200, { ok: true, settings: store.reset() })
      return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    } catch (error) {
      const status = error?.status ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500)
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export const conversationSettingsConstants = Object.freeze({
  minScale: MIN_SCALE,
  maxScale: MAX_SCALE,
  scaleStep: SCALE_STEP,
  maxSettingsBytes: MAX_SETTINGS_BYTES,
  defaults: defaults(),
})
