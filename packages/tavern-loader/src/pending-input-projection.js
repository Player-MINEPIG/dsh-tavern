const DEFAULT_MAX_SCAN_CHARACTERS = 64 * 1024
const DEFAULT_MAX_SCAN_MESSAGES = 128
const DEFAULT_MAX_QUEUED_CHARACTERS = 256 * 1024
const DEFAULT_MAX_QUEUED_MESSAGES = 256
const HARD_MAX_SCAN_CHARACTERS = 1024 * 1024
const HARD_MAX_SCAN_MESSAGES = 1024
const HARD_MAX_QUEUED_CHARACTERS = 1024 * 1024
const HARD_MAX_QUEUED_MESSAGES = 1024

function boundedInteger(value, fallback, maximum) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback
}

function textFromMessage(message, maximum = Infinity) {
  if (message?.role !== 'user' && message?.role !== 'assistant') return { text: '', originalLength: 0 }
  const blocks = Array.isArray(message.content)
    ? message.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text)
    : []
  const originalLength = blocks.reduce((total, text, index) => total + text.length + (index === 0 ? 0 : 1), 0)
  if (originalLength <= maximum) return { text: blocks.join('\n'), originalLength }
  const selected = []
  let remaining = maximum
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const separatorCharacters = selected.length === 0 ? 0 : 1
    if (remaining <= separatorCharacters) break
    const available = remaining - separatorCharacters
    selected.unshift(blocks[index].slice(-available))
    remaining -= Math.min(blocks[index].length, available) + separatorCharacters
  }
  return { text: selected.join('\n'), originalLength }
}

function messageId(message) {
  return typeof message?.id === 'string' && message.id !== '' ? message.id : null
}

function queueState() {
  return { items: [], omittedTailCount: 0 }
}

function projectionState() {
  return {
    queues: { 'next-turn': queueState(), 'next-step': queueState() },
    retainedCharacters: 0,
    claimed: [],
    claimedOmittedCount: 0,
    claimEventSeqs: [],
    invalidEvents: 0,
  }
}

function queueLength(queue) {
  return queue.items.length + queue.omittedTailCount
}

function eventData(event) {
  return event?.type === 'agent/inbox/spliced' && event.data !== null && typeof event.data === 'object'
    ? event.data
    : null
}

function isNormalizedSplice(data, queue) {
  const removedCount = data?.removedCount ?? 0
  return (data?.target === 'next-turn' || data?.target === 'next-step')
    && Number.isSafeInteger(data.start)
    && data.start >= 0
    && Number.isSafeInteger(removedCount)
    && removedCount >= 0
    && data.start + removedCount <= queueLength(queue)
    && Array.isArray(data.inserted)
    && (data.outcome === undefined || data.outcome === 'canceled')
}

function boundLatestMessages(messages, maxMessages, maxCharacters) {
  const selected = messages.slice(-maxMessages)
  const bounded = []
  let remaining = maxCharacters
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const separatorCharacters = bounded.length === 0 ? 0 : 1
    if (remaining <= separatorCharacters) break
    const available = remaining - separatorCharacters
    const original = selected[index].text
    const text = original.length <= available ? original : original.slice(-available)
    if (text === '') continue
    bounded.unshift({
      ...selected[index],
      text,
      truncated: selected[index].truncated === true || text.length !== original.length,
    })
    remaining -= text.length + separatorCharacters
  }
  return {
    messages: bounded,
    text: bounded.map(message => message.text).join('\n'),
    truncated: messages.length > bounded.length || bounded.some(message => message.truncated === true),
  }
}

/**
 * Loader-owned, bounded reconstruction of DSH's public durable inbox splice
 * events. It never reads the Agent's private queue and never writes a Session event.
 */
export class PendingInputProjection {
  constructor(options = {}) {
    this.maxScanCharacters = boundedInteger(options.maxScanCharacters, DEFAULT_MAX_SCAN_CHARACTERS, HARD_MAX_SCAN_CHARACTERS)
    this.maxScanMessages = boundedInteger(options.maxScanMessages, DEFAULT_MAX_SCAN_MESSAGES, HARD_MAX_SCAN_MESSAGES)
    this.maxQueuedCharacters = boundedInteger(options.maxQueuedCharacters, DEFAULT_MAX_QUEUED_CHARACTERS, HARD_MAX_QUEUED_CHARACTERS)
    this.maxQueuedMessages = boundedInteger(options.maxQueuedMessages, DEFAULT_MAX_QUEUED_MESSAGES, HARD_MAX_QUEUED_MESSAGES)
    this.sessions = new WeakMap()
  }

  ensureSession(session, beforeEvent = null) {
    if (session === null || typeof session !== 'object') return null
    const existing = this.sessions.get(session)
    if (existing !== undefined) return existing
    const state = projectionState()
    const seedLength = Number.isSafeInteger(session.header?.seedLength) ? session.header.seedLength : 0
    const events = Array.isArray(session.events) ? session.events : []
    for (let index = seedLength; index < events.length; index += 1) {
      const event = events[index]
      if (event === beforeEvent || (Number.isSafeInteger(beforeEvent?.seq) && event?.seq >= beforeEvent.seq)) break
      this.#apply(state, event, false)
    }
    this.sessions.set(session, state)
    return state
  }

  observeSessionEvent(session, event) {
    const state = this.ensureSession(session, event)
    if (state === null) return false
    return this.#apply(state, event, true)
  }

  clearClaimed(session) {
    const state = this.sessions.get(session)
    if (state === undefined) return
    state.claimed = []
    state.claimedOmittedCount = 0
    state.claimEventSeqs = []
  }

  activationContext(agent) {
    const session = agent?.session
    const state = this.ensureSession(session)
    const derived = typeof session?.deriveMessages === 'function' ? session.deriveMessages() : []
    const durableMessages = []
    let durableMessageCount = 0
    if (Array.isArray(derived)) {
      for (let index = derived.length - 1; index >= 0; index -= 1) {
        const message = derived[index]
        if (message?.role !== 'user' && message?.role !== 'assistant') continue
        durableMessageCount += 1
        if (durableMessages.length >= this.maxScanMessages) continue
        const extracted = textFromMessage(message, this.maxScanCharacters)
        if (extracted.text === '') continue
        durableMessages.unshift({
          id: messageId(message),
          role: message.role,
          text: extracted.text,
          source: 'durable',
          truncated: extracted.text.length !== extracted.originalLength,
        })
      }
    }
    const durableIds = new Set(durableMessages.map(message => message.id).filter(Boolean))
    const claimed = state === null ? [] : state.claimed
    const pendingMessages = claimed
      .filter(message => message.id === null || !durableIds.has(message.id))
      .map(message => ({ ...message, source: 'pending' }))
    const duplicateCount = claimed.length - pendingMessages.length
    const pendingOmittedCount = state?.claimedOmittedCount ?? 0
    const claimEventSeqs = [...(state?.claimEventSeqs ?? [])]
    const invalidEvents = state?.invalidEvents ?? 0
    const combined = [...durableMessages, ...pendingMessages]
    const inputCharacters = combined.reduce((total, message, index) => total + message.text.length + (index === 0 ? 0 : 1), 0)
    const bounded = boundLatestMessages(combined, this.maxScanMessages, this.maxScanCharacters)
    const includedPending = bounded.messages.filter(message => message.source === 'pending')
    this.clearClaimed(session)
    return {
      messages: bounded.messages,
      text: bounded.text,
      metadata: {
        kind: 'durable-plus-pending-input',
        durableMessageCount,
        pendingMessageCount: pendingMessages.length + pendingOmittedCount,
        includedPendingMessageCount: includedPending.length,
        duplicatePendingMessageCount: duplicateCount,
        scannedMessageCount: bounded.messages.length,
        scannedCharacters: bounded.text.length,
        inputCharacters,
        truncated: bounded.truncated || durableMessageCount > durableMessages.length || pendingOmittedCount > 0 || pendingMessages.some(message => message.truncated === true),
        claimEventSeqs: claimEventSeqs.filter(Number.isSafeInteger).slice(-4),
        invalidEventCount: invalidEvents,
      },
    }
  }

  #materialize(state, message) {
    const remaining = Math.max(0, this.maxQueuedCharacters - state.retainedCharacters)
    const extracted = textFromMessage(message, remaining)
    const text = extracted.text
    state.retainedCharacters += text.length
    return {
      id: messageId(message),
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      text,
      truncated: text.length !== extracted.originalLength,
    }
  }

  #apply(state, event, captureClaim) {
    const data = eventData(event)
    if (data === null) return false
    const queue = state.queues[data.target]
    if (queue === undefined || !isNormalizedSplice(data, queue)) {
      state.invalidEvents += 1
      return false
    }
    const removedCount = data.removedCount ?? 0
    const storedRemovedCount = Math.max(0, Math.min(removedCount, queue.items.length - data.start))
    const removed = storedRemovedCount === 0 ? [] : queue.items.splice(data.start, storedRemovedCount)
    state.retainedCharacters -= removed.reduce((total, message) => total + message.text.length, 0)
    const omittedRemoved = removedCount - storedRemovedCount
    queue.omittedTailCount = Math.max(0, queue.omittedTailCount - omittedRemoved)

    if (captureClaim && data.outcome !== 'canceled' && removedCount > 0 && data.inserted.length === 0) {
      state.claimed.push(...removed)
      state.claimedOmittedCount += omittedRemoved
      if (state.claimed.length > this.maxScanMessages) {
        state.claimedOmittedCount += state.claimed.length - this.maxScanMessages
        state.claimed.splice(0, state.claimed.length - this.maxScanMessages)
      }
      if (Number.isSafeInteger(event.seq)) {
        state.claimEventSeqs.push(event.seq)
        if (state.claimEventSeqs.length > 4) state.claimEventSeqs.splice(0, state.claimEventSeqs.length - 4)
      }
    }

    if (data.inserted.length > 0) {
      if (data.start <= queue.items.length) {
        const materialized = data.inserted.map(message => this.#materialize(state, message))
        queue.items.splice(data.start, 0, ...materialized)
      } else {
        queue.omittedTailCount += data.inserted.length
      }
    }

    if (queue.items.length > this.maxQueuedMessages) {
      const omitted = queue.items.splice(this.maxQueuedMessages)
      state.retainedCharacters -= omitted.reduce((total, message) => total + message.text.length, 0)
      queue.omittedTailCount += omitted.length
    }
    return true
  }
}

export const pendingInputProjectionConstants = Object.freeze({
  defaultMaxScanCharacters: DEFAULT_MAX_SCAN_CHARACTERS,
  defaultMaxScanMessages: DEFAULT_MAX_SCAN_MESSAGES,
  defaultMaxQueuedCharacters: DEFAULT_MAX_QUEUED_CHARACTERS,
  defaultMaxQueuedMessages: DEFAULT_MAX_QUEUED_MESSAGES,
  hardMaxScanCharacters: HARD_MAX_SCAN_CHARACTERS,
  hardMaxScanMessages: HARD_MAX_SCAN_MESSAGES,
  hardMaxQueuedCharacters: HARD_MAX_QUEUED_CHARACTERS,
  hardMaxQueuedMessages: HARD_MAX_QUEUED_MESSAGES,
})
