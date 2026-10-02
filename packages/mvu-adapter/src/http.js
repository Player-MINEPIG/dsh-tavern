import { API_V1, requestPathname } from '../../identity.js'
import { sendJson, readBoundedJson } from '../../play/src/http.js'

const paths = ['snapshot', 'card-binding', 'card-write', 'card-binding/revoke']
export const isMvuApiPath = url => paths.some(path => requestPathname(url) === `${API_V1}/mvu/${path}`)
const scopeKeys = ['mode', 'characterId', 'playthroughId', 'sessionId', 'nodeId', 'variantId', 'endEventId', 'sessionFormatVersion']
function validateScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).some(key => !scopeKeys.includes(key))) throw Object.assign(new Error('Invalid MVU scope'), { code: 'MVU_SCOPE' })
  return scope
}
export function createMvuApi(service) {
  return async (req, res) => {
    const pathname = requestPathname(req.url), post = pathname !== `${API_V1}/mvu/snapshot` && pathname !== '/'
    if (req.method !== (post ? 'POST' : 'GET')) return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' })
    const controller = new AbortController()
    req.on?.('aborted', () => controller.abort())
    res.on?.('close', () => { if (!res.writableEnded) controller.abort() })
    try {
      if (!post) {
        const raw = new URL(req.url, 'http://localhost').searchParams.get('scope')
        if (!raw || raw.length > 4000) throw Object.assign(new Error('Invalid MVU scope'), { code: 'MVU_SCOPE' })
        return sendJson(res, 200, await service.snapshot(validateScope(JSON.parse(raw))))
      }
      const body = await readBoundedJson(req, 2 * 1024 * 1024)
      let result
      if (pathname.endsWith('/card-binding')) result = await service.createCardBinding({ scope: validateScope(body.scope), grantId: body.grantId, sourceIdentity: body.sourceIdentity, signal: controller.signal })
      else if (pathname.endsWith('/card-binding/revoke')) { service.revokeCardBinding(body.capability); result = { ok: true } }
      else result = await service.cardWrite({ capability: body.capability, operation: body.operation, value: body.value, expectedRevision: body.expectedRevision, operationId: body.operationId, cause: body.cause, signal: controller.signal })
      return sendJson(res, 200, result)
    } catch (error) {
      const status = ['MVU_AMBIGUOUS', 'REVISION_CONFLICT', 'MVU_IDEMPOTENCY_CONFLICT'].includes(error.code) ? 409 : ['MVU_WRITE_DENIED', 'MVU_READ_ONLY', 'MVU_USAGE_DENIED'].includes(error.code) ? 403 : 400
      return sendJson(res, status, { ok: false, code: error.code ?? 'MVU_SCOPE', error: 'MVU operation rejected for this binding' })
    }
  }
}
