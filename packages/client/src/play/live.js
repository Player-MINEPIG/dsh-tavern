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
  return async function request(method, path, body) {
    const hasBody = body !== undefined
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      const error = new Error(errorMessage(data, response.status))
      error.status = response.status
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
  fetchImpl = globalThis.fetch,
  apiRoot = API_V2,
  v1Root = API_V1,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')
  const v1 = createRequester(fetchImpl, v1Root)
  const v2 = createRequester(fetchImpl, apiRoot)
  const managedRevisions = new Map()

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

  async function getJsonFile(path, normalize, label) {
    let response
    try {
      response = await v2('GET', `/workspace/files${pathQuery(path)}`)
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
    return parsed
  }

  async function putJsonFile(path, value, normalize, label) {
    const normalized = normalize(value, label)
    const body = {
      content: JSON.stringify(normalized),
      expectedRevision: expectedRevision(path),
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
        return await putFresh(next)
      } catch (error) {
        if (error?.status !== 409 || error?.code !== 'PLAY_FILE_REVISION_CONFLICT' || retry >= maxRetries) {
          throw error
        }
      }
    }
  }

  return {
    mode: 'live',
    apiRoot,
    chromeEventsUrl: `${apiRoot}/chrome/events`,
    v1Root,

    async getChrome() {
      return normalizeChrome(await v2('GET', '/chrome'))
    },

    async putChrome(mode) {
      return normalizeChrome(await v2('PUT', '/chrome', { mode }))
    },

    async getWorkspace() {
      return normalizeWorkspace(await v2('GET', '/workspace'))
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

    async getFile(path) {
      const response = await v2('GET', `/workspace/files${pathQuery(path)}`)
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
      return v2('PUT', `/workspace/files${pathQuery(path)}`, body)
    },

    getCatalog() {
      return getJsonFile('catalog.json', normalizeCatalog, 'catalog')
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
        putFresh: value => putJsonFile('catalog.json', value, normalizeCatalog, 'catalog'),
        mutator,
        options,
      })
    },

    getTimeline(playthrough) {
      const path = timelinePath(playthrough)
      return getJsonFile(path, normalizeTimeline, 'timeline')
    },

    putTimeline(playthrough, timeline) {
      const path = timelinePath(playthrough)
      return putJsonFile(path, timeline, normalizeTimeline, 'timeline')
    },

    updateTimeline(playthrough, mutator, options) {
      const path = timelinePath(playthrough)
      return updateJsonFile({
        getFresh: () => getJsonFile(path, normalizeTimeline, 'timeline'),
        putFresh: value => putJsonFile(path, value, normalizeTimeline, 'timeline'),
        mutator,
        options,
      })
    },

    async getMessages(sessionId) {
      const response = await v2('GET', `/sessions/${encodeURIComponent(sessionId)}/messages`)
      return normalizeSessionMessages(response)
    },

    async getImportContextBinding(sessionId) {
      const response = await v2('GET', `/sessions/${encodeURIComponent(sessionId)}/import-context`)
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
      const focus = normalizeFocus(await v2('GET', `/playthroughs/${encodeURIComponent(playthroughId)}/focus`))
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

    postUserMessage(sessionId, text) {
      return v2('POST', `/sessions/${encodeURIComponent(sessionId)}/user-message`, { text })
    },

    postBranch(sessionId, atEventId) {
      if (!Number.isSafeInteger(atEventId) || atEventId < 0) {
        throw new TypeError('atEventId must be a non-negative integer')
      }
      return v2('POST', `/sessions/${encodeURIComponent(sessionId)}/branch`, { atEventId })
    },

    postSession(selectionFromSessionId, importContextRef) {
      const body = {
        ...(typeof selectionFromSessionId === 'string' && selectionFromSessionId !== '' ? { selectionFromSessionId } : {}),
        ...(importContextRef === undefined ? {} : { importContextRef }),
      }
      return v2('POST', '/sessions', body)
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

    putCharacterOrder(characterIds) {
      return v1('PUT', '/characters/order', { characterIds })
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
}
