import test from 'node:test'
import assert from 'node:assert/strict'
import { PresetParameterFallback, rejectedPresetParameters } from '../packages/tavern-loader/src/preset-parameter-fallback.js'

const invalid = message => ({ code: 'INVALID_REQUEST', status: 400, message })
const payload = (agent, patch = {}) => ({ agent, turn: 1, step: 1, signal: new AbortController().signal, ...patch })
const route = { provider: 'test', model: 'model' }

test('unsupported effort withdraws preset override before prepared call, preserving provider default provenance', async () => {
  const recovery = new PresetParameterFallback(), agent = {}, seen = []
  const overrides = Object.freeze({ reasoningEffort: 'xhigh', temperature: 0.6 })
  const llm = { async resolveCallConfig(config) {
    seen.push({ ...config })
    if (config.reasoningEffort === 'xhigh') throw { code: 'UNSUPPORTED_REASONING_EFFORT' }
    return { ...config, reasoningEffort: 'high' }
  } }
  const config = await recovery.prepare(payload(agent), { ...route, reasoningEffort: 'xhigh' }, overrides, llm)
  assert.deepEqual(config, { ...route, temperature: 0.6 })
  assert.equal(seen.length, 2)
  assert.equal(overrides.reasoningEffort, 'xhigh')
  assert.equal(recovery.snapshot(agent, { ...config, reasoningEffort: 'high' }).effective.reasoningEffort, 'high')
  assert.equal(recovery.snapshot(agent).fallbacks[0].stage, 'preflight')
})

test('explicit provider parameter failures retry by withdrawing overrides from persisted header proposals', async () => {
  const recovery = new PresetParameterFallback(), agent = {}, request = payload(agent)
  const overrides = { temperature: 0.5, stop: ['END'], maxTokens: 3000 }
  await recovery.prepare(request, route, overrides)
  assert.equal(recovery.recover({ ...request, failure: invalid("Unsupported value: 'temperature'; only the default value is supported") }), true)
  const second = await recovery.prepare(request, { ...route, ...overrides }, overrides)
  assert.equal(Object.hasOwn(second, 'temperature'), false)
  assert.equal(recovery.recover({ ...request, failure: invalid('stop_sequences is not supported') }), true)
  const third = await recovery.prepare(request, second, overrides)
  assert.deepEqual(third, { ...route, maxTokens: 3000 })
  assert.equal(recovery.recover({ ...request, failure: invalid('stop_sequences is not supported') }), false)
  assert.deepEqual(recovery.snapshot(agent).fallbacks.map(item => item.parameter), ['temperature', 'stop'])
})

test('bounded parameter classifier does not reinterpret unrelated failure classes or ambiguous messages', () => {
  const supplied = { temperature: 0.5, maxTokens: 2048, reasoningEffort: 'low', stop: ['END'] }
  for (const code of ['AUTH', 'QUOTA', 'RATE_LIMIT', 'CONTEXT_WINDOW_EXCEEDED', 'ABORTED', 'TRANSPORT', 'TIMEOUT', 'SERVER']) {
    assert.deepEqual(rejectedPresetParameters({ code, message: 'temperature is unsupported' }, supplied), [])
  }
  for (const message of ['invalid API key', 'invalid messages[0]', 'model is not supported', 'request failed']) {
    assert.deepEqual(rejectedPresetParameters(invalid(message), supplied), [])
  }
  for (const status of [401, 403, 413, 429, 500]) assert.deepEqual(rejectedPresetParameters({ ...invalid('temperature unsupported'), status }, supplied), [])
  assert.deepEqual(rejectedPresetParameters(invalid('max_completion_tokens must be less than 1000'), supplied), ['maxTokens'])
})

test('no retry after output, cancellation, or when only a host-owned parameter failed', async () => {
  const recovery = new PresetParameterFallback(), agent = {}, request = payload(agent)
  await recovery.prepare(request, route, { temperature: 0.5 })
  recovery.observeFrame(agent, { type: 'chunk', chunk: { type: 'block-start', blockType: 'text', index: 0 } })
  assert.equal(recovery.recover({ ...request, failure: invalid('temperature unsupported') }), false)
  const controller = new AbortController()
  await recovery.prepare(payload(agent, { step: 2 }), route, { temperature: 0.5 })
  controller.abort()
  assert.equal(recovery.recover({ ...request, signal: controller.signal, failure: invalid('temperature unsupported') }), false)
  await recovery.prepare(payload(agent, { step: 3 }), { ...route, temperature: 0.8 }, { maxTokens: 100 })
  assert.equal(recovery.recover({ ...request, failure: invalid('temperature unsupported') }), false)
})

test('changing route, preset controls, or step starts a new bounded series; sessions remain isolated', async () => {
  const recovery = new PresetParameterFallback(), one = {}, two = {}
  await recovery.prepare(payload(one), route, { temperature: 0.1 })
  assert.equal(recovery.recover({ ...payload(one), failure: invalid('temperature unsupported') }), true)
  assert.equal((await recovery.prepare(payload(two), route, { temperature: 0.1 })).temperature, 0.1)
  assert.equal((await recovery.prepare(payload(one), { ...route, model: 'other' }, { temperature: 0.1 })).temperature, 0.1)
  recovery.clear(one)
  assert.equal(recovery.snapshot(one), null)
})

test('unknown preflight errors propagate without consuming provider retries', async () => {
  const recovery = new PresetParameterFallback(), agent = {}, failure = new Error('network unavailable')
  await assert.rejects(recovery.prepare(payload(agent), route, { temperature: 0.2 }, { resolveCallConfig() { throw failure } }), error => error === failure)
})

 test('unrelated tool and message failures mentioning parameter names never trigger fallback', () => {
  for (const message of ["Invalid tool call: function 'stop' is not defined", "Invalid tool name: 'max tokens'", "Invalid message content: temperature is not supported"]) {
    assert.deepEqual(rejectedPresetParameters({ code: 'INVALID_REQUEST', status: 400, message }, { stop: ['END'], maxTokens: 300, temperature: 0.4 }), [])
  }
})
