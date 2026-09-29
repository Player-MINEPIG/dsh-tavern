import { createOperationContext } from './operation-log.js'

// Tavern-owned semantics, independent of DSH hook names and storage encoding.
const CHECKPOINTS = new Set([
  'session.created', 'session.selection.copied', 'session.import-context.bound',
  'session.import-context.unbound', 'session.import-lineage.copied',
  'workspace.bound', 'workspace.directory.created', 'workspace.file.written',
  'playthrough.timeline.updated', 'playthrough.catalog.updated', 'playthrough.catalog.restored',
])

export function createContractOperation(options) {
  const { method, route, sessionId, playthroughId } = options?.meta ?? {}
  const context = createOperationContext({ ...options, meta: { method, route, sessionId, playthroughId } })
  const identity = {}
  const seen = new Set()
  const fields = (event, extra) => ({ ...identity, status: extra?.status, eventVersion: 1, event })
  const identify = value => {
    for (const key of ['sessionId', 'playthroughId']) {
      if (typeof value?.[key] === 'string') identity[key] = value[key]
    }
  }
  return Object.freeze({
    operationId: context.operationId,
    operation: context.operation,
    identify,
    start() { return context.start(fields('operation.started')) },
    checkpoint(event, extra) {
      if (!CHECKPOINTS.has(event)) return false
      identify(extra)
      // The adapter records creation before follow-up work; the API fallback
      // also supports hosts that only return a normalized result.
      const key = JSON.stringify([event, identity.sessionId, identity.playthroughId])
      if (seen.has(key)) return false
      seen.add(key)
      return context.stage(event, fields(event))
    },
    success(result = 'completed', extra) { return context.success(result, fields('operation.completed', extra)) },
    failure(error, extra) { return context.failure(error, fields('operation.failed', extra)) },
  })
}

// A failed optional diagnostic is not a failed user operation or DSH turn.
export function recordDiagnosticFailure(options, error) {
  createOperationContext(options).failure(error, { eventVersion: 1, event: 'diagnostic.failed' })
}
