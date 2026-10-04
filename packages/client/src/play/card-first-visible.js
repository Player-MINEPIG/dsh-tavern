// Initial admission only. Ordinary scrolling never tears down a started VM.
// The surrounding RP view owns unmount and source/scope invalidation.
export function firstCardVisibility(frame, signal) {
  if (signal.aborted) return Promise.resolve(false)
  const Observer = frame.ownerDocument.defaultView.IntersectionObserver
  if (typeof Observer !== 'function') return Promise.resolve(true)
  return new Promise((resolve, reject) => {
    let observer, settled = false
    const finish = value => {
      if (settled) return
      settled = true
      observer?.disconnect()
      signal.removeEventListener('abort', cancel)
      resolve(value)
    }
    const cancel = () => finish(false)
    signal.addEventListener('abort', cancel, { once: true })
    try {
      observer = new Observer(entries => {
        if (entries.some(entry => entry.target === frame && entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0)) finish(!signal.aborted && frame.isConnected)
      })
      observer.observe(frame)
    } catch (error) {
      observer?.disconnect()
      signal.removeEventListener('abort', cancel)
      reject(error)
    }
  })
}
