import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DEFAULT_UI_LOCALE,
  SUPPORTED_UI_LOCALES,
  isSupportedUiLocale,
} from '../../ui-settings/src/locale-contract.js'

const SETTINGS_FILE = 'ui-settings.json'
const MAX_SETTINGS_BYTES = 1024
const MIN_SCALE = 0.75
const MAX_SCALE = 1.5
const SCALE_STEP = 0.05
const DEFAULT_UI_SETTINGS = Object.freeze({ schemaVersion: 1, locale: DEFAULT_UI_LOCALE, scale: 1 })

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneDefault() {
  return { ...DEFAULT_UI_SETTINGS }
}

function normalizeScale(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_SCALE || value > MAX_SCALE) {
    throw new TypeError(`scale must be a finite number between ${MIN_SCALE} and ${MAX_SCALE}`)
  }
  const stepped = Math.round(value / SCALE_STEP) * SCALE_STEP
  if (Math.abs(stepped - value) > 1e-9) throw new TypeError(`scale must use ${SCALE_STEP} increments`)
  return Number(stepped.toFixed(2))
}

export function normalizeUiSettings(value) {
  if (!isRecord(value)) throw new TypeError('UI settings must be an object')
  const allowed = new Set(['locale', 'scale'])
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected !== undefined) throw new TypeError(`Unsupported UI setting "${unexpected}"`)
  if (!isSupportedUiLocale(value.locale)) throw new TypeError(`locale must be one of: ${SUPPORTED_UI_LOCALES.join(', ')}`)
  return { schemaVersion: 1, locale: value.locale, scale: normalizeScale(value.scale) }
}

function readSettings(path) {
  try {
    if (statSync(path).size > MAX_SETTINGS_BYTES) return cloneDefault()
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return normalizeUiSettings({ locale: parsed?.locale, scale: parsed?.scale })
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError || error instanceof TypeError) return cloneDefault()
    throw error
  }
}

function atomicJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (Buffer.byteLength(text) > MAX_SETTINGS_BYTES) throw new TypeError('UI settings exceed the storage limit')
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(temporary, path)
  } catch (error) {
    try { unlinkSync(temporary) } catch {}
    throw error
  }
}

export class UiSettingsStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.path = join(this.storageDir, SETTINGS_FILE)
    mkdirSync(this.storageDir, { recursive: true })
    this.settings = readSettings(this.path)
  }

  get() {
    return { ...this.settings }
  }

  set(value) {
    const normalized = normalizeUiSettings(value)
    atomicJson(this.path, normalized)
    this.settings = normalized
    return this.get()
  }

  reset() {
    return this.set({ locale: DEFAULT_UI_SETTINGS.locale, scale: DEFAULT_UI_SETTINGS.scale })
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
        const error = new Error('UI settings request exceeds 1 KiB')
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

export function isUiSettingsApiPath(url) {
  return new URL(url ?? '/', 'http://localhost').pathname === '/dsh-tavern/api/ui-settings'
}

export function createUiSettingsApiHandler(store) {
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

export const uiSettingsConstants = Object.freeze({
  allowedLocales: [...SUPPORTED_UI_LOCALES],
  minScale: MIN_SCALE,
  maxScale: MAX_SCALE,
  scaleStep: SCALE_STEP,
  maxSettingsBytes: MAX_SETTINGS_BYTES,
  defaults: { ...DEFAULT_UI_SETTINGS },
})
