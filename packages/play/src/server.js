import { API_V2 } from '../../identity.js'
import { createChromeApiHandler, createChromeEventsHandler } from './chrome.js'
import { httpError, parsePlayUrl, readBoundedJson, sendJson, sendPlayError } from './http.js'
import { createSessionApiHandler } from './sessions.js'
import { validatePlayDocument } from './timeline.js'
import { createWorkspaceApiHandler } from './workspace.js'
import { createContractOperation } from './operation-contract.js'
import { serveOperationLogs } from './operation-log-api.js'

export function isPlayApiPath(url) {
  return parsePlayUrl(url, API_V2) !== null
}

export function createPlayApiHandler({
  chromeStore, workspaceStore, host, validateFile = validatePlayDocument, now,
  logger, operationOptions, operationJournal, membershipService, resolveCharacter, relinkPlaythrough,
} = {}) {
  if (chromeStore === undefined) throw new TypeError('chromeStore is required')
  const chromeApi = createChromeApiHandler(chromeStore)
  const chromeEventsApi = createChromeEventsHandler(chromeStore)
  const workspaceApi = workspaceStore === undefined ? null
    : createWorkspaceApiHandler(workspaceStore, { validateFile, coordinates: host?.coordinates?.bind(host) })
  const sessionApi = host !== undefined && workspaceStore !== undefined
    ? createSessionApiHandler({ host, workspaceStore, now }) : null
  const operationDefaults = {
    ...(operationOptions ?? {}),
    ...(operationJournal ? { journal: operationJournal } : {}),
    ...(logger === undefined ? {} : { logger }),
  }

  // Method, route template, availability and operation semantics have one owner.
  // Reads and chrome explicitly omit operation metadata and remain quiet.
  const routes = []
  function route(path, available, methods) {
    const pattern = new RegExp(`^${path.replace(':id', '([^/]+)')}$`)
    routes.push({ path, pattern, available, methods })
  }
  const quiet = action => ({ action })
  const mutation = (operation, action, result = 'completed') => ({ operation, action, result })
  route('/operation-logs', true, { GET: quiet(({ req, res, searchParams }) => serveOperationLogs(operationJournal, req, res, searchParams)) })
  route('/chrome', true, Object.fromEntries(['GET', 'PUT'].map(method => [method, quiet(({ req, res }) => chromeApi(req, res, { method }))])))
  route('/chrome/events', true, { GET: quiet(({ req, res }) => chromeEventsApi(req, res, { method: 'GET' })) })
  route('/workspace', workspaceApi !== null, {
    GET: quiet(({ req, res }) => workspaceApi.getWorkspace(req, res)),
    PUT: mutation('workspace.bind', ({ req, res, operation }) => workspaceApi.putWorkspace(req, res, { operation })),
  })
  route('/workspace/dirs', workspaceApi !== null, {
    POST: mutation('workspace.dir.create', ({ req, res, operation }) => workspaceApi.postDirs(req, res, { operation })),
  })
  route('/workspace/files', workspaceApi !== null, {
    GET: quiet(({ req, res, searchParams }) => workspaceApi.files(req, res, { method: 'GET', searchParams })),
    PUT: mutation('workspace.file.write', ({ req, res, searchParams, operation }) => workspaceApi.files(req, res, { method: 'PUT', searchParams, operation })),
  })
  route('/focus', sessionApi !== null, { GET: quiet(({ req, res, searchParams }) => sessionApi.focus(req, res, searchParams)) })
  route('/playthroughs/:id/focus', sessionApi !== null, { GET: quiet(({ req, res, id }) => sessionApi.playthroughFocus(req, res, id)) })
  route('/playthroughs/:id/relink-character', typeof resolveCharacter === 'function' && typeof relinkPlaythrough === 'function', {
    POST: mutation('playthrough.character.relink', async ({ req, res, id, operation }) => {
      const playthroughId = safeDecodeId(id, 'playthrough id')
      operation.identify({ playthroughId })
      const body = await readBoundedJson(req, 16 * 1024)
      if (typeof body.characterId !== 'string' || body.characterId.trim() === '') {
        throw httpError(400, 'characterId must be a non-empty string', 'PLAY_CHARACTER_ID_INVALID')
      }
      const character = await resolveCharacter(body.characterId.trim())
      if (character == null) throw httpError(404, 'character not found', 'CHARACTER_NOT_FOUND')
      return sendJson(res, 200, await relinkPlaythrough(playthroughId, character, { operation }))
    }),
  })
  route('/playthroughs/:id/detach-session', membershipService !== undefined, {
    POST: mutation('playthrough.session.detach', async ({ req, res, id, operation }) => {
      const playthroughId = safeDecodeId(id, 'playthrough id')
      operation.identify({ playthroughId })
      const body = await readBoundedJson(req, 16 * 1024)
      if (typeof body.sessionId !== 'string' || body.sessionId.trim() === '') {
        throw httpError(400, 'sessionId must be a non-empty string', 'PLAY_SESSION_ID_INVALID')
      }
      operation.identify({ sessionId: body.sessionId })
      return sendJson(res, 200, await membershipService.detach(playthroughId, body.sessionId, { operation }))
    }),
  })
  route('/sessions/:id/import-context', sessionApi !== null, Object.fromEntries(['GET', 'PUT', 'DELETE'].map(method => [method, {
    ...(method === 'GET' ? {} : { operation: method === 'PUT' ? 'session.import-context.bind' : 'session.import-context.unbind', result: 'completed' }),
    action: ({ req, res, id, operation }) => sessionApi.importContext(req, res, id, method, operation),
  }])))
  route('/sessions', sessionApi !== null, { POST: mutation('session.create', ({ req, res, operation }) => sessionApi.create(req, res, operation)) })
  for (const [suffix, action, method, operation] of [
    ['branch', 'branch', 'POST', 'session.branch'],
    ['user-message', 'userMessage', 'POST', 'session.user-message'],
    ['messages', 'messages', 'GET'], ['coordinates', 'coordinates', 'GET'],
  ]) {
    route(`/sessions/:id/${suffix}`, sessionApi !== null, { [method]: {
      operation, result: action === 'userMessage' ? 'accepted' : 'completed',
      action: ({ req, res, id, operation }) => sessionApi[action](req, res, id, operation),
    } })
  }

  return async (req, res) => {
    let operation
    try {
      const parsed = parsePlayUrl(req.url, API_V2)
      if (parsed === null) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const entry = routes.find(entry => entry.pattern.test(parsed.rest))
      if (!entry) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const method = String(req.method ?? 'GET').toUpperCase()
      const descriptor = Object.hasOwn(entry.methods, method) ? entry.methods[method] : undefined
      if (!descriptor) throw httpError(405, 'method not allowed', 'PLAY_METHOD_NOT_ALLOWED')
      if (!entry.available) throw httpError(404, 'Not found', 'PLAY_NOT_FOUND')
      const id = parsed.rest.match(entry.pattern)[1]
      if (descriptor.operation) {
        operation = createContractOperation({ ...operationDefaults, operation: descriptor.operation, meta: { method, route: entry.path } })
        res.setHeader('X-Tavern-Operation-Id', operation.operationId)
        operation.start()
      }
      const result = await descriptor.action({ req, res, id, operation, searchParams: parsed.searchParams })
      operation?.success(descriptor.result, { status: res.statusCode })
      return result
    } catch (error) {
      operation?.failure(error, { status: error?.status ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500) })
      return sendPlayError(res, error, operation?.operationId)
    }
  }
}

function safeDecodeId(value, label) {
  try { return decodeURIComponent(value) } catch {
    throw httpError(400, `${label} is not valid URL encoding`, 'PLAY_ID_INVALID')
  }
}
