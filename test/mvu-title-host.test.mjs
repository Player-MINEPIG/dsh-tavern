import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { installMvu } from '../packages/mvu-adapter/src/host.js'
import { createPlayHost } from '../packages/tavern-loader/src/play-host.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { PlayMembershipService } from '../packages/play/src/membership.js'
import { validatePlayDocument } from '../packages/play/src/timeline.js'

const runtimeRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT ?? process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official SessionController rename and Tavern create-title keep empty initial scope available without turns or model requests', { skip: !runtimeRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'mvu-title-host-'))
  let modelRequests = 0, service
  try {
    ctx.provide('directoryPickerController', {}); ctx.provide('workspaceController', {})
    ctx.provide('workspaceRegistry', { list: () => [], get: () => undefined, archivedSessionIds: [] })
    await ctx.plugin(SystemPrompt, { personaPrefix: 'HOST' })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-persistence-jsonl')).default, { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    await ctx.plugin((await load('@deepseek-ai/dsh-session-title')).default, { fallbackMaxWords: 8, fallbackMaxBytes: 80, maxTitleBytes: 160 })
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'title-test', model: 'synthetic' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    new (await load('@deepseek-ai/dsh-api-session-controller')).SessionController(ctx, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default, { defaultPreset: 'workspace-write' })
    ctx.on('llm/stream', () => { modelRequests++; throw Error('title-only test must not call a model') }, { global: true, prepend: true })
    const storageDir = join(directory, 'tavern'), workspace = new PlayWorkspaceStore(storageDir), root = join(directory, 'play')
    mkdirSync(root); await workspace.bindRoot(root)
    const memberships = new PlayMembershipService(workspace), selections = new SessionSelectionStore(storageDir)
    const scopes = [], catalog = { playthroughs: [] }
    const bindMembership = sessionId => {
      const playthroughId = `p-${scopes.length}`, scope = { mode: 'initial', playthroughId, sessionId, characterId: 'c', sessionFormatVersion: 4 }
      selections.set(sessionId, { characterCardId: 'c' })
      workspace.writeFile(`${playthroughId}/timeline.json`, JSON.stringify({ nodes: [] }), { validate: validatePlayDocument, expectedRevision: null, expectedRevisionPresent: true })
      const revision = catalog.playthroughs.length ? workspace.readFile('catalog.json').revision : null
      catalog.playthroughs.push({ id: playthroughId, path: `${playthroughId}/timeline.json`, ext: { pmpDshTavern: { rootSessionId: sessionId, characterId: 'c' } } })
      workspace.writeFile('catalog.json', JSON.stringify(catalog), { validate: validatePlayDocument, expectedRevision: revision, expectedRevisionPresent: true })
      scopes.push(scope); return scope
    }
    ctx.provide('tavernRenderingAuthority', { resolve: async ({ sourceIdentity }) => ({ valid: true, write: true, scope: sourceIdentity.scope }), isCurrent: () => true })
    service = installMvu(ctx, { storageDir, resources: [{ id: 'mvu:title-template', characterId: 'c', sessionIds: ['*'], initial: { stat_data: { hp: 10 } } }],
      sources: { register: () => () => {} }, memberships, getSelection: id => selections.get(id), getSelectionToken: id => selections.selectionRevision(id),
      isActive: (resource, id) => resource.characterId === selections.get(id).characterCardId })
    service.registerUsage(request => request.on === 'card_variable_update' ? { enabled: true, configRevision: 1, checkCurrent: () => true } : undefined)
    const host = createPlayHost({ sessionController: ctx.sessionController })
    const first = await host.createSession({ cwd: directory }), scope = bindMembership(first.sessionId)
    const session = ctx.sessions.get(first.sessionId)
    const before = await service.snapshot(scope)
    const bind = () => service.createCardBinding({ scope, grantId: 'synthetic-title-only', sourceIdentity: { version: 1, sha256: 'a'.repeat(64), scope } })
    const original = await bind()
    const renamed = await ctx.sessionController.rename({ sessionId: first.sessionId, title: '  Opening   title  ' })
    assert.equal(renamed.title, 'Opening title')
    const titleEvent = session.snapshotEvents().findLast(event => event.type === 'session/title')
    assert.deepEqual(titleEvent.data, { title: 'Opening title', messageSeqs: [], source: { kind: 'user' } })
    let after
    try { after = await service.snapshot(scope) } catch (error) { after = { code: error.code } }
    const evidence = { before: { status: before.status, revision: before.revision }, after: { status: after.status, code: after.code },
      events: session.snapshotEvents().map(event => ({ seq: event.seq, type: event.type, data: event.type === 'session/title' ? event.data : undefined })),
      modelRequests, activityEvents: session.snapshotEvents().filter(event => /^(turn\/|user\/|assistant\/|agent\/inbox|request\/)/.test(event.type)).length }
    if (process.env.DSH_TAVERN_TITLE_EVIDENCE) writeFileSync(process.env.DSH_TAVERN_TITLE_EVIDENCE, JSON.stringify(evidence, null, 2))
    assert.equal(modelRequests, 0); assert.equal(evidence.activityEvents, 0)
    assert.equal(after.status, 'available', JSON.stringify(evidence))
    const write = (capability, revision, operationId) => service.cardWrite({ capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -1 }], expectedRevision: revision, operationId, cause: 'user-interaction' })
    await assert.rejects(write(original.capability, before.revision, 'old-title'), { code: 'MVU_READ_ONLY' })
    const firstRename = await bind()
    await ctx.sessionController.rename({ sessionId: first.sessionId, title: 'Other title' })
    await ctx.sessionController.rename({ sessionId: first.sessionId, title: 'Opening title' })
    await assert.rejects(write(firstRename.capability, before.revision, 'title-restored'), { code: 'MVU_READ_ONLY' })
    const fresh = await bind()
    assert.equal((await write(fresh.capability, before.revision, 'fresh-title')).variables.stat_data.hp, 9)
    const second = await host.createSession({ cwd: directory, title: 'New playthrough' }), secondScope = bindMembership(second.sessionId)
    const secondSession = ctx.sessions.get(second.sessionId)
    assert.deepEqual(secondSession.snapshotEvents().findLast(event => event.type === 'session/title').data, { title: 'New playthrough', messageSeqs: [], source: { kind: 'user' } })
    assert.equal((await service.snapshot(secondScope)).status, 'available')
    assert.equal(secondSession.snapshotEvents().filter(event => /^(turn\/|user\/|assistant\/|agent\/inbox|request\/)/.test(event.type)).length, 0)
    assert.equal(modelRequests, 0)
    evidence.tavernCreateTitle = { status: (await service.snapshot(secondScope)).status, events: secondSession.snapshotEvents().map(event => ({ seq: event.seq, type: event.type, data: event.type === 'session/title' ? event.data : undefined })), modelRequests, activityEvents: 0 }
    evidence.oldCapabilityRejected = true; evidence.titleAbaRejected = true; evidence.freshWriteRevision = before.revision + 1
    if (process.env.DSH_TAVERN_TITLE_EVIDENCE) writeFileSync(process.env.DSH_TAVERN_TITLE_EVIDENCE, JSON.stringify(evidence, null, 2))
    await ctx.sessions.flush(session); await ctx.sessions.flush(secondSession)
  } finally { service?.dispose(); await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
