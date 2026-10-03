import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, textOf } from '../packages/request-assembler/assemble.js'
import { BUILTINS } from '../packages/request-assembler/model.js'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'
import { withDeepSeekWire } from './helpers/deepseek-wire.mjs'

const root = process.env.DSH_TAVERN_ASSEMBLY_CORE_ROOT
test('official DeepSeek serializer rejects the reported greeting order and accepts the corrected request offline', { skip: !root }, async () => {
  const input = defaultAssemblyFailureInput()
  const assembled = assembleRequest({ ...input, preset: BUILTINS[0] })
  const reported = structuredClone(assembled.messages)
  const [greeting] = reported.splice(reported.findIndex(m => textOf(m) === 'GREETING'), 1)
  reported.splice(reported.length - 3, 0, greeting)
  await withDeepSeekWire(root, async ({ send, bodies }) => {
    await assert.rejects(send(reported), error => error.code === 'UNSUPPORTED_CONTENT' && /system update without/.test(error.message))
    assert.equal(bodies.length, 0)
    const body = await send(assembled.messages)
    assert.deepEqual(body.messages.map(m => m.role), ['user', 'system', 'system', 'system', 'assistant', 'user', 'system', 'system', 'system'])
    const wireTexts = body.messages.flatMap(m => m.content.filter(b => b.type === 'text').map(b => b.text))
    assert.equal(wireTexts.filter(t => t === 'GREETING').length, 1)
    assert.ok(wireTexts.indexOf('GREETING') < wireTexts.indexOf('input'))
    for (const text of assembled.messages.slice(2).map(textOf)) assert.equal(wireTexts.filter(t => t === text).length, 1)
  })
})
