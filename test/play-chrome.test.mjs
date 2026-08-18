import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
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
