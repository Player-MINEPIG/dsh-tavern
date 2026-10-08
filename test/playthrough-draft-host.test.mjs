import { NATIVE_PHI_LAST } from './fixtures/assembly-references.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assembler from 'dsh-prompt-assembler/plugin'
import { installCoreExtension } from './helpers/assembler-host.mjs'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { characterMvuId, normalizeVariables, compileMvuSchema } from '../packages/mvu-adapter/src/index.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
const root = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
const managerRoot = process.env.DSH_ASSEMBLER_MANAGER_ROOT

for (const managed of [false, true]) test(`sessionless production opening survives remount, transfers resources once and leaves native sessions unbound (manager=${managed})`, { skip: !root || managed && !managerRoot }, async () => {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const hashCore = () => createHash('sha256').update(readFileSync(require.resolve('@deepseek-ai/dsh-api-session-controller'))).digest('hex')
  const beforeCore = hashCore(), ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'production-draft-')), requests = [], errors = []
  let store, handle
  const mount = async () => { handle = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) { store = tavern.apply(scope, { storageDir: join(directory, 'tavern') }) } }); await handle }
  try {
    ctx.provide('directoryPickerController', {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'OFFLINE {{provider}}/{{model}} at {{cwd}}' })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-persistence-jsonl')).default, { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-storage')).default)
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-json'), { root: join(directory, 'storage') })
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-domain'), { backend: 'json' })
    await ctx.plugin((await load('@deepseek-ai/dsh-workspace')).default)
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'offline', model: 'draft-test' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {}, bindPrompt: () => ({ commit() {}, [Symbol.dispose]() {} }) })
    ctx.provide('attachments', { admitPromptContent: async content => content })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    ctx.provide('fs', {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-session-controller')).SessionController, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-api-workspace-controller')).WorkspaceController)
    await ctx.plugin((await load('@deepseek-ai/dsh-session-title')).default, { fallbackMaxWords: 8, fallbackMaxBytes: 80, maxTitleBytes: 160 })
    ctx.on('agent/error', event => errors.push(event.error))
    class Offline extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) {
        requests.push(structuredClone(request.messages))
        const text = `Offline answer. _.add('hp',-1); ${requests.length === 1 ? "_.insert('people','Ada',{hp:10});" : "_.set('people.Ada.hp',9);"}`
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Offline())
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') }); await installCoreExtension(ctx); await mount()
    const playRoot = join(directory, 'play'); mkdirSync(playRoot); await store.playWorkspaceStore.bindRoot(playRoot)
    const schemaSource = `import { registerMvuSchema } from 'https://example.invalid/mvu_zod.js'; const Schema=z.object({hp:z.number().prefault(100),people:z.record(z.string(),z.strictObject({hp:z.number()})).prefault({})}); $(()=>registerMvuSchema(Schema));`
    const character = store.characterStore.import({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Draft fixture', description: 'DRAFT CHARACTER', first_mes: 'Opening A <JSONPatch>[{"op":"replace","path":"/hp","value":80}]</JSONPatch>', alternate_greetings: ['Opening B <UpdateVariable>_.add("hp",-40);</UpdateVariable>'], extensions:{tavern_helper:{scripts:[{content:schemaSource}]}}, character_book: { entries: [{ id: 0, keys: [], comment: '[initvar]', content: '{"hp":100}', enabled: false, insertion_order: 0 }, { id: 1, keys: [], comment: 'Embedded constant', content: 'EMBEDDED CONSTANT', enabled: true, constant: true, insertion_order: 1 }] } } })
    const preset = store.create({ name: 'Draft preset' }); store.update(preset.id, { prompts: [{ identifier: 'main', name: 'Main', role: 'system', content: 'DRAFT PRESET', enabled: true }] })
    const user = store.userStore.create({ name: 'User fixture', description: 'DRAFT PERSONA' })
    const book = store.worldBookStore.import({ entries: { 0: { uid: 0, content: 'DRAFT WORLD BOOK {{format_message_variable::stat_data}}', constant: true } } })
    const boundBook = store.worldBookStore.import({ entries: { 0: { uid: 0, content: 'CHARACTER BOUND CONSTANT', constant: true } } })
    store.resourceWorldBooks.set('character', character.id, [boundBook.id])
    const strategy = store.assemblyPresets.save({ ...store.assemblyPresets.get('builtin-st'), name: 'Draft assembly', rules: [...store.assemblyPresets.get('builtin-st').rules, { id: 'draft-mvu', kind: 'tavern.mvu/state', role: 'system', lifetime: 'request' }] })
    await ctx.get('tavernMvu').list({scope:{authority:'local'}}); await ctx.get('tavernMvu').flush()
    // Reproduce a stored v1 factory from an earlier installation.
    await handle.dispose()
    const ledgerPath=join(directory,'tavern','mvu-instances.json')
    const ledger=JSON.parse(readFileSync(ledgerPath,'utf8')), templateId=characterMvuId(character.id)
    ledger.templates[templateId]={id:templateId,name:character.name,characterId:character.id,discovered:true,managementMode:'native',sessionIds:[],initial:normalizeVariables({stat_data:{hp:100,people:{}},schema:{type:'object',properties:{},extensible:true,strictSet:true},mvu_schema:{...compileMvuSchema(schemaSource),interpreterVersion:1}})}
    writeFileSync(ledgerPath,JSON.stringify(ledger));await mount()
    const created = store.playthroughDrafts.create({ characterId: character.id, selection: { characterCardId: character.id, presetId: preset.id, userId: user.id, worldBookIds: [book.id], character: { greetingIndex: 0 } }, assemblyPresetId: strategy.id })
    const id = created.draft.id
    assert.equal(created.draft.variables.stat_data.hp,80)
    assert.equal(created.sessionId, null); assert.equal(ctx.sessions.list().length, 0)
    assert.equal(created.playthrough.ext.pmpDshTavern.rootSessionId, undefined)
    const importPath = `${character.id}/${id}/import-context.json`
    store.playWorkspaceStore.writeFile(importPath, JSON.stringify({ schemaVersion: 1, greeting: 'Imported opening', qa: [{ user: 'IMPORTED QUESTION', assistant: 'IMPORTED ANSWER' }] }))
    store.playthroughDrafts.update(id, { expectedRevision: 0, variables: { stat_data: { hp: 70 } }, selection: { ...created.draft.selection, character: { greetingIndex: 1 } }, importContextRef: { path: importPath } })
    await handle.dispose()
    const ordinary = await ctx.sessionController.create({ cwd: playRoot })
    assert(!ctx.sessions.get(ordinary.sessionId).snapshotEvents().some(event => event.type === 'session/title'))
    await mount()
    assert.equal(store.sessionSelections.get(ordinary.sessionId).characterCardId, null)
    let draft = (await store.playthroughDrafts.read(id)).draft
    assert.equal(draft.variables.stat_data.hp, 70); assert.equal(draft.selection.character.greetingIndex, 1)
    let managerHandle
    if (managed) {
      const plugin = await import(pathToFileURL(join(resolve(managerRoot), 'src/index.js')))
      managerHandle = ctx.plugin(plugin, { storageDir: join(directory, 'manager') }); await managerHandle
    }
    const beforePreview = readFileSync(store.playthroughDrafts.path, 'utf8')
    const nativePreset = structuredClone(NATIVE_PHI_LAST)
    nativePreset.rules.find(rule => rule.kind === 'phi').text = 'DRAFT PHI'
    const preview = await store.playthroughDrafts.preview(id, { expectedRevision: draft.revision, preset: nativePreset })
    const previewText = preview.messages.flatMap(message => message.content).map(block => block.text ?? '').join('\n')
    for (const value of ['OFFLINE offline/draft-test','DRAFT PRESET','DRAFT PERSONA','DRAFT WORLD BOOK','DRAFT CHARACTER','Opening B','DRAFT PHI','EMBEDDED CONSTANT','CHARACTER BOUND CONSTANT']) assert(previewText.includes(value), value)
    assert(previewText.includes('hp: 70'), 'draft variables must replace the world-book state macro'); assert(!previewText.includes('{{format_message_variable::stat_data}}'))
    assert.equal(preview.scope, 'opening-draft'); assert.equal(preview.backend, 'native'); assert.equal(preview.pendingInputsIncluded, false)
    assert(!previewText.includes('IMPORTED QUESTION')); assert(!previewText.includes('FIRST INPUT'))
    assert.equal(readFileSync(store.playthroughDrafts.path, 'utf8'), beforePreview); assert.equal(requests.length, 0); assert.equal(ctx.sessions.list().length,1)
    assert.equal(store.sessionSelections.get(ordinary.sessionId).characterCardId,null)
    // The reported path: standard preset-slot preview with a real Manager mounted.
    const slots = store.assemblyPresets.get('builtin-native-slots')
    const slotPreview = await store.playthroughDrafts.preview(id, { expectedRevision: draft.revision, preset: slots })
    const text = value => value.messages.flatMap(m => m.content).map(b => b.text ?? '').join('\n')
    for (const value of ['EMBEDDED CONSTANT','CHARACTER BOUND CONSTANT','DRAFT WORLD BOOK','hp: 70']) assert(text(slotPreview).includes(value),value)
    if (managed) {
      const manager=ctx.get('dshMemoryManager'), resourceId=`world-book:character:${character.id}:embedded-world-book`
      await manager.saveEntry({id:resourceId,adapterId:'tavern.world-books',entry:{id:resourceId,adapterId:'tavern.world-books',retrieve:{rule:false}},expectedRevision:manager.configuration.document.revision})
      const denied=await store.playthroughDrafts.preview(id,{expectedRevision:draft.revision,preset:slots})
      assert(!text(denied).includes('EMBEDDED CONSTANT'));assert(text(denied).includes('CHARACTER BOUND CONSTANT'))
      await managerHandle.dispose()
    }
    assert.equal(readFileSync(store.playthroughDrafts.path, 'utf8'), beforePreview);assert.equal(requests.length,0);assert.equal(ctx.sessions.list().length,1)
    const aborted = new AbortController(); aborted.abort()
    await assert.rejects(store.playthroughDrafts.materialize(id, { expectedRevision: draft.revision, text: 'FIRST INPUT', operationId: 'first', signal: aborted.signal }), { name: 'AbortError' })
    assert.equal(ctx.sessions.list().length, 1)
    const [first, duplicate] = await Promise.all([1, 2].map(() => store.playthroughDrafts.materialize(id, { expectedRevision: draft.revision, operationId: 'first', text: 'FIRST INPUT' })))
    assert.deepEqual(first, duplicate); assert.equal((await ctx.get('tavernMvu').list({scope:{sessionId:first.sessionId}}))[0].content.mvu_schema.interpreterVersion,2); assert.notEqual(first.sessionId, ordinary.sessionId)
    assert(ctx.workspaceRegistry.archivedSessionIds.includes(first.sessionId))
    assert(!ctx.sessions.get(first.sessionId).snapshotEvents().some(event => event.type === 'turn/start' || event.type === 'session/title'))
    await handle.dispose(); await mount()
    const host = createPlayHost({ sessionController: ctx.sessionController }, { drafts: () => store.playthroughDrafts })
    await host.promptSession({ ...first, text: 'FIRST INPUT' }); await ctx.agents.get(first.sessionId).whenIdle(); await ctx.get('tavernMvu').flush()
    assert.deepEqual(errors, [])
    assert.equal(ctx.sessions.get(first.sessionId).snapshotEvents().findLast(event => event.type === 'turn/end').data.reason.kind, 'completed', JSON.stringify(ctx.sessions.get(first.sessionId).snapshotEvents()))
    assert(!ctx.workspaceRegistry.archivedSessionIds.includes(first.sessionId))
    const finished = await store.playthroughDrafts.read(id)
    assert.equal(finished.draft.phase, 'started'); assert.equal(finished.playthrough.ext.pmpDshTavern.rootSessionId, first.sessionId)
    assert.equal((await ctx.get('tavernMvu').list({ scope: { sessionId: first.sessionId } })).find(row => row.source?.characterId === character.id).content.stat_data.hp, 69)
    for (const text of ['DRAFT PRESET', 'DRAFT PERSONA', 'DRAFT WORLD BOOK', 'IMPORTED QUESTION', 'FIRST INPUT', '"hp":70', 'Opening B']) assert(requests[0].flatMap(message => message.content).filter(part => part.type === 'text').map(part => part.text).join('\n').includes(text), text)
    await host.promptSession({ ...first, text: 'FIRST INPUT' }); await ctx.agents.get(first.sessionId).whenIdle()
    assert.equal(requests.length, 1)
    const greetingScope = { mode: 'greeting', playthroughId: id, sessionId: first.sessionId, characterId: character.id }
    assert.equal((await ctx.get('tavernMvu').snapshot(greetingScope)).variables.stat_data.hp, 70)
    await host.promptSession({ sessionId: first.sessionId, requestId: 'second-input', text: 'SECOND INPUT' }); await ctx.agents.get(first.sessionId).whenIdle(); await ctx.get('tavernMvu').flush()
    const latest = (await ctx.get('tavernMvu').list({ scope: { sessionId: first.sessionId } })).find(row => row.source?.characterId === character.id)
    assert.equal(latest.content.stat_data.hp, 68); assert.equal(latest.content.stat_data.people.Ada.hp, 9); assert.deepEqual(latest.content.update_diagnostics, [])
    assert.equal((await ctx.get('tavernMvu').snapshot(greetingScope)).variables.stat_data.hp, 70)
    await handle.dispose(); await mount()
    assert.equal((await ctx.get('tavernMvu').snapshot(greetingScope)).variables.stat_data.hp, 70)
    assert.equal((await ctx.get('tavernMvu').list({ scope: { sessionId: first.sessionId } }))[0].content.stat_data.people.Ada.hp, 9)
    // A failed/cancelled preparation returns a genuinely unbound reusable blank.
    const second = store.playthroughDrafts.create({ characterId: character.id })
    const prepared = await store.playthroughDrafts.materialize(second.draft.id, { expectedRevision: 0, operationId: 'cancel-me', text: 'CANCELLED INPUT' })
    assert(ctx.workspaceRegistry.archivedSessionIds.includes(prepared.sessionId))
    assert.equal((await store.playthroughDrafts.cancel(second.draft.id)).sessionId, null)
    assert.equal(store.sessionSelections.get(prepared.sessionId).characterCardId, null)
    assert.equal(store.assemblyPresets.selection(prepared.sessionId), null)
    assert(!ctx.workspaceRegistry.archivedSessionIds.includes(prepared.sessionId))
    assert(!ctx.sessions.get(prepared.sessionId).snapshotEvents().some(event => event.type === 'turn/start' || event.type === 'session/title'))
    assert.equal(requests.length, 2); assert.equal(hashCore(), beforeCore)
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
