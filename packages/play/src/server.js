import { API_V2 } from '../../identity.js'
import { createChromeApiHandler, createChromeEventsHandler } from './chrome.js'
import { httpError, parsePlayUrl, readBoundedJson, sendJson, sendPlayError } from './http.js'
import { createSessionApiHandler } from './sessions.js'
import { validatePlayDocument } from './timeline.js'
import { createWorkspaceApiHandler } from './workspace.js'
import { createOperationContext } from './operation-log.js'

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
  logger,
  operationOptions,
  membershipService,
  resolveCharacter,
  relinkPlaythrough,
} = {}) {
  if (chromeStore === undefined) throw new TypeError('chromeStore is required')
  const chromeApi = createChromeApiHandler(chromeStore)
  const chromeEventsApi = createChromeEventsHandler(chromeStore)
  const workspaceApi = workspaceStore === undefined
    ? null
    : createWorkspaceApiHandler(workspaceStore, { validateFile })
  const sessionApi = host !== undefined && workspaceStore !== undefined
    ? createSessionApiHandler({ host, workspaceStore, now })
    : null

  const operationDefaults = {
    ...(operationOptions ?? {}),
    ...(logger === undefined ? {} : { logger }),
  }

  function startMutation(req, operation, path) {
    const context = createOperationContext({
      ...operationDefaults,
      operation,
      meta: { method: String(req.method ?? 'GET').toUpperCase(), ...(path === undefined ? {} : { path }) },
    })
    context.start({ method: String(req.method ?? 'GET').toUpperCase(), ...(path === undefined ? {} : { path }) })
    return context
  }

  async function runMutation(operation, action) {
    try {
      const result = await action()
      operation.success('committed')
      return result
    } catch (error) {
      operation.failure(error, { status: errorStatus(error) })
      throw error
    }
  }

  return async (req, res) => {
    let operation = null
    try {
      const route = parsePlayUrl(req.url, API_V2)
      if (route === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const method = String(req.method ?? 'GET').toUpperCase()
      if (route.rest === '/chrome') {
        if (method !== 'GET' && method !== 'PUT') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        return await chromeApi(req, res, { method })
      }
      if (route.rest === '/chrome/events') {
        return await chromeEventsApi(req, res, { method })
      }
      if (route.rest === '/workspace') {
        if (method !== 'GET' && method !== 'PUT') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        if (method === 'GET') return await workspaceApi.getWorkspace(req, res)
        operation = startMutation(req, 'workspace.bind', 'workspace')
        return await runMutation(operation, () => workspaceApi.putWorkspace(req, res, { operation }))
      }
      if (route.rest === '/workspace/dirs') {
        if (method !== 'POST') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        operation = startMutation(req, 'workspace.dir.create')
        return await runMutation(operation, () => workspaceApi.postDirs(req, res, { operation }))
      }
      if (route.rest === '/workspace/files') {
        if (workspaceApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        if (method === 'PUT') {
          operation = startMutation(req, 'workspace.file.write', safePath(route.searchParams.get('path')))
          return await runMutation(operation, () => workspaceApi.files(req, res, {
            method,
            searchParams: route.searchParams,
            operation,
          }))
        }
        return await workspaceApi.files(req, res, { method, searchParams: route.searchParams })
      }
      if (route.rest === '/focus') {
        if (method !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await sessionApi.focus(req, res, route.searchParams)
      }
      const playthroughFocusMatch = route.rest.match(/^\/playthroughs\/([^/]+)\/focus$/)
      if (playthroughFocusMatch !== null) {
        if (method !== 'GET') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        return await sessionApi.playthroughFocus(req, res, playthroughFocusMatch[1])
      }
      const relinkCharacterMatch = route.rest.match(/^\/playthroughs\/([^/]+)\/relink-character$/)
      if (relinkCharacterMatch !== null) {
        if (method !== 'POST') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (typeof resolveCharacter !== 'function' || typeof relinkPlaythrough !== 'function') {
          throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        }
        const playthroughId = safeDecodeId(relinkCharacterMatch[1], 'playthrough id')
        const body = await readBoundedJson(req, 16 * 1024)
        if (typeof body.characterId !== 'string' || body.characterId.trim() === '') {
          throw httpError(400, 'characterId must be a non-empty string', 'PLAY_CHARACTER_ID_INVALID')
        }
        const characterId = body.characterId.trim()
        const character = await resolveCharacter(characterId)
        if (character === null || character === undefined) {
          throw httpError(404, 'character not found', 'CHARACTER_NOT_FOUND')
        }
        operation = startMutation(req, 'playthrough.character.relink')
        operation.stage('request.validated', { playthroughId, characterId })
        const result = await runMutation(operation, () => relinkPlaythrough(playthroughId, character, { operation }))
        return sendJson(res, 200, result)
      }
      const detachSessionMatch = route.rest.match(/^\/playthroughs\/([^/]+)\/detach-session$/)
      if (detachSessionMatch !== null) {
        if (method !== 'POST') throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (membershipService === undefined) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        const playthroughId = safeDecodeId(detachSessionMatch[1], 'playthrough id')
        const body = await readBoundedJson(req, 16 * 1024)
        if (typeof body.sessionId !== 'string' || body.sessionId.trim() === '') {
          throw httpError(400, 'sessionId must be a non-empty string', 'PLAY_SESSION_ID_INVALID')
        }
        operation = startMutation(req, 'playthrough.session.detach')
        operation.stage('request.validated', { playthroughId, sessionId: body.sessionId })
        const result = await runMutation(operation, () => membershipService.detach(playthroughId, body.sessionId, { operation }))
        return sendJson(res, 200, result)
      }
      const importContextMatch = route.rest.match(/^\/sessions\/([^/]+)\/import-context$/)
      if (importContextMatch !== null) {
        if (!['GET', 'PUT', 'DELETE'].includes(method)) throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        if (method === 'GET') return await sessionApi.importContext(req, res, importContextMatch[1], method)
        operation = startMutation(req, method === 'PUT' ? 'session.import-context.bind' : 'session.import-context.unbind')
        return await runMutation(operation, () => sessionApi.importContext(req, res, importContextMatch[1], method, operation))
      }
      for (const [pattern, action, required] of SESSION_ROUTES) {
        const match = route.rest.match(pattern)
        if (match === null) continue
        if (method !== required) throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
        if (sessionApi === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
        if (action === 'messages') return await sessionApi[action](req, res, match[1])
        const operationName = action === 'create' ? 'session.create' : action === 'branch' ? 'session.branch' : 'session.user-message'
        operation = startMutation(req, operationName)
        return await runMutation(operation, () => action === 'create'
          ? sessionApi[action](req, res, operation)
          : sessionApi[action](req, res, match[1], operation))
      }
      throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
    } catch (error) {
      operation?.failure(error, { status: errorStatus(error) })
      return sendPlayError(res, error)
    }
  }
}

function errorStatus(error) {
  return error?.status
    ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500)
}

function safePath(value) {
  if (typeof value !== 'string' || value === '') return undefined
  return value.replace(/[\u0000-\u001f\u007f]/g, '\ufffd').slice(0, 512)
}

function safeDecodeId(value, label) {
  try {
    return decodeURIComponent(value)
  } catch {
    throw httpError(400, `${label} is not valid URL encoding`, 'PLAY_ID_INVALID')
  }
}
