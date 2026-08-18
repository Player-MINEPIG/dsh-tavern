export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

export function httpError(status, message, code) {
  const error = new Error(message)
  error.status = status
  if (code !== undefined) error.code = code
  return error
}

export function sendPlayError(res, error) {
  const status = error?.status
    ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500)
  const payload = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }
  if (typeof error?.code === 'string' && error.code !== '') payload.code = error.code
  return sendJson(res, status, payload)
}

export function readBoundedJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let bytes = 0
    const chunks = []
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', chunk => {
      bytes += chunk.length
      if (bytes > maxBytes) {
        fail(httpError(413, `Request exceeds ${maxBytes} bytes`, 'PLAY_REQUEST_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        settled = true
        resolve(parsed)
      } catch (error) {
        fail(httpError(400, error instanceof Error ? error.message : 'Invalid JSON', 'PLAY_INVALID_JSON'))
      }
    })
    req.on('error', fail)
  })
}

export function parsePlayUrl(url, apiV2) {
  const parsed = new URL(url ?? '/', 'http://localhost')
  const path = parsed.pathname
  if (path !== apiV2 && !path.startsWith(`${apiV2}/`)) return null
  return {
    rest: path === apiV2 ? '/' : path.slice(apiV2.length),
    searchParams: parsed.searchParams,
  }
}
