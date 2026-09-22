// Only Tavern-owned request overrides may be withdrawn. Provider routing,
// model defaults and the stored preset remain owned by their existing layers.
export const PRESET_PARAMETER_FIELDS = Object.freeze(['temperature', 'maxTokens', 'reasoningEffort', 'stop'])

const ALIASES = {
  temperature: /\btemperature\b/i,
  maxTokens: /\bmax[_ -]?(?:completion[_ -]?)?tokens\b/i,
  reasoningEffort: /\breasoning[_ .-]?effort\b|\boutput_config\.effort\b/i,
  stop: /\bstop(?:[_ -]sequences)?\b/i,
}
const PARAMETER_CODES = new Set(['INVALID_REQUEST', 'UNSUPPORTED_PARAMETER', 'INVALID_PARAMETER', 'UNSUPPORTED_REASONING_EFFORT', 'HTTP_400', 'HTTP_422'])
const EXCLUDED_CODES = /AUTH|QUOTA|RATE_LIMIT|CONTEXT_WINDOW|ABORT|TIMEOUT|TRANSPORT|SERVER|NETWORK/i
const REJECTION = /not supported|unsupported|does not support|not allowed|not permitted|invalid|out of range|must be|must not|only (?:the |a )?(?:default|supported)|cannot (?:set|use|specify)|unrecognized|unknown (?:parameter|argument)|extra inputs? (?:are )?not permitted/i

export function presetParameters(value = {}) {
  return Object.fromEntries(PRESET_PARAMETER_FIELDS.filter(key => value[key] !== undefined)
    .map(key => [key, structuredClone(value[key])]))
}

/** Identify explicit parameter rejection, never general request/transport failure. */
export function rejectedPresetParameters(failure, supplied) {
  const code = typeof failure?.code === 'string' ? failure.code : ''
  const status = failure?.status
  if (EXCLUDED_CODES.test(code) || [401, 402, 403, 408, 413, 429].includes(status) || status >= 500) return []
  if (!PARAMETER_CODES.has(code) && status !== 400 && status !== 422) return []
  const message = typeof failure?.message === 'string' ? failure.message.slice(0, 8192) : ''
  if (code === 'UNSUPPORTED_REASONING_EFFORT') return supplied.reasoningEffort === undefined ? [] : ['reasoningEffort']
  if (!REJECTION.test(message) || /(?:invalid|unknown|undefined) (?:tool|function|message|content)|tool (?:call|name)|message content|function [\"']/i.test(message)) return []
  return PRESET_PARAMETER_FIELDS.filter(key => {
    if (supplied[key] === undefined) return false
    const match = ALIASES[key].exec(message)
    if (!match) return false
    const before = message.slice(Math.max(0, match.index - 60), match.index)
    const after = message.slice(match.index + match[0].length, match.index + match[0].length + 120)
    // Require a direct parameter subject or an explicit parameter/argument label.
    // A rejected tool/message that merely quotes the field is not recoverable.
    return /^[\"'`\s:=-]*(?:(?:is|are|was)\s+)?(?:not supported|unsupported|does not support|not allowed|not permitted|invalid|out of range|must be|must not|cannot|only)/i.test(after)
      || /(?:unsupported|invalid|unknown|unrecognized|not supported)\s+(?:parameter|argument|field|option|value)\s*[:=]?\s*[\"'`]?$/i.test(before)
      || /(?:parameter|argument|field|option)\s*[\"'`]?$/i.test(before) && REJECTION.test(after)
  })
}

/** Recovery state is request-series-local and never changes persistent presets. */
export class PresetParameterFallback {
  constructor() { this.states = new WeakMap() }

  async prepare({ agent, turn, step, signal }, base, overrides, llm) {
    const requested = presetParameters(overrides)
    const signature = JSON.stringify([turn, step, base.provider, base.model, requested])
    const owned = agent !== null && typeof agent === 'object'
    let state = owned ? this.states.get(agent) : undefined
    if (state?.signature !== signature) {
      state = { signature, requested, omitted: new Set(), fallbacks: [], outputStarted: false, retries: 0, attempts: 0 }
      if (owned) this.states.set(agent, state)
    }
    state.outputStarted = false
    state.attempts++
    state.observedEffective = undefined
    const config = { ...base, ...requested }
    for (const key of state.omitted) delete config[key]
    // Public validation runs before DSH binds and logs its one-shot prepared
    // call. Returning the proposal preserves DSH's adapter-default provenance.
    if (Object.keys(requested).length > 0 && typeof llm?.resolveCallConfig === 'function') {
      for (;;) {
        signal?.throwIfAborted()
        try { await llm.resolveCallConfig(config, signal); break }
        catch (error) {
          if (signal?.aborted) throw error
          // DSH explicitly permits routes implemented by public llm/stream
          // middleware without a registered adapter; preserve that path.
          if (error?.code === 'NO_ADAPTER') break
          const fields = rejectedPresetParameters(error, config).filter(key => Object.hasOwn(requested, key) && !state.omitted.has(key))
          if (fields.length === 0) throw error
          this.omit(state, fields, 'preflight', error)
          for (const key of fields) delete config[key]
        }
      }
    }
    state.effective = presetParameters(config)
    return config
  }

  omit(state, fields, stage, failure) {
    for (const field of fields) {
      state.omitted.add(field)
      state.fallbacks.push({ parameter: field, stage, reason: 'parameter-rejected',
        code: typeof failure?.code === 'string' ? failure.code.slice(0, 100) : 'INVALID_PARAMETER',
        ...(Number.isInteger(failure?.status) ? { status: failure.status } : {}) })
    }
  }

  /** Public stream observation; never edits/replays a prepared LLM request. */
  observeFrame(agent, frame) {
    const state = this.states.get(agent)
    if (!state || frame?.type !== 'chunk') return
    const chunk = frame.chunk
    // Conservatively count a block start as output, even before its first delta.
    if (chunk && chunk.type !== 'finish' && chunk.type !== 'usage') state.outputStarted = true
  }

  recover({ agent, signal, failure }) {
    const state = this.states.get(agent)
    if (!state || signal?.aborted || state.outputStarted || state.retries >= PRESET_PARAMETER_FIELDS.length) return false
    const fields = rejectedPresetParameters(failure, state.effective)
      .filter(key => Object.hasOwn(state.requested, key) && !state.omitted.has(key))
    if (fields.length === 0) return false
    this.omit(state, fields, 'provider', failure)
    state.retries++
    return true
  }

  snapshot(agent, actual) {
    const state = this.states.get(agent)
    if (!state) return null
    if (actual) state.observedEffective = presetParameters(actual)
    return { requested: structuredClone(state.requested),
      effective: presetParameters(actual ?? state.observedEffective ?? state.effective),
      fallbacks: structuredClone(state.fallbacks), attempt: state.attempts }
  }

  clear(agent) { this.states.delete(agent) }
}
