import test from 'node:test'
import assert from 'node:assert/strict'
import { tavernFetch } from '../packages/client/src/api-fetch.js'
const path = '/pmp-dsh-tavern/api/v1/users'
test('desktop writes use a process token, refresh once after Host restart, and cannot leak to other paths', async () => {
  const oldFetch = globalThis.fetch, oldLocation = globalThis.location
  const calls = []; let tokenReads = 0, writes = 0
  globalThis.location = { protocol: 'dsh-app:' }
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/request-token')) { tokenReads++; return Response.json({ token: String(tokenReads).repeat(64) }) }
    writes++
    if (writes === 1) return Response.json({ code: 'TAVERN_API_ORIGIN_FORBIDDEN' }, { status: 403 })
    return Response.json({ ok: true })
  }
  try {
    assert.equal((await tavernFetch(path, { method: 'POST', body: '{}' })).ok, true)
    assert.equal(tokenReads, 2); assert.equal(writes, 2)
    assert.equal(calls[0].options.headers['X-Tavern-Client'], 'embedded')
    assert.equal(calls[1].options.headers.get('X-Tavern-Request-Token'), '1'.repeat(64))
    assert.equal(calls[3].options.headers.get('X-Tavern-Request-Token'), '2'.repeat(64))
    await assert.rejects(tavernFetch('https://example.com/pmp-dsh-tavern/api/v1/users', { method: 'POST' }), /Invalid Tavern API path/)
    assert.equal(calls.length, 4)
    globalThis.location = { protocol: 'http:' }
    await tavernFetch(path, { method: 'POST', body: '{}' })
    assert.equal(calls.at(-1).options.headers, undefined)
  } finally { globalThis.fetch = oldFetch; if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation }
})
