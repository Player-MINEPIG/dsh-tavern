import { API_V3 } from '../../../identity.js'
import { rawText, uiMessage } from '../i18n.js'

const operations = new Set([
  'workspace.bind', 'workspace.dir.create', 'workspace.file.write', 'session.create',
  'session.branch', 'session.user-message', 'session.import-context.bind',
  'session.import-context.unbind', 'playthrough.session.detach',
  'playthrough.character.relink', 'plugin.start', 'plugin.stop', 'rp.policy', 'trace.record',
])
const checkpoints = new Set([
  'session.created', 'session.selection.copied', 'session.import-context.bound',
  'session.import-context.unbound', 'session.import-lineage.copied', 'workspace.bound',
  'workspace.directory.created', 'workspace.file.written', 'playthrough.timeline.updated',
  'playthrough.catalog.updated', 'playthrough.catalog.restored',
])

// Unknown semantic versions and legacy records must not acquire v1 meanings.
export function operationLabel(row) {
  return row.eventVersion === 1 && operations.has(row.operation)
    ? uiMessage(`diagnostics.logsOperation.${row.operation}`)
    : rawText(row.operation || row.event || row.stage || '—')
}

export function operationResult(row) {
  if (row.eventVersion !== 1) return { tone: 'neutral', label: uiMessage('diagnostics.logsResult.raw', { value: [row.event, row.stage, row.result].filter(value => value !== undefined).join(' · ') || '—' }) }
  const event = row.event
  const key = event === 'operation.started' ? 'started'
    : event === 'operation.failed' ? 'failed'
    : event === 'diagnostic.failed' ? 'diagnostic'
    : event === 'operation.completed' ? (row.result === 'accepted' ? 'accepted' : 'completed')
    : checkpoints.has(event) ? event : null
  return {
    tone: event === 'operation.failed' || event === 'diagnostic.failed' ? 'warning' : 'neutral',
    label: key ? uiMessage(`diagnostics.logsResult.${key}`) : rawText([event, row.stage, row.result].filter(value => value !== undefined).join(' · ') || '—'),
  }
}

export function operationObjects(row) {
  const objects = ['sessionId', 'playthroughId'].filter(key => row[key]).map(key => ({ key, label: uiMessage(`diagnostics.logsObject.${key}`), value: row[key] }))
  if (!objects.length) objects.push({ key: 'scope', label: uiMessage('diagnostics.logsObject.scope'), value: row.operation?.startsWith('plugin.') ? uiMessage('diagnostics.logsObject.plugin') : uiMessage('diagnostics.logsObject.unspecified') })
  return objects
}

// Export the exact loaded API page, including metadata; no extra anonymization.
export function operationPageJsonl(page) {
  const { records, ...metadata } = page
  return [JSON.stringify({ type: 'metadata', ...metadata }), ...records.map(row => JSON.stringify(row))].join('\n') + '\n'
}

// No lookup or new collection: only identifiers already present in this record.
// Journal runId names a plugin instance, not a DSH run/turn/attempt.
export function operationLocator(row) {
  const locator = { type: 'tavern-operation-locator', correlation: 'session-and-time-only' }
  for (const key of ['schemaVersion', 'eventVersion', 'timestamp', 'operationId', 'sessionId', 'playthroughId', 'operation', 'event', 'stage', 'result', 'errorCode', 'status']) {
    if (row[key] !== undefined) locator[key] = row[key]
  }
  if (row.id !== undefined) locator.recordId = row.id
  if (row.runId !== undefined) locator.pluginInstanceId = row.runId
  if (row.sessionId) locator.traceIndexApiPath = `${API_V3}/sessions/${encodeURIComponent(row.sessionId)}/assemblies`
  return JSON.stringify(locator, null, 2)
}
