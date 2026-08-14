import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UserStore, createUserApiHandler } from '../packages/user/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { apply, createUserSelectionPolicy } from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    req.method = method
    req.url = url
    req.headers = headers
    const responseHeaders = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { responseHeaders[name.toLowerCase()] = value },
      end: payload => resolve({ status: res.statusCode, headers: responseHeaders, json: JSON.parse(String(payload ?? '')) }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('user API performs CRUD, isolates session bindings, unbinds, and clears deleted ids', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-api-'))
  const store = new UserStore(directory)
  const selections = new SessionSelectionStore(directory)
  const changes = []
  const handler = createUserApiHandler(store, {
    selectionPolicy: createUserSelectionPolicy(store, selections),
    onChange: change => changes.push(change),
  })
  try {
    const first = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/users', body: { id: 'reader-a', name: 'Reader A', description: 'First description.' } })
    const second = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/users', body: { id: 'reader-b', name: 'Reader B', description: 'Second description.' } })
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    assert.deepEqual(Object.keys(first.json.user), ['id', 'name', 'description'])

    const updated = await invoke(handler, { method: 'PATCH', url: '/dsh-tavern/api/users/reader-a', body: { name: 'Reader A+', description: 'Immediate refresh text.' } })
    assert.equal(updated.json.user.description, 'Immediate refresh text.')
    assert.equal((await invoke(handler, { url: '/dsh-tavern/api/users' })).json.users.length, 2)

    await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/user-selection', body: { sessionId: 'session-a', userId: 'reader-a' } })
    await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/user-selection', body: { sessionId: 'session-b', userId: 'reader-b' } })
    assert.equal((await invoke(handler, { url: '/dsh-tavern/api/user-selection?sessionId=session-a' })).json.user.name, 'Reader A+')
    assert.equal((await invoke(handler, { url: '/dsh-tavern/api/user-selection?sessionId=session-b' })).json.user.name, 'Reader B')

    await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/user-selection', body: { sessionId: 'session-a', userId: null } })
    assert.equal((await invoke(handler, { url: '/dsh-tavern/api/user-selection?sessionId=session-a' })).json.selection, null)

    await invoke(handler, { method: 'DELETE', url: '/dsh-tavern/api/users/reader-b', body: {} })
    assert.equal(new SessionSelectionStore(directory).get('session-b').userId, null)
    assert.equal((await invoke(handler, { url: '/dsh-tavern/api/user-selection?sessionId=session-b' })).json.selection, null)
    assert.deepEqual(changes.map(change => change.kind), [
      'user-created', 'user-created', 'user-updated',
      'user-selection-changed', 'user-selection-changed', 'user-selection-changed', 'user-deleted',
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('root Tavern API dispatcher exposes user routes through the single secured prefix', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-root-api-'))
  let route
  const ctx = {
    systemPrompt: { section: () => {} },
    on: () => {},
    emit: () => {},
    get: name => name === 'webServer' ? { register: value => { route = value; return () => {} } } : undefined,
    effect: install => install(),
    logger: { info: () => {} },
  }
  try {
    const rootStore = apply(ctx, { storageDir: directory })
    rootStore.userStore.create({ id: 'root-user', name: 'Root User', description: 'Root route.' })
    const result = await invoke(route.handler, {
      url: '/dsh-tavern/api/users',
      headers: { host: 'localhost:53100' },
    })
    assert.equal(route.path, '/dsh-tavern/api')
    assert.equal(result.status, 200)
    assert.equal(result.json.users[0].id, 'root-user')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('user API rejects unsupported fields and blocks a running-session switch', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-api-errors-'))
  const store = new UserStore(directory)
  const selections = new SessionSelectionStore(directory)
  store.create({ id: 'safe-user', name: 'Safe User', description: '' })
  const handler = createUserApiHandler(store, {
    selectionPolicy: createUserSelectionPolicy(store, selections),
    beforeSelectionChange: ({ sessionId }) => {
      if (sessionId === 'running') {
        const error = new Error('Session is running')
        error.code = 'SESSION_RUNNING'
        error.status = 409
        throw error
      }
    },
  })
  try {
    const avatar = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/users', body: { name: 'Bad', description: '', avatar: 'forbidden' } })
    assert.equal(avatar.status, 400)
    assert.equal(avatar.json.error.code, 'INVALID_USER_REQUEST')
    const blocked = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/user-selection', body: { sessionId: 'running', userId: 'safe-user' } })
    assert.equal(blocked.status, 409)
    assert.equal(selections.get('running').userId, null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
