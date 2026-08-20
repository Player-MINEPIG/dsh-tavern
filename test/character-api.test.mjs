import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CharacterStore,
  MAX_CHARACTER_WORLD_BOOK_BODY_BYTES,
  characterStoreConstants,
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
      url: '/pmp-dsh-tavern/api/v1/characters/import?filename=synthetic.json',
      body: source,
    })
    assert.equal(imported.status, 201)
    const id = imported.json.character.id
    assert.equal(imported.json.character.name, 'API synthetic')

    const listed = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/characters' })
    assert.equal(listed.json.characters.length, 1)
    const detail = await invoke(handler, { url: `/pmp-dsh-tavern/api/v1/characters/${id}` })
    assert.equal(detail.json.character.source.raw.unknown.kept, true)

    const editedBook = {
      name: 'Editable synthetic lore',
      entries: [{
        id: 1,
        keys: ['harbor'],
        secondary_keys: [],
        comment: 'Harbor rule',
        content: 'Synthetic lore content',
        enabled: true,
        insertion_order: 100,
        constant: false,
        selective: false,
        position: 'after_char',
        extensions: { position: 1 },
      }],
    }
    const updated = await invoke(handler, {
      method: 'PATCH',
      url: `/pmp-dsh-tavern/api/v1/characters/${id}/world-book`,
      body: { characterBook: editedBook },
    })
    assert.equal(updated.status, 200)
    assert.deepEqual(updated.json.character.data.characterBook, editedBook)

    const selected = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/character-selection',
      body: { sessionId: 'session-a', characterCardId: id, character: { greetingIndex: 0 } },
    })
    assert.equal(selected.json.selection.characterCardId, id)
    const selection = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/character-selection?sessionId=session-a' })
    assert.equal(selection.json.character.name, 'API synthetic')

    const json = await invoke(handler, { url: `/pmp-dsh-tavern/api/v1/characters/${id}/json` })
    assert.equal(JSON.parse(json.bytes).character_book.entries[0].keys[0], 'harbor')
    const missingOriginal = await invoke(handler, { url: `/pmp-dsh-tavern/api/v1/characters/${id}/artifact` })
    assert.equal(missingOriginal.status, 404)

    const removed = await invoke(handler, { method: 'DELETE', url: `/pmp-dsh-tavern/api/v1/characters/${id}` })
    assert.equal(removed.status, 200)
    const cleared = await invoke(handler, { url: '/pmp-dsh-tavern/api/v1/character-selection?sessionId=session-a' })
    assert.equal(cleared.json.selection, null)
    assert.deepEqual(changes.map((item) => item.kind), [
      'character-imported',
      'character-world-book-updated',
      'character-selection-changed',
      'character-deleted',
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('character API patches fields, exports current PNG, and rejects invalid updates', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-patch-'))
  const store = new CharacterStore(directory)
  const handler = createCharacterApiHandler(store)
  const source = Buffer.from(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: { name: 'Patchable', first_mes: 'First', alternate_greetings: ['Second'] },
  }))
  try {
    const imported = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/characters/import?filename=patchable.json',
      body: source,
    })
    const id = imported.json.character.id
    const patched = await invoke(handler, {
      method: 'PATCH',
      url: `/pmp-dsh-tavern/api/v1/characters/${id}`,
      body: { description: 'Edited', firstMessage: 'First edited' },
    })
    assert.equal(patched.status, 200)
    assert.equal(patched.json.character.data.description, 'Edited')
    assert.equal(JSON.parse((await invoke(handler, { url: `/pmp-dsh-tavern/api/v1/characters/${id}/json` })).bytes).data.description, 'Edited')

    const png = await invoke(handler, { url: `/pmp-dsh-tavern/api/v1/characters/${id}/png` })
    assert.equal(png.status, 200)
    assert.equal(png.headers['content-type'], 'image/png')
    assert.match(png.headers['content-disposition'], /\.png/)

    const missing = await invoke(handler, {
      method: 'PATCH',
      url: '/pmp-dsh-tavern/api/v1/characters/missing',
      body: { description: 'nope' },
    })
    assert.equal(missing.status, 404)
    const invalid = await invoke(handler, {
      method: 'PATCH',
      url: `/pmp-dsh-tavern/api/v1/characters/${id}`,
      body: { characterBook: {} },
    })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.json.error.code, 'INVALID_CHARACTER_REQUEST')

    const oversized = await invoke(handler, {
      method: 'PATCH',
      url: `/pmp-dsh-tavern/api/v1/characters/${id}`,
      body: Buffer.from(`{"description":"${'x'.repeat(characterStoreConstants.maxCharacterDocumentBytes)}}"`),
    })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.json.error.code, 'CHARACTER_DOCUMENT_TOO_LARGE')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('character API creates a blank card', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-create-'))
  const store = new CharacterStore(directory)
  const changes = []
  const handler = createCharacterApiHandler(store, { onChange: (change) => changes.push(change) })
  try {
    const created = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/characters',
      body: { name: 'Created card' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.character.name, 'Created card')
    assert.equal(store.get(created.json.character.id).data.firstMessage, '')
    assert.equal(store.coverImage(created.json.character.id), null)
    assert.deepEqual(changes.map((item) => item.kind), ['character-created'])
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
      url: '/pmp-dsh-tavern/api/v1/characters/import?filename=bad.json',
      body: Buffer.from('{'),
    })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.json.error.code, 'INVALID_CHARACTER_REQUEST')
    assert.doesNotMatch(invalid.json.error.message, /Policy synthetic/)

    const blocked = await invoke(handler, {
      method: 'POST',
      url: '/pmp-dsh-tavern/api/v1/character-selection',
      body: { sessionId: 'running', characterCardId: 'policy', character: {} },
    })
    assert.equal(blocked.status, 409)
    assert.equal(blocked.json.error.code, 'SESSION_RUNNING')
    assert.equal(store.selection('running'), null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('character world-book edits have an independent request and structure boundary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-book-limit-'))
  const store = new CharacterStore(directory)
  store.import(JSON.stringify({ name: 'Bounded synthetic' }), { id: 'bounded' })
  const handler = createCharacterApiHandler(store)
  try {
    const oversized = await invoke(handler, {
      method: 'PATCH',
      url: '/pmp-dsh-tavern/api/v1/characters/bounded/world-book',
      body: Buffer.from(JSON.stringify({
        characterBook: { entries: [{ content: 'x'.repeat(MAX_CHARACTER_WORLD_BOOK_BODY_BYTES) }] },
      })),
    })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.json.error.code, 'CHARACTER_WORLD_BOOK_TOO_LARGE')

    let nested = 'leaf'
    for (let index = 0; index < 34; index += 1) nested = { nested }
    const tooDeep = await invoke(handler, {
      method: 'PATCH',
      url: '/pmp-dsh-tavern/api/v1/characters/bounded/world-book',
      body: { characterBook: { entries: [{ content: 'safe', extensions: nested }] } },
    })
    assert.equal(tooDeep.status, 400)
    assert.equal(tooDeep.json.error.code, 'WORLD_BOOK_DEPTH_LIMIT')
    assert.equal(store.get('bounded').data.characterBook, null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('character regex-scripts API reads and replaces native ST rules without rewriting the card', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-character-regex-'))
  const store = new CharacterStore(directory)
  const changes = []
  store.import(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Regex card',
      description: 'Keep me',
      extensions: {
        kept: { future: true },
        regex_scripts: [{ id: 'old', script_name: 'Old', find_regex: '/old/g', replace_string: 'before' }],
      },
    },
  }), { id: 'character-regex' })
  const handler = createCharacterApiHandler(store, { onChange: change => changes.push(change) })
  try {
    const read = await invoke(handler, {
      url: '/pmp-dsh-tavern/api/v1/characters/character-regex/regex-scripts',
    })
    assert.equal(read.status, 200)
    assert.equal(read.json.regexScripts[0].script_name, 'Old')

    const regexScripts = [{
      id: 'new',
      script_name: 'New',
      find_regex: '/new/g',
      replace_string: 'after',
      disabled: false,
      future_extension: { preserved: true },
    }]
    const replaced = await invoke(handler, {
      method: 'PUT',
      url: '/pmp-dsh-tavern/api/v1/characters/character-regex/regex-scripts',
      body: { regexScripts },
    })
    assert.equal(replaced.status, 200)
    assert.deepEqual(replaced.json.regexScripts, regexScripts)
    const stored = store.get('character-regex')
    assert.deepEqual(stored.source.raw.data.extensions.regex_scripts, regexScripts)
    assert.equal(stored.source.raw.data.extensions.kept.future, true)
    assert.equal(stored.data.description, 'Keep me')
    assert.deepEqual(changes, [{ kind: 'character-regex-scripts-updated', characterCardId: 'character-regex' }])

    const invalid = await invoke(handler, {
      method: 'PUT',
      url: '/pmp-dsh-tavern/api/v1/characters/character-regex/regex-scripts',
      body: { regexScripts: {} },
    })
    assert.equal(invalid.status, 400)
    assert.deepEqual(store.get('character-regex').source.raw.data.extensions.regex_scripts, regexScripts)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
