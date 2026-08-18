import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayWorkspaceStore,
  createPlayApiHandler,
  createPlayHost,
} from '../packages/tavern-loader/src/index.js'

const CODING_WORKSPACE = 'c6f77ddc-0000-0000-0000-000000000000'
const PLAY_WORKSPACE = 'ws-play'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
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

function mockHost({ characterName = 'Alice' } = {}) {
  const calls = []
  return {
    calls,
    async createWorkspace({ path }) {
      calls.push(['createWorkspace', path])
      return { workspaceId: PLAY_WORKSPACE }
    },
    async createSession(args) {
      calls.push(['createSession', args])
      return { sessionId: 'session-new' }
    },
    async forkSession(args) {
      calls.push(['forkSession', args])
      if (args.atSeq === 99) {
        const error = new Error('session has an open turn')
        error.status = 409
        error.code = 'PLAY_FORK_UNAVAILABLE'
        throw error
      }
      return { sessionId: 'session-fork' }
    },
    async promptSession(args) {
      calls.push(['promptSession', args])
      return { accepted: true }
    },
    async history() {
      return {
        events: [
          { type: 'user/message', seq: 1, data: { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }] } },
          { type: 'assistant/message', seq: 3, data: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }] } },
          { type: 'turn/end', seq: 4, data: {} },
        ],
        hasMore: false,
      }
    },
    async deriveMessages() {
      return [
        { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }] },
      ]
    },
    characterName() { return characterName },
    copySelection(from, to) { calls.push(['copySelection', from, to]) },
  }
}

async function boundHandler({ now = () => new Date('2026-08-19T03:04:00.000Z'), characterName = 'Alice' } = {}) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-session-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-session-root-'))
  const host = mockHost({ characterName })
  const workspaceStore = new PlayWorkspaceStore(pluginDir, { host })
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(pluginDir),
    workspaceStore,
    host,
    now,
  })
  await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })
  return { pluginDir, playRoot, host, handler, workspaceStore }
}

test('POST /sessions creates a titled session in the play workspace and does not write timeline', async () => {
  const fixture = await boundHandler()
  try {
    const created = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/sessions`,
      body: { selectionFromSessionId: 'session-parent' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.sessionId, 'session-new')
    assert.equal(created.body.title, 'Alice 2026-08-19 03:04')
    const createCall = fixture.host.calls.find(call => call[0] === 'createSession')
    assert.equal(createCall[1].workspaceId, PLAY_WORKSPACE)
    assert.notEqual(createCall[1].workspaceId, CODING_WORKSPACE)
    assert.deepEqual(fixture.host.calls.find(call => call[0] === 'copySelection'), ['copySelection', 'session-parent', 'session-new'])
    assert.equal(existsSync(join(fixture.playRoot, 'timeline.json')), false)
    assert.equal(fixture.host.calls.some(call => call[0] === 'promptSession'), false)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('POST /sessions without a character uses DSH default create', async () => {
  const fixture = await boundHandler({ characterName: null })
  try {
    const created = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/sessions`,
      body: {},
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.sessionId, 'session-new')
    assert.equal(created.body.title, undefined)
    const createCall = fixture.host.calls.find(call => call[0] === 'createSession')
    assert.equal(createCall[1].title, undefined)
    assert.equal(fixture.host.calls.some(call => call[0] === 'copySelection'), false)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('branch forks from seq without prompting; open turn is 409', async () => {
  const fixture = await boundHandler()
  try {
    const branched = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/sessions/session-root/branch`,
      body: { atEventId: 4 },
    })
    assert.equal(branched.status, 201)
    assert.equal(branched.body.sessionId, 'session-fork')
    assert.deepEqual(fixture.host.calls.find(call => call[0] === 'forkSession')[1], { sessionId: 'session-root', atSeq: 4 })
    assert.equal(fixture.host.calls.some(call => call[0] === 'promptSession'), false)

    const open = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/sessions/session-root/branch`,
      body: { atEventId: 99 },
    })
    assert.equal(open.status, 409)
    assert.equal(open.body.code, 'PLAY_FORK_UNAVAILABLE')
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('user-message sends only the next user text with queue mode', async () => {
  const fixture = await boundHandler()
  try {
    const sent = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/sessions/session-root/user-message`,
      body: { text: 'hello there' },
    })
    assert.equal(sent.status, 200)
    assert.equal(sent.body.accepted, true)
    assert.deepEqual(fixture.host.calls.find(call => call[0] === 'promptSession')[1], {
      sessionId: 'session-root',
      mode: 'queue',
      text: 'hello there',
    })
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('GET messages returns Message.id plus seq and incompleteTurn', async () => {
  const fixture = await boundHandler()
  try {
    const listed = await invoke(fixture.handler, { url: `${API_V2}/sessions/session-root/messages` })
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.body.messages, [
      { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], seq: 1 },
      { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }], seq: 3 },
    ])
    assert.equal(listed.body.incompleteTurn, false)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('GET /focus is derived sessionId only; POST /focus is 405', async () => {
  const fixture = await boundHandler()
  try {
    writeFileSync(join(fixture.playRoot, 'run-timeline.json'), JSON.stringify({
      nodes: [
        {
          id: 'g1',
          kind: 'greeting',
          adoptedVariantId: 'gv',
          variants: [{ id: 'gv', sessionId: 'session-root', startEventId: 0, endEventId: 0 }],
        },
        {
          id: 'q1',
          kind: 'qa',
          adoptedVariantId: 'v1',
          variants: [{ id: 'v1', sessionId: 'session-focus', startEventId: 1, endEventId: 4 }],
        },
      ],
    }))
    fixture.workspaceStore.setActiveTimelinePath('run-timeline.json')
    const focus = await invoke(fixture.handler, { url: `${API_V2}/focus` })
    assert.equal(focus.status, 200)
    assert.equal(focus.body.ok, true)
    assert.equal(focus.body.sessionId, 'session-focus')
    assert.equal(Object.hasOwn(focus.body, 'path'), false)
    assert.equal(Object.hasOwn(focus.body, 'nodeId'), false)
    const post = await invoke(fixture.handler, { method: 'POST', url: `${API_V2}/focus`, body: { sessionId: 'nope' } })
    assert.equal(post.status, 405)
    assert.equal(post.body.code, 'PLAY_METHOD_NOT_ALLOWED')
    const getSessions = await invoke(fixture.handler, { url: `${API_V2}/sessions` })
    assert.equal(getSessions.status, 405)
    const unknown = await invoke(fixture.handler, { url: `${API_V2}/not-a-route` })
    assert.equal(unknown.status, 404)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('createPlayHost maps session.fork RPC fork-unavailable to 409 and prompts with queue', async () => {
  const recorded = []
  const ctx = {
    get(name) {
      if (name !== 'apiProxy') return undefined
      return {
        sessions: {
          async fork(request) {
            recorded.push(['fork', request.payload])
            return {
              rpcId: request.rpcId,
              result: {
                ok: false,
                error: { code: 'fork-unavailable', message: 'open turn', details: { sessionId: request.payload.sessionId } },
              },
            }
          },
          async prompt(request) {
            recorded.push(['prompt', request.payload])
            return { rpcId: request.rpcId, result: { ok: true, value: { accepted: true } } }
          },
        },
      }
    },
  }
  const host = createPlayHost(ctx)
  await assert.rejects(() => host.forkSession({ sessionId: 's1', atSeq: 3 }), error => {
    assert.equal(error.status, 409)
    assert.equal(error.code, 'PLAY_FORK_UNAVAILABLE')
    return true
  })
  await host.promptSession({ sessionId: 's1', text: 'next line', mode: 'queue' })
  assert.equal(recorded[1][1].mode, 'queue')
  assert.deepEqual(recorded[1][1].content, [{ type: 'text', text: 'next line' }])
})

test('live play session APIs against a running DSH host', {
  skip: process.env.DSH_TAVERN_PLAY_LIVE !== '1',
}, async () => {
  assert.ok(process.env.DSH_TAVERN_PLAY_LIVE_URL, 'DSH_TAVERN_PLAY_LIVE_URL is required for live play tests')
})
