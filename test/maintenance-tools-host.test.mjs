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
import { MAINTENANCE_TOOL } from '../packages/tavern-loader/src/maintenance-tools.js'

const root = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

test('official Host tools opt in, preview, clean, restore, remount and dispose without changing native sessions', { skip: !root }, async () => {
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
    await ctx.plugin(assembler, { storageDir: join(directory, 'assembler') })
    await mount(false)
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
    const call = async arguments_ => {
      const { agent } = await ctx.sessionController.resolveAgent(created.sessionId)
      const signal = new AbortController().signal
      const toolSet = await ctx.tools.resolve({ agent, modelSelection: agent.model.current(), signal })
      try {
        const batch = await ctx.tools.execute({ agent, signal, toolSet, calls: [{ id: `maintenance-${++seq}`, name: MAINTENANCE_TOOL, arguments: arguments_ }] })
        const result = batch.results[0].result
        assert.equal(result.isError, false, JSON.stringify(result))
        return result.value
      } finally { toolSet.dispose() }
    }
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
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
