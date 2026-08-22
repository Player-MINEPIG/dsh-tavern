import { randomUUID } from 'node:crypto'

const PREFIX = 'dsh-tavern.operation '
const MAX_OPERATION = 96
const MAX_STAGE = 96
const MAX_RESULT = 96
const MAX_ERROR_CODE = 96
const MAX_METHOD = 32
const MAX_IDENTIFIER = 128
const MAX_PATH = 512

const FIELD_ORDER = Object.freeze([
  'operationId',
  'operation',
  'stage',
  'result',
  'errorCode',
  'status',
  'durationMs',
  'method',
  'sessionId',
  'playthroughId',
  'path',
])

function normalizeText(value, maxLength) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, '\ufffd')
  return text.slice(0, maxLength)
}

function normalizeIdentifier(value, maxLength = MAX_IDENTIFIER) {
  return normalizeText(value, maxLength)
}

function normalizeStatus(value) {
  const status = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
}

function normalizeResult(value, fallback) {
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
    return value
  }
  return normalizeText(value, MAX_RESULT) ?? fallback
}

function normalizeErrorCode(error) {
  return normalizeText(error?.code, MAX_ERROR_CODE) ?? 'UNKNOWN_ERROR'
}

function nowValue(clock) {
  try {
    const value = Number(clock())
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function pickFields(source, { operationId, operation, stage, result, errorCode, status, durationMs } = {}) {
  const input = source !== null && typeof source === 'object' && !Array.isArray(source) ? source : {}
  const payload = {
    operationId,
    operation,
    stage,
    result,
    errorCode,
    status,
    durationMs,
    method: normalizeText(input.method, MAX_METHOD),
    sessionId: normalizeIdentifier(input.sessionId),
    playthroughId: normalizeIdentifier(input.playthroughId),
    path: normalizeText(input.path, MAX_PATH),
  }
  return Object.fromEntries(FIELD_ORDER
    .filter(key => payload[key] !== undefined)
    .map(key => [key, payload[key]]))
}

function resolveLogger(logger) {
  if (logger === null || logger === undefined) return null
  if (typeof logger.info === 'function' || typeof logger.warn === 'function' || typeof logger.error === 'function') {
    return logger
  }
  if (typeof logger !== 'function') return null
  try {
    const named = logger('dsh-tavern')
    return named !== null && typeof named === 'object' ? named : null
  } catch {
    return null
  }
}

function safeLog(logger, level, payload) {
  const target = resolveLogger(logger)
  const method = target?.[level]
  if (typeof method !== 'function') return
  try {
    method.call(target, `${PREFIX}${JSON.stringify(payload)}`)
  } catch {
    // Logging must never change the operation result.
  }
}

/**
 * Create a fail-soft, content-free operation logger for backend mutations.
 * `ctx.logger` may be supplied directly or through `{ ctx }`. The logger is
 * deliberately kept as an argument so this pure utility does not depend on
 * Cordis internals.
 */
export function createOperationContext({
  ctx,
  logger = ctx?.logger,
  operation,
  meta,
  idFactory = randomUUID,
  clock = Date.now,
} = {}) {
  const operationId = normalizeIdentifier(idFactory(), MAX_IDENTIFIER) ?? 'unknown-operation'
  const operationName = normalizeText(operation, MAX_OPERATION) ?? 'unknown'
  const startedAt = nowValue(clock)
  let lastDuration = 0
  let started = false
  let terminal = false

  function duration() {
    lastDuration = Math.max(lastDuration, Math.max(0, nowValue(clock) - startedAt))
    return Math.trunc(lastDuration)
  }

  function emit(level, stage, fields, extras = {}) {
    if (terminal) return false
    const payload = pickFields(
      { ...(meta ?? {}), ...(fields ?? {}) },
      {
        operationId,
        operation: operationName,
        stage: normalizeText(stage, MAX_STAGE) ?? 'unknown',
        ...extras,
      },
    )
    safeLog(logger, level, payload)
    return true
  }

  return Object.freeze({
    get operationId() { return operationId },
    get operation() { return operationName },
    start(fields = {}) {
      if (started || terminal) return false
      started = true
      return emit('info', 'start', fields)
    },
    stage(name, fields = {}) {
      return emit('info', name, fields)
    },
    success(result = 'ok', fields = {}) {
      if (terminal) return false
      const emitted = emit('info', 'success', fields, {
        result: normalizeResult(result, 'ok'),
        durationMs: duration(),
      })
      terminal = true
      return emitted
    },
    failure(error, fields = {}) {
      if (terminal) return false
      const details = fields !== null && typeof fields === 'object' && !Array.isArray(fields) ? fields : {}
      const emitted = emit('warn', 'failure', details, {
        result: normalizeResult(details.result, 'failure'),
        errorCode: normalizeErrorCode(error),
        status: normalizeStatus(details.status ?? error?.status),
        durationMs: duration(),
      })
      terminal = true
      return emitted
    },
  })
}

export const operationLogConstants = Object.freeze({
  prefix: PREFIX,
  maxOperation: MAX_OPERATION,
  maxStage: MAX_STAGE,
  maxResult: MAX_RESULT,
  maxErrorCode: MAX_ERROR_CODE,
  maxMethod: MAX_METHOD,
  maxIdentifier: MAX_IDENTIFIER,
  maxPath: MAX_PATH,
  terminalLevel: 'warn',
  fields: [...FIELD_ORDER],
})