import { httpError, sendJson } from './http.js'

const recordId = /^[\da-f-]{36}:\d{1,16}$/

export function serveOperationLogs(journal, req, res, searchParams) {
  if (!journal) throw httpError(404, 'Operation logs are unavailable.', 'PLAY_NOT_FOUND')
  if (req.method !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
  const allowed = new Set(['limit', 'before', 'operationId', 'sessionId', 'playthroughId', 'level', 'format'])
  const options = {}
  for (const [key, value] of searchParams) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1 || value.length === 0) throw httpError(400, 'Invalid log query.', 'LOG_QUERY_INVALID')
    options[key] = value
  }
  if (options.limit !== undefined) {
    if (!/^\d+$/.test(options.limit) || Number(options.limit) < 1 || Number(options.limit) > journal.limits.maxPageSize) throw httpError(400, 'Invalid log limit.', 'LOG_QUERY_INVALID')
    options.limit = Number(options.limit)
  }
  for (const key of ['operationId', 'sessionId', 'playthroughId']) if (options[key] && (options[key].length > 128 || /[\u0000-\u001f\u007f]/.test(options[key]))) throw httpError(400, 'Invalid log filter.', 'LOG_QUERY_INVALID')
  if ((options.before && !recordId.test(options.before)) || (options.level && !['info', 'warn'].includes(options.level)) || (options.format && !['json', 'jsonl'].includes(options.format))) throw httpError(400, 'Invalid log query.', 'LOG_QUERY_INVALID')
  const page = journal.query(options)
  res.setHeader('Cache-Control', 'no-store')
  if (options.format !== 'jsonl') return sendJson(res, 200, page)
  const { records, ...metadata } = page
  // The first line makes incomplete/degraded exports explicit and carries pagination.
  const body = [JSON.stringify({ type: 'metadata', ...metadata }), ...records.map(row => JSON.stringify(row))].join('\n') + '\n'
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="tavern-operation-logs.jsonl"')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}
