import { API_V1, escapeRegExp } from '../../identity.js'

const API_ROOT = API_V1
const PRESET_ID_ROUTE = new RegExp(`^${escapeRegExp(API_V1)}/presets/([^/]+)(?:/(export|regex-scripts|world-books))?$`)
const MAX_BODY_BYTES = 2 * 1024 * 1024

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function attachment(value) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(value).replaceAll("'", '%27')}`
}

function artifactFileName(value) {
  if (typeof value !== 'string') return 'preset.json'
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return cleaned === '' ? 'preset.json' : cleaned
}

function sendArtifact(res, status, payload) {
  const body = Buffer.from(payload.body, 'utf8')
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', body.byteLength)
  res.setHeader('Content-Disposition', attachment(artifactFileName(payload.fileName)))
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0
    const chunks = []
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BODY_BYTES) {
        const error = new Error('Request body exceeds 2 MiB')
        error.status = 413
        reject(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) {
        error.status = 400
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function presetRoute(pathname) {
  const match = PRESET_ID_ROUTE.exec(pathname)
  return match === null ? null : { id: decodeURIComponent(match[1]), resource: match[2] }
}

function defaultActiveView(store) {
  return {
    selected: store.selectedSummary(),
    callConfig: {},
  }
}

function worldBookIdsBody(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Preset world-book binding request must be an object')
  }
  const unexpected = Object.keys(value).find(key => key !== 'worldBookIds')
  if (unexpected !== undefined) throw new TypeError(`Unsupported preset world-book binding field "${unexpected}"`)
  if (!Array.isArray(value.worldBookIds)) throw new TypeError('worldBookIds must be an array')
  return value.worldBookIds
}

function worldBookBindingPayload(presetId, policy) {
  if (policy?.selection === undefined) throw new Error('Preset world-book binding policy is not installed')
  return { binding: { presetId, worldBookIds: policy.selection(presetId) } }
}

export function createApiHandler(
  store,
  onChange = () => {},
  activeView = () => defaultActiveView(store),
  selectionPolicy = {},
) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      const method = req.method ?? 'GET'
      const route = presetRoute(path)
      const id = route?.id ?? null
      const sessionId = url.searchParams.get('sessionId') || null
      const worldBookBindingPolicy = selectionPolicy.worldBookBindingPolicy ?? null

      if (method === 'GET' && path === `${API_ROOT}/presets`) {
        return sendJson(res, 200, {
          ok: true,
          presets: store.list(),
          selectedId: selectionPolicy.selectedPresetId === undefined
            ? store.state.selectedId
            : selectionPolicy.selectedPresetId(sessionId),
        })
      }

      if (method === 'GET' && path === `${API_ROOT}/active`) {
        return sendJson(res, 200, {
          ok: true,
          ...activeView(sessionId),
        })
      }

      if (method === 'GET' && id !== null && route.resource === undefined) {
        return sendJson(res, 200, { ok: true, preset: store.get(id) })
      }

      if (method === 'GET' && id !== null && route.resource === 'export') {
        const exported = store.json(id)
        return sendArtifact(res, 200, { body: exported.text, fileName: exported.fileName })
      }

      if (method === 'GET' && id !== null && route.resource === 'regex-scripts') {
        return sendJson(res, 200, { ok: true, regexScripts: store.regexScripts(id) })
      }

      if (method === 'GET' && id !== null && route.resource === 'world-books') {
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(id, worldBookBindingPolicy) })
      }

      if (method === 'POST' && path === `${API_ROOT}/import`) {
        const body = await readJson(req)
        if (typeof body.content !== 'string') return sendJson(res, 400, { ok: false, error: 'content must be a JSON string' })
        const preset = store.importSillyTavern(body.content, { name: body.name })
        onChange()
        return sendJson(res, 201, { ok: true, preset })
      }

      if (method === 'POST' && path === `${API_ROOT}/presets`) {
        const body = await readJson(req)
        const preset = store.create({ name: body.name })
        onChange()
        return sendJson(res, 201, { ok: true, preset })
      }

      if (method === 'PUT' && id !== null && route.resource === undefined) {
        const preset = store.update(id, await readJson(req))
        onChange()
        return sendJson(res, 200, { ok: true, preset })
      }

      if (method === 'PUT' && id !== null && route.resource === 'regex-scripts') {
        const body = await readJson(req)
        const preset = store.replaceRegexScripts(id, body.regexScripts)
        onChange({ kind: 'preset-regex-scripts-updated', presetId: id })
        return sendJson(res, 200, { ok: true, regexScripts: store.regexScripts(preset.id) })
      }

      if (method === 'PUT' && id !== null && route.resource === 'world-books') {
        if (worldBookBindingPolicy?.select === undefined) throw new Error('Preset world-book binding policy is not installed')
        const worldBookIds = await worldBookBindingPolicy.select(id, worldBookIdsBody(await readJson(req)))
        onChange({ kind: 'preset-world-book-binding-changed', presetId: id, worldBookIds })
        return sendJson(res, 200, { ok: true, ...worldBookBindingPayload(id, worldBookBindingPolicy) })
      }

      if (method === 'DELETE' && id !== null && route.resource === undefined) {
        store.delete(id)
        selectionPolicy.clearResource?.('preset', id)
        onChange()
        return sendJson(res, 200, { ok: true })
      }

      if (method === 'POST' && path === `${API_ROOT}/select`) {
        const body = await readJson(req)
        const selectedId = body.id === null ? null : body.id
        const targetSessionId = typeof body.sessionId === 'string' && body.sessionId !== '' ? body.sessionId : null
        await selectionPolicy.beforeSelectionChange?.({ sessionId: targetSessionId, presetId: selectedId })
        const selected = selectionPolicy.selectPreset === undefined
          ? store.select(selectedId)
          : selectionPolicy.selectPreset(selectedId, targetSessionId)
        onChange()
        return sendJson(res, 200, { ok: true, selected: selected === null ? null : { id: selected.id, name: selected.name } })
      }

      return sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      const status = error?.status ?? (error?.code === 'PRESET_NOT_FOUND' || error?.code === 'WORLD_BOOK_NOT_FOUND' ? 404 : error instanceof TypeError ? 400 : 500)
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}


export { API_ROOT, MAX_BODY_BYTES }
