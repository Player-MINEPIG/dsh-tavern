import { createSessionReader } from 'dsh-prompt-assembler/session-reader'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import assembler from 'dsh-prompt-assembler/plugin'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { REPAIR_TOOL } from '../packages/tavern-loader/src/repair-command.js'
import { MAINTENANCE_TOOL } from '../packages/tavern-loader/src/maintenance-tools.js'

const root = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official Host runs chat repair, scoped maintenance tools and plugin disposal', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis')
  const { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt')
  const directory = mkdtempSync(join(tmpdir(), 'maintenance-tools-host-'))
  const rp = join(directory, 'rp'); mkdirSync(rp)
  const ctx = new Context()
  let store, handle
  const mount = async enabled => {
    handle = ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(scope) {
      store = tavern.apply(scope, { storageDir: join(directory, 'tavern'), maintenanceTools: enabled })
    } })
    await handle
  }
  try {
    ctx.provide('directoryPickerController', {})
    await ctx.plugin(SystemPrompt, { personaPrefix: 'OFFLINE' })
    await ctx.plugin(await load('@deepseek-ai/dsh-session-persistence-jsonl'), { root: join(directory, 'sessions') })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'tool-executor-native', 'agent-loop']) {
      await ctx.plugin(((await load(`@deepseek-ai/dsh-${name}`)).default ?? await load(`@deepseek-ai/dsh-${name}`)), name === 'agent-loop' ? { agents: [] } : {})
    }
    await ctx.plugin(((await load('@deepseek-ai/dsh-storage')).default ?? await load('@deepseek-ai/dsh-storage')))
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-json'), { root: join(directory, 'storage') })
    await ctx.plugin(await load('@deepseek-ai/dsh-storage-domain'), { backend: 'json' })
    await ctx.plugin(((await load('@deepseek-ai/dsh-workspace')).default ?? await load('@deepseek-ai/dsh-workspace')))
    await ctx.plugin(((await load('@deepseek-ai/dsh-typert-registry')).default ?? await load('@deepseek-ai/dsh-typert-registry')))
    await ctx.plugin(((await load('@deepseek-ai/dsh-api-remote-access')).default ?? await load('@deepseek-ai/dsh-api-remote-access')))
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'offline', model: 'maintenance' }), saveSelection: async () => {} })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {}, bindPrompt: () => ({ commit() {}, [Symbol.dispose]() {} }) })
    ctx.provide('attachments', { admitPromptContent: async content => content })
    ctx.provide('shell', { sandboxMode: 'workspace-write' }); ctx.provide('approval', { config: { policy: 'ask' } })
    new (await load('@deepseek-ai/dsh-session-query')).SessionQueryEngine(ctx)
    ctx.provide('fs', {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-gateway')).TypertGatewayService, {})
    await ctx.plugin((await load('@deepseek-ai/dsh-api-session-controller')).SessionController, { nativeOpen: false })
    await ctx.plugin((await load('@deepseek-ai/dsh-api-workspace-controller')).WorkspaceController)
    await ctx.plugin((await load('@deepseek-ai/dsh-commands')).CommandRuntime)
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await mount(false)
    assert.equal(ctx.tools.schemas().some(tool => tool.name === REPAIR_TOOL), false)
    assert.equal(ctx.tools.schemas().some(tool => tool.name === MAINTENANCE_TOOL), false)
    await handle.dispose()
    await mount(true)
    assert.equal(ctx.tools.schemas().filter(tool => tool.name === MAINTENANCE_TOOL).length, 1)
    await store.playWorkspaceStore.bindRoot(rp)
    const created = await ctx.sessionController.create({ cwd: rp })
    const nativeBefore = await createSessionReader(ctx)(created.sessionId)
    const rows = [
      { id: 'playthrough-missing', path: 'card/playthrough-missing/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'missing-session-fixture' } } },
      { id: 'playthrough-live', path: 'card/playthrough-live/timeline.json', ext: { pmpDshTavern: { rootSessionId: created.sessionId } } },
    ]
    for (const row of rows) store.playWorkspaceStore.writeFile(row.path, '{"nodes":[]}', { expectedRevision: null, expectedRevisionPresent: true })
    store.playWorkspaceStore.writeFile('catalog.json', JSON.stringify({ playthroughs: rows }), { expectedRevision: null, expectedRevisionPresent: true })
    let seq = 0
    const call = async (arguments_, name = MAINTENANCE_TOOL, expectError = false) => {
      const { agent } = await ctx.sessionController.resolveAgent(created.sessionId)
      const signal = new AbortController().signal
      const toolSet = await ctx.tools.resolve({ agent, modelSelection: agent.model.current(), signal })
      try {
        const batch = await ctx.tools.execute({ agent, signal, toolSet, calls: [{ id: `maintenance-${++seq}`, name, arguments: arguments_ }] })
        const result = batch.results[0].result
        assert.equal(result.isError, expectError, JSON.stringify(result))
        return result.value
      } finally { toolSet.dispose() }
    }
    const repair = await call({}, REPAIR_TOOL)
    assert.deepEqual(repair.items, [{ id: rows[0].id, changes: [], remaining: [{
      reason: 'PLAY_SESSION_NOT_FOUND', sessionId: 'missing-session-fixture',
    }] }])
    const preview = await call({})
    assert.equal(preview.items.find(item => item.id === rows[0].id).status, 'invalid')
    assert.equal(preview.items.find(item => item.id === rows[1].id).status, 'available')
    const cleaned = await call({ action: 'clean', ids: [rows[0].id, rows[1].id], workspaceScope: preview.workspaceScope })
    assert.deepEqual(cleaned.results.map(item => item.status), ['cleaned', 'available'])
    await handle.dispose()
    assert.equal(ctx.tools.schemas().some(tool => tool.name === MAINTENANCE_TOOL), false)
    await mount(true)
    const restored = await call({ action: 'restore', ids: [cleaned.results[0].backupId], workspaceScope: preview.workspaceScope })
    assert.equal(restored.results[0].status, 'restored')
    await handle.dispose()
    assert.equal(ctx.tools.schemas().some(tool => tool.name === MAINTENANCE_TOOL), false)
    assert.deepEqual(await createSessionReader(ctx)(created.sessionId), nativeBefore)
    await mount(true)
    const { agent } = await ctx.sessionController.resolveAgent(created.sessionId)
    assert.equal(ctx.commands.list(agent).filter(item => item.name === 'tavern-repair').length, 1)
    const { session } = agent
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    const content = [{ type: 'text', text: 'offline fixture' }]
    session.append('user/message', { role: 'user', id: 'question', content, source: { kind: 'user' } }, { surfaceOp: 'append' })
    session.append('assistant/message', { turn: 1, step: 1, stream: [], message: {
      role: 'assistant', id: 'reply', content, source: { kind: 'model', provider: 'offline', model: 'maintenance' },
    } }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    const beforeRepair = store.playWorkspaceStore.readFile(rows[1].path)
    const fromTool = await call({ action: 'apply', id: rows[1].id }, REPAIR_TOOL)
    assert.equal(fromTool.items[0].changes[0].added, 1)
    store.playWorkspaceStore.writeFile(rows[1].path, beforeRepair.content, {
      expectedRevision: store.playWorkspaceStore.readFile(rows[1].path).revision, expectedRevisionPresent: true,
    })
    session.append('sandbox/mode', { mode: 'read-only' })
    await call({ action: 'apply' }, REPAIR_TOOL, true)
    assert.equal(store.playWorkspaceStore.readFile(rows[1].path).content, beforeRepair.content)
    await handle.dispose()
    await mount(false)
    const beforeCommand = session.snapshotEvents()
    const command = await ctx.commands.execute(agent, '/tavern-repair', [], new AbortController().signal)
    assert.equal(command.result.kind, 'success', JSON.stringify(command))
    assert.match(command.result.text, /已检查 2 个周目/)
    assert.match(command.result.text, /原生会话缺失/)
    assert.match(command.result.text, /已修复 1 个/)
    const repaired = JSON.parse(store.playWorkspaceStore.readFile(rows[1].path).content)
    assert.deepEqual(repaired.nodes[0].variants[0].ext.pmpDshTavern, { sessionFormatVersion: 4 })
    assert.deepEqual((await createSessionReader(ctx)(created.sessionId)).events.slice(beforeCommand.length).map(event => event.type), ['command/run', 'command/done'])
    await handle.dispose()
    assert.equal(ctx.commands.list(agent).some(item => item.name === 'tavern-repair'), false)
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
