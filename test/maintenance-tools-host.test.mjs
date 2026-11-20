import { createSessionReader } from 'dsh-prompt-assembler/session-reader'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import assembler from 'dsh-prompt-assembler/plugin'
import * as tavern from '../packages/tavern-loader/src/index.js'
import { createCreationService } from '../packages/play/src/creation.js'
import { createGenerationService } from '../packages/play/src/generation.js'
import { createRollbackService } from '../packages/play/src/rollback.js'
import { createContractOperation } from '../packages/play/src/operation-contract.js'
import { REPAIR_TOOL } from '../packages/tavern-loader/src/repair-command.js'
import { MAINTENANCE_TOOL } from '../packages/tavern-loader/src/maintenance-tools.js'

const root = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT

async function verifyGenerationAndFork({ ctx, load, workspace, row, nodeId, expectedWorkspaceScope }) {
  const { LlmAdapter } = await load('@deepseek-ai/dsh-llm')
  const answer = 'Offline swipe result'
  class Offline extends LlmAdapter {
    async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
    async *stream() {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: answer }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: answer } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['offline'], new Offline())

  const admitted = Promise.withResolvers()
  const sends = []
  const generation = createGenerationService(workspace, {
    ...workspace.host,
    async promptSession(request) {
      sends.push(request)
      try {
        const result = await workspace.host.promptSession(request)
        admitted.resolve()
        return result
      } catch (error) {
        admitted.reject(error)
        throw error
      }
    },
  })
  const operation = name => createContractOperation({ operation: name, meta: { playthroughId: row.id } })
  const generationOp = operation('playthrough.generation')
  const identity = { operationKey: randomUUID(), expectedWorkspaceScope }
  const start = { ...identity, action: 'start', kind: 'reply-swipe', nodeId, expectedRevision: workspace.readFile(row.path).revision }
  const generated = await generation.run(row.id, start, generationOp)
  await admitted.promise
  const { agent } = await ctx.sessionController.resolveAgent(generated.sessionId)
  await agent.whenIdle()

  const read = createSessionReader(ctx)
  const { events } = await read(generated.sessionId)
  assert.equal(sends.length, 1)
  assert.equal(sends[0].sessionId, generated.sessionId)
  assert.equal(sends[0].text, 'offline fixture')
  assert.ok(sends[0].requestId)
  const inputs = events.filter(event => event.type === 'user/message' && event.data.source?.rpcId === sends[0].requestId)
  assert.equal(inputs.length, 1, 'native prompt must echo its requestId in the durable user source')
  const user = inputs[0]
  const reply = events.find(event => event.type === 'assistant/message' && event.data.message.content.some(part => part.text === answer))
  const end = events.find(event => event.type === 'turn/end' && event.seq > user.seq)
  assert.equal(end?.data.reason.kind, 'completed')
  assert.ok(user.seq < reply?.seq && reply.seq < end.seq)

  const status = await generation.run(row.id, { ...identity, action: 'status' }, generationOp)
  assert.equal(status.state, 'ready', JSON.stringify(status))
  const finished = await generation.run(row.id, { ...identity, action: 'finish' }, generationOp)
  const saved = JSON.parse(workspace.readFile(row.path).content)
  assert.equal(saved.head.sessionId, generated.sessionId)
  assert.deepEqual(saved.head, finished.timeline.head)
  const variant = saved.nodes.find(node => node.id === nodeId).variants.find(item => item.id === saved.head.variantId)
  assert.deepEqual([variant.startEventId, variant.endEventId], [user.seq, reply.seq])
  assert.equal((await generation.run(row.id, start, generationOp)).sessionId, generated.sessionId)
  assert.equal(sends.length, 1)

  const creation = createCreationService(workspace, workspace.host)
  const creationOp = operation('playthrough.fork')
  const request = { nodeId, creationId: randomUUID(), expectedWorkspaceScope, expectedRevision: workspace.readFile(row.path).revision }
  const fork = await creation.run(row.id, request, creationOp)
  assert.notEqual(fork.sessionId, generated.sessionId)
  const child = await read(fork.sessionId)
  assert.equal(child.inheritedEventCount, reply.seq + 1)
  assert.equal(child.events[user.seq].data.source.rpcId, sends[0].requestId)
  assert.equal(child.events[reply.seq].data.message.id, reply.data.message.id)
  const catalog = JSON.parse(workspace.readFile('catalog.json').content)
  const published = catalog.playthroughs.filter(item => item.id === fork.playthrough.id)
  assert.deepEqual(published, [fork.playthrough])
  assert.equal(published[0].ext.pmpDshTavern.rootSessionId, fork.sessionId)
  assert.equal(JSON.parse(workspace.readFile(published[0].path).content).head.sessionId, fork.sessionId)
  assert.equal(workspace.readFile(row.path).revision, request.expectedRevision)
  assert.equal((await creation.run(row.id, request, creationOp)).sessionId, fork.sessionId)
}

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
    ctx.provide('attachments', { admitPromptContent: async content => content, imageLimits: { maxImageBytes: 1024,
      maxImagesPerMessage: 4, maxMessageImageBytes: 4096, maxImagePixels: 4096, maxImageDimension: 1024, mediaTypes: ['image/png'] } })
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
    const repairChat = await ctx.sessionController.create({ workspaceId: store.playWorkspaceStore.get().workspaceId })
    const { agent: repairAgent } = await ctx.sessionController.resolveAgent(repairChat.sessionId)
    assert.notEqual(repairChat.sessionId, created.sessionId)
    assert.equal(realpathSync(repairAgent.session.header.cwd), realpathSync(rp))
    const executeRepair = id => ctx.commands.execute(repairAgent, `/tavern-repair assist ${id}`, [], new AbortController().signal)
    const offset = repairAgent.session.snapshotEvents().length
    assert.match((await executeRepair(rows[1].id)).result.text, /已检查 1 个周目，已修复 0 个/)
    assert.deepEqual(repairAgent.session.snapshotEvents().slice(offset).map(event => event.type), ['command/run', 'command/done'])
    const unresolved = await executeRepair(rows[0].id)
    assert.equal(unresolved.result.kind, 'success', unresolved.result.text)
    assert.match(unresolved.result.text, /已将待处理项提交/)
    const queued = repairAgent.session.snapshotEvents().filter(event => event.type === 'agent/inbox/spliced').flatMap(event => event.data.inserted ?? [])
    assert.equal(queued.length, 1)
    assert.match(queued[0].content[0].text, /playthrough-missing/)
    assert.deepEqual(agent.inbox.nextTurn, [])
    assert.deepEqual(session.snapshotEvents().slice(beforeCommand.length).map(event => event.type), ['command/run', 'command/done'])
    const workspace = store.playWorkspaceStore
    const binding = workspace.get()
    const rollbackRequest = { nodeId: repaired.nodes[0].id, expectedRevision: workspace.readFile(rows[1].path).revision,
      expectedWorkspaceScope: JSON.stringify([binding.workspaceId, binding.rootPath]) }
    const rollback = createRollbackService(workspace, workspace.host)
    const operation = createContractOperation({ operation: 'playthrough.rollback', meta: { playthroughId: rows[1].id } })
    workspace.beforeRename = () => { throw new Error('interrupted before head write') }
    await assert.rejects(rollback.run(rows[1].id, rollbackRequest, operation), /interrupted before head write/)
    workspace.beforeRename = null
    const previewPending = await ctx.commands.execute(repairAgent, '/tavern-repair preview', [], new AbortController().signal)
    assert.match(previewPending.result.text, /回退未完成/)
    const recovered = await executeRepair(rows[1].id)
    assert.match(recovered.result.text, /已核实并恢复回退位置/)
    assert.match(recovered.result.text, /备份/)
    const rolled = await rollback.run(rows[1].id, rollbackRequest, operation)
    assert.notEqual(rolled.sessionId, created.sessionId)
    assert.equal(rolled.timeline.head.sessionId, rolled.sessionId)
    assert.equal((await rollback.run(rows[1].id, rollbackRequest, operation)).sessionId, rolled.sessionId)
    await verifyGenerationAndFork({ ctx, load, workspace, row: rows[1], nodeId: repaired.nodes[0].id,
      expectedWorkspaceScope: rollbackRequest.expectedWorkspaceScope })
    await handle.dispose()
    assert.equal(ctx.commands.list(agent).some(item => item.name === 'tavern-repair'), false)
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
