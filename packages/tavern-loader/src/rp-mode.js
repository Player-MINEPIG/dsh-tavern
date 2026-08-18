const RP_SOURCES = new Set(['command', 'character-follow'])
const SANDBOX_MODES = new Set(['read-only', 'workspace-write', 'danger-full-access'])

export const DEFAULT_RP_STATE = Object.freeze({
  active: false,
  source: null,
  followSuppressed: false,
  sandboxBefore: null,
})

export const RP_WRITE_BLOCK_REASON = 'Tavern roleplay is on. File writes, shell, and sandbox escalation are blocked until RP mode is turned off on the character card.'

export const DEFAULT_RP_SECTION = RP_WRITE_BLOCK_REASON

export const RP_MUTATING_TOOL_NAMES = new Set([
  'write',
  'edit',
  'str_replace_editor',
  'bash',
  'pwsh',
  'run_code',
  'web_fetch',
])

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

export function rpWriteGuardReason(execution) {
  if (!isRecord(execution) || typeof execution.name !== 'string') return undefined
  if (RP_MUTATING_TOOL_NAMES.has(execution.name)) return RP_WRITE_BLOCK_REASON
  const args = execution.arguments
  if (isRecord(args) && args.sandbox_permissions) return RP_WRITE_BLOCK_REASON
  return undefined
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
    policyStore = null,
    section = DEFAULT_RP_SECTION,
    readOnlyOnEnter = true,
  }) {
    this.selections = selections
    this.uiSettings = uiSettings
    this.agents = typeof agents === 'function' ? agents : () => agents
    this.sandboxDefault = typeof sandboxDefault === 'function' ? sandboxDefault : () => sandboxDefault
    this.logger = logger
    this.policyStore = policyStore
    this.defaultSection = section
    this.readOnlyOnEnter = readOnlyOnEnter !== false
    this.pendingIntents = new WeakMap()
    this.highRiskAlerts = new Map()
    this.highRiskAlertSeq = 0
  }

  get section() {
    return this.policyStore?.get() ?? this.defaultSection
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

  blocksWrites(agent) {
    const sessionId = agent?.id ?? agent?.session?.id
    if (typeof sessionId === 'string' && this.stored(sessionId).active === true) return true
    return this.isActive(agent)
  }

  get(agent) {
    const stored = this.stored(agent?.id ?? agent?.session?.id)
    const pending = agent?.session === undefined ? undefined : this.pendingIntents.get(agent.session)
    return pending === undefined ? { rp: stored } : { rp: stored, pending: pending.rp }
  }

  write(sessionId, rp) {
    this.selections.set(sessionId, { rp: normalizeRpState(rp) })
  }

  noteHighRiskBlock(sessionId, toolName) {
    if (typeof sessionId !== 'string' || sessionId === '') return null
    const existing = this.highRiskAlerts.get(sessionId)
    if (existing !== undefined) {
      if (typeof toolName === 'string' && toolName !== '') existing.toolName = toolName
      existing.at = Date.now()
      return existing
    }
    this.highRiskAlertSeq += 1
    const alert = {
      id: this.highRiskAlertSeq,
      sessionId,
      toolName: typeof toolName === 'string' ? toolName : 'unknown',
      at: Date.now(),
    }
    this.highRiskAlerts.set(sessionId, alert)
    return alert
  }

  peekHighRiskAlert(sessionId) {
    const alert = this.highRiskAlerts.get(sessionId)
    return alert === undefined ? null : { ...alert }
  }

  takeHighRiskAlert(sessionId, id) {
    const alert = this.peekHighRiskAlert(sessionId)
    if (alert === null) return null
    if (id !== undefined && alert.id !== id) return null
    this.highRiskAlerts.delete(sessionId)
    return alert
  }

  interruptHighRisk(execution) {
    if (!this.blocksWrites(execution?.agent)) return undefined
    const reason = rpWriteGuardReason(execution)
    if (reason === undefined) return undefined
    const agent = execution.agent
    const sessionId = agent?.id ?? agent?.session?.id
    this.noteHighRiskBlock(sessionId, execution.name)
    queueMicrotask(() => {
      try {
        agent?.cancel?.({ kind: 'hook', reason: 'rp-high-risk-block' }, { keepInbox: true })
      } catch {}
    })
    return reason
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

  enforceReadOnly(session) {
    if (this.readOnlyOnEnter !== true || typeof session?.append !== 'function') return false
    const sessionId = session.id ?? session.header?.id
    if (typeof sessionId !== 'string' || sessionId === '') return false
    const pending = this.pendingIntents.get(session)
    const stored = this.stored(sessionId)
    const active = stored.active === true || pending?.rp.active === true
    if (active !== true) return false
    if (this.currentSandbox(session) === 'read-only') return false
    session.append('sandbox/mode', { mode: 'read-only' })
    return true
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
      this.write(sessionId, next)
      if (session !== undefined) this.pendingIntents.delete(session)
      return 'committed'
    }
    const previous = current.sandboxBefore
    next.sandboxBefore = null
    if (next.source !== 'command') next.source = null
    this.write(sessionId, next)
    if (session !== undefined) this.pendingIntents.delete(session)
    this.applySandbox(session, { active: false, previous })
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
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === '/dsh-tavern/api/rp-mode' || path === '/dsh-tavern/api/rp-alert'
}

export function createRpModeApiHandler(controller, { beforeChange = async () => {} } = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const method = String(req.method ?? 'GET').toUpperCase()
      if (url.pathname === '/dsh-tavern/api/rp-alert') {
        const sessionId = url.searchParams.get('sessionId')
        if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId must be a string')
        if (method === 'GET') return sendJson(res, 200, { ok: true, alert: controller.peekHighRiskAlert(sessionId) })
        if (method === 'DELETE') {
          const raw = url.searchParams.get('id')
          const id = raw === null || raw === '' ? undefined : Number(raw)
          return sendJson(res, 200, { ok: true, alert: controller.takeHighRiskAlert(sessionId, Number.isSafeInteger(id) ? id : undefined) })
        }
        return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      }
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
            ? 'Roleplay mode on. Writes, shell, and fetch stay blocked until you turn RP off. Use /rp off to leave.'
            : 'Entering roleplay mode (applies from the next step). Use /rp off to leave.',
        }
      },
    })
  })
}

export function registerRpWriteGuard(ctx, controller) {
  if (typeof ctx?.inject !== 'function') return
  ctx.inject(['tools'], toolCtx => {
    toolCtx.tools.guard(execution => controller.interruptHighRisk(execution))
  })
}

export const rpModeConstants = Object.freeze({
  defaultState: { ...DEFAULT_RP_STATE },
  defaultSection: DEFAULT_RP_SECTION,
  sectionName: 'rp:policy',
  sectionOrder: 45,
  sandboxModes: [...SANDBOX_MODES],
})
