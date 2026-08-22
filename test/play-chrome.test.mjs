import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  apply,
  chromeConstants,
  createPlayApiHandler,
  normalizeChrome,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url, body, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const content = rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => resolve({
        status: res.statusCode,
        headers,
        body: payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('chrome defaults to native and PUT play survives a new store instance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-'))
  try {
    const store = new ChromeStore(directory)
    assert.deepEqual(store.get(), chromeConstants.defaults)
    assert.equal(store.set({ mode: 'play' }).mode, 'play')
    assert.equal(new ChromeStore(directory).get().mode, 'play')
    assert.equal(readFileSync(join(directory, chromeConstants.fileName), 'utf8').includes('session'), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('chrome rejects illegal modes and unknown fields', () => {
  assert.throws(() => normalizeChrome({ mode: 'red' }), /mode/)
  assert.throws(() => normalizeChrome({ mode: 'play', sessionId: 'no' }), /Unsupported/)
  assert.throws(() => normalizeChrome('play'), /object/)
})

test('GET /v2/chrome does not require JSON and POST /chrome is absent', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-api-'))
  try {
    const handler = createPlayApiHandler({ chromeStore: new ChromeStore(directory) })
    const fresh = await invoke(handler, { url: `${API_V2}/chrome` })
    assert.equal(fresh.status, 200)
    assert.equal(fresh.body.ok, true)
    assert.equal(fresh.body.mode, 'native')
    assert.equal(typeof fresh.body.revision, 'string')
    assert.notEqual(fresh.body.revision, '')

    const put = await invoke(handler, { method: 'PUT', url: `${API_V2}/chrome`, body: { mode: 'play' } })
    assert.equal(put.status, 200)
    assert.equal(put.body.mode, 'play')

    const bad = await invoke(handler, { method: 'PUT', url: `${API_V2}/chrome`, body: { mode: 'magic' } })
    assert.equal(bad.status, 400)

    const post = await invoke(handler, { method: 'POST', url: `${API_V2}/chrome`, body: { mode: 'play' } })
    assert.equal(post.status, 405)
    assert.equal(post.body.code, 'PLAY_METHOD_NOT_ALLOWED')

    const unknown = await invoke(handler, { url: `${API_V2}/not-a-route` })
    assert.equal(unknown.status, 404)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('chrome play and RP lock do not rewrite each other', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-rp-'))
  const ctx = {
    systemPrompt: { section: () => {} },
    on: () => {},
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }
  try {
    const store = apply(ctx, { storageDir: directory })
    store.sessionSelections.set('session-a', { rp: { active: true, source: 'command' } })
    store.chromeStore.set({ mode: 'play' })
    assert.equal(store.sessionSelections.get('session-a').rp.active, true)
    assert.equal(new ChromeStore(directory).get().mode, 'play')

    store.sessionSelections.set('session-a', { rp: { active: false, source: null } })
    assert.equal(store.chromeStore.get().mode, 'play')
    assert.equal(store.sessionSelections.get('session-a').rp.active, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('loader routes v2 chrome through the existing single secured API prefix', () => {
  const source = readFileSync(new URL('../packages/tavern-loader/src/index.js', import.meta.url), 'utf8')
  assert.match(source, /isPlayApiPath\(req\.url\)[\s\S]*playApi\(req, res\)/)
  assert.equal(source.match(/path: API_ROOT/g)?.length, 1)
  assert.equal(source.match(/secureTavernApi\(/g)?.length, 1)
  assert.doesNotMatch(source, /archiveSession/)
})

test('chrome store revisions and subscriptions only publish actual changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-events-'))
  try {
    const store = new ChromeStore(directory)
    const initial = store.get()
    const snapshots = []
    const secondSnapshots = []
    const dispose = store.subscribe(snapshot => {
      snapshots.push(snapshot)
      throw new Error('listener failure is isolated')
    })
    const disposeSecond = store.subscribe(snapshot => secondSnapshots.push(snapshot))
    assert.equal(store.set({ mode: 'native', revision: 'client-controlled' }).revision, initial.revision)
    assert.equal(snapshots.length, 0)
    const changed = store.set({ mode: 'play', revision: 'client-controlled' })
    assert.equal(snapshots.length, 1)
    assert.equal(secondSnapshots.length, 1)
    assert.equal(secondSnapshots[0].mode, 'play')
    assert.equal(secondSnapshots[0].revision, changed.revision)
    assert.notEqual(changed.revision, initial.revision)
    assert.notEqual(changed.revision, 'client-controlled')
    assert.equal(store.set({ mode: 'play' }).revision, changed.revision)
    dispose()
    dispose()
    disposeSecond()
    disposeSecond()
    store.set({ mode: 'native' })
    assert.equal(snapshots.length, 1)
    store.dispose()
    store.dispose()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('chrome events sends initial and changed snapshots, then cleans up on close', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-sse-'))
  try {
    const store = new ChromeStore(directory)
    const req = new EventEmitter()
    req.method = 'GET'
    const res = new EventEmitter()
    const headers = {}
    const chunks = []
    res.setHeader = (name, value) => { headers[name.toLowerCase()] = value }
    res.write = chunk => { chunks.push(String(chunk)); return true }
    res.flushHeaders = () => {}
    res.destroyed = false
    res.writableEnded = false
    let endCalls = 0
    res.end = () => { endCalls += 1; res.writableEnded = true }
    req.url = `${API_V2}/chrome/events`
    const handler = createPlayApiHandler({ chromeStore: store })
    await handler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(headers['content-type'], 'text/event-stream; charset=utf-8')
    assert.match(chunks[0], /event: chrome\/change/)
    assert.match(chunks[0], /"mode":"native"/)
    store.set({ mode: 'play' })
    assert.equal(chunks.length, 2)
    assert.match(chunks[1], /"mode":"play"/)
    req.emit('close')
    store.set({ mode: 'native' })
    assert.equal(endCalls, 0)
    assert.equal(chunks.length, 2)
    const bad = await invoke(handler, { method: 'POST', url: `${API_V2}/chrome/events` })
    assert.equal(bad.status, 405)
    assert.equal(bad.body.code, 'PLAY_METHOD_NOT_ALLOWED')
    store.dispose()
    assert.equal(chunks.length, 2)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('chrome events end and unsubscribe on store disposal or write failure', async () => {
  const firstDirectory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-dispose-'))
  const secondDirectory = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-chrome-write-failure-'))
  const exchange = ({ failAfter = Infinity } = {}) => {
    const req = new EventEmitter()
    const res = new EventEmitter()
    const chunks = []
    let writes = 0
    let endCalls = 0
    req.method = 'GET'
    req.url = `${API_V2}/chrome/events`
    res.setHeader = () => {}
    res.flushHeaders = () => {}
    res.destroyed = false
    res.writableEnded = false
    res.write = chunk => {
      if (writes >= failAfter) throw new Error('write failed')
      writes += 1
      chunks.push(String(chunk))
      return true
    }
    res.end = () => {
      endCalls += 1
      res.writableEnded = true
    }
    return { req, res, chunks, endCalls: () => endCalls }
  }
  try {
    const disposedStore = new ChromeStore(firstDirectory)
    const disposedExchange = exchange()
    await createPlayApiHandler({ chromeStore: disposedStore })(disposedExchange.req, disposedExchange.res)
    assert.equal(disposedExchange.chunks.length, 1)
    disposedStore.dispose()
    disposedStore.dispose()
    assert.equal(disposedExchange.endCalls(), 1)
    disposedStore.set({ mode: 'play' })
    assert.equal(disposedExchange.chunks.length, 1)

    const failedStore = new ChromeStore(secondDirectory)
    const failedExchange = exchange({ failAfter: 1 })
    await createPlayApiHandler({ chromeStore: failedStore })(failedExchange.req, failedExchange.res)
    assert.equal(failedExchange.chunks.length, 1)
    failedStore.set({ mode: 'play' })
    assert.equal(failedExchange.endCalls(), 1)
    failedStore.set({ mode: 'native' })
    assert.equal(failedExchange.chunks.length, 1)
    failedStore.dispose()
    assert.equal(failedExchange.endCalls(), 1)
  } finally {
    rmSync(firstDirectory, { recursive: true, force: true })
    rmSync(secondDirectory, { recursive: true, force: true })
  }
})
