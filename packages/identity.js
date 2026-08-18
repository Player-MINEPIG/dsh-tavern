export const PLUGIN_ID = 'pmp-dsh-tavern'
export const API_ROOT = `/${PLUGIN_ID}/api`
export const API_V1 = `${API_ROOT}/v1`
export const API_V2 = `${API_ROOT}/v2`
export const LEGACY_API_ROOT = '/dsh-tavern/api'

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function requestPathname(url) {
  return new URL(url ?? '/', 'http://localhost').pathname
}

export function apiV1Path(pathname = '') {
  if (pathname === '' || pathname === '/') return API_V1
  return `${API_V1}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

export function apiV2Path(pathname = '') {
  if (pathname === '' || pathname === '/') return API_V2
  return `${API_V2}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

export function isApiV1Path(url, pathname = '') {
  return requestPathname(url) === apiV1Path(pathname)
}

export function isUnderApiV1(url, prefix) {
  const path = requestPathname(url)
  const root = apiV1Path(prefix)
  return path === root || path.startsWith(`${root}/`)
}

export const identityConstants = Object.freeze({
  pluginId: PLUGIN_ID,
  apiRoot: API_ROOT,
  apiV1: API_V1,
  apiV2: API_V2,
  legacyApiRoot: LEGACY_API_ROOT,
})
