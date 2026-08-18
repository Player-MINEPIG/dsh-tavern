import { randomUUID } from 'node:crypto'
import { httpError } from './http.js'

export function rpcRequest(payload = {}) {
  return { rpcId: `play-${randomUUID()}`, payload }
}

export function mapHostError(error) {
  const code = error?.code
  const message = typeof error?.message === 'string' && error.message !== ''
    ? error.message
    : 'Host request failed'
  if (code === 'fork-unavailable' || code === 'OPEN_TURN') {
    return httpError(409, message, 'PLAY_FORK_UNAVAILABLE')
  }
  if (code === 'session-not-found') return httpError(404, message, 'PLAY_SESSION_NOT_FOUND')
  if (code === 'workspace-not-found') return httpError(404, message, 'PLAY_WORKSPACE_NOT_FOUND')
  if (code === 'workspace-invalid-path') return httpError(400, message, 'PLAY_WORKSPACE_INVALID')
  if (code === 'workspace-attach-failed') return httpError(409, message, 'PLAY_WORKSPACE_ATTACH_FAILED')
  if (typeof error?.status === 'number') return error
  const mapped = httpError(502, message, typeof code === 'string' ? code : 'PLAY_HOST_ERROR')
  return mapped
}

export function unwrapRpc(response) {
  if (response instanceof Error) throw mapHostError(response)
  const result = response?.result ?? response
  if (result?.ok === false) throw mapHostError(result.error)
  if (result?.ok === true) return result.value
  return response
}

export async function callHost(fn, payload) {
  if (typeof fn !== 'function') {
    throw httpError(501, 'Host capability is unavailable', 'PLAY_HOST_UNAVAILABLE')
  }
  try {
    return unwrapRpc(await fn(rpcRequest(payload)))
  } catch (error) {
    if (error?.status !== undefined) throw error
    throw mapHostError(error)
  }
}
