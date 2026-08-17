const RP_SOURCES = new Set(['command', 'character-follow'])
const SANDBOX_MODES = new Set(['read-only', 'workspace-write', 'danger-full-access'])

export const DEFAULT_RP_STATE = Object.freeze({
  active: false,
  source: null,
  followSuppressed: false,
  sandboxBefore: null,
})

export const DEFAULT_RP_SECTION = [
  'You are in Tavern roleplay mode for this session.',
  'The bound character card, user persona, world books, and preset already in this prompt are the scene contract. Stay in character. Do not break the scene to act as a coding assistant, software engineer, or planner unless the user explicitly asks to leave roleplay.',
  'Do not speak for the user or decide their feelings. Do not invent shared history that is not in this prompt, the world-book activations, or this conversation. Prefer one clear in-character beat over padding, recap, or interrogation.',
  'File tools may still appear. This session is expected to use a read-only file sandbox; do not create, edit, or delete project files as part of roleplay. If a file operation is denied, continue in text. Do not treat denials as a reason to escalate into a coding workflow.',
  'Tool approval still applies. Trace and the current Tavern bindings remain in force. World-book text in this prompt is canon for the scene.',
  'When roleplay mode is turned off, resume ordinary DeepSeek Harness assistant behavior.',
].join('\n\n')

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeRpState(value) {
  if (!isRecord(value)) return { ...DEFAULT_RP_STATE }
  return {
    active: value.active === true,
    source: RP_SOURCES.has(value.source) ? value.source : null,
    followSuppressed: value.followSuppressed === true,
    sandboxBefore: SANDBOX_MODES.has(value.sandboxBefore) ? value.sandboxBefore : null,
  }
}

export function resolveRpConfig(config = {}) {
  const unknown = Object.keys(config).filter(key => key !== 'section')
  if (unknown.length > 0) {
    throw new Error(`RpModeConfig has unknown key(s) ${unknown.join(', ')} — config is { section }`)
  }
  if (config.section === undefined) return { section: DEFAULT_RP_SECTION }
  if (typeof config.section !== 'string') throw new Error('RpModeConfig needs a string `section`')
  if (config.section.trim() === '') throw new Error('RpModeConfig needs a non-empty `section`')
  return { section: config.section }
}

export function foldSandboxMode(events) {
  let mode
  if (!Array.isArray(events)) return mode
  for (const event of events) {
    if (event?.type === 'sandbox/mode' && SANDBOX_MODES.has(event.data?.mode)) mode = event.data.mode
  }
  return mode
}

export function hasOpenTurn(events) {
  let open = false
  if (!Array.isArray(events)) return false
  for (const event of events) {
    if (event?.type === 'turn/start') open = true
    else if (event?.type === 'turn/end') open = false
  }
  return open
}

function cloneRp(value) {
  return { ...normalizeRpState(value) }
}

function sameRp(left, right) {
  const a = normalizeRpState(left)
  const b = normalizeRpState(right)
  return a.active === b.active
    && a.source === b.source
    && a.followSuppressed === b.followSuppressed
    && a.sandboxBefore === b.sandboxBefore
}

/**
 * Per-session RP collaboration state. Durable bits live on the Tavern
 * selection store because out-of-repo plugins cannot register SessionEventMap
 * members. Sandbox switches still use the official `sandbox/mode` event.
 */
export class RpModeController {
  constructor({
    selections,
    uiSettings = null,
    agents = () => undefined,
    sandboxDefault = () => undefined,
    logger = null,
    section = DEFAULT_RP_SECTION,
    readOnlyOnEnter = true,
  }) {
    this.selections = selections
    this.uiSettings = uiSettings
    this.agents = typeof agents === 'function' ? agents : () => agents
    this.sandboxDefault = typeof sandboxDefault === 'function' ? sandboxDefault : () => sandboxDefault
    this.logger = logger
    this.section = section
    this.readOnlyOnEnter = readOnlyOnEnter !== false
    this.pendingIntents = new WeakMap()
  }

  followCharacterEnabled() {
    return this.uiSettings?.get?.()?.rpFollowCharacter !== false
  }

  stored(sessionId) {
    return normalizeRpState(this.selections.get(sessionId).rp)
  }

  agentFor(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return undefined
    return this.agents()?.get?.(sessionId)
  }

  effective(agent) {
    const pending = agent?.session === undefined ? undefined : this.pendingIntents.get(agent.session)
    if (pending !== undefined) return pending.rp
    const sessionId = agent?.id ?? agent?.session?.id ?? agent?.session?.header?.id
    return typeof sessionId === 'string' ? this.stored(sessionId) : cloneRp()
  }

  isActive(agent) {
    return this.effective(agent).active === true
  }

  get(agent) {
    const stored = this.stored(agent?.id ?? agent?.session?.id)
    const pending = agent?.session === undefined ? undefined : this.pendingIntents.get(agent.session)
    return pending === undefined ? { rp: stored } : { rp: stored, pending: pending.rp }
  }

  write(sessionId, rp) {
    this.selections.set(sessionId, { rp: normalizeRpState(rp) })
  }

  currentSandbox(session) {
    return foldSandboxMode(session?.events) ?? this.sandboxDefault()
  }

  applySandbox(session, { active, previous }) {
    if (this.readOnlyOnEnter !== true || typeof session?.append !== 'function') {
      return active ? previous ?? null : null
    }
    const current = this.currentSandbox(session)
    if (active) {
      if (current === 'read-only') return previous ?? null
      session.append('sandbox/mode', { mode: 'read-only' })
      return SANDBOX_MODES.has(current) ? current : previous ?? null
    }
    const restore = SANDBOX_MODES.has(previous) ? previous : null
    if (restore !== null && current === 'read-only' && restore !== 'read-only') {
      session.append('sandbox/mode', { mode: restore })
    }
    return null
  }

  commit(agent, rp, { recaptureSandbox = false } = {}) {
    const sessionId = agent?.id ?? agent?.session?.id
    const session = agent?.session
    const current = this.stored(sessionId)
    const next = cloneRp(rp)
    if (next.active) {
      next.followSuppressed = false
      const previous = recaptureSandbox ? null : current.sandboxBefore
      next.sandboxBefore = this.applySandbox(session, { active: true, previous })
    } else {
      this.applySandbox(session, { active: false, previous: current.sandboxBefore })
      next.sandboxBefore = null
      if (next.source !== 'command') next.source = null
    }
    this.write(sessionId, next)
    if (session !== undefined) this.pendingIntents.delete(session)
    return 'committed'
  }

  /**
   * @returns `committed` | `queued` | `cancelled` | `noop`
   */
  set(agent, active, { source = 'command', followSuppressed } = {}) {
    const sessionId = agent?.id ?? agent?.session?.id
    if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('RP mode requires a session id')
    const stored = this.stored(sessionId)
    const pending = agent?.session === undefined ? undefined : this.pendingIntents.get(agent.session)
    const next = cloneRp({
      active: active === true,
      source: active === true ? (source === 'character-follow' ? 'character-follow' : 'command') : null,
      followSuppressed: active === true ? false : followSuppressed === true,
      sandboxBefore: stored.sandboxBefore,
    })
    const target = pending?.rp ?? stored
    if (target.active === next.active && target.source === next.source && target.followSuppressed === next.followSuppressed) {
      return 'noop'
    }
    if (
      pending !== undefined
      && stored.active === next.active
      && stored.source === next.source
      && stored.followSuppressed === next.followSuppressed
    ) {
      this.pendingIntents.delete(agent.session)
      return 'cancelled'
    }
    if (agent?.session !== undefined && hasOpenTurn(agent.session.events)) {
      this.pendingIntents.set(agent.session, { rp: next })
      return 'queued'
    }
    return this.commit(agent, next)
  }

  setBySessionId(sessionId, active, options) {
    const agent = this.agentFor(sessionId)
    if (agent !== undefined) return this.set(agent, active, options)
    const stored = this.stored(sessionId)
    const next = cloneRp({
      ...stored,
      active: active === true,
      source: active === true ? (options?.source === 'character-follow' ? 'character-follow' : 'command') : null,
      followSuppressed: active === true ? false : options?.followSuppressed === true,
      sandboxBefore: active === true ? stored.sandboxBefore : null,
    })
    if (sameRp(stored, next)) return 'noop'
    this.write(sessionId, next)
    return 'committed'
  }

  onBoundary(agent) {
    const pending = agent?.session === undefined ? undefined : this.pendingIntents.get(agent.session)
    if (pending === undefined) return
    this.commit(agent, pending.rp)
  }

  onSessionStart(agent) {
    const sessionId = agent?.id
    if (typeof sessionId !== 'string' || sessionId === '') return
    const header = agent.session?.header ?? {}
    if (Number.isSafeInteger(header.delegationDepth) && header.delegationDepth > 0) return
    const rp = this.stored(sessionId)
    const characterBound = this.selections.get(sessionId).characterCardId !== null
    if (rp.active) {
      const inherited = typeof header.parentSession === 'string' && header.parentSession !== ''
      this.commit(agent, rp, { recaptureSandbox: inherited !== true })
      return
    }
    if (characterBound && this.followCharacterEnabled() && rp.followSuppressed !== true) {
      this.set(agent, true, { source: 'character-follow' })
    }
  }

  followCharacterChange(sessionId, { previousId, nextId }) {
    const previous = previousId ?? null
    const next = nextId ?? null
    if (previous === next) return
    if (next === null) {
      this.setBySessionId(sessionId, false, { followSuppressed: false })
      return
    }
    if (this.stored(sessionId).active) return
    if (!this.followCharacterEnabled()) return
    this.setBySessionId(sessionId, true, { source: 'character-follow' })
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

export function isRpModeApiPath(url) {
  return new URL(url ?? '/', 'http://localhost').pathname === '/dsh-tavern/api/rp-mode'
}

export function createRpModeApiHandler(controller, { beforeChange = async () => {} } = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const method = String(req.method ?? 'GET').toUpperCase()
      if (method === 'GET') {
        const sessionId = url.searchParams.get('sessionId')
        if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId must be a string')
        const agent = controller.agentFor(sessionId)
        const view = agent === undefined ? { rp: controller.stored(sessionId) } : controller.get(agent)
        return sendJson(res, 200, {
          ok: true,
          rp: view.rp,
          pending: view.pending ?? null,
          followCharacter: controller.followCharacterEnabled(),
        })
      }
      if (method === 'PUT') {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        if (typeof body.sessionId !== 'string' || body.sessionId === '') throw new TypeError('sessionId must be a string')
        if (typeof body.active !== 'boolean') throw new TypeError('active must be a boolean')
        await beforeChange({ sessionId: body.sessionId, active: body.active })
        const outcome = controller.setBySessionId(body.sessionId, body.active, {
          source: 'command',
          followSuppressed: body.active !== true,
        })
        const agent = controller.agentFor(body.sessionId)
        const view = agent === undefined ? { rp: controller.stored(body.sessionId) } : controller.get(agent)
        return sendJson(res, 200, {
          ok: true,
          outcome,
          rp: view.pending ?? view.rp,
          pending: view.pending ?? null,
          followCharacter: controller.followCharacterEnabled(),
        })
      }
      return sendJson(res, 405, { ok: false, error: 'method not allowed' })
    } catch (error) {
      const status = error?.status ?? (error instanceof TypeError || error instanceof SyntaxError ? 400 : 500)
      return sendJson(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export function registerRpCommands(ctx, controller) {
  if (typeof ctx?.inject !== 'function') return
  ctx.inject(['commands'], commandCtx => {
    commandCtx.commands.register({
      name: 'rp',
      description: 'Enter or leave Tavern roleplay mode',
      input: { hint: '[off]' },
      handler: ({ agent, rawInput }) => {
        const message = String(rawInput ?? '').trim()
        if (message === 'off') {
          switch (controller.set(agent, false, { source: 'command', followSuppressed: true })) {
            case 'committed': return { kind: 'success', text: 'Roleplay mode off.' }
            case 'queued': return { kind: 'success', text: 'Leaving roleplay mode (applies from the next step).' }
            case 'cancelled': return { kind: 'success', text: 'Roleplay mode entry cancelled.' }
            case 'noop': return controller.isActive(agent)
              ? { kind: 'success', text: 'Leaving roleplay mode (applies from the next step).' }
              : { kind: 'success', text: 'Roleplay mode is already inactive.' }
          }
        }
        const outcome = controller.set(agent, true, { source: 'command' })
        return {
          kind: 'success',
          text: outcome === 'committed'
            ? 'Roleplay mode on. Files default to read-only. Use /rp off to leave.'
            : 'Entering roleplay mode (applies from the next step). Use /rp off to leave.',
        }
      },
    })
  })
}

export const rpModeConstants = Object.freeze({
  defaultState: { ...DEFAULT_RP_STATE },
  defaultSection: DEFAULT_RP_SECTION,
  sectionName: 'rp:policy',
  sectionOrder: 45,
  sandboxModes: [...SANDBOX_MODES],
})
