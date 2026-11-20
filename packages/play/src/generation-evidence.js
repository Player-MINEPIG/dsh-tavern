import { createHash } from 'node:crypto'
import { requireCoordinates, sessionCoordinates } from './session-coordinates.js'
import { readSessionMessages } from './sessions.js'
import * as target from './generation-target.js'

export { generationConflict, resultHead } from './generation-target.js'
const hash = value => createHash('sha256').update(value).digest('hex')
export const resolveGenerationSource = (host, row, timeline, request) => target.resolveGenerationSource(id => readSessionMessages(host, id), row, timeline, request, hash)
export const verifyGenerationTarget = (record, timeline) => target.verifyGenerationTarget(record, timeline, hash)
export const generationTimeline = (record, timeline, outcome) => target.generationTimeline(record, timeline, outcome, hash)

// Correlate the native RPC ID and both coordinates within its own closed turn.
// A later human input, unrelated assistant output or ambiguous interruption
// cannot complete the recorded send, even if it contains identical text.
export async function generationOutcome(host, record) {
  if (!record.sessionId || !['sending','accepted'].includes(record.stage)) return { state: 'uncertain' }
  const cut = await host.inspectSession(record.sessionId)
  if (cut?.meta?.id !== record.sessionId || !Array.isArray(cut.events)
    || cut.inheritedEventCount !== record.boundary + 1
    || cut.events.some((event, index) => event?.seq !== index)) return { state: 'uncertain' }
  const coordinates = sessionCoordinates(cut)
  requireCoordinates(record.childVersion, coordinates)
  const events = cut.events.slice(cut.inheritedEventCount)
  const isUser = e => {
    const message = e.data?.message ?? e.data
    return message?.role === 'user' && (e.type === 'steering/message'
      || (e.type === 'user/message' && (message.source?.kind ?? 'user') === 'user'))
  }
  const users = events.filter(e => isUser(e) && (e.data?.message ?? e.data).source?.rpcId === record.requestId)
  if (!users.length) {
    const admission = events.find(e => e.type === 'agent/inbox/spliced' && e.data?.inserted?.some(
      message => message?.role === 'user' && message.source?.rpcId === record.requestId))
    if (admission && !events.some(e => e.seq > admission.seq && e.type === 'turn/end')) {
      return { state: events.some(e => e.seq > admission.seq && e.type === 'turn/start') ? 'running' : 'waiting' }
    }
    if (events.some(isUser) || record.stage === 'sending' || admission) return { state: 'uncertain' }
    return { state: 'waiting' }
  }
  if (users.length !== 1) return { state: 'uncertain' }
  const user = users[0]
  const start = events.findLast(e => e.type === 'turn/start' && e.seq < user.seq)
  // A fork can inherit the parent turn/start. Only a new turn may claim the send.
  if (!start || events.some(e => e.type === 'turn/end' && e.seq > start.seq && e.seq < user.seq)) return { state: 'uncertain' }
  const end = events.find(e => e.seq > user.seq && (e.type === 'turn/end' || e.type === 'turn/start'))
  if (!end) return { state: 'running' }
  if (end.type !== 'turn/end' || end.data?.turn !== start.data?.turn) return { state: 'uncertain' }
  const turn = events.filter(e => e.seq > user.seq && e.seq < end.seq)
  if (turn.some(isUser)) return { state: 'uncertain' }
  const assistant = turn.findLast(e => e.type === 'assistant/message' && (e.data?.message ?? e.data)?.role === 'assistant')
  if (end.data.reason?.kind === 'aborted' && !turn.some(e => e.type === 'assistant/message'
    && (e.data?.message ?? e.data)?.content?.some(part => part.type === 'text' && part.text?.trim()))) return { state: 'stopped' }
  if (!assistant || !['completed', 'aborted'].includes(end.data.reason?.kind)) return { state: 'uncertain' }
  return { state: 'ready', start: user.seq, end: assistant.seq, version: coordinates.sessionFormatVersion }
}
