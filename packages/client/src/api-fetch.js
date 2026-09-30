import { API_ROOT } from '../../identity.js'

// Keep Host credentials in the official desktop proxy. The opaque token is
// local CSRF protection, never authentication and never exposed to message JS.
let tokenPromise
function requestToken() {
  return tokenPromise ??= globalThis.fetch(`${API_ROOT}/request-token`, {
    headers: { 'X-Tavern-Client': 'embedded' }, cache: 'no-store',
  }).then(async response => {
    if (!response.ok) throw new Error(`Tavern request token: HTTP ${response.status}`)
    const { token } = await response.json()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid Tavern request token')
    return token
  }).catch(error => { tokenPromise = undefined; throw error })
}

export async function tavernFetch(url, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase()
  if (globalThis.location?.protocol !== 'dsh-app:' || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return globalThis.fetch(url, options)
  }
  // This helper is deliberately limited to our API, including on retries.
  if (typeof url !== 'string' || !url.startsWith(`${API_ROOT}/`)) throw new Error('Invalid Tavern API path')
  const send = async () => {
    const headers = new Headers(options.headers)
    headers.set('X-Tavern-Request-Token', await requestToken())
    return globalThis.fetch(url, { ...options, headers })
  }
  const response = await send()
  if (response.status !== 403) return response
  const error = await response.clone().json().catch(() => null)
  if (error?.code !== 'TAVERN_API_ORIGIN_FORBIDDEN') return response
  tokenPromise = undefined // Host restart: rejected writes had no side effects.
  return send()
}
