import { installIndependentAssembler } from './helpers/assembler-host.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandHookDeclaration, commandHookSourceFromCharacter } from '../packages/mvu-adapter/src/command-hook-declaration.js'
import { commandHookInput, commandsFromHook } from '../packages/mvu-adapter/src/command-hook-commands.js'
import { createCommandProcessor } from '../packages/mvu-adapter/src/command-processor.js'
import { MvuService } from '../packages/mvu-adapter/src/service.js'
import { confirmMvuCommandHooks } from '../packages/client/src/play/mvu-builtins.js'

// Authored fixtures only. Private card Helpers are tested outside the repository.
const helper = body => `(()=>{let registered=false;const callback=(variables,commands,text)=>{${body}};const register=()=>{if(!registered){eventMakeLast(Mvu.events.COMMAND_PARSED,callback);registered=true}};eventOn('global_Mvu_initialized',register);register()})();`
const pass = helper('')
const scope = { sessionId: 's', authority: 'local' }
const patch = value => `<JSONPatch>[{"op":"replace","path":"/hp","value":${value}}]</JSONPatch>`
const initial = { stat_data: { hp: 10 }, schema: { type: 'object', properties: { hp: { type: 'number' } }, extensible: false } }
const session = (text = patch(8), turn = 1, userText = '') => ({ id: 's', header: { id: 's', version: 4 }, snapshotEvents: () => [
  { seq: 4 * turn, type: 'turn/start', data: { turn } },
  { seq: 4 * turn + 1, type: 'user/message', data: { turn, message: { content: [{ type: 'text', text: userText }], source: { kind: 'user' } } } },
  { seq: 4 * turn + 2, type: 'assistant/message', data: { turn, message: { id: `a${turn}`, content: [{ type: 'text', text }] } } },
  { seq: 4 * turn + 3, type: 'turn/end', data: { turn, reason: { kind: 'completed' } } },
] })
async function fixture(run, options = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-command-'))
  const service = new MvuService({ storageDir, resources: [{ id: 'mvu:test', sharing: 'shared', sessionIds: ['s'], initial, commandSource: pass, ...options.resource }], ...options })
  try { await run(service, storageDir) } finally { service.dispose(); rmSync(storageDir, { recursive: true, force: true }) }
}
const read = service => service.read({ id: 'mvu:test', scope })

test('conversion roundtrips op/from/key/target, literal keys, pointer escaping and ordered mixed source commands', () => {
  const text = `_.set('hp',10,1);<JSONPatch>[{"op":"move","from":"/a~1b/x.y","path":"/c~0d/[k]"},{"op":"add","path":"/list/0","value":{"nested":["x","y"]}},{"op":"replace","path":"/quote\\\"key","value":"_.set('hp',999)"}]</JSONPatch>_.delete('list',2);`
  const input = commandHookInput(text)
  assert.deepEqual(commandsFromHook(input.view, input.admitted), input.admitted)
  assert.deepEqual(input.admitted[1], { op: 'move', path: ['c~d', '[k]'], from: ['a/b', 'x.y'] })
  assert.equal(input.view[0].full_match, "_.set('hp',10,1)")
  assert.deepEqual(input.view[0].args, ['hp', '10', '1'])
  assert.equal(input.view[1].reason, 'json_patch')
  assert.throws(() => commandsFromHook([...input.view].reverse(), input.admitted), { code: 'MVU_COMMAND_HOOK_OUTPUT' })
  assert.throws(() => commandsFromHook([{ type: 'set', args: ['hp', '999'] }], input.admitted), { code: 'MVU_COMMAND_HOOK_OUTPUT' })
})

test('repair admission is narrow and unsafe/unsupported/oversized commands keep their fatal errors', () => {
  const repaired = commandHookInput('<JSONPatch>[{"op":"replace","path":"/hp":{"n":1}}]</JSONPatch>')
  assert.deepEqual(repaired.view, [])
  assert.deepEqual(repaired.admitted, [{ op: 'set', path: ['hp'], value: { n: 1 } }])
  assert.throws(() => commandHookInput('<JSONPatch>[{"op":"replace","path":"/hp":1}]</JSONPatch>'), { code: 'MVU_PARSE' })
  assert.throws(() => commandHookInput('<JSONPatch>[{"op":"copy","from":"/x","path":"/hp"}]</JSONPatch>'), { code: 'MVU_UNSUPPORTED' })
  assert.throws(() => commandHookInput(patch(1).replace('/hp', '/__proto__/x')), { code: 'MVU_PATH' })
  assert.throws(() => commandHookInput('x'.repeat(1024 * 1024 + 1)), { code: 'MVU_LIMIT' })
})

test('real initialization, eventMakeLast ordering and listener deduplication occur before an actual callback', async () => {
  const source = `(()=>{const last=(v,c)=>c.shift();const first=(v,c)=>c.reverse();const register=()=>{eventMakeLast(Mvu.events.COMMAND_PARSED,last);eventOn(Mvu.events.COMMAND_PARSED,first);eventMakeLast(Mvu.events.COMMAND_PARSED,last)};eventOn('global_Mvu_initialized',register);register()})();`
  const processor = await createCommandProcessor(source)
  try {
    assert.equal(processor.listenerCount, 2)
    // Reverse [hp=7,hp=8], then remove the first => the original hp=7.
    assert.deepEqual(await processor.process({ variables: initial, text: `${patch(7)}${patch(8)}` }), [{ op: 'set', path: ['hp'], value: 7 }])
  } finally { processor.dispose() }
})

test('baseline and sandbox boundaries are enforced; failed processing cannot poison the next callback', async () => {
  for (const body of ['variables.stat_data.hp=1', 'commands[0].args[1]="999"', 'while(true){}', 'fetch("https://invalid.example")', 'return Promise.resolve()']) {
    const processor = await createCommandProcessor(helper(body))
    try { await assert.rejects(processor.process({ variables: initial, text: patch(8) }), error => /^MVU_COMMAND_HOOK_/.test(error.code)); assert.equal(initial.stat_data.hp, 10) }
    finally { processor.dispose() }
  }
  const processor = await createCommandProcessor(helper('if(text.includes("reject"))throw Error("fixture");'))
  try { await assert.rejects(processor.process({ variables: initial, text: patch(8) + 'reject' })); assert.equal((await processor.process({ variables: initial, text: patch(8) }))[0].value, 8) }
  finally { processor.dispose() }
})

test('same-turn gate context is a narrowing guard and is cleared between requests', async () => {
  const source = helper('const gate=globalThis.fixtureGate;if(!gate.extractOperationBlock(gate.latestUserText()).includes("allow"))commands.length=0;')
  assert.equal(commandHookDeclaration(source).gateGlobal, 'fixtureGate')
  const processor = await createCommandProcessor(source)
  try {
    const userText = '<本轮APP操作><本轮执行边界>one</本轮执行边界><操作项>allow</操作项></本轮APP操作>'
    assert.equal((await processor.process({ variables: initial, text: patch(8), userText })).length, 1)
    assert.equal((await processor.process({ variables: initial, text: patch(8) })).length, 0)
    assert.equal((await processor.process({ variables: initial, text: patch(8), userText: userText + userText })).length, 0)
    assert.equal((await processor.process({ variables: initial, text: patch(8), userText: userText + '<本轮操作>' })).length, 0)
  } finally { processor.dispose() }
})

test('enabled character declarations are singular; disabled folders and conflicting declarations are rejected', () => {
  const card = scripts => ({ source: { raw: { data: { extensions: { tavern_helper: [['scripts', scripts]] } } } } })
  assert.equal(commandHookSourceFromCharacter(card([{ enabled: true, content: pass }, { enabled: false, content: helper('commands.length=0') }])), pass)
  assert.equal(commandHookSourceFromCharacter(card([{ enabled: false, scripts: [{ enabled: true, content: pass }] }])), null)
  assert.throws(() => commandHookSourceFromCharacter(card([{ content: pass }, { content: helper('commands.length=0') }])), { code: 'MVU_COMMAND_HOOK_CONFLICT' })
})

test('one processor registration survives repeated snapshots; replay/restart do not execute the old reply again', () => fixture(async (service, storageDir) => {
  const registration = await read(service), again = await read(service)
  assert.equal(registration.commandProcessor.registrationId, again.commandProcessor.registrationId)
  assert.equal(registration.revision, 0)
  confirmMvuCommandHooks([{ source: pass }], await service.snapshot(scope))
  const facts = []; service.observe(fact => facts.push(fact))
  await service.ingest(session()); await service.ingest(session())
  assert.equal((await read(service)).content.stat_data.hp, 8)
  assert.equal((await read(service)).revision, 1)
  assert.equal(facts.filter(f => f.phase === 'applied').length, 1)
  service.dispose()
  const restored = new MvuService({ storageDir, resources: [{ id: 'mvu:test', sharing: 'shared', sessionIds: ['s'], initial, commandSource: pass }] })
  try { await restored.ingest(session()); assert.equal((await read(restored)).revision, 1) } finally { restored.dispose() }
}))

test('managed denial never runs a command processor; native no-handler retains its original commit path', () => fixture(async service => {
  await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 8)
}, { resource: { managementMode: 'native' } }).then(() => fixture(async service => {
  const facts = []; service.observe(fact => facts.push(fact))
  await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 10)
  assert.equal(facts.filter(f => f.phase === 'applied').length, 0)
}, { resource: { managementMode: 'managed', commandSource: helper('throw Error("must not execute")') } })))

test('manager same-handler reload is rechecked synchronously after callback, before save', () => fixture(async service => {
  let policy = true, checks = 0
  service.registerUsage(() => ({ enabled: true, configRevision: 4, checkCurrent: () => { checks++; return policy } }))
  service.resolveCommandHook = () => ({ source: pass, checkCurrent: () => { if (++checks === 2) policy = false; return true } })
  const facts = []; service.observe(fact => facts.push(fact))
  await assert.rejects(service.ingest(session()), { code: 'MVU_USAGE_CANCELLED' })
  service.resolveCommandHook = undefined
  assert.equal((await read(service)).revision, 0)
  assert.equal(facts.some(f => f.phase === 'applied'), false)
  policy = true; await service.ingest(session())
  assert.equal(facts.find(f => f.phase === 'applied').configRevision, 4)
}, { resource: { managementMode: 'managed' } }))

test('source lease, selection ABA and service disposal cancel pending registration without consuming the reply', async () => {
  for (const boundary of ['source', 'selection', 'dispose', 'registration']) await fixture(async service => {
    let current = true
    service.capturePromptScope = () => () => current
    const entered = new Promise(resolve => service.registerUsage(() => { resolve(); return { enabled: true, checkCurrent: () => true } }))
    const pending = service.ingest(session()); const rejected = assert.rejects(pending, error => ['MVU_USAGE_CANCELLED', 'MVU_DISPOSED'].includes(error.code))
    await entered
    if (boundary === 'source') service.resolveCommandHook = () => ({ source: pass, checkCurrent: () => false })
    else if (boundary === 'selection') current = false
    else if (boundary === 'dispose') service.dispose()
    else { const first = service.registerCommandProcessor({ id: 'mvu:test', source: pass }); const handled = first.catch(error => error.code); const second = await service.registerCommandProcessor({ id: 'mvu:test', source: helper('') + '\n ' }); second.dispose(); await handled }
    await rejected
    if (boundary !== 'dispose') { service.resolveCommandHook = undefined; assert.equal((await read(service)).revision, 0) }
  }, { resource: { commandSource: boundary === 'registration' ? null : pass } })
})

test('old disposer cannot remove replacement registration; receipt alone never claims a committed state', () => fixture(async service => {
  const old = await service.registerCommandProcessor({ id: 'mvu:test', source: pass })
  const next = await service.registerCommandProcessor({ id: 'mvu:test', source: helper('commands.length=0') })
  old.dispose()
  // Explicit Host registration, with no configured automatic declaration.
  service.resources[0] = { ...service.resources[0], commandSource: undefined }
  assert.equal((await read(service)).commandProcessor.registrationId, next.receipt.registrationId)
  await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 10)
  assert.throws(()=>confirmMvuCommandHooks([{source:next.receipt.source}],null),error=>error.code==='MVU_SNAPSHOT_UNAVAILABLE')
  for (const snapshot of [{ status: 'available', commandProcessor: { ...next.receipt, source: 'different' } }, { status: 'available', commandProcessor: { ...next.receipt, registered: false } }]) assert.throws(() => confirmMvuCommandHooks([{ source: next.receipt.source }], snapshot), /successful source registration/)
}))

test('trusted ingest carries bounded same-turn user text, never a prior-turn operation block', () => fixture(async service => {
  const gate = '<本轮操作><本轮执行边界>one</本轮执行边界><操作项>allow</操作项></本轮操作>'
  const first = session(patch(8), 1, gate)
  await service.ingest(first)
  assert.equal((await read(service)).content.stat_data.hp, 8)
  const second = session(patch(6), 2, 'ordinary user text')
  await service.ingest({ ...second, snapshotEvents: () => [...first.snapshotEvents(), ...second.snapshotEvents()] })
  assert.equal((await read(service)).content.stat_data.hp, 8)
}, { resource: { commandSource: helper('const gate=globalThis.fixtureGate;if(!gate.extractOperationBlock(gate.latestUserText()).includes("allow"))commands.length=0;') } }))

test('callback errors recheck policy and selection before writing a failure receipt; cancelled replies remain retryable', async () => {
  for (const mode of ['policy', 'selection']) await fixture(async service => {
    let valid = true
    service.capturePromptScope = () => () => mode === 'policy' || valid
    service.registerUsage(() => ({ enabled: true, checkCurrent: () => mode === 'selection' || valid }))
    service.resolveCommandHook = () => ({ source: helper('throw Error("callback fixture")'), checkCurrent: () => { valid = false; return true } })
    const facts = []; service.observe(f => facts.push(f))
    await assert.rejects(service.ingest(session()), { code: 'MVU_USAGE_CANCELLED' })
    service.resolveCommandHook = undefined; valid = true
    assert.equal((await read(service)).revision, 0)
    await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 8)
    assert.equal(facts.filter(f => f.phase === 'applied').length, 1)
  })
})

test('valid whole-state and reply budgets remain separate during bounded processor serialization', async () => {
  const processor = await createCommandProcessor(pass)
  const pad = 'x'.repeat(700 * 1024), variables = { stat_data: { hp: 10, pad }, display_data: { hp: 10, pad }, schema: { type: 'object' } }
  try { assert.equal((await processor.process({ variables, text: 'n'.repeat(650 * 1024) + patch(8) }))[0].value, 8) } finally { processor.dispose() }
})

test('source revocation during failed initialization cancels without persisting a poison receipt', () => fixture(async service => {
  let current = true
  service.resolveCommandHook = () => {
    queueMicrotask(() => { current = false })
    return { source: pass + ';throw Error("initialization failed")', checkCurrent: () => current }
  }
  await assert.rejects(service.ingest(session()), { code: 'MVU_USAGE_CANCELLED' })
  service.resolveCommandHook = undefined
  assert.equal((await read(service)).revision, 0)
  await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 8)
}))

test('official AgentLoop/loader snapshot carries its own user gate through a single source-owned commit', { skip: !process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT }, async t => {
  const { createRequire } = await import('node:module'), { pathToFileURL } = await import('node:url')
  const require = createRequire(join(process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT, 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis')
  const llm = await load('@deepseek-ai/dsh-llm'), tavern = await import('../packages/tavern-loader/src/index.js')
  const ctx = new Context(), storageDir = mkdtempSync(join(tmpdir(), 'mvu-command-official-')), errors = []
  t.after(async () => { await ctx.fiber.dispose(); rmSync(storageDir, { recursive: true, force: true }) })
  for (const name of ['sessionController', 'workspaceController', 'directoryPickerController']) ctx.provide(name, {})
  await ctx.plugin((await load('@deepseek-ai/dsh-system-prompt')).default, {})
  for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
  class Adapter extends llm.LlmAdapter {
    async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
    async *stream() {
      const text = patch(8)
      yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }; yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['command-fixture'], new Adapter()); ctx.on('agent/error', e => errors.push(e.error))
  const commandSource = helper('const gate=globalThis.fixtureGate;if(!gate.extractOperationBlock(gate.latestUserText()).includes("allow"))commands.length=0;')
  const resource = { id: 'mvu:official-command', sessionIds: ['*'], initial, commandSource }
  await installIndependentAssembler(ctx, storageDir)
  await ctx.plugin({ name: tavern.name, inject: tavern.inject, apply(context) { tavern.apply(context, { storageDir, mvu: { resources: [resource] } }) } })
  const service = ctx.get('tavernMvu'), handle = await ctx.agents.create({ sessionId: 'command-official', agentOptions: { provider: 'command-fixture', model: 'synthetic' } })
  const { agent } = handle, facts = []; service.observe(f => facts.push(f))
  const text = '<本轮操作><本轮执行边界>one</本轮执行边界><操作项>allow</操作项></本轮操作>'
  agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await agent.whenIdle(); await service.flush(); assert.deepEqual(errors, [])
  const first = (await service.list({ scope: { sessionId: agent.id } }))[0]
  assert.equal(first.content.stat_data.hp, 8); assert.equal(first.revision, 1); assert.equal(first.commandProcessor.registered, true)
  agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'plain user text' }], source: { kind: 'user' } }))
  await agent.whenIdle(); await service.flush(); assert.deepEqual(errors, [])
  assert.equal((await service.read({ id: first.id, scope: { sessionId: agent.id } })).revision, 2)
  assert.equal(facts.filter(f => f.phase === 'applied').length, 1)
  await handle.dispose()
})

test('real card preparation replaces only the recognized command Helper and requires its exact source receipt', async () => {
  const { readFile } = await import('node:fs/promises')
  const { discoverDependencies, externalUrl, loadWrapper } = await import('../packages/client/src/play/rendering-sources.js')
  const { DEPENDENCY_LIMITS } = await import('../packages/client/src/play/rendering-limits.js')
  const source = await readFile(new URL('../packages/client/src/play/scripted-content.js', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('export function prepareCardDocument('), source.indexOf('\nexport function createDomBridge(')).replace('export function', 'function')
  const document = { createElement() { return { innerHTML: '', content: { querySelectorAll() { return [] } } } } }
  const prepare = new Function('commandHookDeclaration', 'DEPENDENCY_LIMITS', 'discoverDependencies', 'externalUrl', 'loadWrapper', 'MAX_RENDER_SOURCE', 'document', 'cardDocument', body + ';return prepareCardDocument')(commandHookDeclaration, DEPENDENCY_LIMITS, discoverDependencies, externalUrl, loadWrapper, 8 * 1024 * 1024, document, html => ({ html, scripts: [], unsupported: [] }))
  const trust = { isEnabled: (_owner, _key, value) => value, inspect: () => null }
  const content = [{ owner: 'character:fixture', key: 'command', enabled: true, content: pass }, { owner: 'character:fixture', key: 'ordinary', enabled: true, content: 'console.log("display")' }]
  const result = prepare('', ['character:fixture'], content, trust)
  assert.equal(result.runs.length, 1); assert.equal(result.runs[0].code, content[1].content)
  assert.equal(result.commandDeclarations[0].source, pass)
  assert.equal(result.adapters[0].source, pass) // Included in the independent write bundle identity.
  await fixture(async service => {
    const snapshot = await service.snapshot(scope)
    assert.equal(confirmMvuCommandHooks(result.commandDeclarations, snapshot)[0].registrationId, snapshot.commandProcessor.registrationId)
    assert.throws(() => confirmMvuCommandHooks(result.commandDeclarations, { ...snapshot, commandProcessor: undefined }), /successful source registration/)
    assert.equal((await read(service)).revision, 0)
  })
})

test('reused pending initialization rejects a revoked source before recording a failure', () => fixture(async service => {
  const bad = pass + ';throw Error("pending initialization")'
  const registration = service.registerCommandProcessor({ id: 'mvu:test', source: bad }).catch(error => error.code)
  let current = true
  service.resolveCommandHook = () => { queueMicrotask(() => { current = false }); return { source: bad, checkCurrent: () => current } }
  await assert.rejects(service.ingest(session()), { code: 'MVU_USAGE_CANCELLED' })
  await registration
  service.resolveCommandHook = undefined
  assert.equal((await read(service)).revision, 0)
  await service.ingest(session()); assert.equal((await read(service)).content.stat_data.hp, 8)
}))
