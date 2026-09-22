import { digest } from '../../prompt-metadata.js'

function failureFromEvent(event) {
  let value
  if (event?.type === 'turn/end' && event.data?.reason?.kind === 'error') {
    value = event.data.reason.error
  } else if (event?.type === 'assistant/attempt' && Array.isArray(event.data?.stream)) {
    const finish = event.data.stream.findLast(item => item?.type === 'chunk' && item.chunk?.type === 'finish')?.chunk
    if (finish?.reason?.kind === 'error' || finish?.reason?.kind === 'aborted') value = finish.reason.failure
  }
  if (!value || (typeof value.code !== 'string' && typeof value.message !== 'string')) return null
  return { code: typeof value.code === 'string' ? value.code : null,
    message: typeof value.message === 'string' ? value.message : null }
}

/** Error text stays in the official log, independently of the earlier prompt cut. */
export function captureFailureReference(session, event) {
  if (!session || !Number.isSafeInteger(event?.seq) || event.seq < 0
    || !Number.isSafeInteger(session.seq) || event.seq >= session.seq
    || ![0, 1, 2, 3, 4].includes(session.header?.version) || session.header?.createdAt === undefined
    || !failureFromEvent(event)) return null
  return { eventSeq: event.seq, eventType: event.type, eventHash: digest(event.data),
    sessionRef: { sessionId: session.id, sessionFormatVersion: session.header.version,
      sessionCreatedAt: session.header.createdAt, logCutSeq: event.seq } }
}

export function readFailureReference(record, inspection, readError) {
  const reference = record.failureRef
  if (!reference) return
  delete record.failure
  const ref = reference.sessionRef
  const meta = inspection?.meta
  const events = inspection?.events ?? []
  let error = readError
  if (!error && (!ref || meta?.id !== record.sessionId || ref.sessionId !== record.sessionId
    || meta.createdAt !== ref.sessionCreatedAt)) error = 'session-mismatch'
  if (!error && (meta.version !== ref.sessionFormatVersion || ![0, 1, 2, 3, 4].includes(meta.version))) error = 'format-mismatch'
  if (!error && (!Number.isSafeInteger(ref.logCutSeq) || ref.logCutSeq < 0
    || (events.at(-1)?.seq ?? -1) < ref.logCutSeq)) error = 'cut-unavailable'
  const event = events.find(event => event.seq === reference.eventSeq)
  if (!error && (!Number.isSafeInteger(reference.eventSeq) || reference.eventSeq < 0
    || reference.eventSeq > ref.logCutSeq || event?.type !== reference.eventType)) error = 'event-unavailable'
  if (!error && (event.data?.turn !== record.turn
    || (event.type === 'assistant/attempt' && event.data?.step !== record.step))) error = 'identity-mismatch'
  if (!error && digest(event.data) !== reference.eventHash) error = 'hash-mismatch'
  const failure = error ? null : failureFromEvent(event)
  if (!error && !failure) error = 'event-unavailable'
  record.failureStatus = error ? 'reference-unavailable' : 'available'
  if (error) record.failureReferenceError = error
  else { record.failure = failure; delete record.failureReferenceError }
}
