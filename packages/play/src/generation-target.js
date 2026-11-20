import { projectContentText } from './message-content.js'
import { httpError } from './http.js'
import { requireCoordinates, variantFormatVersion, withVariantFormat } from './session-coordinates.js'
import { activeTimelineEntries, timelineHead, timelineWithHead } from './timeline-tree.js'

export const generationConflict = () => httpError(409, 'The active reply or its source changed. Review this generation in Repair playthrough.', 'PLAY_GENERATION_CONFLICT')
const human = message => message.role === 'user' && ['user', 'steering'].includes(message.origin.kind)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const anchor = variant => variant ? [variant.id, variant.sessionId, variant.startEventId, variant.endEventId, variantFormatVersion(variant) ?? null] : null

const branchIdentity = (entries, hash) => hash(JSON.stringify(entries.map(({ node, variant }) => [node.id, anchor(variant)])))

export async function resolveGenerationSource(readMessages, row, timeline, request, hash) {
  const entries = activeTimelineEntries(timeline)
  let index, source, user, target, sourceSessionId
  if (request.kind === 'request-retry') {
    index = entries.length
    sourceSessionId = request.sessionId
    if ((timelineHead(timeline)?.sessionId ?? row.ext?.pmpDshTavern?.rootSessionId) !== sourceSessionId) throw generationConflict()
    source = await readMessages(sourceSessionId)
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
      if (!sessions.has(sourceSessionId)) sessions.set(sourceSessionId, await readMessages(sourceSessionId))
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
      expectedHead: timelineHead(timeline), branch: branchIdentity(entries, hash), source: anchor(target?.variant), parent: anchor(parent),
      boundary: parent?.endEventId ?? -1, forkVersion: parent ? variantFormatVersion(parent) : undefined,
    },
  }
}

export function verifyGenerationTarget(record, timeline, hash) {
  const entries = activeTimelineEntries(timeline)
  const target = entries[record.sourceIndex]
  const head = timelineHead(timeline)
  if (['sessionId', 'nodeId', 'variantId'].some(key => head?.[key] !== record.expectedHead?.[key])
    || branchIdentity(entries, hash) !== record.branch || !same(anchor(entries[record.sourceIndex - 1]?.variant), record.parent)
    || (record.kind === 'reply-swipe' && (target?.node.id !== record.nodeId || !same(anchor(target.variant), record.source)))
    || (record.kind === 'request-retry' && entries.length !== record.sourceIndex)) throw generationConflict()
}

export function resultHead(record) {
  const variantId = 'generation-' + record.requestId
  return { sessionId: record.sessionId, nodeId: record.kind === 'reply-swipe' ? record.nodeId : 'qa-' + variantId, variantId }
}

export function generationTimeline(record, timeline, outcome, hash) {
  const head = resultHead(record)
  const saved = timeline.nodes.find(node => node.id === head.nodeId)?.variants.find(v => v.id === head.variantId)
  const variant = withVariantFormat({ id: head.variantId, sessionId: head.sessionId, startEventId: outcome.start, endEventId: outcome.end }, outcome.version)
  if (saved) {
    if (!same(anchor(saved), anchor(variant))) throw generationConflict()
    return timeline // A lost acknowledgement must never reselect a head.
  }
  verifyGenerationTarget(record, timeline, hash)
  const nodes = record.kind === 'reply-swipe'
    ? timeline.nodes.map(node => node.id === head.nodeId ? { ...node, adoptedVariantId: variant.id, variants: [...node.variants, variant] } : node)
    : [...timeline.nodes, { id: head.nodeId, kind: 'qa', displayOverride: null, parentVariantId: record.parent?.[0] ?? null, adoptedVariantId: variant.id, variants: [variant] }]
  return timelineWithHead({ ...timeline, nodes }, head)
}
