import test from 'node:test'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
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
  let importBinding = null
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
          { type: 'user/message', seq: 1, data: { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } } },
          { type: 'assistant/message', seq: 3, data: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }] } },
          { type: 'turn/end', seq: 4, data: {} },
        ],
        hasMore: false,
      }
    },
    async deriveMessages() {
      return [
        { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } },
        { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }] },
      ]
    },
    characterName() { return characterName },
    prepareImportContext(reference) { calls.push(['prepareImportContext', reference]); return { path: reference.path, hash: 'hash', qaCount: 1 } },
    bindImportContext(sessionId, prepared) {
      calls.push(['bindImportContext', sessionId, prepared])
      importBinding = { ...prepared, state: 'pending' }
      return importBinding
    },
    getImportContextBinding() { return importBinding },
    unbindImportContext() { importBinding = null; return true },
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

test('copying a play session selection reconciles RP after the snapshot is stored', () => {
  const calls = []
  const selections = {
    get(sessionId) {
      calls.push(['get', sessionId])
      return { characterCardId: 'card-a' }
    },
    set(sessionId, selection) {
      calls.push(['set', sessionId, selection])
    },
  }
  const host = createPlayHost({ get: () => undefined }, {
    selections,
    onSelectionCopied(sessionId) {
      calls.push(['reconcile', sessionId])
    },
  })

  host.copySelection('session-parent', 'session-child')

  assert.deepEqual(calls, [
    ['get', 'session-parent'],
    ['set', 'session-child', { characterCardId: 'card-a' }],
    ['reconcile', 'session-child'],
  ])
})

test('GET messages returns Message.id plus seq and incompleteTurn', async () => {
  const fixture = await boundHandler()
  try {
    const listed = await invoke(fixture.handler, { url: `${API_V2}/sessions/session-root/messages` })
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.body.messages, [
      { id: 'm1', role: 'user', content: [{ type: 'text', text: 'hi' }], seq: 1, origin: { kind: 'user' } },
      { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'yo' }], seq: 3, origin: { kind: 'assistant' } },
    ])
    assert.equal(listed.body.incompleteTurn, false)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})

test('session import-context route exposes binding and rejects mutation after history', async () => {
  const fixture = await boundHandler()
  try {
    const read = await invoke(fixture.handler, { url: `${API_V2}/sessions/session-root/import-context` })
    assert.equal(read.status, 200)
    assert.equal(read.body.binding, null)
    const locked = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/sessions/session-root/import-context`,
      body: { reference: { path: 'card/run/import-context.json' } },
    })
    assert.equal(locked.status, 409)
    assert.equal(locked.body.code, 'PLAY_IMPORT_CONTEXT_LOCKED')
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
          id: 'q1',
          kind: 'qa',
          adoptedVariantId: 'v1',
          variants: [{ id: 'v1', sessionId: 'session-focus', startEventId: 1, endEventId: 4 }],
        },
      ],
    }))
    fixture.workspaceStore.setActiveTimelinePath('run-timeline.json')
    const focus = await invoke(fixture.handler, { url: API_V2 + '/focus' })
    assert.equal(focus.status, 400)
    assert.equal(focus.body.code, 'PLAY_FOCUS_PATH_REQUIRED')
    const explicitFocus = await invoke(fixture.handler, { url: API_V2 + '/focus?path=run-timeline.json' })
    assert.equal(explicitFocus.status, 200)
    assert.equal(explicitFocus.body.ok, true)
    assert.equal(explicitFocus.body.sessionId, 'session-focus')
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

test('branch reports explicit copy failure after fork', async () => {
  let forked = false
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(mkdtempSync(join(tmpdir(), 'dsh-tavern-branch-copy-chrome-'))),
    workspaceStore: {},
    host: {
      async forkSession() { forked = true; return { sessionId: 'child' } },
      copySelection() { throw new Error('selection copy failed') },
    },
  })
  const output = await invoke(handler, {
    method: 'POST',
    url: `${API_V2}/sessions/source/branch`,
    body: { atEventId: 3 },
  })
  assert.equal(forked, true)
  assert.equal(output.status, 502)
  assert.equal(output.body.code, 'PLAY_BRANCH_COPY_FAILED')
})

test('GET /sessions messages preserves model role while projecting context provenance', async () => {
  const fixture = await boundHandler()
  try {
    fixture.host.history = async () => ({
      hasMore: false,
      events: [
        { type: 'user/message', seq: 1, data: { id: 'human', role: 'user', content: [], source: { kind: 'user' } } },
        { type: 'user/message', seq: 2, data: { id: 'report', role: 'user', content: [], source: { kind: 'subagent-report', form: 'relay', senderSessionId: 'child-a' } } },
        { type: 'user/message', seq: 3, data: { id: 'settled', role: 'user', content: [], source: { kind: 'subagent-settled', form: 'notice', summary: 'Child finished', senderSessionId: 'child-a' } } },
        { type: 'assistant/message', seq: 4, data: { id: 'answer', role: 'assistant', content: [] } },
      ],
    })
    fixture.host.deriveMessages = async () => [
      { id: 'human', role: 'user', content: [], source: { kind: 'user' } },
      { id: 'report', role: 'user', content: [], source: { kind: 'subagent-report', form: 'relay', senderSessionId: 'child-a' } },
      { id: 'settled', role: 'user', content: [], source: { kind: 'subagent-settled', form: 'notice', summary: 'Child finished', senderSessionId: 'child-a' } },
      { id: 'answer', role: 'assistant', content: [] },
    ]
    const response = await invoke(fixture.handler, {
      url: `${API_V2}/sessions/session-root/messages`,
    })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.messages.map(message => [message.role, message.origin]), [
      ['user', { kind: 'user' }],
      ['user', { kind: 'context', producer: 'subagent-report', form: 'relay', summary: null }],
      ['user', { kind: 'context', producer: 'subagent-settled', form: 'notice', summary: 'Child finished' }],
      ['assistant', { kind: 'assistant' }],
    ])
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})
test('live play session APIs expose chrome and workspace authority from a running DSH host', {
  skip: process.env.DSH_TAVERN_PLAY_LIVE !== '1',
}, async () => {
  assert.ok(process.env.DSH_TAVERN_PLAY_LIVE_URL, 'DSH_TAVERN_PLAY_LIVE_URL is required for live play tests')
  const baseUrl = new URL(process.env.DSH_TAVERN_PLAY_LIVE_URL)
  const readJson = async path => {
    const response = await fetch(new URL(path, baseUrl), {
      headers: {
        accept: 'application/json',
        origin: baseUrl.origin,
      },
    })
    const text = await response.text()
    assert.equal(response.status, 200, `${path} returned ${response.status}: ${text}`)
    assert.match(response.headers.get('content-type') || '', /^application\/json\b/)
    return JSON.parse(text)
  }

  const chrome = await readJson(`${API_V2}/chrome`)
  assert.equal(chrome.ok, true)
  assert.ok(chrome.mode === 'native' || chrome.mode === 'play')
  assert.equal(typeof chrome.revision, 'string')
  assert.ok(chrome.revision.length > 0)

  const workspace = await readJson(`${API_V2}/workspace`)
  assert.equal(workspace.ok, true)
  assert.equal(typeof workspace.selected, 'boolean')
  if (workspace.selected) {
    assert.equal(typeof workspace.rootPath, 'string')
    assert.ok(workspace.rootPath.length > 0)
    assert.equal(typeof workspace.workspaceId, 'string')
    assert.ok(workspace.workspaceId.length > 0)
  }
})
test('GET /playthroughs/:id/focus derives catalog authority and does not use active timeline', async () => {
  const fixture = await boundHandler()
  try {
    mkdirSync(join(fixture.playRoot, 'alice', 'pt-a'), { recursive: true })
    mkdirSync(join(fixture.playRoot, 'alice', 'pt-empty'), { recursive: true })
    writeFileSync(join(fixture.playRoot, 'alice', 'pt-a', 'timeline.json'), JSON.stringify({
      nodes: [{ id: 'q1', kind: 'qa', adoptedVariantId: 'v1', variants: [{ id: 'v1', sessionId: 'session-focus', startEventId: 1, endEventId: 4 }] }],
    }))
    writeFileSync(join(fixture.playRoot, 'alice', 'pt-empty', 'timeline.json'), JSON.stringify({ nodes: [] }))
    writeFileSync(join(fixture.playRoot, 'catalog.json'), JSON.stringify({ playthroughs: [
      { id: 'pt-a', path: 'alice/pt-a/timeline.json', lastOpenedAt: '9999', ext: { pmpDshTavern: { rootSessionId: 'session-root-a' } } },
      { id: 'pt-empty', path: 'alice/pt-empty/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'session-root-empty' } } },
    ] }))
    fixture.workspaceStore.setActiveTimelinePath('alice/pt-empty/timeline.json')
    const result = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/pt-a/focus' })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true, playthroughId: 'pt-a', sessionId: 'session-focus', nodeId: 'q1', variantId: 'v1' })
    const empty = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/pt-empty/focus' })
    assert.equal(empty.status, 200)
    assert.deepEqual(empty.body, { ok: true, playthroughId: 'pt-empty', sessionId: 'session-root-empty', nodeId: null, variantId: null })
    const missing = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/nope/focus' })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.code, 'PLAY_PLAYTHROUGH_NOT_FOUND')
    const invalidId = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/bad%2Fid/focus' })
    assert.equal(invalidId.status, 400)
    assert.equal(invalidId.body.code, 'PLAY_PLAYTHROUGH_ID_INVALID')
    const post = await invoke(fixture.handler, { method: 'POST', url: API_V2 + '/playthroughs/pt-a/focus' })
    assert.equal(post.status, 405)
    assert.equal(post.body.code, 'PLAY_METHOD_NOT_ALLOWED')
    const before = fixture.workspaceStore.get().activeTimelinePath
    const current = readFileSync(join(fixture.playRoot, 'alice', 'pt-a', 'timeline.json'))
    const revision = createHash('sha256').update(current).digest('hex')
    const put = await invoke(fixture.handler, { method: 'PUT', url: API_V2 + '/workspace/files?path=alice/pt-a/timeline.json', body: { content: JSON.stringify({ nodes: [] }), expectedRevision: revision } })
    assert.equal(put.status, 200)
    assert.equal(fixture.workspaceStore.get().activeTimelinePath, before)
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})
test('playthrough focus preserves null focus for empty timelines and maps file failures', async () => {
  const fixture = await boundHandler()
  try {
    mkdirSync(join(fixture.playRoot, 'alice', 'empty'), { recursive: true })
    mkdirSync(join(fixture.playRoot, 'alice', 'missing'), { recursive: true })
    mkdirSync(join(fixture.playRoot, 'alice', 'invalid'), { recursive: true })
    writeFileSync(join(fixture.playRoot, 'alice', 'empty', 'timeline.json'), JSON.stringify({ nodes: [] }))
    writeFileSync(join(fixture.playRoot, 'alice', 'invalid', 'timeline.json'), '{invalid')
    writeFileSync(join(fixture.playRoot, 'catalog.json'), JSON.stringify({ playthroughs: [
      { id: 'empty', path: 'alice/empty/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'empty-root' } } },
      { id: 'missing', path: 'alice/missing/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'missing-root' } } },
      { id: 'invalid', path: 'alice/invalid/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'invalid-root' } } },
    ] }))
    const empty = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/empty/focus' })
    assert.equal(empty.status, 200)
    assert.deepEqual(empty.body, { ok: true, playthroughId: 'empty', sessionId: 'empty-root', nodeId: null, variantId: null })
    const missing = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/missing/focus' })
    assert.equal(missing.status, 409)
    assert.equal(missing.body.code, 'PLAY_FOCUS_UNAVAILABLE')
    const invalid = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/invalid/focus' })
    assert.equal(invalid.status, 409)
    assert.equal(invalid.body.code, 'PLAY_FOCUS_UNAVAILABLE')
    writeFileSync(join(fixture.playRoot, 'catalog.json'), '{invalid')
    const badCatalog = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/empty/focus' })
    assert.equal(badCatalog.status, 400)
    assert.equal(badCatalog.body.code, 'PLAY_CATALOG_INVALID')
    unlinkSync(join(fixture.playRoot, 'catalog.json'))
    const missingCatalog = await invoke(fixture.handler, { url: API_V2 + '/playthroughs/empty/focus' })
    assert.equal(missingCatalog.status, 409)
    assert.equal(missingCatalog.body.code, 'PLAY_CATALOG_UNAVAILABLE')
  } finally {
    rmSync(fixture.pluginDir, { recursive: true, force: true })
    rmSync(fixture.playRoot, { recursive: true, force: true })
  }
})
