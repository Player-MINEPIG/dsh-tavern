import { variantFormatVersion } from './session-coordinates.js'

export function uniqueMessageCoordinates(events) {
  const messages = new Map()
  for (const event of events) {
    const message = event.data?.message ?? event.data
    const isUser = message?.role === 'user' && (event.type === 'steering/message'
      || (event.type === 'user/message' && (message.source == null || message.source.kind === 'user')))
    if (!isUser && !(event.type === 'assistant/message' && message?.role === 'assistant')) continue
    if (typeof message.id !== 'string' || !message.id) continue
    // A reused message ID cannot identify a unique endpoint.
    messages.set(message.id, messages.has(message.id) ? null : { role: message.role, seq: event.seq })
  }
  return messages
}

export function automaticStampBounds(artifact, messages, postUpgradeUserMessageId) {
  // V3→V4 emits each source event once in order. It may insert an interrupted
  // closer before a restart. Treat every interrupted closer as a possible
  // insertion. Child catalog additions follow all source events.
  const firstInsertion = artifact.events.findIndex(event => event.type === 'turn/end' && event.data?.reason?.kind === 'interrupted')
  const firstPossibleShift = firstInsertion < 0 ? Infinity : firstInsertion
  let postUpgradeStart = Infinity
  if (postUpgradeUserMessageId !== undefined) {
    const anchor = messages.get(postUpgradeUserMessageId)
    if (anchor?.role !== 'user' || anchor.seq < artifact.inheritedEventCount) {
      throw new Error(`Expected a unique, non-inherited post-upgrade user message in ${artifact.header.id}`)
    }
    postUpgradeStart = anchor.seq
  }
  const endpoints = new Map()
  for (const message of messages.values()) {
    if (message) endpoints.set(message.seq, message.role)
  }
  return { firstPossibleShift, postUpgradeStart, endpoints }
}

export function automaticStampRefusal(variant, log) {
  if (variantFormatVersion(variant) !== undefined) return 'explicit-historical-version'
  if (!log) return 'missing-session-log'
  if (log.endpoints.get(variant.startEventId) !== 'user' || log.endpoints.get(variant.endEventId) !== 'assistant') {
    return 'unverified-message-range'
  }
  if (variant.endEventId >= log.firstPossibleShift && variant.startEventId < log.postUpgradeStart) return 'possible-v3-offset'
  return null
}
