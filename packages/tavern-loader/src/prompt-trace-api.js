import { API_V3 } from '../../identity.js'
import { composeWorldBookSelection } from './user-world-book-policy.js'
import { projectPresetCallConfig } from './profile-compiler.js'
import { httpError, sendJson } from '../../play/src/http.js'
import { digest } from './assembly-parts.js'
import { validSession } from '../../tavern-trace/src/assembly-store.js'
const MAX_SOURCE_BYTES = 16 * 1024 * 1024
const hash = digest
const fail = (status, code, message) => { throw httpError(status, message, `PROMPT_${code}`) }
function sessionId(id) { if (!validSession(id)) fail(400, 'SESSION_INVALID', 'A valid explicit sessionId is required'); return id }
function measures(text) {
  let characters = 0
  for (const _ of text) characters++
  return { characters, utf16Units: text.length, utf8Bytes: Buffer.byteLength(text, 'utf8') }
}

// JSON pointers retain array positions and escaped unknown extension keys.
function fieldLengths(value) {
  const result = {}
  const pending = [[value, '']]
  let visited = 0
  while (pending.length) {
    const [item, path] = pending.pop()
    if (++visited > 100000 || path.length > 4096) fail(413, 'SOURCES_TOO_LARGE', 'Source metadata exceeds the traversal limit')
    if (typeof item === 'string') result[path] = measures(item)
    else if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        pending.push([child, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`])
        if (pending.length > 100000) fail(413, 'SOURCES_TOO_LARGE', 'Source metadata exceeds the traversal limit')
      }
    }
  }
  return result
}
function resource(store, id) {
  if (id === null) return null
  try { return store.get(id) } catch (error) {
    if (error?.code?.endsWith('_NOT_FOUND')) fail(409, 'RESOURCE_MISSING', 'A selected prompt resource is missing; refresh the binding')
    throw error
  }
}

export class PromptSourceService {
  constructor(dependencies) { Object.assign(this, dependencies) }
  getSources(id) {
    sessionId(id)
    const selection = this.selections.get(id)
    const preset = resource(this.presets, selection.presetId)
    const character = resource(this.characters, selection.characterCardId)
    const user = resource(this.users, selection.userId)
    const worldBookSelection = composeWorldBookSelection(selection.worldBookIds,
      user ? this.userWorldBooks.get(user.id) : [],
      preset ? this.resourceWorldBooks.get('preset', preset.id) : [],
      character ? this.resourceWorldBooks.get('character', character.id) : [])
    const documents = { preset, character, user, worldBooks: [] }
    // Bound aggregate allocation before fetching the next large book. Never truncate fields.
    let bytes = Buffer.byteLength(JSON.stringify(documents))
    if (bytes > MAX_SOURCE_BYTES) fail(413, 'SOURCES_TOO_LARGE', 'Selected source documents exceed the snapshot limit')
    for (const bookId of worldBookSelection.effectiveIds) {
      const document = resource(this.worldBooks, bookId)
      bytes += Buffer.byteLength(JSON.stringify(document))
      if (bytes > MAX_SOURCE_BYTES) fail(413, 'SOURCES_TOO_LARGE', 'Selected source documents exceed the snapshot limit')
      documents.worldBooks.push(document)
    }
    const data = character?.data ?? character
    const requestedIndex = selection.character.greetingIndex ?? 0
    const greetings = data ? [data.firstMessage ?? data.first_mes ?? '', ...(data.alternateGreetings ?? data.alternate_greetings ?? [])] : []
    const effectiveIndex = data ? (requestedIndex < greetings.length ? requestedIndex : 0) : null
    const sources = {
      schemaVersion: 3, sessionId: id, selection, worldBookSelection, documents,
      greeting: { requestedIndex, effectiveIndex, text: effectiveIndex === null ? null : greetings[effectiveIndex], semantics: 'first-turn-reference' },
      fieldLengths: fieldLengths(documents),
      suggestedCallConfig: projectPresetCallConfig(preset),
      countUnit: 'unicode-code-points',
    }
    if (Buffer.byteLength(JSON.stringify(sources)) > MAX_SOURCE_BYTES) fail(413, 'SOURCES_TOO_LARGE', 'Source snapshot including metadata exceeds the limit')
    return structuredClone({ ...sources, revision: hash(sources) })
  }

}

export function createPromptTraceApi({ sources, assemblies, ensureSession, legacyStore }) {
  const legacy = id => (legacyStore?.list(id) ?? []).map(row => ({ schemaVersion: 3,
    id: `legacy:${row.id}`, sessionId: id, turn: row.turn, step: row.step, attempt: row.attempt,
    recordedAt: row.recordedAt, status: 'legacy-metadata-only', contentStatus: 'legacy-metadata-only', audit: row,
  }))
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    try {
      const url = new URL(req.url, 'http://localhost')
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Read-only API' })
      if (url.pathname === `${API_V3}/capabilities`) return sendJson(res, 200, {
        ok: true, apiVersion: 3, contract: 'prompt-trace-primitives', sourceMapping: 'section-contributors',
        currentSources: true, historicalAssemblies: true, composerRegistry: false,
        officialSections: true, arbitraryMessageDepth: false, maxSourceBytes: MAX_SOURCE_BYTES, storage: assemblies.storage(),
      })
      const match = url.pathname.match(new RegExp(`^${API_V3}/sessions/([^/]+)/(sources|assemblies)(?:/([^/]+))?$`))
      if (!match) return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', error: 'Not found' })
      const id = sessionId(decodeURIComponent(match[1]))
      if (match[2] === 'sources' && !match[3]) {
        await ensureSession(id)
        return sendJson(res, 200, { ok: true, sources: sources.getSources(id) })
      }
      if (match[2] !== 'assemblies') return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', error: 'Not found' })
      if (!match[3]) {
        const current = assemblies.list(id)
        const keys = new Set(current.map(r => `${r.turn}:${r.step}:${r.attempt}`))
        const historical = legacy(id).filter(r => !keys.has(`${r.turn}:${r.step}:${r.attempt}`)).map(({ audit, ...r }) => r)
        return sendJson(res, 200, { ok: true, sessionId: id, records: [...historical, ...current].sort((a, b) => a.recordedAt - b.recordedAt), storage: assemblies.storage() })
      }
      const recordId = decodeURIComponent(match[3])
      const record = recordId.startsWith('legacy:') ? legacy(id).find(r => r.id === recordId) : assemblies.get(id, recordId)
      return sendJson(res, record ? 200 : 404, record ? { ok: true, record } : { ok: false, code: 'ASSEMBLY_NOT_FOUND', error: 'Record missing or evicted' })
    } catch (error) {
      const status = error.status ?? (error instanceof TypeError || error instanceof URIError ? 400 : 500)
      return sendJson(res, status, { ok: false, code: status === 500 ? 'TRACE_READ_FAILED' : error.code ?? 'INVALID_REQUEST', error: status === 500 ? 'Unable to read prompt data' : error.message })
    }
  }
}
