import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { secureTavernApi } from '../packages/tavern-loader/src/index.js'

function invoke(handler, {
  method = 'GET',
  url = '/pmp-dsh-tavern/api/v1/presets',
  headers = {},
  remoteAddress = '127.0.0.1',
} = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([])
    req.method = method
    req.url = url
    req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
    req.socket = { remoteAddress }
    const responseHeaders = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { responseHeaders[name.toLowerCase()] = value },
      end: (body = '') => resolve({
        status: res.statusCode,
        headers: responseHeaders,
        body: body === '' ? null : JSON.parse(String(body)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function successHandler(_req, res) {
  res.statusCode = 204
  res.end()
}

test('API security accepts loopback reads and emits defensive response headers', async () => {
  const response = await invoke(secureTavernApi(successHandler), {
    headers: { host: '127.0.0.1:53101' },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
})

test('API security rejects unapproved Host values and permits explicit network hosts', async () => {
  const blocked = await invoke(secureTavernApi(successHandler), {
    headers: { host: 'dsh.lan:53101' },
  })
  assert.equal(blocked.status, 403)
  assert.equal(blocked.body.code, 'TAVERN_API_HOST_FORBIDDEN')

  const permitted = await invoke(secureTavernApi(successHandler, { allowedHosts: ['dsh.lan'] }), {
    headers: { host: 'dsh.lan:53101' },
  })
  assert.equal(permitted.status, 204)
})

test('API security rejects non-loopback peers independently of spoofable Host headers', async () => {
  const blocked = await invoke(secureTavernApi(successHandler), {
    remoteAddress: '192.168.1.50',
    headers: { host: '127.0.0.1:53101' },
  })
  assert.equal(blocked.status, 403)
  assert.equal(blocked.body.code, 'TAVERN_API_REMOTE_FORBIDDEN')

  const missingPeer = await invoke(secureTavernApi(successHandler), {
    remoteAddress: null,
    headers: { host: '127.0.0.1:53101' },
  })
  assert.equal(missingPeer.status, 403)

  const mappedLoopback = await invoke(secureTavernApi(successHandler), {
    remoteAddress: '::ffff:127.0.0.42',
    headers: { host: 'localhost:53101' },
  })
  assert.equal(mappedLoopback.status, 204)

  const explicitRemote = await invoke(secureTavernApi(successHandler, {
    allowedHosts: ['dsh.lan'],
    allowRemoteClients: true,
  }), {
    remoteAddress: '192.168.1.50',
    headers: { host: 'dsh.lan:53101' },
  })
  assert.equal(explicitRemote.status, 204)
})

test('API security requires same-origin JSON writes', async () => {
  const handler = secureTavernApi(successHandler)
  const missingOrigin = await invoke(handler, {
    method: 'POST',
    headers: { host: 'localhost:53101', 'content-type': 'application/json' },
  })
  assert.equal(missingOrigin.status, 403)
  assert.equal(missingOrigin.body.code, 'TAVERN_API_ORIGIN_FORBIDDEN')

  const crossSite = await invoke(handler, {
    method: 'POST',
    headers: {
      host: 'localhost:53101',
      origin: 'https://attacker.example',
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
    },
  })
  assert.equal(crossSite.status, 403)

  const wrongType = await invoke(handler, {
    method: 'POST',
    headers: { host: 'localhost:53101', origin: 'http://localhost:53101', 'content-type': 'text/plain' },
  })
  assert.equal(wrongType.status, 415)
  assert.equal(wrongType.body.code, 'TAVERN_API_CONTENT_TYPE_REQUIRED')

  const accepted = await invoke(handler, {
    method: 'PUT',
    headers: { host: 'localhost:53101', origin: 'http://localhost:53101', 'content-type': 'application/json; charset=utf-8' },
  })
  assert.equal(accepted.status, 204)
})

test('character imports allow only the bounded binary and JSON media types', async () => {
  const handler = secureTavernApi(successHandler)
  const headers = { host: 'localhost:53101', origin: 'http://localhost:53101' }
  const png = await invoke(handler, {
    method: 'POST',
    url: '/pmp-dsh-tavern/api/v1/characters/import?filename=card.png',
    headers: { ...headers, 'content-type': 'image/png' },
  })
  assert.equal(png.status, 204)

  const form = await invoke(handler, {
    method: 'POST',
    url: '/pmp-dsh-tavern/api/v1/characters/import?filename=card.png',
    headers: { ...headers, 'content-type': 'multipart/form-data; boundary=x' },
  })
  assert.equal(form.status, 415)
})

test('standalone world-book imports remain same-origin JSON-only mutations', async () => {
  const handler = secureTavernApi(successHandler)
  const headers = { host: 'localhost:53101', origin: 'http://localhost:53101' }
  const json = await invoke(handler, {
    method: 'POST',
    url: '/pmp-dsh-tavern/api/v1/world-books/import?filename=book.json',
    headers: { ...headers, 'content-type': 'application/json' },
  })
  assert.equal(json.status, 204)

  const binary = await invoke(handler, {
    method: 'POST',
    url: '/pmp-dsh-tavern/api/v1/world-books/import?filename=book.json',
    headers: { ...headers, 'content-type': 'application/octet-stream' },
  })
  assert.equal(binary.status, 415)
})
