const API_PATH = '/dsh-tavern/api/traces'

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

export function isTavernTraceApiPath(url) {
  return new URL(url ?? '/', 'http://localhost').pathname === API_PATH
}

export function createTavernTraceApiHandler(store) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if ((req.method ?? 'GET') !== 'GET' || url.pathname !== API_PATH) {
        return sendJson(res, 404, { ok: false, error: 'not found' })
      }
      const sessionId = url.searchParams.get('sessionId')
      if (sessionId === null || sessionId === '') return sendJson(res, 400, { ok: false, error: 'sessionId is required' })
      return sendJson(res, 200, {
        ok: true,
        sessionId,
        records: store.list(sessionId),
        storage: {
          kind: 'plugin-bounded-json',
          maxSessions: store.maxSessions,
          maxRecordsPerSession: store.maxRecordsPerSession,
          maxRecordBytes: store.maxRecordBytes,
        },
        authority: 'DSH request/header is authoritative for final model request content.',
      })
    } catch (error) {
      const status = error instanceof TypeError ? 400 : 500
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export const tavernTraceApiPath = API_PATH
