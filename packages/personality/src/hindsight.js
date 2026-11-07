import { evidenceHash } from './turn-assessment.js'

const MAX_RESPONSE = 512 * 1024
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const safeSegment = id => typeof id === 'string' && id.trim().length > 0 && !['.', '..'].includes(id) && !id.includes('/') && id.length <= 512

// The official DSH writer retains conversation:<sessionId>, as JSONL transport turns.
// Accept a unit only where its chunk proves which complete exchange supplied it.
// A mixed, truncated, or unavailable chunk is insufficient to attribute the fact.
function matchesTurn(chunk, origin, bankId, chunkId) {
  const doc = 'conversation:' + origin.sessionId
  if (chunk?.bank_id !== bankId || chunk.document_id !== doc || chunk.chunk_id !== chunkId || typeof chunk.chunk_text !== 'string') return false
  let rows
  try {
    const text = chunk.chunk_text.trim()
    rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(line => JSON.parse(line))
  } catch { return false }
  if (!Array.isArray(rows)) return false
  if (rows[0]?.role === 'system' && rows[0].content === 'REF-ID: ' + doc) rows = rows.slice(1)
  const users = rows.slice(0, -1), reply = rows.at(-1)
  return users.length > 0 && users.every(row => row?.role === 'user' && typeof row.content === 'string') &&
    reply?.role === 'assistant' && typeof reply.content === 'string' &&
    evidenceHash([users.map(row => row.content), reply.content]) === origin.textHash
}

async function readJson(url, token, signal, fetcher) {
  const response = await fetcher(url, { headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, signal, redirect: 'error' })
  if (!response.ok) {
    await response.body?.cancel()
    if (response.status === 404) return null
    throw new Error('Hindsight returned HTTP ' + response.status)
  }
  if (Number(response.headers.get('Content-Length')) > MAX_RESPONSE) {
    await response.body?.cancel()
    throw new Error('Hindsight response exceeded the byte limit')
  }
  const reader = response.body.getReader(), buffers = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_RESPONSE) {
        await reader.cancel()
        throw new Error('Hindsight response exceeded the byte limit')
      }
      buffers.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(buffers).toString('utf8'))
}

function configuredScope(config) {
  if (!Array.isArray(config.bindings) || !config.bindings.length) throw new TypeError('Hindsight requires explicit personality and session bindings')
  const scope = new Map()
  for (const { personalityId, sessionIds } of config.bindings) {
    if (typeof personalityId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(personalityId) ||
      scope.has(personalityId) || !Array.isArray(sessionIds) || !sessionIds.length ||
      sessionIds.some(id => typeof id !== 'string' || !id.trim() || id === '*' || id.length > 256)) {
      throw new TypeError('Invalid Hindsight personality/session binding')
    }
    scope.set(personalityId, new Set(sessionIds))
  }
  return scope
}

export function createHindsightEvidence(config, { fetcher = fetch, signal: lifetime } = {}) {
  const base = new URL(config.baseUrl)
  const { bankId, apiKeyEnv } = config
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.hash || base.search ||
    !safeSegment(bankId) || (apiKeyEnv !== undefined && (typeof apiKeyEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)))) {
    throw new TypeError('Invalid Hindsight endpoint, bank or key environment variable')
  }
  const scope = configuredScope(config)
  const prefix = base.href.replace(/\/$/, '') + '/v1/default'
  const bank = prefix + '/banks/' + encodeURIComponent(bankId)
  const inScope = ({ personalityId, origin }) => !lifetime?.aborted && scope.get(personalityId)?.has(origin?.sessionId) && /^[a-f0-9]{64}$/.test(origin.textHash)
  const deadline = signal => AbortSignal.any([signal, lifetime, AbortSignal.timeout(6500)].filter(Boolean))
  const get = (url, signal) => {
    const token = apiKeyEnv && process.env[apiKeyEnv]
    if (apiKeyEnv && !token) throw new Error('Hindsight API key environment variable is unavailable')
    if (token && base.protocol === 'http:' && !['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname)) throw new Error('Hindsight credentials require HTTPS or loopback')
    return readJson(url, token, signal, fetcher)
  }
  const lookup = async (id, request, signal) => {
    if (!UUID.test(id)) return null
    const unit = await get(bank + '/memories/' + id, signal)
    if (unit?.id !== id || unit.state !== 'valid' || !['world', 'experience'].includes(unit.type) ||
      unit.document_id !== 'conversation:' + request.origin.sessionId || !Array.isArray(unit.tags) ||
      !['source:chat','harness:dsh'].every(tag => unit.tags.includes(tag)) ||
      !safeSegment(unit.chunk_id) || typeof unit.text !== 'string' || !unit.text.trim() || unit.text.length > 23000) return null
    const chunk = await get(prefix + '/chunks/' + encodeURIComponent(unit.chunk_id), signal)
    if (!matchesTurn(chunk, request.origin, bankId, unit.chunk_id)) return null
    const version = evidenceHash([prefix, bankId, id, unit.type, unit.text, unit.document_id, unit.chunk_id, unit.edited_at ?? null, request.origin.textHash])
    const text = '[Hindsight ' + unit.type + ' memory] ' + unit.text
    return { id, version, text }
  }
  const wrap = (value, request) => ({
    ...value,
    checkCurrent: () => inScope(request) && !request.signal?.aborted,
    revalidate: async () => inScope(request) &&
      (await lookup(value.id, request, deadline(request.signal)))?.version === value.version,
  })
  return {
    id: 'hindsight',
    supports: personalityId => scope.has(personalityId),
    async resolve(request) {
      if (!inScope(request)) return null
      const signal = deadline(request.signal)
      const query = new URLSearchParams({ document_id: 'conversation:' + request.origin.sessionId, state: 'valid', limit: '16' })
      const list = await get(bank + '/memories/list?' + query, signal)
      const rows = list?.items
      if (!Array.isArray(rows)) return null
      const candidates = rows.filter(row => row.document_id === 'conversation:' + request.origin.sessionId &&
        ['experience','world'].includes(row.fact_type) && UUID.test(row.id))
      for (const row of candidates.slice(0,8)) {
        const value = await lookup(row.id, request, signal)
        if (value) return wrap(value, request)
      }
      return null
    },
    async read(request) {
      if (!inScope(request) || !UUID.test(request.id)) return null
      const value = await lookup(request.id, request, deadline(request.signal))
      return value && value.version === request.version ? wrap(value, request) : null
    },
  }
}

export function installHindsightEvidence(ctx, sources, config) {
  if (config === undefined) return
  ctx.effect(() => {
    const stop = new AbortController()
    const unregister = sources.register(createHindsightEvidence(config, { signal: stop.signal }))
    return () => { stop.abort(); unregister() }
  }, 'dsh-tavern: configured Hindsight personality evidence')
}
