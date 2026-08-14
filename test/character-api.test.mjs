import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CharacterStore,
  createCharacterApiHandler,
} from '../packages/character/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const input = body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))]
    const req = Readable.from(input)
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => {
        const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
        const json = headers['content-type']?.startsWith('application/json')
          ? JSON.parse(bytes.toString('utf8'))
          : undefined
        resolve({ status: res.statusCode, headers, bytes, json })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('character API imports raw bytes, reads resources, selects, exports, and deletes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-api-'))
  const store = new CharacterStore(directory)
  const changes = []
  const handler = createCharacterApiHandler(store, { onChange: (change) => changes.push(change) })
  const source = Buffer.from(JSON.stringify({ name: 'API synthetic', first_mes: 'Hello', unknown: { kept: true } }))
  try {
    const imported = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/characters/import?filename=synthetic.json',
      body: source,
    })
    assert.equal(imported.status, 201)
    const id = imported.json.character.id
    assert.equal(imported.json.character.name, 'API synthetic')

    const listed = await invoke(handler, { url: '/dsh-tavern/api/characters' })
    assert.equal(listed.json.characters.length, 1)
    const detail = await invoke(handler, { url: `/dsh-tavern/api/characters/${id}` })
    assert.equal(detail.json.character.source.raw.unknown.kept, true)

    const selected = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/character-selection',
      body: { sessionId: 'session-a', characterCardId: id, character: { greetingIndex: 0 } },
    })
    assert.equal(selected.json.selection.characterCardId, id)
    const selection = await invoke(handler, { url: '/dsh-tavern/api/character-selection?sessionId=session-a' })
    assert.equal(selection.json.character.name, 'API synthetic')

    const artifact = await invoke(handler, { url: `/dsh-tavern/api/characters/${id}/artifact` })
    assert.deepEqual(artifact.bytes, source)
    assert.equal(artifact.headers['content-type'], 'application/json')
    const json = await invoke(handler, { url: `/dsh-tavern/api/characters/${id}/json` })
    assert.deepEqual(JSON.parse(json.bytes), JSON.parse(source))

    const removed = await invoke(handler, { method: 'DELETE', url: `/dsh-tavern/api/characters/${id}` })
    assert.equal(removed.status, 200)
    const cleared = await invoke(handler, { url: '/dsh-tavern/api/character-selection?sessionId=session-a' })
    assert.equal(cleared.json.selection, null)
    assert.deepEqual(changes.map((item) => item.kind), [
      'character-imported',
      'character-selection-changed',
      'character-deleted',
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('character API returns structured errors and delegates session policy', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-api-policy-'))
  const store = new CharacterStore(directory)
  store.import(JSON.stringify({ name: 'Policy synthetic' }), { id: 'policy' })
  const handler = createCharacterApiHandler(store, {
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
    const invalid = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/characters/import?filename=bad.json',
      body: Buffer.from('{'),
    })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.json.error.code, 'INVALID_CHARACTER_REQUEST')
    assert.doesNotMatch(invalid.json.error.message, /Policy synthetic/)

    const blocked = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/character-selection',
      body: { sessionId: 'running', characterCardId: 'policy', character: {} },
    })
    assert.equal(blocked.status, 409)
    assert.equal(blocked.json.error.code, 'SESSION_RUNNING')
    assert.equal(store.selection('running'), null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
