import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { API_V1 } from '../packages/identity.js'
import { CharacterStore } from '../packages/character/src/store.js'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { createPersonalityApiHandler } from '../packages/personality/src/server.js'
import { secureTavernApi } from '../packages/tavern-loader/src/api-security.js'

function invoke(handler, method, path, body, type = 'application/json') {
  const req = Readable.from(body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, url: `${API_V1}/${path}`, socket: { remoteAddress: '127.0.0.1' },
    headers: { host: 'localhost', origin: 'http://localhost', 'content-type': type } })
  return new Promise((resolve, reject) => {
    const headers = {}
    handler(req, { setHeader: (key, value) => { headers[key] = value }, end(payload) {
      resolve({ status: this.statusCode, body: headers['Content-Type']?.includes('json') ? JSON.parse(payload) : payload })
    } }).catch(reject)
  })
}

test('personality library round trips original cards and binds native sessions independently of RP', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'tavern-personality-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const roles = new CharacterStore(dir)
  const role = roles.import({ spec: 'chara_card_v2', spec_version: '2.0', data: {
    name: 'Test', description: 'Test card', personality: 'Always asks why',
    extensions: { authorField: ['preserved'] },
  } })
  roles.select('native', { characterCardId: role.id })
  let running = false
  const host = () => secureTavernApi(createPersonalityApiHandler(new PersonalityStore(dir), { isRunning: () => running }))
  const api = host()
  const png = roles.png(role.id).bytes
  const imported = await invoke(api, 'POST', 'personalities/import?filename=sample.png', Buffer.from(png), 'image/png')
  assert.equal(imported.status, 201)
  const id = imported.body.personality.id
  assert.notEqual(id, role.id)
  assert.deepEqual((await invoke(api, 'GET', `personalities/${id}/json`)).body, role.source.raw)
  assert.deepEqual((await invoke(api, 'GET', 'personalities')).body.personalities.map(card => card.id), [id])
  assert.equal((await invoke(api, 'GET', `personalities/${role.id}`)).status, 404)
  assert.equal((await invoke(api, 'POST', 'personality-selection', { sessionId: 'native', personalityId: id })).body.personality.name, 'Test')
  const restarted = host()
  assert.equal((await invoke(restarted, 'GET', 'personality-selection?sessionId=native')).body.personalityId, id)
  assert.equal((await invoke(restarted, 'GET', 'personality-selection?sessionId=other')).body.personalityId, null)
  const edit = await invoke(restarted, 'PATCH', `personalities/${id}`, { personality: 'Prefers evidence' })
  assert.equal(edit.body.personality.data.personality, 'Prefers evidence')
  assert.deepEqual(edit.body.personality.source.raw.data.extensions, role.source.raw.data.extensions)
  running = true
  assert.equal((await invoke(restarted, 'POST', 'personality-selection', { sessionId: 'native', personalityId: null })).status, 409)
  assert.equal((await invoke(restarted, 'GET', 'personality-selection?sessionId=native')).body.personalityId, id)
  assert.equal((await invoke(restarted, 'DELETE', `personalities/${id}`)).status, 200)
  assert.equal((await invoke(host(), 'GET', 'personality-selection?sessionId=native')).body.personalityId, null)
  assert.equal(roles.selectedCharacter('native').character.data.personality, 'Always asks why')
})
