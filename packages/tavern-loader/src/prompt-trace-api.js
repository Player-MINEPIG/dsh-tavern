import { API_V3 } from '../../identity.js'
import { httpError, sendJson } from '../../play/src/http.js'
import { validSession } from '../../tavern-trace/src/assembly-store.js'
function sessionId(id) {
  if (!validSession(id)) throw httpError(400, 'A valid explicit sessionId is required', 'PROMPT_SESSION_INVALID')
  return id
}

export function createPromptTraceApi({ assemblies, legacyStore, readBodies = async record => record }) {
  const legacy = id => (legacyStore?.list(id) ?? []).map(row => ({ schemaVersion: 3,
    id: `legacy:${row.id}`, sessionId: id, turn: row.turn, step: row.step, attempt: row.attempt,
    recordedAt: row.recordedAt, status: 'legacy-metadata-only', contentStatus: 'legacy-metadata-only', audit: row,
  }))
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const url = new URL(req.url, 'http://localhost')
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Read-only API' })
      if (url.pathname === `${API_V3}/capabilities`) return sendJson(res, 200, {
        ok: true, apiVersion: 3, contract: 'prompt-trace-primitives', sourceMapping: 'section-contributors',
        historicalAssemblies: true, composerRegistry: false,
        officialSections: true, arbitraryMessageDepth: false, storage: assemblies.storage(),
      })
      const match = url.pathname.match(new RegExp(`^${API_V3}/sessions/([^/]+)/assemblies(?:/([^/]+))?$`))
      if (!match) return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', error: 'Not found' })
      const id = sessionId(decodeURIComponent(match[1]))
      if (!match[2]) {
        const current = assemblies.list(id)
        // Either store may reuse attempt-based IDs after eviction, even within
        // one clock tick. Only a shared capture UUID establishes identity.
        const keys = new Set(current.flatMap(r => typeof r.legacyCaptureId === 'string' ? [r.legacyCaptureId] : []))
        const historical = legacy(id).filter(r => !keys.has(r.audit.captureId)).map(({ audit, ...r }) => r)
        return sendJson(res, 200, { ok: true, sessionId: id, records: [...historical, ...current].sort((a, b) => a.recordedAt - b.recordedAt), storage: assemblies.storage() })
      }
      const recordId = decodeURIComponent(match[2])
      const stored = recordId.startsWith('legacy:') ? legacy(id).find(r => r.id === recordId) : assemblies.get(id, recordId)
      const record = stored ? await readBodies(stored) : null
      return sendJson(res, record ? 200 : 404, record ? { ok: true, record } : { ok: false, code: 'ASSEMBLY_NOT_FOUND', error: 'Record missing or evicted' })
    } catch (error) {
      const status = error.status ?? (error instanceof TypeError || error instanceof URIError ? 400 : 500)
      return sendJson(res, status, { ok: false, code: status === 500 ? 'TRACE_READ_FAILED' : error.code ?? 'INVALID_REQUEST', error: status === 500 ? 'Unable to read prompt data' : error.message })
    }
  }
}
