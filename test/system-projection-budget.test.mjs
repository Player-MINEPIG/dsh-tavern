import { CoreRequestBackend } from 'dsh-prompt-assembler/core-backend'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, textOf } from '../packages/request-assembler/assemble.js'
import { BUILTINS } from '../packages/request-assembler/model.js'
import { RequestAssembler } from '../packages/request-assembler/runtime.js'
import { projectSystemSnapshots } from '../packages/request-assembler/system-snapshots.js'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'
import { withDeepSeekWire } from './helpers/deepseek-wire.mjs'

const profileLimit = 512 * 1024, projectionLimit = 2 * 1024 * 1024
const coreRoot = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
const options = { systemPromptUpdate: 'in-history' }
const bytes = value => Buffer.byteLength(JSON.stringify(value))
const message = (id, role, text) => ({ id, role, content: [{ type: 'text', text }] })

function fixture(beforeKiB = 82, tailKiB = 12) {
  const input = defaultAssemblyFailureInput()
  for (const [i, entry] of input.assets.loreEntries.entries()) {
    const prefix = `SYNTHETIC_LORE_${i}:`
    entry.content = prefix + 'x'.repeat((i < 3 ? beforeKiB : tailKiB) * 1024 - prefix.length)
  }
  return input
}

function runtimeFor(input, maxProfileBytes = profileLimit) {
  const snapshot = { assemblyInput: input.assets }
  const runtime = new RequestAssembler({
    ctx: { get: key => key === 'systemPrompt'
      ? { assemble: async () => ({ sections: [{ text: textOf(input.nativeMessages[0]) }] }) }
      : { requestAssemblyVersion: 1 } },
    store: { selection: () => BUILTINS[0] },
    resources: { maxProfileBytes, assembledFor: () => snapshot, compile: () => snapshot },
  })
  runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  return runtime
}

function payloadFor(input) {
  return { agent: { id: 'synthetic-budget', session: {
    snapshotEvents: () => input.inputIds.map((id, seq) => ({ seq, type: 'user/message', data: { id } })),
    deriveMessages: () => input.nativeMessages,
    requestContext: () => options,
  } } }
}

test('runtime and preview admit logical content below 512 KiB when complete snapshots exceed 512 KiB', async () => {
  const input = fixture(), logical = assembleRequest({ ...input, preset: BUILTINS[0], maxBytes: profileLimit })
  const runtime = runtimeFor(input), payload = payloadFor(input)
  const actual = await runtime.execute(payload, async () => ({ messages: input.nativeMessages }))
  const projected = actual.metadata.assembly
  assert.equal(logical.extraBytes, 292721)
  assert.equal(projected.logicalExtraBytes, logical.extraBytes)
  assert.equal(projected.extraBytes, 544031)
  assert.equal(projected.systemProjection.maxBytes, projectionLimit)
  assert.equal(logical.snapshots.length, 0)
  assert.equal(new Set(logical.messages.map(m => m.id)).size, logical.messages.length)
  assert.deepEqual(projected.systemProjection.messages.map(s => s.contributorIds.length), [2, 5, 8])
  for (const snapshot of projected.systemProjection.messages) {
    assert.equal(new Set(snapshot.contributorIds).size, snapshot.contributorIds.length)
    assert.equal(textOf(actual.messages[snapshot.index]), snapshot.contributorIds.map(id => textOf(logical.messages.find(m => m.id === id))).join('\n\n'))
  }
  assert.deepEqual(actual.messages.filter(m => m.role !== 'system'), logical.messages.filter(m => m.role !== 'system'))
  assert.deepEqual(projected.nodes.map(n => n.inputMessageIds), logical.nodes.map(n => n.requestMessageIds))
  const preview = await runtime.preview({ preset: BUILTINS[0], agent: payload.agent })
  assert.ok(preview.logicalExtraBytes < profileLimit)
  assert.ok(preview.extraBytes > profileLimit && preview.extraBytes < projectionLimit)
  assert.equal(preview.systemProjection.maxBytes, projectionLimit)
  assert.equal(preview.pendingInputsIncluded, false)
  assert.throws(() => projectSystemSnapshots(logical, input.nativeMessages, profileLimit, options), { status: 413 })
  assert.equal(projectSystemSnapshots(logical, input.nativeMessages, projected.extraBytes, options).extraBytes, projected.extraBytes)
  assert.throws(() => projectSystemSnapshots(logical, input.nativeMessages, projected.extraBytes - 1, options), { status: 413 })
})

test('runtime and preview still reject logical excess under default and tightened profile limits', async () => {
  for (const [input, limit] of [[fixture(130, 40), profileLimit], [fixture(), 250 * 1024]]) {
    const runtime = runtimeFor(input, limit), payload = payloadFor(input)
    const rejectsLogical = error => error.status === 413 && error.message === `Assembled content exceeds ${limit} bytes`
    await assert.rejects(runtime.execute(payload, async () => ({ messages: input.nativeMessages })), rejectsLogical)
    await assert.rejects(runtime.preview({ preset: BUILTINS[0], agent: payload.agent }), rejectsLogical)
  }
})

test('projection charges complete carriers separately and refuses physical excess even for a small logical input', async () => {
  const input = fixture()
  input.nativeMessages[0].content[0].text = 'N'.repeat(256 * 1024)
  input.assets.preset.prompts = Array.from({ length: 20 }, (_, i) => [
    { identifier: `system-${i}`, enabled: true, role: 'system', content: 'S'.repeat(8 * 1024) },
    { identifier: `user-${i}`, enabled: true, role: 'user', content: 'separator' },
  ]).flat()
  input.assets.loreEntries = []
  const logical = assembleRequest({ ...input, preset: BUILTINS[0], maxBytes: profileLimit })
  assert.ok(logical.extraBytes < profileLimit)
  const runtime = runtimeFor(input), payload = payloadFor(input)
  const rejectsPhysical = error => error.status === 413 && error.message === `System snapshot projection exceeds ${projectionLimit} additional bytes`
  await assert.rejects(runtime.execute(payload, async () => ({ messages: input.nativeMessages })), rejectsPhysical)
  await assert.rejects(runtime.preview({ preset: BUILTINS[0], agent: payload.agent }), rejectsPhysical)
  assert.throws(() => projectSystemSnapshots(logical, input.nativeMessages, projectionLimit * 2, options), rejectsPhysical)
})

test('physical ceiling accepts equality, rejects one extra byte and cannot be bypassed by invalid limits', () => {
  const exact = message('boundary', 'user', '')
  exact.content[0].text = 'x'.repeat(projectionLimit - bytes(exact))
  const assembly = { messages: [exact], nodes: [], extraBytes: bytes([exact]) }
  assert.equal(projectSystemSnapshots(assembly, [], undefined, options).extraBytes, projectionLimit)
  exact.content[0].text += 'x'
  for (const limit of [undefined, projectionLimit * 2, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => projectSystemSnapshots(assembly, [], limit, options), { status: 413 })
  }
  for (const invalid of [NaN, Infinity, -1, 1.5, '2097152', null]) {
    assert.throws(() => projectSystemSnapshots(assembly, [], invalid, options), RangeError)
  }
  // Unchanged native history is not additional plugin overhead, even above the ceiling.
  assert.equal(projectSystemSnapshots(assembly, [exact], 0, options).extraBytes, 0)
})

test('official DeepSeek wire receives every active contribution once per complete snapshot offline', { skip: !coreRoot }, async () => {
  const input = fixture(), runtime = runtimeFor(input), payload = payloadFor(input)
  const result = await runtime.execute(payload, async () => ({ messages: input.nativeMessages }))
  await withDeepSeekWire(coreRoot, async ({ send, bodies }) => {
    const body = await send(result.messages)
    assert.equal(bodies.length, 1)
    assert.deepEqual(body.messages.map(m => m.role), ['user', 'system', 'assistant', 'user', 'system'])
    const wireSystems = [body.system, ...body.messages.filter(m => m.role === 'system').map(m => m.content.map(b => b.text).join(''))]
    assert.deepEqual(wireSystems, result.messages.filter(m => m.role === 'system').map(textOf))
    assert.equal(wireSystems.at(-1).split('SYNTHETIC_LORE_0:').length - 1, 1)
    assert.equal(wireSystems.at(-1).split('SYNTHETIC_LORE_5:').length - 1, 1)
  })
})
