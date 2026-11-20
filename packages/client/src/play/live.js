import { runGenerationOperation } from './generation-recovery.js'
import { rollbackAtNode, runBranchOperation } from './branch-recovery.js'
import { tavernFetch } from '../api-fetch.js'
import { API_V1, API_V2 } from '../../../identity.js'
import {
  normalizeCatalog,
  normalizeChrome,
  normalizeFocus,
  normalizeSessionMessages,
  normalizeTimeline,
  normalizeWorkspace,
  parseJsonDocument,
  timelinePath,
} from './schema.js'

function errorMessage(data, status) {
  if (typeof data?.error === 'string') return data.error
  if (typeof data?.error?.message === 'string') return data.error.message
  return `HTTP ${status}`
}

function createRequester(fetchImpl, root) {
  return async function request(method, path, body, {signal} = {}) {
    const hasBody = body !== undefined
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
      ...(signal ? {signal} : {}),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      const error = new Error(errorMessage(data, response.status))
      error.status = response.status
      error.operationId = data?.operationId ?? response.headers?.get?.('X-Tavern-Operation-Id') ?? undefined
      error.code = data?.code ?? data?.error?.code
      error.diagnostics = data?.diagnostics ?? data?.error?.diagnostics ?? []
      error.details = data?.details ?? data?.error?.details
      throw error
    }
    return data
  }
}

function fileContent(value, label) {
  if (typeof value?.content !== 'string') throw new TypeError(`${label}: content must be a string`)
  return value.content
}

const REVISION_PATTERN = /^[0-9a-f]{64}$/

function fileRevision(value, label) {
  if (typeof value?.revision !== 'string' || !REVISION_PATTERN.test(value.revision)) {
    throw new TypeError(`${label}: revision must be a 64-character lowercase SHA-256 hex string`)
  }
  return value.revision
}

function pathQuery(path) {
  return `?path=${encodeURIComponent(path)}`
}

export function createLivePlayClient({
  fetchImpl = tavernFetch,
  apiRoot = API_V2,
  v1Root = API_V1,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')
  const v1 = createRequester(fetchImpl, v1Root)
  const v2 = createRequester(fetchImpl, apiRoot)
  const managedRevisions = new Map()
  const snapshotRevisions = new WeakMap()

  function invalidateRevision(path) {
    managedRevisions.delete(path)
  }

  function expectedRevision(path) {
    return managedRevisions.has(path) ? managedRevisions.get(path) : null
  }

  async function getCharacterSelection(sessionId) {
    const query = typeof sessionId === 'string' && sessionId !== ''
      ? `?sessionId=${encodeURIComponent(sessionId)}`
      : ''
    return v1('GET', `/character-selection${query}`)
  }

  async function getJsonFile(path, normalize, label, options) {
    let response
    try {
      response = await v2('GET', `/workspace/files${pathQuery(path)}`, undefined, options)
    } catch (error) {
      if (error?.status === 404 && error?.code === 'PLAY_PATH_NOT_FOUND') {
        managedRevisions.set(path, null)
      }
      throw error
    }
    const content = fileContent(response, label)
    const revision = fileRevision(response, label)
    const parsed = parseJsonDocument(content, normalize, label)
    managedRevisions.set(path, revision)
    snapshotRevisions.set(parsed, revision)
    return parsed
  }

  async function putJsonFile(path, value, normalize, label, { expectedWorkspaceScope, revision = expectedRevision(path) } = {}) {
    const normalized = normalize(value, label)
    const body = {
      content: JSON.stringify(normalized),
      expectedRevision: revision,
      ...(expectedWorkspaceScope === undefined ? {} : { expectedWorkspaceScope }),
    }
    try {
      const response = await v2('PUT', `/workspace/files${pathQuery(path)}`, body)
      const revision = fileRevision(response, label)
      managedRevisions.set(path, revision)
    } catch (error) {
      if (error?.status === 409 && error?.code === 'PLAY_FILE_REVISION_CONFLICT') {
        invalidateRevision(path)
      } else if (error instanceof TypeError) {
        // A malformed success envelope leaves the write outcome unknown; never reuse the old revision.
        invalidateRevision(path)
      }
      throw error
    }
    return normalized
  }

  function retryLimit(options) {
    const value = options?.maxRetries ?? options?.retries ?? 3
    if (!Number.isSafeInteger(value) || value < 1 || value > 5) {
      throw new TypeError('maxRetries must be an integer from 1 to 5')
    }
    return value
  }

  async function updateJsonFile({ getFresh, putFresh, mutator, options }) {
    if (typeof mutator !== 'function') throw new TypeError('mutator must be a function')
    const maxRetries = retryLimit(options)
    for (let retry = 0; ; retry += 1) {
      const current = await getFresh()
      const next = await mutator(current)
      try {
        return await putFresh(next, snapshotRevisions.get(current) ?? null)
      } catch (error) {
        if (error?.status !== 409 || error?.code !== 'PLAY_FILE_REVISION_CONFLICT' || retry >= maxRetries) {
          throw error
        }
      }
    }
  }

  // Bound each HTTP step independently. A queued model turn may take much
  // longer than a request; generation polls its durable status between steps.
  function operationOptions(options = {}) {
    const deadline = AbortSignal.timeout(35_000)
    return { ...options, signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline }
  }

  async function workspaceScope(options) {
    const workspace = normalizeWorkspace(await v2('GET', '/workspace', undefined, options))
    return JSON.stringify([workspace.workspaceId, workspace.rootPath])
  }

  function mutationIdentity(options) {
    const { operationKey, expectedWorkspaceScope, checkpointId, checkpointKey } = options ?? {}
    return { operationKey, expectedWorkspaceScope, checkpointId, checkpointKey }
  }

  const client = {
    mode: 'live',
    apiRoot,
    chromeEventsUrl: `${apiRoot}/chrome/events`,
    v1Root,

    async getOperationLogs(filters = {}) {
      if (filters.format && filters.format !== 'json') throw new TypeError('getOperationLogs returns JSON pages; use the HTTP endpoint for JSONL.')
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''))
      return v2('GET', `/operation-logs?${query}`)
    },

    async getChrome() {
      return normalizeChrome(await v2('GET', '/chrome'))
    },

    async putChrome(mode) {
      return normalizeChrome(await v2('PUT', '/chrome', { mode }))
    },

    async getWorkspace(options) {
      return normalizeWorkspace(await v2('GET', '/workspace', undefined, operationOptions(options)))
    },

    async putWorkspace(path) {
      return normalizeWorkspace(await v2('PUT', '/workspace', { path }))
    },

    async createDirs(path) {
      return v2('POST', '/workspace/dirs', { path })
    },

    async listFiles(prefix = '') {
      return v2('GET', `/workspace/files?list=${encodeURIComponent(prefix)}`)
    },

    async getFile(path, options) {
      const response = await v2('GET', `/workspace/files${pathQuery(path)}`, undefined, options)
      return {
        path: response.path,
        content: fileContent(response, path),
        ...(response.revision === undefined ? {} : { revision: response.revision }),
      }
    },

    async putFile(path, content, options = {}) {
      if (typeof content !== 'string') throw new TypeError('content must be a string')
      const body = { content }
      if (options !== null && typeof options === 'object' && Object.hasOwn(options, 'expectedRevision')) {
        body.expectedRevision = options.expectedRevision
      }
      if (options !== null && typeof options === 'object' && Object.hasOwn(options, 'expectedWorkspaceScope')) {
        body.expectedWorkspaceScope = options.expectedWorkspaceScope
      }
      return v2('PUT', `/workspace/files${pathQuery(path)}`, { ...body, checkpointId: options?.checkpointId, checkpointKey: options?.checkpointKey }, operationOptions(options))
    },

    getCatalog() {
      return getJsonFile('catalog.json', normalizeCatalog, 'catalog')
    },

    inspectPlaythrough(playthroughId) {
      return v2('GET', `/playthroughs/${encodeURIComponent(playthroughId)}/availability`)
    },

    putCatalog(catalog) {
      return putJsonFile('catalog.json', catalog, normalizeCatalog, 'catalog')
    },

    updateCatalog(mutator, options) {
      return updateJsonFile({
        getFresh: async () => {
          try {
            return await getJsonFile('catalog.json', normalizeCatalog, 'catalog')
          } catch (error) {
            if (error?.status === 404 && error?.code === 'PLAY_PATH_NOT_FOUND') {
              return { playthroughs: [] }
            }
            throw error
          }
        },
        putFresh: (value, revision) => putJsonFile('catalog.json', value, normalizeCatalog, 'catalog', { ...options, revision }),
        mutator,
        options,
      })
    },

    getTimeline(playthrough, options) {
      const path = timelinePath(playthrough)
      return getJsonFile(path, normalizeTimeline, 'timeline', operationOptions(options))
    },

    getCheckpoint(row, scope, key) {
      const query = new URLSearchParams({ scope })
      if (key !== undefined) query.set('key', key)
      return v2('GET', `/workspace/checkpoints/${encodeURIComponent(row.id)}?${query}`, undefined, operationOptions())
        .then(result => result.checkpoint)
    },
    putCheckpoint(row, body) {
      return v2('PUT', `/workspace/checkpoints/${encodeURIComponent(row.id)}`, body, operationOptions())
        .then(result => result.checkpoint)
    },
    getSessionReceipt(key, scope) {
      return v2('GET', `/operation-receipts/${encodeURIComponent(key)}?${new URLSearchParams({ scope })}`, undefined, operationOptions())
    },
    getSessionEvidence(id, bounds) {
      const query = new URLSearchParams({ evidence: 'inheritance', ...bounds })
      return v2('GET', `/sessions/${encodeURIComponent(id)}/messages?${query}`, undefined, operationOptions())
    },
    getCoordinates(id) {
      return v2('GET', `/sessions/${encodeURIComponent(id)}/coordinates`, undefined, operationOptions())
    },
    getRequestOutcome(id, query) {
      return v2('GET', `/sessions/${encodeURIComponent(id)}/messages?${new URLSearchParams(query)}`, undefined, operationOptions())
    },
    rollbackPlaythrough(row, nodeId, variantId) {
      return rollbackAtNode(client, row, nodeId, variantId)
    },
    forkPlaythrough(row, body, options) {
      return runBranchOperation(client, row, { ...body, kind: 'fork' }, options)
    },
    generation(row, body, timeline) {
      return runGenerationOperation(client, row, { ...body, expectedRevision: body.expectedRevision ?? snapshotRevisions.get(timeline) })
    },

    putTimeline(playthrough, timeline) {
      const path = timelinePath(playthrough)
      return putJsonFile(path, timeline, normalizeTimeline, 'timeline')
    },

    updateTimeline(playthrough, mutator, options) {
      const path = timelinePath(playthrough)
      return updateJsonFile({
        getFresh: () => getJsonFile(path, normalizeTimeline, 'timeline'),
        putFresh: (value, revision) => putJsonFile(path, value, normalizeTimeline, 'timeline', { revision }),
        mutator,
        options,
      })
    },

    async getMessages(sessionId) {
      const response = await v2('GET', `/sessions/${encodeURIComponent(sessionId)}/messages`, undefined, operationOptions())
      return normalizeSessionMessages(response)
    },

    async getImportContextBinding(sessionId) {
      const response = await v2('GET', `/sessions/${encodeURIComponent(sessionId)}/import-context`, undefined, operationOptions())
      return response?.binding ?? null
    },

    async putImportContextBinding(sessionId, reference) {
      const response = await v2('PUT', `/sessions/${encodeURIComponent(sessionId)}/import-context`, { reference })
      return response?.binding ?? null
    },

    async deleteImportContextBinding(sessionId) {
      const response = await v2('DELETE', `/sessions/${encodeURIComponent(sessionId)}/import-context`, {})
      return response?.binding ?? null
    },

    async getFocus(playthrough) {
      const playthroughId = playthrough?.id
      if (typeof playthroughId !== 'string' || playthroughId.trim() === '') {
        throw new TypeError('playthrough.id must be a non-empty string')
      }
      const focus = normalizeFocus(await v2('GET', `/playthroughs/${encodeURIComponent(playthroughId)}/focus`, undefined, operationOptions()))
      if (focus.playthroughId !== playthroughId) {
        throw new TypeError('focus.playthroughId does not match playthrough.id')
      }
      return focus
    },

    detachPlaythroughSession(playthroughId, sessionId) {
      if (typeof playthroughId !== 'string' || playthroughId === '') throw new TypeError('playthroughId is required')
      if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId is required')
      return v2('POST', `/playthroughs/${encodeURIComponent(playthroughId)}/detach-session`, { sessionId })
    },

    postUserMessage(sessionId, text, options) {
      return v2('POST', `/sessions/${encodeURIComponent(sessionId)}/user-message`, { text, ...mutationIdentity(options), ...(options?.requestId ? { requestId: options.requestId } : {}) }, operationOptions(options))
    },
    async postDraft(body, options) {
      const expectedWorkspaceScope = body.expectedWorkspaceScope ?? await workspaceScope(options)
      options?.signal?.throwIfAborted()
      return v2('POST', '/drafts', { ...body, expectedWorkspaceScope }, options)
    },
    getDraft(id, options) { return v2('GET', `/drafts/${encodeURIComponent(id)}`, undefined, options) },
    putDraft(id, patch) { return v2('PUT', `/drafts/${encodeURIComponent(id)}`, patch) },
    materializeDraft(id, body, options) { return v2('POST', `/drafts/${encodeURIComponent(id)}/materialize`, body, options) },
    cancelDraft(id) { return v2('POST', `/drafts/${encodeURIComponent(id)}/cancel`, {}) },

    postBranch(sessionId, atEventId, sessionFormatVersion, stateSource, options) {
      if (!Number.isSafeInteger(atEventId) || atEventId < 0) {
        throw new TypeError('atEventId must be a non-negative integer')
      }
      return v2('POST', `/sessions/${encodeURIComponent(sessionId)}/branch`, { atEventId, ...mutationIdentity(options),
        ...(stateSource === undefined ? {} : { stateSource }),
        ...(sessionFormatVersion === undefined ? {} : { sessionFormatVersion }),
      }, operationOptions(options))
    },

    postSession(selectionFromSessionId, importContextRef, stateSource, options) {
      const body = { ...mutationIdentity(options),
        ...(typeof selectionFromSessionId === 'string' && selectionFromSessionId !== '' ? { selectionFromSessionId } : {}),
        ...(importContextRef === undefined ? {} : { importContextRef }),
        ...(stateSource === undefined ? {} : { stateSource }),
      }
      return v2('POST', '/sessions', body, operationOptions(options))
    },

    getCharacterSelection,

    async getSelection(sessionId) {
      const response = await getCharacterSelection(sessionId)
      return response?.selection ?? null
    },
    putCharacterSelection(sessionId, characterCardId, character = {}) {
      if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId is required')
      if (typeof characterCardId !== 'string' || characterCardId === '') {
        throw new TypeError('characterCardId is required')
      }
      if (character === null || typeof character !== 'object' || Array.isArray(character)) {
        throw new TypeError('character selection options must be an object')
      }
      return v1('POST', '/character-selection', {
        sessionId,
        characterCardId,
        character,
      })
    },
    getCharacters() {
      return v1('GET', '/characters')
    },

    putCharacterOrder(mode, characterIds) {
      return v1('PUT', '/characters/order', {
        mode,
        ...(characterIds === undefined ? {} : { characterIds }),
      })
    },

    relinkCharacter(previousCharacterId, characterId) {
      return v1('POST', '/characters/relink', { previousCharacterId, characterId })
    },

    relinkPlaythroughCharacter(playthroughId, characterId) {
      if (typeof playthroughId !== 'string' || playthroughId === '') throw new TypeError('playthroughId is required')
      if (typeof characterId !== 'string' || characterId === '') throw new TypeError('characterId is required')
      return v2('POST', `/playthroughs/${encodeURIComponent(playthroughId)}/relink-character`, { characterId })
    },

    getCharacter(id) {
      return v1('GET', `/characters/${encodeURIComponent(id)}`)
    },

    getCharacterRegexScripts(id) {
      return v1('GET', `/characters/${encodeURIComponent(id)}/regex-scripts`)
    },

    putCharacterRegexScripts(id, regexScripts) {
      return v1('PUT', `/characters/${encodeURIComponent(id)}/regex-scripts`, { regexScripts })
    },

    getPreset(id) {
      return v1('GET', `/presets/${encodeURIComponent(id)}`)
    },

    getPresetRegexScripts(id) {
      return v1('GET', `/presets/${encodeURIComponent(id)}/regex-scripts`)
    },

    putPresetRegexScripts(id, regexScripts) {
      return v1('PUT', `/presets/${encodeURIComponent(id)}/regex-scripts`, { regexScripts })
    },

    getUserSelection(sessionId) {
      return v1('GET', `/user-selection?sessionId=${encodeURIComponent(sessionId)}`)
    },

    getActive(sessionId) {
      const query = typeof sessionId === 'string' && sessionId !== ''
        ? `?sessionId=${encodeURIComponent(sessionId)}`
        : ''
      return v1('GET', `/active${query}`)
    },

    async putGreetingIndex(sessionId, greetingIndex) {
      if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId is required')
      if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0) {
        throw new TypeError('greetingIndex must be a non-negative integer')
      }
      const current = await getCharacterSelection(sessionId)
      if (typeof current?.selection?.characterCardId !== 'string') {
        throw new TypeError('character selection is empty')
      }
      return v1('POST', '/character-selection', {
        sessionId,
        characterCardId: current.selection.characterCardId,
        character: { ...(current.selection.character ?? {}), greetingIndex },
      })
    },
  }
  return client
}
