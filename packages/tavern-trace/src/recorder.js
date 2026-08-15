import { createHash } from 'node:crypto'

const CALL_CONFIG_FIELDS = ['temperature', 'maxTokens', 'reasoningEffort', 'stop']
const MAX_DIAGNOSTICS = 64
const MAX_TEXT = 320
const MAX_IDS = 64
const MAX_WORLD_BOOKS = 16
const MAX_WORLD_BOOK_DECISIONS = 128

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
}

function clipped(value, maximum = MAX_TEXT) {
  const text = String(value ?? '')
  return text.length <= maximum ? text : `${text.slice(0, maximum)}…`
}

function stringOrNull(value) {
  return typeof value === 'string' && value !== '' ? clipped(value, 200) : null
}

function stringArray(value, maximum = MAX_IDS) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string').slice(0, maximum).map(item => clipped(item, 160))
    : []
}

function resource(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return {
    id: stringOrNull(value.id),
    name: clipped(value.name, 200),
    kind: stringOrNull(value.kind),
    format: stringOrNull(value.format),
    entryCount: Number.isSafeInteger(value.entryCount) ? value.entryCount : null,
    matchedEntryCount: Number.isSafeInteger(value.matchedEntryCount) ? value.matchedEntryCount : null,
  }
}

function diagnostics(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_DIAGNOSTICS).map(item => ({
    code: clipped(item?.code, 120),
    severity: clipped(item?.severity, 24),
    message: clipped(item?.message),
    resourceId: stringOrNull(item?.resourceId),
    entryId: item?.entryId === undefined ? null : clipped(item.entryId, 120),
  }))
}

function callConfig(value) {
  if (value === null || typeof value !== 'object') return {}
  return Object.fromEntries(CALL_CONFIG_FIELDS.flatMap(key => value[key] === undefined ? [] : [[key, structuredClone(value[key])]]))
}

function userInjection(value) {
  const placement = stringOrNull(value?.descriptionPlacement) ?? 'none'
  return {
    selected: value?.selected === true,
    descriptionAvailable: value?.descriptionAvailable === true,
    descriptionCharacters: Number.isSafeInteger(value?.descriptionCharacters) ? value.descriptionCharacters : 0,
    descriptionInsertions: Number.isSafeInteger(value?.descriptionInsertions) ? value.descriptionInsertions : 0,
    descriptionPlacement: placement,
  }
}

function selection(value) {
  return {
    presetId: stringOrNull(value?.presetId),
    characterCardId: stringOrNull(value?.characterCardId),
    userProfileId: stringOrNull(value?.userProfileId ?? value?.userId),
    worldBookIds: stringArray(value?.worldBookIds),
  }
}

function decision(value) {
  return {
    resourceId: stringOrNull(value?.resourceId),
    entryId: value?.entryId === undefined ? null : clipped(value.entryId, 120),
    entryName: clipped(value?.entryName, 160),
    decision: value?.decision === 'included' ? 'included' : 'rejected',
    reason: clipped(value?.reason, 120),
    primaryMatches: stringArray(value?.primaryMatches, 16),
    secondaryMatches: stringArray(value?.secondaryMatches, 16),
    secondaryLogic: stringOrNull(value?.secondaryLogic),
    groupName: stringOrNull(value?.groupName),
    groupWeight: Number.isFinite(value?.groupWeight) ? value.groupWeight : null,
    groupOverride: value?.groupOverride === true,
    probability: Number.isFinite(value?.probability) ? value.probability : null,
    probabilityRoll: Number.isFinite(value?.probabilityRoll) ? value.probabilityRoll : null,
    tokenCost: Number.isFinite(value?.tokenCost) ? value.tokenCost : null,
    requestedPosition: stringOrNull(value?.requestedPosition),
    appliedPosition: stringOrNull(value?.appliedPosition),
    approximatePosition: value?.approximatePosition === true,
  }
}

function worldBooks(value) {
  const books = Array.isArray(value?.resources) ? value.resources : []
  let remaining = MAX_WORLD_BOOK_DECISIONS
  return books.slice(0, MAX_WORLD_BOOKS).map(book => {
    const decisions = Array.isArray(book?.decisions)
      ? book.decisions.slice(0, remaining).map(decision)
      : []
    remaining -= decisions.length
    return {
      resource: resource(book?.resource ?? book),
      budget: {
        limit: Number.isFinite(book?.budget?.limit) ? book.budget.limit : null,
        used: Number.isFinite(book?.budget?.used) ? book.budget.used : 0,
        remaining: Number.isFinite(book?.budget?.remaining) ? book.budget.remaining : null,
      },
      decisions,
    }
  })
}

function latestHeaderEvent(session) {
  const events = Array.isArray(session?.events) ? session.events : []
  return events.findLast(event => event?.type === 'request/header') ?? null
}

function headerAuthority(headerEvent, header, expectedSystemText, expectedCallConfig, headerReused = null) {
  if (header === undefined || header === null) {
    return {
      kind: 'dsh-request-header',
      headerEventSeq: null,
      headerReason: null,
      headerReused: null,
      headerFingerprint: null,
      systemFingerprint: null,
      configFingerprint: null,
      tavernProfilePresent: null,
      tavernCallConfigApplied: null,
    }
  }
  const system = typeof header.system === 'string' ? header.system : ''
  const actualConfig = header.config ?? {}
  return {
    kind: 'dsh-request-header',
    headerEventSeq: Number.isSafeInteger(headerEvent?.seq) ? headerEvent.seq : null,
    headerReason: stringOrNull(headerEvent?.data?.reason),
    headerReused,
    headerFingerprint: hash(header),
    systemFingerprint: hash(system),
    configFingerprint: hash(actualConfig),
    tavernProfilePresent: expectedSystemText === '' ? null : system.includes(expectedSystemText),
    tavernCallConfigApplied: Object.entries(expectedCallConfig).every(([key, value]) => JSON.stringify(actualConfig[key]) === JSON.stringify(value)),
  }
}

/**
 * Correlates the loader's exact assembly snapshot with public Agent turn/step
 * identifiers, then links it to DSH's effective request/header without ever
 * copying the header or model-visible text into plugin persistence.
 */
export class TavernTraceRecorder {
  constructor(store, options = {}) {
    this.store = store
    this.now = typeof options.now === 'function' ? options.now : () => Date.now()
    this.pending = new Map()
  }

  begin({ agent, turn, step, snapshot }) {
    const sessionId = agent?.id
    if (typeof sessionId !== 'string' || !Number.isSafeInteger(turn) || !Number.isSafeInteger(step)) return null
    const records = this.store.list(sessionId)
    const attempt = Math.max(
      0,
      ...records
        .filter(record => record.turn === turn && record.step === step)
        .map(record => Number.isSafeInteger(record.attempt) ? record.attempt : 0),
    ) + 1
    const recordedAt = this.now()
    const expectedSystemText = typeof snapshot?.systemText === 'string' ? snapshot.systemText : ''
    const expectedCallConfig = callConfig(snapshot?.callConfig)
    const id = `${turn}:${step}:${attempt}`
    const audit = snapshot?.audit ?? {}
    const resources = snapshot?.resources ?? audit.resources ?? {}
    const record = {
      schemaVersion: 1,
      id,
      sessionId,
      turn,
      step,
      attempt,
      recordedAt,
      updatedAt: recordedAt,
      status: 'awaiting-header',
      assembly: {
        fingerprint: stringOrNull(audit.fingerprint),
        profileSection: 'dsh-tavern:profile',
        profileOrder: 10,
        systemPromptMode: snapshot?.systemPromptMode === 'replace' ? 'replace' : 'append',
        systemCharacters: expectedSystemText.length,
        systemFingerprint: hash(expectedSystemText),
        callConfig: expectedCallConfig,
        userInjection: userInjection(audit.composition?.userInjection),
      },
      selection: selection(audit.selection),
      resources: {
        preset: resource(resources.preset),
        characterCard: resource(resources.characterCard),
        userProfile: resource(resources.userProfile ?? resources.user),
        worldBooks: Array.isArray(resources.worldBooks) ? resources.worldBooks.slice(0, 32).map(resource).filter(Boolean) : [],
      },
      worldBooks: worldBooks(audit.worldBooks),
      diagnostics: diagnostics(snapshot?.diagnostics ?? audit.diagnostics),
      authority: headerAuthority(null, null, expectedSystemText, expectedCallConfig),
      sensitiveContentStored: false,
      entersModelHistory: false,
    }
    const previous = this.pending.get(sessionId)
    const updates = []
    if (previous !== undefined) {
      updates.push({
        ...previous.record,
        status: 'superseded-unconfirmed',
        updatedAt: recordedAt,
      })
    }
    updates.push(record)
    this.store.upsertMany(sessionId, updates)
    if (previous !== undefined) this.pending.delete(sessionId)
    this.pending.set(sessionId, { id, turn, step, record, expectedSystemText, expectedCallConfig })
    while (this.pending.size > this.store.maxSessions) {
      const oldestSessionId = this.pending.keys().next().value
      this.pending.delete(oldestSessionId)
    }
    return structuredClone(record)
  }

  observeSessionEvent(session, event) {
    const sessionId = session?.id
    const pending = this.pending.get(sessionId)
    if (pending === undefined) return null
    if (event?.type === 'request/header') return this.finalize(session, 'header-observed', event)
    const turn = event?.data?.turn
    const step = event?.data?.step
    if ((event?.type === 'assistant/chunk' || event?.type === 'assistant/message') && turn === pending.turn && step === pending.step) {
      return this.finalize(session, 'header-reused-or-observed')
    }
    if (event?.type === 'turn/end' && turn === pending.turn) {
      return this.finalize(session, 'request-not-confirmed')
    }
    return null
  }

  observeRequestError(agent, turn, step) {
    const pending = this.pending.get(agent?.id)
    if (pending === undefined || pending.turn !== turn || pending.step !== step) return null
    return this.finalize(agent.session, 'request-error')
  }

  finalize(session, status, observedHeaderEvent = null) {
    const sessionId = session?.id
    const pending = this.pending.get(sessionId)
    if (pending === undefined) return null
    const latest = observedHeaderEvent?.type === 'request/header' ? observedHeaderEvent : latestHeaderEvent(session)
    const header = typeof session?.requestHeader === 'function'
      ? session.requestHeader()
      : latest?.data?.header
    const updatedAt = this.now()
    const record = {
      ...pending.record,
      updatedAt,
      status,
      authority: headerAuthority(
        latest,
        header,
        pending.expectedSystemText,
        pending.expectedCallConfig,
        latest === null ? null : observedHeaderEvent?.type !== 'request/header',
      ),
    }
    this.store.upsert(sessionId, record)
    this.pending.delete(sessionId)
    return structuredClone(record)
  }
}

export const tavernTraceRecorderConstants = Object.freeze({ callConfigFields: [...CALL_CONFIG_FIELDS] })
