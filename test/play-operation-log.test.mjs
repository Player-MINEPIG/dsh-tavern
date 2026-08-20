import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperationContext, operationLogConstants } from '../packages/play/src/index.js'

function loggerSink({ throws = false } = {}) {
  const calls = []
  const logger = {
    info(value) {
      if (throws) throw new Error('logger unavailable')
      calls.push(['info', value])
    },
    warn(value) {
      if (throws) throw new Error('logger unavailable')
      calls.push(['warn', value])
    },
  }
  return { calls, logger }
}

function parse(call) {
  const [level, line] = call
  assert.equal(line.startsWith(operationLogConstants.prefix), true)
  return { level, payload: JSON.parse(line.slice(operationLogConstants.prefix.length)) }
}

test('operation context keeps one id and records non-negative terminal duration', () => {
  const sink = loggerSink()
  let tick = 100
  const operation = createOperationContext({
    logger: sink.logger,
    operation: 'catalog.update',
    idFactory: () => 'op-test',
    clock: () => tick,
  })
  assert.equal(operation.start({ method: 'PUT', sessionId: 's1' }), true)
  tick = 97
  operation.stage('compare', { path: '角色/1/timeline.json', body: 'secret' })
  tick = 123
  operation.success('updated', { prompt: 'never log this', qa: ['secret'] })
  assert.equal(sink.calls.length, 3)
  const records = sink.calls.map(parse)
  assert.deepEqual(records.map(record => record.payload.stage), ['start', 'compare', 'success'])
  assert.equal(new Set(records.map(record => record.payload.operationId)).size, 1)
  assert.equal(records[2].payload.durationMs, 23)
  assert.equal(records[2].payload.result, 'updated')
  assert.equal(records[1].payload.path, '角色/1/timeline.json')
  assert.equal(Object.hasOwn(records[1].payload, 'body'), false)
})

test('failure uses stable code and status without error details', () => {
  const sink = loggerSink()
  const operation = createOperationContext({ logger: sink.logger, operation: 'session.create', idFactory: () => 'op-fail', clock: () => 0 })
  operation.start()
  const error = Object.assign(new Error('prompt and stack must not leak'), {
    code: 'PLAY_CONFLICT',
    status: 409,
    cause: new Error('secret cause'),
  })
  operation.failure(error, { result: 'conflict', message: 'do not emit', content: 'secret' })
  const record = parse(sink.calls[1])
  assert.equal(record.level, 'warn')
  assert.deepEqual(record.payload, {
    operationId: 'op-fail',
    operation: 'session.create',
    stage: 'failure',
    result: 'conflict',
    errorCode: 'PLAY_CONFLICT',
    status: 409,
    durationMs: 0,
  })
})

test('unknown fields and unsafe identifiers are bounded and single-line', () => {
  const sink = loggerSink()
  const long = 'x'.repeat(1000)
  const operation = createOperationContext({
    logger: sink.logger,
    operation: `op\n${long}`,
    idFactory: () => `id\n${long}`,
    meta: { path: `a\nb\r${long}`, method: `PUT\n${long}`, body: 'body', regex: 'regex' },
  })
  operation.start({ sessionId: `s\n${long}`, role: 'user', content: 'content' })
  const line = sink.calls[0][1]
  assert.equal(line.includes('\n'), false)
  const payload = parse(sink.calls[0]).payload
  assert.equal(payload.operation.length, operationLogConstants.maxOperation)
  assert.equal(payload.operationId.length, operationLogConstants.maxIdentifier)
  assert.equal(payload.path.length, operationLogConstants.maxPath)
  assert.equal(payload.method.length, operationLogConstants.maxMethod)
  assert.equal(Object.hasOwn(payload, 'body'), false)
  assert.equal(Object.hasOwn(payload, 'regex'), false)
  assert.equal(Object.hasOwn(payload, 'role'), false)
  assert.equal(Object.hasOwn(payload, 'content'), false)
})

test('terminal is emitted once and later stages or terminals are no-ops', () => {
  const sink = loggerSink()
  const operation = createOperationContext({ logger: sink.logger, operation: 'x', idFactory: () => 'op' })
  operation.start()
  assert.equal(operation.success(), true)
  assert.equal(operation.stage('late'), false)
  assert.equal(operation.failure({ code: 'LATE' }), false)
  assert.equal(operation.success('late'), false)
  assert.equal(sink.calls.length, 2)
})

test('missing or throwing loggers and injectable logger service are fail-soft', () => {
  const missing = createOperationContext({ operation: 'missing', idFactory: () => 'm' })
  assert.doesNotThrow(() => {
    missing.start()
    missing.stage('work')
    missing.failure(new Error('ignored'))
  })
  const throwing = createOperationContext({ logger: loggerSink({ throws: true }).logger, operation: 'throwing', idFactory: () => 't' })
  assert.doesNotThrow(() => throwing.success())
  const calls = []
  const service = (name) => ({ info: line => calls.push([name, line]) })
  const named = createOperationContext({ logger: service, operation: 'named', idFactory: () => 'n' })
  named.start()
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'dsh-tavern')
})