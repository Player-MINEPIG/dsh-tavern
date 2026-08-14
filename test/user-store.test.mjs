import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UserStore, createUserAdapter } from '../packages/user/src/index.js'

function temporaryStore() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-'))
  return { directory, store: new UserStore(directory) }
}

test('user CRUD persists only id, name, and description', () => {
  const { directory, store } = temporaryStore()
  try {
    const created = store.create({ id: 'synthetic-reader', name: 'Synthetic Reader', description: 'A self-authored fixture.' })
    assert.deepEqual(Object.keys(created), ['id', 'name', 'description'])
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'users', 'synthetic-reader.json'), 'utf8')), created)

    const updated = store.update(created.id, { name: 'Updated Reader', description: 'Updated locally.' })
    assert.deepEqual(updated, { id: 'synthetic-reader', name: 'Updated Reader', description: 'Updated locally.' })
    assert.deepEqual(new UserStore(directory).get(created.id), updated)
    assert.deepEqual(new UserStore(directory).list(), [updated])

    store.delete(created.id)
    assert.throws(() => store.get(created.id), error => error.code === 'USER_NOT_FOUND')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('user resource rejects avatar fields, unsafe ids, and invalid text', () => {
  const { directory, store } = temporaryStore()
  try {
    assert.throws(() => store.create({ id: 'bad', name: 'Bad', description: '', avatar: 'not-allowed' }), /Unsupported user field/)
    assert.throws(() => store.create({ id: '../escape', name: 'Bad', description: '' }), /Invalid user id/)
    assert.throws(() => store.create({ id: 'bad-name', name: 'line\nbreak', description: '' }), /control characters/)
    const user = store.create({ id: 'safe', name: 'Safe', description: '' })
    assert.throws(() => store.update(user.id, { avatar: 'not-allowed' }), /Unsupported user field/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('user adapter returns exact resources and diagnoses missing selections', () => {
  const { directory, store } = temporaryStore()
  try {
    const user = store.create({ id: 'adapter-user', name: 'Adapter User', description: 'Adapter description.' })
    const adapter = createUserAdapter(store)
    assert.deepEqual(adapter.resolve({ selection: { userId: user.id } }), { user, diagnostics: [] })
    const missing = adapter.resolve({ selection: { userId: 'missing' } })
    assert.equal(missing.user, null)
    assert.equal(missing.diagnostics[0].code, 'user-not-found')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
