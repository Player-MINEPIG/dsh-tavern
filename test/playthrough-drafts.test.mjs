import { Readable } from 'node:stream'
import { createPlayApiHandler } from '../packages/play/src/server.js'
import { API_V2 } from '../packages/identity.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CharacterStore } from '../packages/character/src/store.js'
import { PlaythroughDrafts } from '../packages/tavern-loader/src/playthrough-drafts.js'
import { normalizeTemplateSelection } from '../packages/session-template/src/model.js'

function fixture(t, greetingData = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'draft-unit-')); t.after(() => rmSync(directory, { recursive: true, force: true }))
  const characters = new CharacterStore(join(directory, 'characters'))
  const character = characters.import({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Fixture', first_mes: 'Opening', alternate_greetings: ['Alternate'], ...greetingData, character_book: { entries: [{ id: 0, comment: '[initvar]', keys: [], content: '{"hp":100}', enabled: false }] } } })
  const files = new Map(), sessions = new Map(), archived = new Set(), selections = new Map(), assembly = new Map(), calls = []
  const workspace = { get: () => ({ rootPath: directory, workspaceId: 'work' }), readFile: path => { if (!files.has(path)) throw Object.assign(Error('missing'), { code: 'PLAY_PATH_NOT_FOUND' }); return files.get(path) }, writeFile: (path, content, options) => { assert.equal(options.expectedRevision, files.get(path)?.revision ?? null); const value = { content, revision: String(Number(files.get(path)?.revision ?? 0) + 1) }; files.set(path, value); return value } }
  const controller = { create: async ({ sessionId }) => { sessions.set(sessionId, sessions.get(sessionId) ?? []); return { sessionId } }, inspect: async sessionId => ({ events: sessions.get(sessionId) }), rename: async value => calls.push(['rename', value]), cancel: value => calls.push(['cancel', value]) }
  const service = new PlaythroughDrafts({ storageDir: directory, workspace, characters, configurations: { diagnostics: () => [] }, selections: { get: () => normalizeTemplateSelection(), set: (id, value) => selections.set(id, value) }, assembly: { get: id => ({ id, rules: [] }), selection: () => null, applySnapshot: (id, value) => assembly.set(id, value) }, mvu: { flush: async () => {}, list: async () => [{ id: 'mvu', revision: 0, source: { characterId: character.id } }], update: async () => {} }, controller, workspaces: { archiveSession: async ({ sessionId }) => archived.add(sessionId), unarchiveSession: async ({ sessionId }) => archived.delete(sessionId) }, agents: { get: () => ({ inbox: { nextTurn: [], nextStep: [] } }) }, reconcileRp: () => {}, renderingAuthority: { resolve: async value => ({ valid: true, write: true, scope: value.sourceIdentity.scope }), isCurrent: () => true } })
  service.importContexts = { unbind() {} }; t.after(() => service.dispose())
  const created = service.create({ characterId: character.id })
  return { service, created, sessions, selections, assembly, archived, calls, controller, characters }
}

test('draft MVU grants cannot migrate across openings; edits survive disk reload and conflict safely', async t => {
  const { service, created, sessions } = fixture(t), id = created.draft.id
  assert.equal(sessions.size, 0)
  const scope = { mode: 'draft', playthroughId: id, characterId: created.draft.selection.characterCardId, greetingIndex: 0 }
  const snapshot = await service.snapshot(scope); scope.selectionToken = snapshot.viewIdentity.selectionToken
  const binding = await service.createCardBinding({ scope, grantId: 'grant', sourceIdentity: { scope }, bindingId: randomUUID() })
  const request = { capability: binding.capability, operation: 'patch', value: [{ op: 'replace', path: '/hp', value: 70 }], expectedRevision: 0, operationId: 'edit-1', cause: 'user-interaction' }
  const changed = await service.cardWrite(request)
  assert.equal(changed.variables.stat_data.hp, 70); assert.deepEqual(await service.cardWrite(request), changed)
  await assert.rejects(service.cardWrite({ ...request, operationId: 'edit-2' }), { code: 'REVISION_CONFLICT' })
  assert.equal((await service.read(id)).draft.variables.stat_data.hp, 70)
  service.update(id, { expectedRevision: 1, selection: { ...created.draft.selection, character: { greetingIndex: 1 } } })
  await assert.rejects(service.cardWrite({ ...request, operationId: 'edit-3', expectedRevision: 1 }), { code: 'MVU_READ_ONLY' })
  await assert.rejects(service.snapshot({ ...scope, sessionId: 'ordinary' }), { code: 'MVU_SCOPE' })
})

test('cancel waits for admitted first input, preserves its native history and never releases it as a blank', async t => {
  const { service, created, sessions, selections, calls } = fixture(t), id = created.draft.id
  const prepared = await service.materialize(id, { expectedRevision: 0, operationId: 'first', text: 'INPUT' })
  let release, began
  const gate = new Promise(resolve => { release = resolve }), entered = new Promise(resolve => { began = resolve })
  const admission = service.admitPrompt({ ...prepared, text: 'INPUT' }, async () => {
    began(); await gate
    sessions.get(prepared.sessionId).push({ type: 'turn/start' }, { type: 'user/message', data: { message: { source: { rpcId: prepared.requestId }, content: [{ type: 'text', text: 'INPUT' }] } } })
  })
  await entered
  const cancellation = service.cancel(id)
  await Promise.resolve()
  assert.equal(service.record(id).claim.sessionId, prepared.sessionId)
  release(); await admission
  const cancelled = await cancellation
  assert.equal(cancelled.sessionId, prepared.sessionId); assert.equal(cancelled.draft.phase, 'started')
  assert.equal(selections.get(prepared.sessionId).characterCardId, created.draft.selection.characterCardId)
  assert(calls.some(([name]) => name === 'cancel'))
})

test('cancel before admission and retry with new input do not retain character, strategy or native title', async t => {
  const { service, created, sessions, selections, assembly, calls } = fixture(t), id = created.draft.id
  const first = await service.materialize(id, { expectedRevision: 0, operationId: 'first', text: 'INPUT' })
  let admitted = false
  const admission = service.admitPrompt({ ...first, text: 'INPUT' }, async () => { admitted = true })
  const cancellation = service.cancel(id)
  assert.equal(service.cancel(id), cancellation, "concurrent view recovery joins one rollback")
  await assert.rejects(admission, { code: 'PLAY_DRAFT_INPUT_CHANGED' }); const cancelled = await cancellation
  assert.equal(admitted, false); assert.equal(cancelled.sessionId, null); assert.equal((await service.read(id)).draft.lastInput,'INPUT')
  assert.equal(selections.get(first.sessionId).characterCardId, null); assert.equal(assembly.get(first.sessionId), null)
  assert.equal(sessions.get(first.sessionId).length, 0); assert(!calls.some(([name]) => name === 'rename'))
  const retry = await service.materialize(id, { expectedRevision: cancelled.draft.revision, operationId: 'second', text: 'NEW INPUT' })
  assert.notEqual(retry.sessionId, first.sessionId)
})

 test('greeting initialization is independent and preserves each opening edit across switching and remount', async t => {
  const { service, created, sessions } = fixture(t, { first_mes: '<JSONPatch>[{"op":"replace","path":"/hp","value":80}]</JSONPatch>', alternate_greetings: ['<UpdateVariable>_.set("hp",30);_.add("hp",5);</UpdateVariable>', 'No update'] })
  const id = created.draft.id; assert.equal(created.draft.variables.stat_data.hp,80)
  const change = patch => service.update(id,{expectedRevision:service.record(id).revision,...patch})
  const select = index => change({selection:{...service.record(id).selection,character:{greetingIndex:index}}})
  select(1);assert.equal(service.record(id).variables.stat_data.hp,35)
  change({variables:{stat_data:{hp:70}}})
  select(0);assert.equal(service.record(id).variables.stat_data.hp,80)
  change({variables:{stat_data:{hp:75}}})
  select(1);assert.equal(service.record(id).variables.stat_data.hp,70)
  service.state=JSON.parse(readFileSync(service.path,'utf8'))
  select(0);assert.equal(service.record(id).variables.stat_data.hp,75)
  select(2);assert.equal(service.record(id).variables.stat_data.hp,100)
  select(1);change({resetVariables:true});assert.equal(service.record(id).variables.stat_data.hp,35)
  select(0);assert.equal(service.record(id).variables.stat_data.hp,75)
  assert.equal(sessions.size,0)
})

 test('opening preview is read-only and rejects changed resources, revisions and first-send races', async t => {
  const { service, created, sessions, selections, assembly } = fixture(t), id = created.draft.id
  const before = readFileSync(service.path, 'utf8')
  service.previewAssembly = async (record, preset) => {
    assert.equal(record.id, id); assert.equal(preset.id, 'edited')
    record.selection.character.greetingIndex = 1
    return { nodes: [], messages: [], diagnostics: [] }
  }
  const preview = await service.preview(id, { expectedRevision: 0, preset: {id:'edited'} })
  assert.equal(preview.scope, 'opening-draft'); assert.equal(preview.pendingInputsIncluded, false)
  assert.equal(readFileSync(service.path,'utf8'), before)
  assert.equal(sessions.size, 0); assert.equal(selections.size, 0); assert.equal(assembly.size, 0)
  await assert.rejects(service.preview(id, {expectedRevision:1}), {code:'REVISION_CONFLICT'})
  await assert.rejects(service.preview('missing', {expectedRevision:0}), {code:'PLAY_DRAFT_NOT_FOUND'})
  service.previewAssembly = async () => { service.update(id, {expectedRevision:0,variables:{stat_data:{hp:90}}}); return {} }
  await assert.rejects(service.preview(id, {expectedRevision:0}), {code:'REVISION_CONFLICT'})
  service.record(id).phase = 'preparing'
  await assert.rejects(service.preview(id, {expectedRevision:1}), {code:'PLAY_DRAFT_LOCKED'})
 })

 test('draft preview HTTP route is a quiet bounded read and cannot accept session overrides', async t => {
  const { service, created } = fixture(t)
  service.previewAssembly = async () => ({messages:[],nodes:[],diagnostics:[]})
  let logs = 0
  const api = createPlayApiHandler({chromeStore:{}, drafts:service, logger:{info(){logs++},warn(){logs++}}})
  const invoke = async body => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method='POST'; req.url=`${API_V2}/drafts/${created.draft.id}/preview`
    let result
    await api(req,{setHeader(){},end(text){result={status:this.statusCode,body:JSON.parse(text)}}})
    return result
  }
  const good = await invoke({expectedRevision:0})
  assert.equal(good.status,200); assert.equal(good.body.preview.scope,'opening-draft'); assert.equal(logs,0)
  const stale = await invoke({expectedRevision:1}); assert.equal(stale.status,409); assert.equal(stale.body.code,'REVISION_CONFLICT')
  const override = await invoke({expectedRevision:0,sessionId:'other'}); assert.equal(override.status,400); assert.equal(override.body.code,'PLAY_DRAFT_INVALID')
 })
