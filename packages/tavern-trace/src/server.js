const API_PATH = '/dsh-tavern/api/traces'

function oldestRecordIndex(records) {
  let oldestIndex = 0
  let oldestTime = Infinity
  for (const [index, record] of records.entries()) {
    const time = Number.isFinite(record?.updatedAt)
      ? record.updatedAt
      : Number.isFinite(record?.recordedAt) ? record.recordedAt : 0
    if (time < oldestTime) {
      oldestIndex = index
      oldestTime = time
    }
  }
  return oldestIndex
}

function sendJson(res, status, payload, maximumBytes = Infinity) {
  let body = JSON.stringify(payload)
  if (Buffer.byteLength(body) > maximumBytes && Array.isArray(payload?.records)) {
    const bounded = {
      ...payload,
      records: [...payload.records],
      storage: {
        kind: payload.storage?.kind,
        maxRecordBytes: payload.storage?.maxRecordBytes,
        maxTotalBytes: payload.storage?.maxTotalBytes,
        persistedBytes: payload.storage?.persistedBytes,
      },
      authority: undefined,
      responseMetadataTrimmed: true,
    }
    body = JSON.stringify(bounded)
    while (Buffer.byteLength(body) > maximumBytes && bounded.records.length > 1) {
      bounded.records.splice(oldestRecordIndex(bounded.records), 1)
      bounded.responseTrimmed = true
      body = JSON.stringify(bounded)
    }
    if (Buffer.byteLength(body) > maximumBytes && bounded.records.length === 1) {
      bounded.storage = { maxTotalBytes: payload.storage?.maxTotalBytes }
      body = JSON.stringify(bounded)
    }
  }
  if (Buffer.byteLength(body) > maximumBytes) throw new RangeError(`Tavern Trace response exceeds total limit ${maximumBytes} bytes`)
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
          maxTotalBytes: store.maxTotalBytes,
          persistedBytes: store.persistedBytes,
        },
        authority: 'DSH request/header is authoritative for final model request content.',
      }, store.maxTotalBytes)
    } catch (error) {
      const status = error instanceof TypeError ? 400 : 500
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export const tavernTraceApiPath = API_PATH
