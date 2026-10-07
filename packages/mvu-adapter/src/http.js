import { API_V1, requestPathname } from '../../identity.js'
import { sendJson, readBoundedJson } from '../../play/src/http.js'

const paths = ['resources', 'resource', 'history', 'facts', 'update', 'snapshot', 'card-binding', 'card-write', 'card-binding/revoke']
export const isMvuApiPath = url => paths.some(path => requestPathname(url) === `${API_V1}/mvu/${path}`)
const scopeKeys = ['mode', 'characterId', 'playthroughId', 'sessionId', 'nodeId', 'variantId', 'endEventId', 'sessionFormatVersion', 'greetingIndex', 'selectionToken']
function validateScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).some(key => !scopeKeys.includes(key))
    || (!['greeting', 'initial', 'draft'].includes(scope.mode) && ['greetingIndex', 'selectionToken'].some(key => Object.hasOwn(scope, key)))) throw Object.assign(new Error('Invalid MVU scope'), { code: 'MVU_SCOPE' })
  return scope
}
const traceReads = new Set(['resources', 'resource', 'history', 'facts'])
function traceScope(scope, current = false) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)
    || typeof scope.sessionId !== 'string' || !scope.sessionId || scope.sessionId.length > 200
    || scope.authority && scope.authority !== 'local'
    || Object.keys(scope).some(key => !['authority', 'sessionId', 'messageId', 'endEventId'].includes(key))
    || current && ['messageId', 'endEventId'].some(key => Object.hasOwn(scope, key))
    || scope.endEventId !== undefined && (!Number.isSafeInteger(scope.endEventId) || scope.endEventId < -1)
    || scope.messageId !== undefined && (typeof scope.messageId !== 'string' || !scope.messageId || scope.messageId.length > 200)) {
    throw Object.assign(new Error('Invalid current local MVU scope'), { code: 'MVU_SCOPE' })
  }
  return { ...scope, authority: 'local' }
}
function resourceId(id) {
  if (typeof id !== 'string' || !/^mvu:[A-Za-z0-9_.-]{1,160}$/.test(id)) throw Object.assign(new Error('Invalid MVU resource'), { code: 'MVU_SCOPE' })
  return id
}
export function createMvuApi(service, { drafts } = {}) {
  return async (req, res) => {
    const pathname = requestPathname(req.url), action = pathname.split('/').at(-1), post = !traceReads.has(action) && pathname !== `${API_V1}/mvu/snapshot` && pathname !== '/'
    if (req.method !== (post ? 'POST' : 'GET')) return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' })
    const controller = new AbortController()
    req.on?.('aborted', () => controller.abort())
    res.on?.('close', () => { if (!res.writableEnded) controller.abort() })
    try {
      if (!post) {
        const raw = new URL(req.url, 'http://localhost').searchParams.get('scope')
        if (!raw || raw.length > 4000) throw Object.assign(new Error('Invalid MVU scope'), { code: 'MVU_SCOPE' })
        if (traceReads.has(action)) {
          const params = new URL(req.url, 'http://localhost').searchParams
          const scope = traceScope(JSON.parse(raw), action !== 'resource')
          const request = { scope, signal: controller.signal }
          if (action === 'resources') return sendJson(res, 200, { ok: true, records: await service.list(request) })
          request.id = resourceId(params.get('id'))
          if (action === 'resource') return sendJson(res, 200, { ok: true, record: await service.read(request) })
          if (action === 'facts') return sendJson(res, 200, { ok: true, ...await service.facts(request) })
          return sendJson(res, 200, { ok: true, versions: await service.history({ ...request, includeBefore: true }) })
        }
        const scope = validateScope(JSON.parse(raw))
        return sendJson(res, 200, await (scope.mode === 'draft' && drafts ? drafts : service).snapshot(scope))
      }
      const body = await readBoundedJson(req, 2 * 1024 * 1024)
      let result
      if (action === 'update') {
        const scope = traceScope(body.scope, true), id = resourceId(body.id)
        const record = await service.read({ id, scope, signal: controller.signal })
        if (!record || record.legacy || record.sourceError || record.capabilities?.edit === false) throw Object.assign(new Error('MVU source is read-only'), { code: 'MVU_READ_ONLY' })
        result = await service.update({ id, scope, content: body.content, expectedRevision: body.expectedRevision, operationId: body.operationId, signal: controller.signal })
      }
      else if (pathname.endsWith('/card-binding')) { const scope = validateScope(body.scope); result = await (scope.mode === 'draft' && drafts ? drafts : service).createCardBinding({ scope, grantId: body.grantId, sourceIdentity: body.sourceIdentity, bindingId: body.bindingId, signal: controller.signal }) }
      else if (pathname.endsWith('/card-binding/revoke')) { service.revokeCardBinding(body.capability); drafts?.revokeCardBinding(body.capability); result = { ok: true } }
      else result = await (drafts?.ownsBinding(body.capability) ? drafts : service).cardWrite({ capability: body.capability, operation: body.operation, value: body.value, expectedRevision: body.expectedRevision, operationId: body.operationId, cause: body.cause, signal: controller.signal })
      return sendJson(res, 200, result)
    } catch (error) {
      const status = ['MVU_AMBIGUOUS', 'REVISION_CONFLICT', 'MVU_IDEMPOTENCY_CONFLICT'].includes(error.code) ? 409 : ['MVU_WRITE_DENIED', 'MVU_READ_ONLY', 'MVU_USAGE_DENIED'].includes(error.code) ? 403 : 400
      return sendJson(res, status, { ok: false, code: error.code ?? 'MVU_SCOPE', error: action === 'update' && ['MVU_SCHEMA', 'MVU_SCHEMA_CODE', 'MVU_PARSE', 'MVU_PATH', 'MVU_LIMIT'].includes(error.code) ? error.message.slice(0, 1200) : 'MVU operation rejected for this binding' })
    }
  }
}
