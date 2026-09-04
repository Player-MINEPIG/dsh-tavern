import { httpError } from './http.js'

export function mapHostError(error) {
  const code = error?.code
  const message = typeof error?.message === 'string' && error.message !== ''
    ? error.message
    : 'Host request failed'
  if (code === 'session/fork-unavailable' || code === 'fork-unavailable' || code === 'OPEN_TURN') {
    return httpError(409, message, 'PLAY_FORK_UNAVAILABLE')
  }
  if (code === 'session/not-found' || code === 'session-not-found') return httpError(404, message, 'PLAY_SESSION_NOT_FOUND')
  if (code === 'workspace/not-found' || code === 'workspace-not-found') return httpError(404, message, 'PLAY_WORKSPACE_NOT_FOUND')
  if (code === 'workspace/invalid-path' || code === 'workspace-invalid-path') return httpError(400, message, 'PLAY_WORKSPACE_INVALID')
  if (code === 'session/workspace-attach-failed' || code === 'workspace-attach-failed') {
    return httpError(409, message, 'PLAY_WORKSPACE_ATTACH_FAILED')
  }
  if (code === 'gateway/bad-request') return httpError(400, message, 'PLAY_HOST_BAD_REQUEST')
  if (typeof error?.status === 'number') return error
  const mapped = httpError(502, message, typeof code === 'string' ? code : 'PLAY_HOST_ERROR')
  return mapped
}
