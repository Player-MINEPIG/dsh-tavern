export const CHROME_CLICK_DELAY = 260

export function nextChromeMode(mode) {
  return mode === 'play' ? 'native' : 'play'
}

export function createChromeClickController({
  getMode,
  persistMode,
  openMenu,
  closeMenu,
  setMode,
  setError = () => {},
  schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
  cancel = timer => globalThis.clearTimeout(timer),
  delay = CHROME_CLICK_DELAY,
}) {
  if (typeof getMode !== 'function') throw new TypeError('getMode is required')
  if (typeof persistMode !== 'function') throw new TypeError('persistMode is required')
  if (typeof openMenu !== 'function') throw new TypeError('openMenu is required')
  if (typeof closeMenu !== 'function') throw new TypeError('closeMenu is required')
  if (typeof setMode !== 'function') throw new TypeError('setMode is required')

  let pendingClick = null
  let switching = false
  let disposed = false

  const cancelPendingClick = () => {
    if (pendingClick === null) return
    cancel(pendingClick)
    pendingClick = null
  }

  const switchMode = async ({ suppressed = false } = {}) => {
    cancelPendingClick()
    closeMenu()
    if (disposed || suppressed || switching) return false
    switching = true
    try {
      const saved = await persistMode(nextChromeMode(getMode()))
      if (disposed) return false
      setMode(saved.mode)
      setError(null)
      return true
    } catch (reason) {
      if (!disposed) setError(reason)
      return false
    } finally {
      switching = false
    }
  }

  return {
    click({ suppressed = false } = {}) {
      if (disposed || suppressed || pendingClick !== null) return false
      pendingClick = schedule(() => {
        pendingClick = null
        if (!disposed) openMenu()
      }, delay)
      return true
    },

    switchMode,
    doubleClick: switchMode,

    dispose() {
      disposed = true
      cancelPendingClick()
    },
  }
}
