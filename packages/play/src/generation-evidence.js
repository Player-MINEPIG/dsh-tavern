import { createHash } from 'node:crypto'
import { projectContentText } from './message-content.js'
import { httpError } from './http.js'
import { requireCoordinates, sessionCoordinates, variantFormatVersion, withVariantFormat } from './session-coordinates.js'
import { readSessionMessages } from './sessions.js'
import { activeTimelineEntries, timelineHead, timelineWithHead } from './timeline-tree.js'

export const generationConflict = () => httpError(409, 'The active reply or its source changed. Review this generation in Repair playthrough.', 'PLAY_GENERATION_CONFLICT')
const human = message => message.role === 'user' && ['user', 'steering'].includes(message.origin.kind)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const anchor = variant => variant ? [variant.id, variant.sessionId, variant.startEventId, variant.endEventId, variantFormatVersion(variant) ?? null] : null

const branchIdentity = entries => createHash('sha256')
  .update(JSON.stringify(entries.map(({ node, variant }) => [node.id, anchor(variant)]))).digest('hex')

export async function resolveGenerationSource(host, row, timeline, request) {
  const entries = activeTimelineEntries(timeline)
  let index, source, user, target, sourceSessionId
  if (request.kind === 'request-retry') {
    index = entries.length
    sourceSessionId = request.sessionId
    if ((timelineHead(timeline)?.sessionId ?? row.ext?.pmpDshTavern?.rootSessionId) !== sourceSessionId) throw generationConflict()
    source = await readSessionMessages(host, sourceSessionId)
    user = source.messages.find(message => message.seq === request.userEventId && human(message))
    if (source.incompleteTurn || source.stoppedRequest?.userEventId !== request.userEventId || !user
      || !projectContentText(user.content).trim() || (entries.at(-1)?.variant.endEventId ?? -1) >= user.seq) {
      throw httpError(409, 'The stopped request is no longer retryable', 'PLAY_GENERATION_SOURCE_INVALID')
    }
  } else {
    index = entries.findIndex(({node}) => node.id === request.nodeId)
    if (index < 0 || (request.variantId !== undefined && entries[index].variant.id !== request.variantId)) throw generationConflict()
    const sessions = new Map()
    for (; index >= 0; index--) {
      target = entries[index]
      sourceSessionId = target.variant.sessionId
      if (!sessions.has(sourceSessionId)) sessions.set(sourceSessionId, await readSessionMessages(host, sourceSessionId))
      source = sessions.get(sourceSessionId)
      requireCoordinates(variantFormatVersion(target.variant), source)
      user = source.messages.find(message => Number.isSafeInteger(message.seq) && human(message)
        && message.seq >= target.variant.startEventId && message.seq <= target.variant.endEventId)
      if (user && projectContentText(user.content)) break
    }
    if (index < 0) throw httpError(409, 'Active branch has no reusable user message', 'PLAY_GENERATION_SOURCE_INVALID')
  }
  const parent = entries[index - 1]?.variant
  return {
    text: projectContentText(user.content),
    intent: {
      kind: request.kind, sourceSessionId, nodeId: target?.node.id ?? 'live-' + user.seq, sourceIndex: index,
      stateSource: { sessionId: sourceSessionId, ...(target ? { beforeReplyEventId: target.variant.endEventId } : { beforeUserEventId: user.seq }) },
      expectedHead: timelineHead(timeline), branch: branchIdentity(entries), source: anchor(target?.variant), parent: anchor(parent),
      boundary: parent?.endEventId ?? -1, forkVersion: parent ? variantFormatVersion(parent) : undefined,
    },
  }
}

export function verifyGenerationTarget(record, timeline) {
  const entries = activeTimelineEntries(timeline)
  const target = entries[record.sourceIndex]
  const head = timelineHead(timeline)
  if (['sessionId', 'nodeId', 'variantId'].some(key => head?.[key] !== record.expectedHead?.[key])
    || branchIdentity(entries) !== record.branch || !same(anchor(entries[record.sourceIndex - 1]?.variant), record.parent)
    || (record.kind === 'reply-swipe' && (target?.node.id !== record.nodeId || !same(anchor(target.variant), record.source)))
    || (record.kind === 'request-retry' && entries.length !== record.sourceIndex)) throw generationConflict()
}

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
    if (events.some(isUser) || record.stage === 'sending') return { state: 'uncertain' }
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

export function resultHead(record) {
  const variantId = 'generation-' + record.requestId
  return { sessionId: record.sessionId, nodeId: record.kind === 'reply-swipe' ? record.nodeId : 'qa-' + variantId, variantId }
}

export function generationTimeline(record, timeline, outcome) {
  const head = resultHead(record)
  const saved = timeline.nodes.find(node => node.id === head.nodeId)?.variants.find(v => v.id === head.variantId)
  const variant = withVariantFormat({ id: head.variantId, sessionId: head.sessionId, startEventId: outcome.start, endEventId: outcome.end }, outcome.version)
  if (saved) {
    if (!same(anchor(saved), anchor(variant))) throw generationConflict()
    return timeline // A lost acknowledgement must never reselect a head.
  }
  verifyGenerationTarget(record, timeline)
  const nodes = record.kind === 'reply-swipe'
    ? timeline.nodes.map(node => node.id === head.nodeId ? { ...node, adoptedVariantId: variant.id, variants: [...node.variants, variant] } : node)
    : [...timeline.nodes, { id: head.nodeId, kind: 'qa', displayOverride: null, parentVariantId: record.parent?.[0] ?? null, adoptedVariantId: variant.id, variants: [variant] }]
  return timelineWithHead({ ...timeline, nodes }, head)
}
