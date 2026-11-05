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
import * as tavern from '../packages/tavern-loader/src/index.js'
import { characterMvuId, normalizeVariables, compileMvuSchema } from '../packages/mvu-adapter/src/index.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
const root = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('stock Host applies draft model, reasoning and permission before first send, with RP secure by default', { skip: !root }, async () => {
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
    await ctx.plugin(await load('@deepseek-ai/dsh-session-persistence-jsonl'), { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'tool-executor-native', 'agent-loop']) await ctx.plugin(((await load(`@deepseek-ai/dsh-${name}`)).default ?? await load(`@deepseek-ai/dsh-${name}`)), name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin(((await load('@deepseek-ai/dsh-storage')).default ?? await load('@deepseek-ai/dsh-storage')))
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-json'), { root: join(directory, 'storage') })
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-domain'), { backend: 'json' })
    await ctx.plugin(((await load('@deepseek-ai/dsh-workspace')).default ?? await load('@deepseek-ai/dsh-workspace')))
    await ctx.plugin(((await load('@deepseek-ai/dsh-typert-registry')).default ?? await load('@deepseek-ai/dsh-typert-registry')))
    await ctx.plugin(((await load('@deepseek-ai/dsh-api-remote-access')).default ?? await load('@deepseek-ai/dsh-api-remote-access')))
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'offline', model: 'draft-test' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {}, bindPrompt: () => ({ commit() {}, [Symbol.dispose]() {} }) })
    ctx.provide('attachments', { admitPromptContent: async content => content })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default)
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    ctx.provide('fs', {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-gateway')).TypertGatewayService, {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-session-controller')).SessionController, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-api-workspace-controller')).WorkspaceController)
    await ctx.plugin(((await load('@deepseek-ai/dsh-session-title')).default ?? await load('@deepseek-ai/dsh-session-title')), { fallbackMaxWords: 8, fallbackMaxBytes: 80, maxTitleBytes: 160 })
    ctx.on('agent/error', event => errors.push(event.error))
    class Offline extends llm.LlmAdapter {
      async listModels(provider) { return Promise.all(['draft-test', 'opening-choice'].map(id => this.resolveModel(provider, id))) }
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } } }
      async *stream(request) {
        requests.push({ model: request.model, reasoningEffort: request.reasoningEffort })
        const text = `Offline answer. _.add('hp',-1); ${requests.length === 1 ? "_.insert('people','Ada',{hp:10});" : "_.set('people.Ada.hp',9);"}`
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Offline())
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') }); await mount()
    const playRoot = join(directory, 'play'); mkdirSync(playRoot); await store.playWorkspaceStore.bindRoot(playRoot)
    const character = store.characterStore.import({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Opening controls', first_mes: 'Welcome' } })
    const created = store.playthroughDrafts.create({ characterId: character.id })
    const id = created.draft.id
    let draft = store.playthroughDrafts.update(id, { expectedRevision: 0, modelSelection: { provider: 'offline', model: 'opening-choice', reasoningEffort: 'low' }, permissionPreset: 'workspace-write' }).draft
    assert.equal(ctx.sessions.list().length, 0)
    assert.equal(requests.length, 0)
    const preview = await store.playthroughDrafts.preview(id, { expectedRevision: draft.revision })
    assert(JSON.stringify(preview).includes('OFFLINE offline/opening-choice'))
    await handle.dispose(); await mount()
    draft = (await store.playthroughDrafts.read(id)).draft
    assert.equal(draft.modelSelection.model, 'opening-choice')
    const first = await store.playthroughDrafts.materialize(id, { expectedRevision: draft.revision, operationId: 'first', text: 'FIRST INPUT' })
    const agent = ctx.agents.get(first.sessionId)
    assert.equal(agent.model.current().model, 'opening-choice')
    assert.equal(agent.model.current().reasoningEffort, 'low')
    assert.equal(ctx.permissionPresets.current(agent.session), 'workspace-write')
    assert.equal(store.sessionSelections.get(first.sessionId).rp.active, false)
    assert.equal(store.sessionSelections.get(first.sessionId).rp.followSuppressed, true)
    const host = createPlayHost({ sessionController: ctx.sessionController }, { drafts: () => store.playthroughDrafts })
    await host.promptSession({ ...first, text: 'FIRST INPUT' }); await agent.whenIdle()
    assert.deepEqual(errors, [])
    assert.equal(requests.length, 1)
    assert.equal(requests[0].reasoningEffort, 'low')
    const secure = store.playthroughDrafts.create({ characterId: character.id })
    const second = await store.playthroughDrafts.materialize(secure.draft.id, { expectedRevision: 0, operationId: 'secure', text: 'SECOND INPUT' })
    assert.equal(store.sessionSelections.get(second.sessionId).rp.active, true)
    assert.equal(ctx.agents.get(second.sessionId).session.snapshotEvents().findLast(event => event.type === 'sandbox/mode').data.mode, 'read-only')
    assert.equal(hashCore(), beforeCore)
  } finally { await handle?.dispose(); await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
