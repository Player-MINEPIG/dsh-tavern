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
  now = () => Date.now(),
  delay = CHROME_CLICK_DELAY,
}) {
  if (typeof getMode !== 'function') throw new TypeError('getMode is required')
  if (typeof persistMode !== 'function') throw new TypeError('persistMode is required')
  if (typeof openMenu !== 'function') throw new TypeError('openMenu is required')
  if (typeof closeMenu !== 'function') throw new TypeError('closeMenu is required')
  if (typeof setMode !== 'function') throw new TypeError('setMode is required')

  let lastClickAt = null
  let suppressNextDoubleClick = false
  let switching = false
  let disposed = false

  const switchMode = async ({ suppressed = false } = {}) => {
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
      if (disposed || suppressed || switching) return false
      const clickedAt = Number(now())
      const elapsed = lastClickAt === null ? Infinity : clickedAt - lastClickAt
      if (elapsed >= 0 && elapsed <= delay) {
        lastClickAt = null
        suppressNextDoubleClick = true
        return switchMode()
      }
      lastClickAt = clickedAt
      suppressNextDoubleClick = false
      openMenu()
      return true
    },

    switchMode,
    doubleClick(options) {
      if (suppressNextDoubleClick) {
        suppressNextDoubleClick = false
        return false
      }
      return switchMode(options)
    },

    dispose() {
      disposed = true
      lastClickAt = null
      suppressNextDoubleClick = false
    },
  }
}
