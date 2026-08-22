import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    req.method = method
    req.url = url
    req.headers = {
      host: 'localhost:53100',
      ...(method === 'GET' ? {} : {
        origin: 'http://localhost:53100',
        'content-type': 'application/json',
      }),
    }
    req.socket = { remoteAddress: '127.0.0.1' }
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: payload => resolve({
        status: res.statusCode,
        headers,
        json: payload === undefined || payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function host() {
  let route
  return {
    ctx: {
      systemPrompt: { section: () => {} },
      on: () => {},
      emit: () => {},
      get: name => name === 'webServer' ? { register: value => { route = value; return () => {} } } : undefined,
      effect: install => install(),
      logger: { info: () => {}, warn: () => {} },
    },
    route: () => route,
  }
}

function agent(id) {
  return { id, session: { deriveMessages: () => [] } }
}

test('v1 preset and character relation APIs compose standalone books without modifying ST documents', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-resource-world-book-api-'))
  const fixture = host()
  try {
    const store = apply(fixture.ctx, { storageDir: directory })
    const preset = store.create({ id: 'preset-a', name: 'Preset A' })
    const character = store.characterStore.create({ id: 'character-a', name: 'Character A' })
    for (const id of ['session-book', 'shared-book', 'preset-book', 'character-book']) {
      store.worldBookStore.import(JSON.stringify({
        name: id,
        entries: { one: { uid: 1, constant: true, content: `${id} content`, position: 1 } },
      }), { id })
    }
    const handler = fixture.route().handler
    const presetSaved = await invoke(handler, {
      method: 'PUT',
      url: `/pmp-dsh-tavern/api/v1/presets/${preset.id}/world-books`,
      body: { worldBookIds: ['shared-book', 'preset-book'] },
    })
    const characterSaved = await invoke(handler, {
      method: 'PUT',
      url: `/pmp-dsh-tavern/api/v1/characters/${character.id}/world-books`,
      body: { worldBookIds: ['shared-book', 'character-book'] },
    })
    assert.equal(presetSaved.status, 200)
    assert.equal(characterSaved.status, 200)
    assert.deepEqual(presetSaved.json.binding, {
      presetId: preset.id,
      worldBookIds: ['shared-book', 'preset-book'],
    })
    assert.deepEqual(characterSaved.json.binding, {
      characterCardId: character.id,
      worldBookIds: ['shared-book', 'character-book'],
    })
    assert.deepEqual((await invoke(handler, {
      url: `/pmp-dsh-tavern/api/v1/presets/${preset.id}/world-books`,
    })).json.binding.worldBookIds, ['shared-book', 'preset-book'])
    assert.deepEqual((await invoke(handler, {
      url: `/pmp-dsh-tavern/api/v1/characters/${character.id}/world-books`,
    })).json.binding.worldBookIds, ['shared-book', 'character-book'])

    store.sessionSelections.set('session-a', {
      presetId: preset.id,
      characterCardId: character.id,
      worldBookIds: ['session-book', 'shared-book'],
    })
    const compiled = store.profileLoader.compile({ agent: agent('session-a') })
    assert.deepEqual(compiled.audit.worldBookSelection, {
      explicitIds: ['session-book', 'shared-book'],
      userBoundIds: [],
      presetBoundIds: ['shared-book', 'preset-book'],
      characterBoundIds: ['shared-book', 'character-book'],
      effectiveIds: ['session-book', 'shared-book', 'preset-book', 'character-book'],
      duplicateIds: ['shared-book'],
      order: 'session-explicit-then-user-then-preset-then-character',
    })
    assert.deepEqual(compiled.resources.worldBooks.map(book => [book.id, book.bindingSources]), [
      ['session-book', ['session']],
      ['shared-book', ['session', 'preset', 'character']],
      ['preset-book', ['preset']],
      ['character-book', ['character']],
    ])
    assert.doesNotMatch(JSON.stringify(store.get(preset.id)), /worldBookIds|world-books/)
    assert.doesNotMatch(JSON.stringify(store.characterStore.get(character.id)), /worldBookIds|world-books/)

    const removed = await invoke(handler, {
      method: 'DELETE',
      url: '/pmp-dsh-tavern/api/v1/world-books/shared-book',
      body: {},
    })
    assert.equal(removed.status, 200)
    assert.deepEqual(store.resourceWorldBooks.get('preset', preset.id), ['preset-book'])
    assert.deepEqual(store.resourceWorldBooks.get('character', character.id), ['character-book'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
