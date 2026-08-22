export const PLUGIN_ID = 'pmp-dsh-tavern'
export const API_ROOT = `/${PLUGIN_ID}/api`
export const API_V1 = `${API_ROOT}/v1`
export const API_V2 = `${API_ROOT}/v2`
export const LEGACY_API_ROOT = '/dsh-tavern/api'
export const PROFILE_SECTION = `${PLUGIN_ID}:profile`
export const CLIENT_REFRESH_EVENT = `${PLUGIN_ID}:refresh`
export const CHROME_SERVICE_NAME = 'pmpDshTavernChrome'
export const CLIENT_UI_SETTINGS_EVENT = `${PLUGIN_ID}:ui-settings`
export const CLIENT_CONVERSATION_SETTINGS_EVENT = `${PLUGIN_ID}:conversation-settings`
export const CLIENT_IMPORT_FAILURE_EVENT = `${PLUGIN_ID}:import-failure`

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

export function isUnderApiV2(url, prefix = '') {
  const path = requestPathname(url)
  const root = apiV2Path(prefix)
  return path === root || path.startsWith(`${root}/`)
}

export const identityConstants = Object.freeze({
  pluginId: PLUGIN_ID,
  apiRoot: API_ROOT,
  apiV1: API_V1,
  apiV2: API_V2,
  chromeServiceName: CHROME_SERVICE_NAME,
  legacyApiRoot: LEGACY_API_ROOT,
  profileSection: PROFILE_SECTION,
  clientRefreshEvent: CLIENT_REFRESH_EVENT,
  clientUiSettingsEvent: CLIENT_UI_SETTINGS_EVENT,
  clientConversationSettingsEvent: CLIENT_CONVERSATION_SETTINGS_EVENT,
  clientImportFailureEvent: CLIENT_IMPORT_FAILURE_EVENT,
})
