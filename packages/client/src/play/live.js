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
      throw error
    }
    return data
  }
}

function fileContent(value, label) {
  if (typeof value?.content !== 'string') throw new TypeError(`${label}: content must be a string`)
  return value.content
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

  async function getCharacterSelection(sessionId) {
    const query = typeof sessionId === 'string' && sessionId !== ''
      ? `?sessionId=${encodeURIComponent(sessionId)}`
      : ''
    return v1('GET', `/character-selection${query}`)
  }

  async function getJsonFile(path, normalize, label) {
    const response = await v2('GET', `/workspace/files${pathQuery(path)}`)
    return parseJsonDocument(fileContent(response, label), normalize, label)
  }

  async function putJsonFile(path, value, normalize, label) {
    const normalized = normalize(value, label)
    await v2('PUT', `/workspace/files${pathQuery(path)}`, {
      content: JSON.stringify(normalized),
    })
    return normalized
  }

  return {
    mode: 'live',
    apiRoot,
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
      return { path: response.path, content: fileContent(response, path) }
    },

    async putFile(path, content) {
      if (typeof content !== 'string') throw new TypeError('content must be a string')
      return v2('PUT', `/workspace/files${pathQuery(path)}`, { content })
    },

    getCatalog() {
      return getJsonFile('catalog.json', normalizeCatalog, 'catalog')
    },

    putCatalog(catalog) {
      return putJsonFile('catalog.json', catalog, normalizeCatalog, 'catalog')
    },

    getTimeline(playthrough) {
      const path = timelinePath(playthrough)
      return getJsonFile(path, normalizeTimeline, 'timeline')
    },

    putTimeline(playthrough, timeline) {
      const path = timelinePath(playthrough)
      return putJsonFile(path, timeline, normalizeTimeline, 'timeline')
    },

    async getMessages(sessionId) {
      const response = await v2('GET', `/sessions/${encodeURIComponent(sessionId)}/messages`)
      return normalizeSessionMessages(response)
    },

    async getFocus(playthrough) {
      const query = playthrough === undefined
        ? ''
        : pathQuery(timelinePath(playthrough))
      return normalizeFocus(await v2('GET', `/focus${query}`))
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

    getCharacter(id) {
      return v1('GET', `/characters/${encodeURIComponent(id)}`)
    },

    getPreset(id) {
      return v1('GET', `/presets/${encodeURIComponent(id)}`)
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
