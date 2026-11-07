import { API_V1 as API_ROOT } from '../../identity.js'
import { tavernFetch as fetch } from './api-fetch.js'

function errorMessage(data, status) {
  if (typeof data?.error === 'string') return data.error
  if (typeof data?.error?.message === 'string') return data.error.message
  return `HTTP ${status}`
}

export async function resourceApi(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase()
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(method === 'GET' || method === 'HEAD' ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok === false) {
    const error = new Error(errorMessage(data, response.status))
    error.status = response.status
    error.code = data?.code ?? data?.error?.code
    error.details = data?.details ?? data?.error?.details
    throw error
  }
  return data
}
