import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import { validatePlayDocument } from '../packages/play/src/index.js'
import { apply } from '../packages/tavern-loader/src/index.js'

const ORIGIN = 'http://127.0.0.1:3080'

/**
 * Drives the real secured loader route. Every mutation must carry a same-origin
 * `Origin` and a JSON content-type, exactly like the browser; the fake mirrors
 * that admission rule instead of bypassing it.
 */
function invoke(handler, { method = 'GET', url, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = url
    req.socket = { remoteAddress: '127.0.0.1' }
    req.headers = { host: '127.0.0.1:3080', origin: ORIGIN, 'content-type': 'application/json', ...headers }
    const res = {
      statusCode: 200,
      setHeader() {},
      end(payload = '') {
        resolve({ status: res.statusCode, body: payload === '' ? null : JSON.parse(String(payload)) })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function variant(id, sessionId) {
  return { id, sessionId, startEventId: 1, endEventId: 2 }
}

function sampleTimeline() {
  return {
    nodes: [
      { id: 'n-root', kind: 'qa', displayOverride: null, parentVariantId: null, adoptedVariantId: 'v-root', variants: [variant('v-root', 'session-root')] },
      { id: 'n-swipe', kind: 'qa', displayOverride: null, parentVariantId: 'v-root', adoptedVariantId: 'v-target', variants: [variant('v-target', 'session-target')] },
    ],
  }
}

/**
 * A full loader with the HTTP route reachable, a bound play root, and one
 * playthrough (`pt`) bound to `session-root` + `session-target`.
 */
async function withLoader({ allowPlaythroughDelete, agents, workspaceRegistry } = {}, run) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-loader-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-delete-loader-root-'))
  let handler
  const ctx = {
    systemPrompt: { section: () => {} },
    on: () => {},
    emit: () => {},
    effect: (fn) => { fn() },
    inject: (names, callback) => {
      if (names.includes('webServer')) {
        callback({ webServer: { register: ({ handler: route }) => { handler = route; return () => {} } } })
      }
    },
    get: (name) => {
      if (name === 'agents') return agents
      if (name === 'workspaceRegistry') return workspaceRegistry
      // Binding a play root registers it with the Host; the delete path itself
      // must not need any further Host seam.
      if (name === 'workspaceController') return { create: async () => ({}) }
      if (name === 'sessionController') return { create: async () => ({}) }
      return undefined
    },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  }

  try {
    const store = apply(ctx, { storageDir: pluginDir, allowPlaythroughDelete })
    const workspaceStore = store.playWorkspaceStore
    await workspaceStore.bindRoot(playRoot)
    workspaceStore.createDir('card/pt')
    workspaceStore.writeFile('card/pt/timeline.json', JSON.stringify(sampleTimeline()), {
      expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument,
    })
    workspaceStore.writeFile('card/pt/archive/floors/0001.json', '{"_floor":1,"mes":"floor"}\n', { validate: validatePlayDocument })
    workspaceStore.writeFile('catalog.json', JSON.stringify({
      playthroughs: [{
        id: 'pt',
        path: 'card/pt/timeline.json',
        title: '1周目',
        ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'session-root', playthroughNumber: 1 } },
      }],
    }), { expectedRevision: null, expectedRevisionPresent: true, validate: validatePlayDocument })

    assert.ok(handler, 'the loader must register its secured route')
    await run({ store, handler, playRoot, pluginDir })
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
}

function catalogOf(playRoot) {
  return JSON.parse(readFileSync(join(playRoot, 'catalog.json'), 'utf8'))
}

test('delete is refused with 403 and changes nothing while the opt-in flag is off', async () => {
  await withLoader({ allowPlaythroughDelete: false }, async ({ handler, playRoot }) => {
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt` })
    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'PLAYTHROUGH_DELETE_DISABLED')
    // Default-off must mean "no side effect at all", not "delete then complain".
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), true)
    assert.equal(catalogOf(playRoot).playthroughs.length, 1)
  })
})

test('delete is refused with 403 for a missing Origin even when the flag is on', async () => {
  await withLoader({ allowPlaythroughDelete: true }, async ({ handler, playRoot }) => {
    const response = await invoke(handler, {
      method: 'DELETE',
      url: `${API_V2}/playthroughs/pt`,
      headers: { origin: '' },
    })
    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'TAVERN_API_ORIGIN_FORBIDDEN')
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), true)
  })
})

test('delete reports 404 for an unknown playthrough and leaves the catalog alone', async () => {
  await withLoader({ allowPlaythroughDelete: true }, async ({ handler, playRoot }) => {
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/nope` })
    assert.equal(response.status, 404)
    assert.equal(response.body.code, 'PLAYTHROUGH_NOT_FOUND')
    assert.equal(catalogOf(playRoot).playthroughs.length, 1)
  })
})

test('delete refuses with 409 while a bound session is running and touches nothing', async () => {
  const agents = { get: id => (id === 'session-target' ? { status: 'running' } : undefined) }
  await withLoader({ allowPlaythroughDelete: true, agents }, async ({ handler, playRoot }) => {
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt` })
    assert.equal(response.status, 409)
    assert.equal(response.body.code, 'PLAYTHROUGH_AGENT_RUNNING')
    // `sendPlayError` puts only ok/error/code on the wire, so the message itself
    // has to tell the user what to do about the live turn.
    assert.match(response.body.error, /running/i)
    assert.match(response.body.error, /finish/i)
    assert.equal(existsSync(join(playRoot, 'card', 'pt', 'timeline.json')), true)
    assert.equal(catalogOf(playRoot).playthroughs.length, 1)
    assert.equal(existsSync(join(playRoot, '.dtavern-trash')), false)
  })
})

test('delete removes the Tavern tree, reports the bound session ids and leaves DSH sessions to their owner', async () => {
  const reached = []
  const workspaceRegistry = {
    archiveSession(sessionId) {
      reached.push(sessionId)
      throw new Error('the play layer must never reach a session-lifecycle seam')
    },
  }
  await withLoader({ allowPlaythroughDelete: true, workspaceRegistry }, async ({ handler, playRoot }) => {
    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt` })
    assert.equal(response.status, 200)
    assert.equal(response.body.removed, true)
    assert.equal(typeof response.body.backupDir, 'string')
    assert.deepEqual(response.body.sessionIds.slice().sort(), ['session-root', 'session-target'])
    assert.equal(response.body.rootSessionId, 'session-root')

    // Tavern-owned state is gone, and the response is the only channel that
    // tells a session-owning component which sessions to collect.
    assert.equal(existsSync(join(playRoot, 'card', 'pt')), false)
    assert.equal(catalogOf(playRoot).playthroughs.length, 0)
    assert.equal(existsSync(join(playRoot, response.body.backupDir, 'timeline.json')), true)

    // The documented boundary: no delete, archive or rename of DSH sessions here.
    assert.deepEqual(reached, [])
  })
})

test('delete drops the per-session Tavern selection without deleting the session', async () => {
  await withLoader({ allowPlaythroughDelete: true }, async ({ store, handler }) => {
    store.sessionSelections.set('session-target', { characterCardId: 'card' })
    assert.equal(store.sessionSelections.get('session-target').characterCardId, 'card')

    const response = await invoke(handler, { method: 'DELETE', url: `${API_V2}/playthroughs/pt` })
    assert.equal(response.status, 200)
    assert.equal(store.sessionSelections.get('session-target').characterCardId, null)
  })
})
