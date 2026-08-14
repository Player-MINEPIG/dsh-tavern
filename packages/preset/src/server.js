const API_ROOT = '/dsh-tavern/api'
const MAX_BODY_BYTES = 2 * 1024 * 1024

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
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

function presetId(pathname) {
  const match = /^\/dsh-tavern\/api\/presets\/([^/]+)$/.exec(pathname)
  return match === null ? null : decodeURIComponent(match[1])
}

function defaultActiveView(store) {
  return {
    selected: store.selectedSummary(),
    callConfig: {},
    compiledPrompt: '',
  }
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
      const id = presetId(path)
      const sessionId = url.searchParams.get('sessionId') || null

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

      if (method === 'GET' && id !== null) {
        return sendJson(res, 200, { ok: true, preset: store.get(id) })
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

      if (method === 'PUT' && id !== null) {
        const preset = store.update(id, await readJson(req))
        onChange()
        return sendJson(res, 200, { ok: true, preset })
      }

      if (method === 'DELETE' && id !== null) {
        store.delete(id)
        selectionPolicy.clearResource?.('preset', id)
        onChange()
        return sendJson(res, 200, { ok: true })
      }

      if (method === 'POST' && path === `${API_ROOT}/select`) {
        const body = await readJson(req)
        const selectedId = body.id === null ? null : body.id
        const targetSessionId = typeof body.sessionId === 'string' && body.sessionId !== '' ? body.sessionId : null
        const selected = selectionPolicy.selectPreset === undefined
          ? store.select(selectedId)
          : selectionPolicy.selectPreset(selectedId, targetSessionId)
        onChange()
        return sendJson(res, 200, { ok: true, selected: selected === null ? null : { id: selected.id, name: selected.name } })
      }

      return sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      const status = error?.status ?? (error?.code === 'PRESET_NOT_FOUND' ? 404 : error instanceof TypeError ? 400 : 500)
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export function installServerRoutes(ctx, store, onChange, activeView, selectionPolicy) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return undefined
  return webServer.register({
    kind: 'prefix',
    path: API_ROOT,
    handler: createApiHandler(store, onChange, activeView, selectionPolicy),
  })
}

export { API_ROOT, MAX_BODY_BYTES }
