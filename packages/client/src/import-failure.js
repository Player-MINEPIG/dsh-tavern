import { CLIENT_IMPORT_FAILURE_EVENT } from '../../identity.js'

export function importFailureMessage(reason) {
  if (typeof reason?.message === 'string' && reason.message.trim() !== '') return reason.message.trim().slice(0, 1000)
  const value = String(reason ?? '').trim()
  return value === '' ? 'Unknown import error' : value.slice(0, 1000)
}

export function announceImportFailure(reason, target = globalThis.window) {
  const message = importFailureMessage(reason)
  target?.dispatchEvent?.(new CustomEvent(CLIENT_IMPORT_FAILURE_EVENT, {
    detail: { message },
  }))
  return message
}
