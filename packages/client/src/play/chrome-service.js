const CHROME_MODES = new Set(['native', 'play'])

function serviceError() {
  const error = new Error('Chrome mode service is disposed')
  error.code = 'CHROME_SERVICE_DISPOSED'
  return error
}

function normalizeSnapshot(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('chrome snapshot must be an object')
  if (!CHROME_MODES.has(value.mode)) throw new TypeError('chrome snapshot mode must be native or play')
  if (value.revision !== undefined && value.revision !== null && (typeof value.revision !== 'string' || value.revision === '')) {
    throw new TypeError('chrome snapshot revision must be a non-empty string or null')
  }
  return Object.freeze({ mode: value.mode, revision: value.revision ?? null })
}

function safely(action) {
  try { action() } catch {}
}

export function createChromeModeServiceCore({
  initial = { mode: 'native', revision: null },
  read,
  write,
} = {}) {
  if (typeof read !== 'function') throw new TypeError('read must be a function')
  if (typeof write !== 'function') throw new TypeError('write must be a function')

  let snapshot = normalizeSnapshot(initial)
  let disposed = false
  let queue = Promise.resolve()
  let intentMode = snapshot.mode
  let intentVersion = 0
  let pendingWrites = 0
  const listeners = new Set()
  const effects = new Set()

  const notify = () => {
    for (const listener of [...listeners]) safely(() => listener(snapshot))
  }

  const stopEffect = effect => {
    effect.generation += 1
    if (effect.dispose !== null) safely(effect.dispose)
    effect.dispose = null
  }

  const startEffect = effect => {
    if (!effect.active || disposed || snapshot.mode !== effect.mode) return
    const generation = ++effect.generation
    let result
    try {
      result = effect.setup({ snapshot })
    } catch {
      return
    }
    Promise.resolve(result).then(dispose => {
      if (typeof dispose !== 'function') return
      if (!effect.active || disposed || effect.generation !== generation || snapshot.mode !== effect.mode) {
        safely(dispose)
        return
      }
      effect.dispose = dispose
    }, () => {})
  }

  const commit = value => {
    const next = normalizeSnapshot(value)
    if (next.mode === snapshot.mode && next.revision === snapshot.revision) return snapshot
    const previousMode = snapshot.mode
    snapshot = next
    if (previousMode !== next.mode) {
      for (const effect of effects) stopEffect(effect)
      for (const effect of effects) startEffect(effect)
    }
    notify()
    return snapshot
  }

  const enqueue = action => {
    const result = queue.then(() => {
      if (disposed) throw serviceError()
      return action()
    })
    queue = result.catch(() => {})
    return result
  }

  const planWrite = mode => {
    if (!CHROME_MODES.has(mode)) return Promise.reject(new TypeError('chrome mode must be native or play'))
    const version = ++intentVersion
    intentMode = mode
    pendingWrites += 1
    return enqueue(async () => {
      try {
        const value = await write(mode)
        if (disposed) throw serviceError()
        const confirmed = commit(value)
        if (version === intentVersion) intentMode = confirmed.mode
        return confirmed
      } catch (error) {
        if (version === intentVersion) intentMode = snapshot.mode
        throw error
      } finally {
        pendingWrites -= 1
      }
    })
  }

  const face = Object.freeze({
    getMode() {
      return snapshot.mode
    },
    getSnapshot() {
      return snapshot
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function')
      if (disposed) return () => {}
      listeners.add(listener)
      safely(() => listener(snapshot))
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    refresh() {
      const version = intentVersion
      return enqueue(async () => {
        const value = await read()
        if (disposed) throw serviceError()
        const confirmed = commit(value)
        if (version === intentVersion) intentMode = confirmed.mode
        return confirmed
      })
    },
    setMode(mode) {
      return planWrite(mode)
    },
    switchMode() {
      const next = intentMode === 'native' ? 'play' : 'native'
      return planWrite(next)
    },
    when(mode, setup) {
      if (!CHROME_MODES.has(mode)) throw new TypeError('chrome mode must be native or play')
      if (typeof setup !== 'function') throw new TypeError('setup must be a function')
      if (disposed) return () => {}
      const effect = { mode, setup, active: true, generation: 0, dispose: null }
      effects.add(effect)
      startEffect(effect)
      return () => {
        if (!effect.active) return
        effect.active = false
        stopEffect(effect)
        effects.delete(effect)
      }
    },
  })

  const internal = Object.freeze({
    acceptSnapshot(value) {
      if (disposed) throw serviceError()
      const confirmed = commit(value)
      if (pendingWrites === 0) {
        intentMode = confirmed.mode
        intentVersion += 1
      }
      return confirmed
    },
    dispose() {
      if (disposed) return
      disposed = true
      listeners.clear()
      for (const effect of [...effects]) {
        effect.active = false
        stopEffect(effect)
      }
      effects.clear()
    },
  })

  return Object.freeze({ face, internal })
}

export const chromeModeServiceConstants = Object.freeze({
  modes: Object.freeze([...CHROME_MODES]),
  disposedCode: 'CHROME_SERVICE_DISPOSED',
})
