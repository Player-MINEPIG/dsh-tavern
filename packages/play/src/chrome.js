import { randomUUID } from 'node:crypto'
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
  revision: 'initial',
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneDefault() {
  return { ...DEFAULT_CHROME }
}

function revisionValue(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : undefined
}

export function normalizeChrome(value) {
  if (!isRecord(value)) throw new TypeError('chrome must be an object')
  const allowed = new Set(['mode', 'revision'])
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected !== undefined) throw new TypeError('Unsupported chrome field "' + unexpected + '"')
  if (!CHROME_MODES.includes(value.mode)) {
    throw new TypeError('mode must be one of: ' + CHROME_MODES.join(', '))
  }
  return {
    schemaVersion: 1,
    mode: value.mode,
    revision: revisionValue(value.revision) ?? cloneDefault().revision,
  }
}

function readChrome(path) {
  try {
    const parsed = readJsonFile(path, MAX_CHROME_BYTES)
    return normalizeChrome({ mode: parsed?.mode, revision: parsed?.revision })
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
    this.listeners = new Set()
    this.disposeListeners = new Set()
    this.disposed = false
  }

  get() {
    return Object.freeze({ ...this.settings })
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function')
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.listeners.delete(listener)
    }
  }

  onDispose(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function')
    if (this.disposed) {
      listener()
      return () => {}
    }
    this.disposeListeners.add(listener)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.disposeListeners.delete(listener)
    }
  }

  set(value) {
    const normalized = normalizeChrome(value)
    if (normalized.mode === this.settings.mode) return this.get()
    normalized.revision = randomUUID()
    atomicJson(this.path, normalized, MAX_CHROME_BYTES)
    this.settings = normalized
    for (const listener of [...this.listeners]) {
      try { listener(this.get()) } catch {}
    }
    return this.get()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const listener of [...this.disposeListeners]) {
      try { listener() } catch {}
    }
    this.disposeListeners.clear()
    this.listeners.clear()
  }
}

function writeSse(res, event, snapshot) {
  const payload = JSON.stringify({ mode: snapshot.mode, revision: snapshot.revision })
  res.write('event: ' + event + '\ndata: ' + payload + '\n\n')
}

export function createChromeEventsHandler(store) {
  return (req, res, { method } = {}) => {
    const verb = String(method ?? req.method ?? 'GET').toUpperCase()
    if (verb !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
    if (typeof res.write !== 'function') throw new TypeError('SSE response is unavailable')

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    let closed = false
    let dispose = () => {}
    let disposeStore = () => {}
    let keepAlive
    const close = ({ endResponse = false } = {}) => {
      if (closed) return
      closed = true
      dispose()
      disposeStore()
      if (keepAlive !== undefined) clearInterval(keepAlive)
      if (endResponse && !res.writableEnded && !res.destroyed && typeof res.end === 'function') {
        try { res.end() } catch {}
      }
    }
    const onClose = () => close()
    req.once?.('close', onClose)
    req.once?.('aborted', onClose)
    res.once?.('close', onClose)
    dispose = store.subscribe(snapshot => {
      if (closed || res.destroyed) return
      try { writeSse(res, 'chrome/change', snapshot) } catch { close({ endResponse: true }) }
    })
    disposeStore = store.onDispose?.(() => close({ endResponse: true })) ?? (() => {})
    try { writeSse(res, 'chrome/change', store.get()) } catch {
      close({ endResponse: true })
      return
    }
    keepAlive = setInterval(() => {
      if (closed || res.destroyed || store.disposed) return close()
      try { res.write(': keep-alive\n\n') } catch { close({ endResponse: true }) }
    }, 25_000)
    keepAlive.unref?.()
  }
}

export function createChromeApiHandler(store) {
  return async (req, res, { method } = {}) => {
    const verb = String(method ?? req.method ?? 'GET').toUpperCase()
    if (verb === 'GET') {
      const snapshot = store.get()
      return sendJson(res, 200, { ok: true, mode: snapshot.mode, revision: snapshot.revision })
    }
    if (verb === 'PUT') {
      const body = await readBoundedJson(req, MAX_CHROME_BYTES)
      const snapshot = store.set(body)
      return sendJson(res, 200, { ok: true, mode: snapshot.mode, revision: snapshot.revision })
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
