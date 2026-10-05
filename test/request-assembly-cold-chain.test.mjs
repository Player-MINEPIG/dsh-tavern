import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createSessionReadContext } from '../packages/request-assembler/session-read-context.js'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { BUILTINS } from '../packages/request-assembler/model.js'

test('preview read contexts isolate concurrent sessions, expire on return and unload, and prefer live replacement', async () => {
  const live = new Map(), reader = createSessionReadContext(id => live.get(id))
  const session = id => ({ id, header: { id } }), a = session('a'), b = session('b')
  let release, entered, later
  const gate = new Promise(r => { release = r }), started = new Promise(r => { entered = r })
  const pending = reader.run(a, async () => { entered(); await gate; assert.equal(reader.getSession('a'), a); assert.equal(reader.getSession('b'), undefined); later = () => reader.getSession('a') })
  await started
  await reader.run(b, async () => { assert.equal(reader.getSession('b'), b); assert.equal(reader.getSession('a'), undefined) })
  assert.equal(reader.getSession('a'), undefined); release(); await pending; assert.equal(later(), undefined)
  await reader.run(a, async () => { live.set('a', b); assert.equal(reader.getSession('a'), b); live.delete('a'); reader.dispose(); assert.equal(reader.getSession('a'), undefined) })
  await assert.rejects(reader.run(a, () => {}), { code: 'PREVIEW_SESSION_UNAVAILABLE' })
})

const runtimeRoot = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT, managerRoot = process.env.DSH_TAVERN_MEMORY_MANAGER_ROOT
test('full official persisted cold preview traverses Tavern catalog, actual Manager defaults and MVU macro leases without resuming or writing', { skip: !runtimeRoot || !managerRoot, timeout: 30000 }, async () => {
  const require = createRequire(join(resolve(runtimeRoot), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const managerPlugin = await import(pathToFileURL(join(resolve(managerRoot), 'src/index.js')).href)
  const directory = mkdtempSync(join(tmpdir(), 'cold-preview-chain-')), storageDir = join(directory, 'tavern'), managerDir = join(directory, 'manager'), playRoot = join(directory, 'play')
  mkdirSync(managerDir); mkdirSync(playRoot)
  const configPath = join(managerDir, 'config.json')
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, revision: 1, entries: [], presets: {} }))
  const calls = { model: 0, provider: 0, resume: 0, events: 0 }, defaults = [], dependencies = []
  let ctx, store, sessionId, resourceId
  const boot = async (managed = false) => {
    ctx = new Context(); const routes = new Map()
    ctx.provide('webServer', { register({ path, handler }) { routes.set(path, handler); return () => routes.delete(path) } })
    ctx.provide('directoryPickerController', {}); ctx.provide('workspaceController', { create: async () => ({ workspace: { workspaceId: 'authored-play' }, created: true }) })
    ctx.provide('workspaceRegistry', { list: () => [], get: () => undefined, archivedSessionIds: [] })
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'HOST {{provider}}/{{model}}' })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-persistence-jsonl')).default, { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('typert', { lookups: { configure: () => () => {} }, contexts: { configureHost: () => () => {} } })
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'authored', model: 'cold-only' }), saveSelection: async () => { throw Error('read must not save model selection') } })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    ctx.provide('fs', {}); ctx.provide('attachments', { imageLimits: { maxImageBytes: 1024 } })
    await ctx.plugin((await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine, {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-session-controller')).SessionController, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-permission-presets')).default, { defaultPreset: 'workspace-write' })
    ctx.on('llm/stream', () => { calls.model++; throw Error('cold preview cannot call a model') }, { global: true, prepend: true })
    for (const method of ['prepareCall', 'resolveCallConfig', 'modelInfo']) ctx.llm[method] = () => { calls.provider++; throw Error('cold preview cannot prepare a provider') }
    await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(c) { store = tavern.apply(c, { storageDir }) } })
    if (managed) await ctx.plugin(managerPlugin, { storageDir: managerDir })
    return routes
  }
  const bytes = root => Object.fromEntries(readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => { const path = join(e.parentPath, e.name); return [path.slice(root.length), readFileSync(path).toString('base64')] }))
  const call = async (routes, id = sessionId) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: id, preset: BUILTINS[0] }))])
    Object.assign(req, { method: 'POST', url: '/pmp-dsh-tavern/api/v1/assembly-presets/preview', headers: { host: '127.0.0.1', origin: 'http://127.0.0.1', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } })
    let result
    await routes.get('/pmp-dsh-tavern/api')(req, { statusCode: 200, setHeader() {}, end(body) { result = { status: this.statusCode, ...JSON.parse(body) } } })
    return result
  }
  try {
    await boot()
    store.characterStore.import(JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Authored cold card', first_mes: 'AUTHORED_GREETING', character_book: { entries: [
      { uid: 1, comment: '[initvar]', content: 'hp: 100', enabled: false },
      { uid: 2, comment: 'State', content: 'COLD_STATE {{format_message_variable::stat_data}}', enabled: true, constant: true, position: 'after_char' }
    ] } } }), { id: 'cold-card' })
    sessionId = (await ctx.sessionController.create({ cwd: directory })).sessionId
    store.sessionSelections.set(sessionId, { characterCardId: 'cold-card' })
    const session = ctx.sessions.get(sessionId), llm = await load('@deepseek-ai/dsh-llm')
    session.append('user/message', llm.createUserMessage({ content: [{ type: 'text', text: 'AUTHORED_COLD_INPUT' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    await ctx.get('tavernMvu').flush()
    resourceId = (await ctx.get('tavernMvu').list({ scope: { sessionId } }))[0].id
    await store.playWorkspaceStore.bindRoot(playRoot)
    const put = (path, data, expectedRevision = null) => store.playWorkspaceStore.writeFile(path, JSON.stringify(data), { expectedRevision, expectedRevisionPresent: true, validate: tavern.validatePlayDocument })
    put('p/timeline.json', { nodes: [] }); put('fork/timeline.json', { nodes: [{ id: 'ancestor', kind: 'qa', parentVariantId: null, adoptedVariantId: 'old', variants: [{ id: 'old', sessionId, startEventId: 0, endEventId: session.seq - 1 }] }] })
    const catalog = { playthroughs: [{ id: 'p', path: 'p/timeline.json', ext: { pmpDshTavern: { rootSessionId: sessionId, characterId: 'cold-card' } } }, { id: 'fork', path: 'fork/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'child', characterId: 'cold-card' } } }] }
    put('catalog.json', catalog)
    await ctx.sessions.flush(session); await ctx.fiber.dispose(); ctx = null
    const routes = await boot(true), service = ctx.get('tavernMvu'), manager = ctx.get('dshMemoryManager')
    await manager.query({ scope: {} }) // Discover fixture ownership without activating or loading a session.
    const originalDefaults = service.getManagementDefaults.bind(service), originalDependency = service.resolvePromptDependency.bind(service)
    service.getManagementDefaults = args => { const result = originalDefaults(args); defaults.push({ id: args.id, valid: result?.checkCurrent() === true }); return result }
    service.resolvePromptDependency = async args => { const result = await originalDependency(args); dependencies.push({ id: result?.id, valid: result?.checkCurrent() === true, checkCurrent: result?.checkCurrent }); return result }
    ctx.sessionController.resolveAgent = async () => { calls.resume++; throw Error('cold preview cannot resume') }
    ctx.on('session/event', () => calls.events++)
    const beforeLog = bytes(join(directory, 'sessions')), beforeState = readFileSync(join(storageDir, 'mvu-instances.json')), beforeConfig = readFileSync(configPath)
    const result = await call(routes)
    assert.equal(result.status, 200, JSON.stringify(result))
    const output = result.preview.messages.flatMap(message => message.content.map(block => block.text)).join('\n')
    assert.match(output, /AUTHORED_COLD_INPUT/); assert.match(output, /COLD_STATE.*hp: 100/s); assert.equal(output.includes('format_message_variable'), false)
    assert(result.preview.diagnostics.some(d => d.code === 'WORLD_BOOK_MVU_VARIABLE_VERSION' && d.resourceId === resourceId))
    assert(defaults.some(d => d.id === resourceId && d.valid)); assert(dependencies.some(d => d.id === resourceId && d.valid))
    assert(dependencies.filter(d => d.valid).every(d => d.checkCurrent() === false), 'cold dependency leases expire when the preview returns')
    assert.equal(ctx.sessions.get(sessionId), undefined); assert.equal(ctx.agents.get(sessionId), undefined)
    assert.deepEqual(bytes(join(directory, 'sessions')), beforeLog); assert.deepEqual(readFileSync(join(storageDir, 'mvu-instances.json')), beforeState); assert.deepEqual(readFileSync(configPath), beforeConfig)
    assert.equal((await call(routes, 'absent-session')).status, 404)
    await assert.rejects(service.resolvePromptDependency({ id: resourceId, scope: { authority: 'local', sessionId },
      event: { preview: true, usage: 'world-book-variable', consumer: { adapterId: 'tavern.world-books', id: 'world-book:one' } } }), { code: 'MVU_SESSION_LEASE' })
    const policy = rule => ({ id: resourceId, adapterId: 'tavern.mvu', type: 'mvu-state', whitelist: [{ sessionId }], blacklist: [],
      retrieve: { on: 'before_model_request', rule, strategy: ['read_content', 'render_state_and_update_instructions', 'provide_to_model'].map(operation => ({ operation })) } })
    let configRevision = 1
    const configure = async rule => { writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, revision: ++configRevision, entries: [policy(rule)], presets: {} })); await manager.reload() }
    await configure(false)
    const policyDenied = await call(routes)
    assert.equal(policyDenied.code, 'WORLD_BOOK_VARIABLE_DENIED'); assert.equal(policyDenied.preview, undefined)
    let release, entered
    const gate = new Promise(r => { release = r }), waiting = new Promise(r => { entered = r })
    const stopCondition = manager.registerCondition({ id: 'cold-preview-wait', test: async () => { entered(); await gate; return true } })
    await configure('cold-preview-wait')
    const pending = call(routes); await waiting; await configure(false); release()
    const changed = await pending
    assert.equal(changed.code, 'WORLD_BOOK_VARIABLE_DENIED'); assert.equal(changed.preview, undefined); stopCondition()
    writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, revision: ++configRevision, entries: [], presets: {} })); await manager.reload()
    catalog.playthroughs[1].ext.pmpDshTavern.characterId = 'foreign'
    put('catalog.json', catalog, store.playWorkspaceStore.readFile('catalog.json').revision)
    const denied = await call(routes)
    assert.notEqual(denied.status, 200); assert.equal(denied.code, 'WORLD_BOOK_VARIABLE_DENIED'); assert.equal(denied.preview, undefined)
    assert.deepEqual(bytes(join(directory, 'sessions')), beforeLog); assert.deepEqual(readFileSync(join(storageDir, 'mvu-instances.json')), beforeState)
    assert.deepEqual(calls, { model: 0, provider: 0, resume: 0, events: 0 })
    assert.equal(manager.traces.some(fact => fact.phase === 'applied'), false)
    catalog.playthroughs[1].ext.pmpDshTavern.characterId = 'cold-card'
    put('catalog.json', catalog, store.playWorkspaceStore.readFile('catalog.json').revision)
    await ctx.fiber.dispose(); ctx = null
    const unallocated = JSON.parse(beforeState); delete unallocated.resources[resourceId]
    const unallocatedBytes = JSON.stringify(unallocated)
    writeFileSync(join(storageDir, 'mvu-instances.json'), unallocatedBytes)
    const freshRoutes = await boot(true)
    ctx.sessionController.resolveAgent = async () => { calls.resume++; throw Error('cold preview cannot resume') }
    ctx.on('session/event', () => calls.events++)
    const unavailable = await call(freshRoutes)
    assert.equal(unavailable.status, 409); assert.equal(unavailable.code, 'MVU_PREVIEW_STATE_UNAVAILABLE'); assert.equal(unavailable.preview, undefined)
    assert.equal(readFileSync(join(storageDir, 'mvu-instances.json'), 'utf8'), unallocatedBytes)
    assert.deepEqual(bytes(join(directory, 'sessions')), beforeLog)
    assert.deepEqual(calls, { model: 0, provider: 0, resume: 0, events: 0 })
  } finally { await ctx?.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
