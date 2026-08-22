export function startChromeModeTransport({
  face,
  internal,
  eventsUrl,
  EventSourceImpl = globalThis.EventSource,
  focusTarget = globalThis.window,
  pollIntervalMs = 1_000,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  if (typeof face?.refresh !== 'function') throw new TypeError('face.refresh is required')
  if (typeof internal?.acceptSnapshot !== 'function') throw new TypeError('internal.acceptSnapshot is required')
  if (typeof eventsUrl !== 'string' || eventsUrl === '') throw new TypeError('eventsUrl is required')
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 250 || pollIntervalMs > 60_000) {
    throw new TypeError('pollIntervalMs must be an integer from 250 to 60000')
  }
  if (typeof setIntervalImpl !== 'function' || typeof clearIntervalImpl !== 'function') {
    throw new TypeError('timer functions are required')
  }

  let disposed = false
  let source = null
  let pollTimer = null

  const refresh = () => {
    if (disposed) return Promise.resolve()
    return Promise.resolve(face.refresh()).catch(() => {})
  }

  const stopPolling = () => {
    if (pollTimer === null) return
    clearIntervalImpl(pollTimer)
    pollTimer = null
  }

  const startPolling = () => {
    if (disposed || pollTimer !== null) return
    pollTimer = setIntervalImpl(() => { void refresh() }, pollIntervalMs)
  }

  const acceptEvent = event => {
    if (disposed) return
    try {
      internal.acceptSnapshot(JSON.parse(String(event?.data ?? '')))
    } catch {
      void refresh()
    }
  }

  const focus = () => { void refresh() }
  focusTarget?.addEventListener?.('focus', focus)

  if (typeof EventSourceImpl === 'function') {
    try {
      source = new EventSourceImpl(eventsUrl)
      source.addEventListener?.('chrome/change', acceptEvent)
      source.addEventListener?.('open', stopPolling)
      source.addEventListener?.('error', startPolling)
    } catch {
      source = null
      startPolling()
    }
  } else {
    startPolling()
  }

  void refresh()

  return () => {
    if (disposed) return
    disposed = true
    stopPolling()
    focusTarget?.removeEventListener?.('focus', focus)
    source?.removeEventListener?.('chrome/change', acceptEvent)
    source?.removeEventListener?.('open', stopPolling)
    source?.removeEventListener?.('error', startPolling)
    source?.close?.()
    source = null
  }
}
