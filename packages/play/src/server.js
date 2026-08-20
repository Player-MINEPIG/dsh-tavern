import { API_V2 } from '../../identity.js'
import { createChromeApiHandler } from './chrome.js'
import { httpError, parsePlayUrl, sendPlayError } from './http.js'
import { createSessionApiHandler } from './sessions.js'
import { validatePlayDocument } from './timeline.js'
import { createWorkspaceApiHandler } from './workspace.js'

export function isPlayApiPath(url) {
  return parsePlayUrl(url, API_V2) !== null
}

const SESSION_ROUTES = [
  [/^\/sessions\/([^/]+)\/branch$/, 'branch', 'POST'],
  [/^\/sessions\/([^/]+)\/user-message$/, 'userMessage', 'POST'],
  [/^\/sessions\/([^/]+)\/messages$/, 'messages', 'GET'],
  [/^\/sessions$/, 'create', 'POST'],
]

export function createPlayApiHandler({
  chromeStore,
  workspaceStore,
  host,
  validateFile = validatePlayDocument,
  now,
} = {}) {
  if (chromeStore === undefined) throw new TypeError('chromeStore is required')
  const chromeApi = createChromeApiHandler(chromeStore)
  const workspaceApi = workspaceStore === undefined
    ? null
    : createWorkspaceApiHandler(workspaceStore, { validateFile })
  const sessionApi = host !== undefined && workspaceStore !== undefined
    ? createSessionApiHandler({ host, workspaceStore, now })
    : null

  return async (req, res) => {
    try {
      const route = parsePlayUrl(req.url, API_V2)
      if (route === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const method = String(req.method ?? 'GET').toUpperCase()
      if (route.rest === '/chrome') {
        if (method !== 'GET' && method !== 'PUT') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        return await chromeApi(req, res, { method })
      }
      if (route.rest === '/workspace') {
        if (method !== 'GET' && method !== 'PUT') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        if (method === 'GET') return await workspaceApi.getWorkspace(req, res)
        return await workspaceApi.putWorkspace(req, res)
      }
      if (route.rest === '/workspace/dirs') {
        if (method !== 'POST') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await workspaceApi.postDirs(req, res)
      }
      if (route.rest === '/workspace/files') {
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await workspaceApi.files(req, res, { method, searchParams: route.searchParams })
      }
      if (route.rest === '/focus') {
        if (method !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await sessionApi.focus(req, res, route.searchParams)
      }
      const importContextMatch = route.rest.match(/^\/sessions\/([^/]+)\/import-context$/)
      if (importContextMatch !== null) {
        if (!['GET', 'PUT', 'DELETE'].includes(method)) throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await sessionApi.importContext(req, res, importContextMatch[1], method)
      }
      for (const [pattern, action, required] of SESSION_ROUTES) {
        const match = route.rest.match(pattern)
        if (match === null) continue
        if (method !== required) throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await sessionApi[action](req, res, match[1])
      }
      throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
    } catch (error) {
      return sendPlayError(res, error)
    }
  }
}
