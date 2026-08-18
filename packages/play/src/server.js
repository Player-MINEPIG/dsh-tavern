import { API_V2 } from '../../identity.js'
import { createChromeApiHandler } from './chrome.js'
import { httpError, parsePlayUrl, sendPlayError } from './http.js'
import { validatePlayDocument } from './timeline.js'
import { createWorkspaceApiHandler } from './workspace.js'

export function isPlayApiPath(url) {
  return parsePlayUrl(url, API_V2) !== null
}

export function createPlayApiHandler({ chromeStore, workspaceStore, validateFile = validatePlayDocument } = {}) {
  if (chromeStore === undefined) throw new TypeError('chromeStore is required')
  const chromeApi = createChromeApiHandler(chromeStore)
  const workspaceApi = workspaceStore === undefined
    ? null
    : createWorkspaceApiHandler(workspaceStore, { validateFile })

  return async (req, res) => {
    try {
      const route = parsePlayUrl(req.url, API_V2)
      if (route === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const method = String(req.method ?? 'GET').toUpperCase()
      if (route.rest === '/chrome') return await chromeApi(req, res, { method })
      if (workspaceApi !== null) {
        if (route.rest === '/workspace' && method === 'GET') return await workspaceApi.getWorkspace(req, res)
        if (route.rest === '/workspace' && method === 'PUT') return await workspaceApi.putWorkspace(req, res)
        if (route.rest === '/workspace/dirs' && method === 'POST') return await workspaceApi.postDirs(req, res)
        if (route.rest === '/workspace/files') return await workspaceApi.files(req, res, { method, searchParams: route.searchParams })
      }
      throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
    } catch (error) {
      return sendPlayError(res, error)
    }
  }
}
