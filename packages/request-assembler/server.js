import { API_V1 } from '../identity.js'
const ROOT = `${API_V1}/assembly-presets`
export const isAssemblyApiPath = url => { const p = new URL(url, 'http://localhost').pathname; return p === ROOT || p.startsWith(`${ROOT}/`) }
function send(res, status, body) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)) }
async function read(req) {
  let size = 0; const chunks = []
  for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw Object.assign(new Error('Assembly request exceeds 2 MiB'), { status: 413 }); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
export function createAssemblyApi({ store, runtime, agents, sessions, inspect, notify }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), part = decodeURIComponent(url.pathname.slice(ROOT.length + 1)), method = req.method
      const sessionId = url.searchParams.get('sessionId') ?? ''
      if (!part && method === 'GET') return send(res, 200, { ok: true, presets: store.list(), selection: runtime.selected(sessionId), capability: runtime.available(), sourceProtocolVersion: runtime.registry.version, sources: runtime.sources() })
      if (part === 'preview' && method === 'POST') {
        const body = await read(req), id = body.sessionId ?? sessionId
        const live = agents()?.get?.(id)
        let session = live?.session ?? sessions()?.get?.(id)
        if (!session && id && inspect) {
          const record = await inspect(id)
          session = sessions().get(id) ?? sessions().prepare(id, { seed: record.events, meta: record.meta, inheritedEventCount: record.inheritedEventCount, eventState: 'detached' })
        }
        if (id && !session) throw Object.assign(new Error('Session is unavailable'), { code: 'SCOPE_CATALOG_NOT_FOUND', status: 404 })
        const agent = live ?? (session ? { id, session } : undefined)
        return send(res, 200, { ok: true, preview: await runtime.preview({ preset: body.preset ?? store.get(body.presetId), agent, sessionId: id }) })
      }
      if (part === 'selection' && method === 'PUT') {
        const body = await read(req), agent = agents()?.get?.(body.sessionId)
        if (agent?.status === 'running') throw Object.assign(new Error('Apply after the current turn finishes'), { status: 409 })
        if (body.id !== null) runtime.requireAvailable()
        const selection = store.apply(body.sessionId, body.id); notify()
        return send(res, 200, { ok: true, selection })
      }
      if (!part && method === 'POST') { const body = await read(req); return send(res, 201, { ok: true, preset: store.save(body.preset ?? body) }) }
      if (part && method === 'GET') return send(res, 200, { ok: true, preset: store.get(part) })
      if (part && method === 'PUT') return send(res, 200, { ok: true, preset: store.save(await read(req), part) })
      if (part && method === 'DELETE') { store.remove(part); return send(res, 200, { ok: true }) }
      return send(res, 405, { ok: false, error: 'Method not allowed' })
    } catch (error) { return send(res, error.status ?? (error.code === 'SESSION_QUERY_SESSION_NOT_FOUND' || error.code === 'SCOPE_CATALOG_NOT_FOUND' || error.constructor?.name === 'ApiSessionNotFound' ? 404 : error instanceof TypeError || error instanceof SyntaxError ? 400 : 500), { ok: false, error: error.message, code: error.code }) }
  }
}
