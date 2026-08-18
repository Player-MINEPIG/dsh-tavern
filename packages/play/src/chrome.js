import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { atomicJson, readJsonFile } from './atomic-json.js'
import { httpError, readBoundedJson, sendJson } from './http.js'

const CHROME_FILE = 'chrome.json'
const MAX_CHROME_BYTES = 1024
const CHROME_MODES = Object.freeze(['native', 'play'])
const DEFAULT_CHROME = Object.freeze({
  schemaVersion: 1,
  mode: 'native',
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneDefault() {
  return { ...DEFAULT_CHROME }
}

export function normalizeChrome(value) {
  if (!isRecord(value)) throw new TypeError('chrome must be an object')
  const allowed = new Set(['mode'])
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected !== undefined) throw new TypeError(`Unsupported chrome field "${unexpected}"`)
  if (!CHROME_MODES.includes(value.mode)) {
    throw new TypeError(`mode must be one of: ${CHROME_MODES.join(', ')}`)
  }
  return {
    schemaVersion: 1,
    mode: value.mode,
  }
}

function readChrome(path) {
  try {
    const parsed = readJsonFile(path, MAX_CHROME_BYTES)
    return normalizeChrome({ mode: parsed?.mode })
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError || error instanceof TypeError) {
      return cloneDefault()
    }
    throw error
  }
}

export class ChromeStore {
  constructor(storageDir) {
    this.storageDir = resolve(storageDir)
    this.path = join(this.storageDir, CHROME_FILE)
    mkdirSync(this.storageDir, { recursive: true })
    this.settings = readChrome(this.path)
  }

  get() {
    return { ...this.settings }
  }

  set(value) {
    const normalized = normalizeChrome(value)
    atomicJson(this.path, normalized, MAX_CHROME_BYTES)
    this.settings = normalized
    return this.get()
  }
}

export function createChromeApiHandler(store) {
  return async (req, res, { method } = {}) => {
    const verb = String(method ?? req.method ?? 'GET').toUpperCase()
    if (verb === 'GET') return sendJson(res, 200, { ok: true, mode: store.get().mode })
    if (verb === 'PUT') {
      const body = await readBoundedJson(req, MAX_CHROME_BYTES)
      return sendJson(res, 200, { ok: true, mode: store.set(body).mode })
    }
    throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
  }
}

export const chromeConstants = Object.freeze({
  modes: [...CHROME_MODES],
  maxBytes: MAX_CHROME_BYTES,
  defaults: { ...DEFAULT_CHROME },
  fileName: CHROME_FILE,
})
