import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { UserStore, createUserApiHandler } from '../packages/user/src/index.js'
import { SessionTemplateStore, SessionConfigurationService, createSessionTemplateApiHandler } from '../packages/session-template/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { parseSillyTavernPreset, exportSillyTavernPreset, editPreset } from '../packages/tavern-format/src/index.js'

const prefix = '/pmp-dsh-tavern/api/v1'
async function invoke(handler, path, method = 'GET', body) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  request.url = `${prefix}${path}`
  request.method = method
  const headers = {}
  let result
  const response = { statusCode: 200, setHeader: (key, value) => { headers[key] = value }, end: value => { result = { status: response.statusCode, headers, body: JSON.parse(value) } } }
  await handler(request, response)
  return result
}
function directory(t) {
  const value = mkdtempSync(join(tmpdir(), 'tavern-resource-transfer-'))
  t.after(() => rmSync(value, { recursive: true, force: true }))
  return value
}

test('user API exports saved editable fields and reimports distinct identities without selection changes', async t => {
  const store = new UserStore(directory(t))
  const selected = []
  const handler = createUserApiHandler(store, { selectionPolicy: { select: (...args) => selected.push(args) } })
  const created = await invoke(handler, '/users', 'POST', { name: 'Reader', description: '原文 {{user}}\n😀' })
  const id = created.body.user.id
  await invoke(handler, `/users/${id}`, 'PATCH', { name: 'Reader edited', description: 'Current body' })
  const artifact = await invoke(handler, `/users/${id}/export`)
  assert.equal(artifact.status, 200)
  assert.match(artifact.headers['Content-Disposition'], /attachment/)
  assert.deepEqual(artifact.body, { format: 'pmp-dsh-tavern', version: 1, resourceType: 'user', data: { name: 'Reader edited', description: 'Current body' } })
  const one = await invoke(handler, '/users/import', 'POST', artifact.body)
  const two = await invoke(handler, '/users/import', 'POST', artifact.body)
  assert.equal(one.status, 201)
  assert.notEqual(one.body.user.id, id)
  assert.notEqual(one.body.user.id, two.body.user.id)
  assert.deepEqual(store.export(one.body.user.id), artifact.body)
  assert.equal(store.list().length, 3)
  assert.deepEqual(selected, [])
  assert.equal((await invoke(handler, '/users/missing/export')).status, 404)
})

test('user import validates shape, version, fields and size without partial writes, including worst-case valid text', async t => {
  const store = new UserStore(directory(t))
  const handler = createUserApiHandler(store)
  const source = store.create({ name: 'Escaped', description: '\u0001'.repeat(100_000) })
  const document = store.export(source.id)
  assert.equal((await invoke(handler, '/users/import', 'POST', document)).status, 201)
  const count = store.list().length
  for (const value of [null, {}, { ...document, version: 2 }, { ...document, data: { ...document.data, id: source.id } }, { ...document, data: { name: '', description: '' } }, { ...document, data: { name: 'Long', description: 'x'.repeat(100_001) } }]) {
    assert.equal((await invoke(handler, '/users/import', 'POST', value)).status, 400)
  }
  assert.equal((await invoke(handler, '/users/import', 'POST', { ...document, data: { name: 'Too big', description: 'x'.repeat(1024 * 1024) } })).status, 413)
  assert.equal(store.list().length, count)
})

test('template blank creation, direct edit and transfer preserve all settings and diagnose missing resources', async t => {
  const location = directory(t)
  const templates = new SessionTemplateStore(location)
  const selections = new SessionSelectionStore(location)
  selections.set('target', { userId: 'existing-user' })
  const before = selections.get('target')
  const absent = { get: id => { throw new Error(`Missing ${id}`) } }
  const service = new SessionConfigurationService({ templates, selections, presets: absent, characters: absent, users: absent, worldBooks: absent })
  const handler = createSessionTemplateApiHandler(templates, service)
  const created = await invoke(handler, '/session-templates', 'POST', { name: 'Blank' })
  assert.equal(created.status, 201)
  assert.equal(created.body.template.selection.presetId, null)
  const id = created.body.template.id
  const selection = { presetId: 'missing-preset', characterCardId: 'missing-character', userId: 'missing-user', worldBookIds: ['book-b', 'book-a'], character: { greetingIndex: 2, preferCharacterSystemPrompt: false, preferCharacterPostHistory: true }, rp: { active: true, source: 'command', followSuppressed: true, sandboxBefore: 'workspace-write' } }
  const edited = await invoke(handler, `/session-templates/${id}`, 'PATCH', { name: 'Edited', selection })
  assert.equal(edited.status, 200)
  assert.deepEqual(edited.body.template.selection, selection)
  assert.ok(edited.body.diagnostics.length > 0)
  const artifact = await invoke(handler, `/session-templates/${id}/export`)
  assert.deepEqual(artifact.body.data, { name: 'Edited', selection })
  assert.equal(artifact.body.resourceType, 'session-template')
  assert.equal(Object.hasOwn(artifact.body.data, 'id'), false)
  for (let i = 0; i < 2; i++) {
    const imported = await invoke(handler, '/session-templates/import', 'POST', artifact.body)
    assert.equal(imported.status, 201)
    assert.notEqual(imported.body.template.id, id)
    assert.deepEqual(imported.body.template.selection, selection)
    assert.ok(imported.body.diagnostics.length > 0)
    assert.equal(templates.state.selectedId, id)
  }
  assert.equal(new Set(templates.list().map(item => item.id)).size, 3)
  assert.deepEqual(selections.get('target'), before)
  const applied = await invoke(handler, '/session-configurations/apply', 'POST', { targetSessionId: 'target', source: { mode: 'template', templateId: id } })
  assert.equal(applied.status, 409)
  assert.deepEqual(selections.get('target'), before)
  assert.deepEqual(new SessionTemplateStore(location).get(id).selection, selection)
})

test('invalid template imports/edits reject rather than normalize away saved intent', async t => {
  const location = directory(t)
  const templates = new SessionTemplateStore(location, { maxTemplates: 2 })
  const selections = new SessionSelectionStore(location)
  const present = { get: id => ({ id }) }
  const service = new SessionConfigurationService({ templates, selections, presets: present, characters: present, users: present, worldBooks: present })
  const handler = createSessionTemplateApiHandler(templates, service)
  const original = templates.create({ name: 'Original' })
  const document = templates.export(original.id)
  const invalidSelections = [null, [], { unexpected: true }, { worldBookIds: ['a', 'a'] }, { worldBookIds: Array.from({ length: 101 }, (_, i) => `${i}`) }, { userId: 'a'.repeat(201) }, { character: { greetingIndex: -1 } }, { rp: { active: 'true' } }, { rp: { sandboxBefore: 'unknown' } }]
  for (const selection of invalidSelections) {
    assert.equal((await invoke(handler, '/session-templates/import', 'POST', { ...document, data: { name: 'Bad', selection } })).status, 400)
    assert.equal((await invoke(handler, `/session-templates/${original.id}`, 'PATCH', { selection })).status, 400)
  }
  assert.equal((await invoke(handler, '/session-templates', 'POST', { name: 'Bad', sourceSessionId: 'source', selection: {} })).status, 400)
  assert.equal((await invoke(handler, '/session-templates/import', 'POST', { ...document, version: 2 })).status, 400)
  assert.deepEqual(templates.list(), [original])
  assert.equal((await invoke(handler, '/session-templates/import', 'POST', document)).status, 201)
  assert.equal((await invoke(handler, '/session-templates/import', 'POST', document)).status, 409)
  assert.equal(templates.state.selectedId, original.id)
})

test('preset reasoning efforts off, max and future IDs survive import, unrelated edits and export', () => {
  for (const effort of ['off', 'max', 'low', 'medium', 'high', 'xhigh', 'future-provider-effort']) {
    const preset = parseSillyTavernPreset({ prompts: [], reasoning_effort: effort })
    assert.equal(preset.sampling.reasoningEffort, effort)
    const updated = editPreset(preset, { name: 'Edited' })
    assert.equal(updated.sampling.reasoningEffort, effort)
    assert.equal(JSON.parse(exportSillyTavernPreset(updated)).reasoning_effort, effort)
    const cleared = editPreset(updated, { sampling: { reasoningEffort: null } })
    assert.equal(JSON.parse(exportSillyTavernPreset(cleared)).reasoning_effort, undefined)
  }
  for (const effort of ['', '   ', 'x'.repeat(101), 'max\n']) {
    assert.equal(parseSillyTavernPreset({ prompts: [], reasoning_effort: effort }).sampling.reasoningEffort, undefined)
  }
})
