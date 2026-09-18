import { digest } from '../../prompt-metadata.js'
import { snapshotSessionEvents } from '../../session-events.js'
import { readFailureReference } from './failure-references.js'

export const messageText = message => (message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('')
const contentHash = message => digest(message?.content ?? [])
const systemContext = message => message?.source?.kind === 'plugin'
  && message.source.plugin === '@deepseek-ai/dsh-system-prompt' && message.source.form === 'snapshot'
const eventMessage = event => event?.type === 'system/message' ? event.data?.message
  : event?.type === 'user/message' ? event.data : null

function messageReference(event, kind) {
  const message = eventMessage(event)
  if (typeof message?.id !== 'string' || message.id === '') return null
  return { kind, eventSeq: event.seq, eventType: event.type, messageId: message.id,
    messageHash: contentHash(message), textHash: digest(messageText(message)) }
}

/** Capture only references verified against the current public model surface. */
export function captureBodyReferences(session, options, sections, contexts, verifiedSystemIndex) {
  const version = session?.header?.version ?? 0
  if (!session || !Number.isSafeInteger(session.seq) || session.seq < 1
    || ![0, 1, 2, 3].includes(version) || session.header?.createdAt === undefined) return {}
  const sessionRef = { sessionId: session.id, sessionFormatVersion: version,
    sessionCreatedAt: session.header.createdAt, logCutSeq: session.seq - 1 }
  const events = snapshotSessionEvents(session)
  const bySeq = new Map(events.map(event => [event.seq, event]))
  const nodes = (session.surface?.nodes ?? []).map(seq => bySeq.get(seq)).filter(Boolean)
  const messages = options.messages ?? []
  const systems = typeof options.system === 'string'
    ? [{ role: 'system', content: [{ type: 'text', text: options.system }] }]
    : messages.filter(message => message.role === 'system')
  const systemMessageRefs = systems.map(message => {
    if (version < 3) {
      const event = events.findLast(item => item.type === 'request/header')
      const text = event?.data?.header?.system
      return typeof text === 'string' && text === messageText(message)
        ? { kind: 'request-header-system', eventSeq: event.seq, eventType: event.type, textHash: digest(text) } : null
    }
    const matches = nodes.filter(event => event.type === 'system/message'
      && (typeof message.id !== 'string' || event.data?.message?.id === message.id)
      && contentHash(event.data?.message) === contentHash(message))
    return matches.length === 1 ? messageReference(matches[0], 'system-message') : null
  })
  const systemRef = verifiedSystemIndex === null ? null : systemMessageRefs[verifiedSystemIndex]
  if (systemRef) for (const section of sections) section.reference = { ...systemRef,
    range: { startUtf16: section.offsetUtf16, endUtf16: section.offsetUtf16 + section.utf16Units } }

  // Official context snapshots retain their named sections. Their user-message
  // body has an official prefix, so system-style offsets cannot address it.
  const contextEvent = nodes.findLast(event => event.type === 'user/message' && systemContext(event.data))
  if (contextEvent) {
    const message = contextEvent.data
    const actual = messages.filter(item => item.role === 'user'
      && (typeof item.id !== 'string' || item.id === message.id)
      && contentHash(item) === contentHash(message))
    const reference = actual.length === 1 ? messageReference(contextEvent, 'context-section') : null
    if (reference) for (const section of contexts) {
      const matches = (message.source.sections ?? []).flatMap((item, index) => item.name === section.name
        && typeof item.text === 'string' && digest(item.text) === section.hash ? [index] : [])
      if (matches.length === 1) section.reference = { ...reference,
        sourceSectionIndex: matches[0], sourceSectionName: section.name }
    }
  }
  return { sessionRef, systemMessageRefs }
}

function readReference(reference, sessionRef, events, cache, expectedHash) {
  if (!reference) return { error: 'unverified' }
  const event = events.get(reference.eventSeq)
  if (!Number.isSafeInteger(reference.eventSeq) || reference.eventSeq < 0
    || reference.eventSeq > sessionRef.logCutSeq || event?.type !== reference.eventType) return { error: 'event-unavailable' }
  let body = cache.get(event.seq)
  if (!body) {
    const message = eventMessage(event)
    const text = message ? messageText(message) : event.data?.header?.system
    body = { message, text, messageHash: message ? contentHash(message) : null,
      textHash: typeof text === 'string' ? digest(text) : null }
    cache.set(event.seq, body)
  }
  let text
  if (reference.kind === 'request-header-system') {
    if (event.type !== 'request/header' || sessionRef.sessionFormatVersion >= 3) return { error: 'identity-mismatch' }
    text = body.text
  } else {
    const message = body.message
    if (!message || message.id !== reference.messageId) return { error: 'identity-mismatch' }
    if (body.messageHash !== reference.messageHash) return { error: 'hash-mismatch' }
    text = body.text
    if (reference.kind === 'context-section') {
      if (event.type !== 'user/message' || !systemContext(message)) return { error: 'identity-mismatch' }
      if (body.textHash !== reference.textHash) return { error: 'hash-mismatch' }
      const part = message.source.sections?.[reference.sourceSectionIndex]
      if (part?.name !== reference.sourceSectionName) return { error: 'identity-mismatch' }
      text = part.text
    } else if (reference.kind !== 'system-message' || event.type !== 'system/message') return { error: 'identity-mismatch' }
  }
  if (typeof text !== 'string') return { error: 'event-unavailable' }
  if (reference.kind !== 'context-section' && body.textHash !== reference.textHash) return { error: 'hash-mismatch' }
  if (reference.range) {
    const { startUtf16, endUtf16 } = reference.range
    if (!Number.isSafeInteger(startUtf16) || !Number.isSafeInteger(endUtf16)
      || startUtf16 < 0 || endUtf16 < startUtf16 || endUtf16 > text.length) return { error: 'range-mismatch' }
    text = text.slice(startUtf16, endUtf16)
  }
  if (expectedHash && digest(text) !== expectedHash) return { error: 'hash-mismatch' }
  return { text }
}

/** One cold inspection per detail; never resumes an Agent or reassembles text. */
export function createAssemblyBodyReader(sessionController) {
  return async function readBodies(stored, signal = new AbortController().signal) {
    const record = structuredClone(stored)
    if (record.bodyStorage !== 'official-session') return record
    let inspection
    let error
    const ref = record.sessionRef ?? record.failureRef?.sessionRef
    if (!ref) error = 'unverified'
    else if (typeof sessionController?.inspect !== 'function') error = 'history-unavailable'
    else {
      try { inspection = await sessionController.inspect(record.sessionId, signal) }
      catch (failure) {
        error = failure?.name === 'ApiSessionNotFound' || failure?.constructor?.name === 'ApiSessionNotFound'
          || ['SESSION_NOT_FOUND', 'PLAY_SESSION_NOT_FOUND'].includes(failure?.code) ? 'history-unavailable' : 'history-read-failed'
      }
    }
    readFailureReference(record, inspection, error)
    if (!error) {
      const meta = inspection?.meta
      if (meta?.version !== ref.sessionFormatVersion) error = 'format-mismatch'
      else if (meta.id !== record.sessionId || ref.sessionId !== record.sessionId
        || meta.createdAt !== ref.sessionCreatedAt) error = 'session-mismatch'
      else if (!Number.isSafeInteger(ref.logCutSeq) || ref.logCutSeq < 0
        || (inspection.events?.at(-1)?.seq ?? -1) < ref.logCutSeq) error = 'cut-unavailable'
    }
    const events = new Map((inspection?.events ?? []).map(event => [event.seq, event]))
    const cache = new Map()
    let available = 0
    let missing = 0
    for (const part of [...record.sections ?? [], ...record.contexts ?? []]) {
      delete part.text
      const result = error ? { error } : readReference(part.reference, ref, events, cache, part.hash)
      if (result.error) { part.contentStatus = 'reference-unavailable'; part.referenceError = result.error; missing++ }
      else { part.text = result.text; part.contentStatus = 'available'; available++ }
    }
    delete record.systemMessages
    if (record.systemMessageRefs?.length) {
      const systems = record.systemMessageRefs.map(reference => error ? { error } : readReference(reference, ref, events, cache))
      if (systems.every(result => !result.error)) record.systemMessages = systems.map(result => result.text)
      else record.requestContentStatus = 'reference-unavailable'
    }
    if (error) record.referenceError = error
    if (record.contentStatus !== 'assembly-unavailable' && record.contentStatus !== 'omitted-size-limit') {
      record.contentStatus = available > 0 && missing === 0 ? 'available'
        : available > 0 ? 'partially-available' : 'reference-unavailable'
    }
    return record
  }
}
