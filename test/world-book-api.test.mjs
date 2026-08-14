import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { WorldBookStore, createWorldBookApiHandler } from '../packages/world-book-library/src/index.js'
import { SessionSelectionStore, createWorldBookSelectionPolicy } from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url = '/dsh-tavern/api/world-books', body } = {}) {
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
    const req = Readable.from(bytes)
    req.method = method
    req.url = url
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: value => {
        const text = value === undefined ? '' : Buffer.from(value).toString('utf8')
        resolve({
          status: res.statusCode,
          headers,
          text,
          body: headers['content-type']?.startsWith('application/json') && text !== '' ? JSON.parse(text) : null,
        })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('world-book API covers create, edit, export, multi-select, delete and selection cleanup', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-api-'))
  try {
    const store = new WorldBookStore(directory)
    const selections = new SessionSelectionStore(directory)
    const policy = createWorldBookSelectionPolicy(store, selections)
    const changes = []
    const handler = createWorldBookApiHandler(store, { selectionPolicy: policy, onChange: change => changes.push(change) })

    const imported = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/world-books/import?filename=synthetic.json',
      body: { name: 'Imported API Book', entries: {} },
    })
    const first = await invoke(handler, { method: 'POST', body: { name: 'API Book A' } })
    const second = await invoke(handler, { method: 'POST', body: { name: 'API Book B' } })
    assert.equal(imported.status, 201)
    assert.equal(imported.body.worldBook.source.fileName, 'synthetic.json')
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    const firstId = first.body.worldBook.id
    const secondId = second.body.worldBook.id

    const book = first.body.worldBook.book
    book.entries.push({
      uid: 1, keys: ['alpha'], secondaryKeys: [], comment: 'Alpha', content: 'Alpha lore',
      enabled: true, constant: false, selective: false, insertionOrder: 200,
      position: 'before_character_definition', probability: 100,
    })
    const patched = await invoke(handler, { method: 'PATCH', url: `/dsh-tavern/api/world-books/${firstId}`, body: { book } })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.worldBook.book.entries[0].comment, 'Alpha')

    const selected = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/world-book-selection',
      body: { sessionId: 'session-a', worldBookIds: [firstId, secondId] },
    })
    assert.deepEqual(selected.body.selection.worldBookIds, [firstId, secondId])
    assert.deepEqual(selections.get('session-b').worldBookIds, [])

    const exported = await invoke(handler, { url: `/dsh-tavern/api/world-books/${firstId}/json` })
    assert.equal(exported.status, 200)
    assert.equal(Object.values(JSON.parse(exported.text).entries)[0].comment, 'Alpha')

    const removed = await invoke(handler, { method: 'DELETE', url: `/dsh-tavern/api/world-books/${firstId}` })
    assert.equal(removed.status, 200)
    assert.deepEqual(selections.get('session-a').worldBookIds, [secondId])
    assert.equal(changes.at(-1).kind, 'world-book-deleted')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('world-book selection API rejects missing resources and unsafe session ids', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-world-book-api-invalid-'))
  try {
    const store = new WorldBookStore(directory)
    const selections = new SessionSelectionStore(directory)
    const handler = createWorldBookApiHandler(store, { selectionPolicy: createWorldBookSelectionPolicy(store, selections) })
    const missing = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/world-book-selection', body: { sessionId: 'safe', worldBookIds: ['missing'] } })
    assert.equal(missing.status, 404)
    const unsafe = await invoke(handler, { method: 'POST', url: '/dsh-tavern/api/world-book-selection', body: { sessionId: '__proto__', worldBookIds: [] } })
    assert.equal(unsafe.status, 400)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
