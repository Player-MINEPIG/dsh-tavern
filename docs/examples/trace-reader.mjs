// Browser or Node fetch. Configure the trusted same-origin base in the caller.
export function traceReader(base = '/pmp-dsh-tavern/api/v3', request = fetch) {
  async function get(path, signal) {
    const response = await request(`${base}${path}`, { signal, cache: 'no-store', credentials: 'same-origin' })
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(`${data.code ?? response.status}: ${data.error}`)
    return data
  }
  return {
    capabilities: signal => get('/capabilities', signal),
    sources: (sessionId, signal) => get(`/sessions/${encodeURIComponent(sessionId)}/sources`, signal),
    list: (sessionId, signal) => get(`/sessions/${encodeURIComponent(sessionId)}/assemblies`, signal),
    detail: (sessionId, recordId, signal) => get(`/sessions/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(recordId)}`, signal),
  }
}
