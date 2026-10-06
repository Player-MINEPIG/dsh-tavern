import { updateTimeline } from './mutations.js'
import {
  activeTimelineEntries,
  activeVariantEnd,
  timelineHead,
  timelineWithHead,
} from '../../../play/src/timeline-tree.js'

// Older clients recorded reasoning-only cancelled turns as a completed QA.
// Repair only an unbranched active leaf proven empty by durable stop evidence.
function repairStoppedLeaf(timeline, messageState, sessionId) {
  const stopped = messageState.stoppedRequest
  if (!stopped) return { timeline, changed: false }
  const path = activeTimelineEntries(timeline)
  const leaf = path.at(-1)
  const previous = path.at(-2)
  if (!leaf || leaf.node.kind !== 'qa' || leaf.node.variants.length !== 1
    || leaf.variant.sessionId !== sessionId || leaf.variant.startEventId !== stopped.userEventId
    || leaf.variant.endEventId <= stopped.userEventId
    || leaf.variant.endEventId >= stopped.turnEndEventId
    || (previous && previous.variant.sessionId !== sessionId)
    || (timeline.nodes ?? []).some(node => node.parentVariantId === leaf.variant.id)) return { timeline, changed: false }
  const reply = messageState.messages?.find(message => message.seq === leaf.variant.endEventId)
  if (reply?.role !== 'assistant' || (reply.text ?? '').trim()
    || reply.content?.some(block => block.type === 'text' && block.text?.trim())) return { timeline, changed: false }
  const head = previous ? { sessionId: previous.variant.sessionId, nodeId: previous.node.id, variantId: previous.variant.id } : null
  const next = { ...timeline, nodes: timeline.nodes.filter(node => node.id !== leaf.node.id) }
  delete next.head
  const remembered = next.ext?.pmpDshTavern?.branchHeads
  if (Array.isArray(remembered)) next.ext = { ...next.ext, pmpDshTavern: { ...next.ext.pmpDshTavern,
    branchHeads: remembered.filter(value => value.branchVariantId !== leaf.variant.id && value.variantId !== leaf.variant.id),
  } }
  return { timeline: head ? timelineWithHead(next, head) : next, changed: true }
}

function recordedEndSeq(timeline, sessionId) {
  let end = -1
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId) end = Math.max(end, variant.endEventId)
    }
  }
  return Math.max(end, activeVariantEnd(timeline, sessionId))
}

function defaultId(prefix, sessionId, startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return `${prefix}-${startEventId}-${endEventId}-${random}`.slice(0, 200)
}

function messageOriginKind(message) {
  const value = message?.origin?.kind
  if (typeof value === 'string' && value !== '') return value
  return message?.role === 'assistant' ? 'assistant' : message?.role === 'system' ? 'system' : 'user'
}

function isRealUserMessage(message) {
  const origin = messageOriginKind(message)
  return message?.role === 'user' && (origin === 'user' || origin === 'steering')
}

function extendHeadVariant(timeline, sessionId, endEventId) {
  const head = timelineHead(timeline)
  if (head === null || head.sessionId !== sessionId) return { timeline, changed: false }
  let changed = false
  const nodes = (timeline?.nodes ?? []).map(node => {
    if (node.id !== head.nodeId) return node
    const variants = (node.variants ?? []).map(variant => {
      if (variant.id !== head.variantId || variant.sessionId !== sessionId
        || endEventId <= variant.endEventId) return variant
      changed = true
      return { ...variant, endEventId }
    })
    return changed ? { ...node, variants } : node
  })
  return changed ? { timeline: { ...timeline, nodes }, changed } : { timeline, changed }
}

export function appendCompletedTurns(timeline, messageState, sessionId, {
  idFactory = defaultId,
} = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId is required')
  if (messageState?.incompleteTurn === true) return { timeline, added: [], changed: false }
  const repaired = repairStoppedLeaf(timeline, messageState, sessionId)
  timeline = repaired.timeline
  const head = timelineHead(timeline)
  if (head !== null && head.sessionId !== sessionId) return { timeline, added: [], changed: false }
  const boundary = recordedEndSeq(timeline, sessionId)
  const messages = [...(messageState?.messages ?? [])]
    .filter(message => Number.isSafeInteger(message.seq) && message.seq > boundary)
    .sort((left, right) => left.seq - right.seq)
  const added = []
  let nextTimeline = timeline
  let changed = repaired.changed
  let parentVariantId = timelineHead(timeline)?.variantId ?? null
  let user = null
  let assistant = null
  let continuationAssistant = null
  const appendPair = () => {
    if (user === null || assistant === null) return
    const nodeId = idFactory('qa', sessionId, user.seq, assistant.seq)
    const variantId = idFactory('variant', sessionId, user.seq, assistant.seq)
    added.push({
      id: nodeId,
      kind: 'qa',
      displayOverride: null,
      parentVariantId,
      adoptedVariantId: variantId,
      variants: [{
        id: variantId,
        sessionId,
        startEventId: user.seq,
        endEventId: assistant.seq,
        ...(Number.isSafeInteger(messageState.sessionFormatVersion) ? {
          ext: { pmpDshTavern: { sessionFormatVersion: messageState.sessionFormatVersion } },
        } : {}),
      }],
    })
    parentVariantId = variantId
  }
  for (const message of messages) {
    if (isRealUserMessage(message)) {
      if (user !== null && assistant !== null) {
        appendPair()
      }
      if (user === null && continuationAssistant !== null) {
        const extended = extendHeadVariant(nextTimeline, sessionId, continuationAssistant.seq)
        nextTimeline = extended.timeline
        changed ||= extended.changed
        parentVariantId = timelineHead(nextTimeline)?.variantId ?? parentVariantId
      }
      user = message
      assistant = null
      continuationAssistant = null
    } else if (message.role === 'assistant' && user !== null) {
      if(messageState.stoppedRequest?.userEventId!==user.seq)assistant = message
    } else if (message.role === 'assistant') {
      // Context/tool/subagent messages do not open a new QA. A later parent reply
      // extends the active real-user turn, including when DSH persists it in a
      // separate completed host turn.
      continuationAssistant = message
    }
  }
  appendPair()
  if (user === null && continuationAssistant !== null) {
    const extended = extendHeadVariant(nextTimeline, sessionId, continuationAssistant.seq)
    nextTimeline = extended.timeline
    changed ||= extended.changed
  }
  if (added.length === 0) return { timeline: nextTimeline, added, changed }
  const tail = added.at(-1)
  const variant = tail.variants[0]
  return {
    timeline: timelineWithHead({
      ...nextTimeline,
      nodes: [...nextTimeline.nodes, ...added],
    }, { sessionId, nodeId: tail.id, variantId: variant.id }),
    added,
    changed: true,
  }
}

export function createTurnReconciler(client) {
  if (client == null) throw new TypeError('playClient.required')
  let pending = Promise.resolve()
  return function reconcile(sessionId, playthrough) {
    const task = pending.then(async () => {
      const messages = await client.getMessages(sessionId)
      if (messages.incompleteTurn) return { timeline: null, added: [], changed: false }
      const initial = await client.getTimeline(playthrough)
      const initialResult = appendCompletedTurns(initial, messages, sessionId)
      if (!initialResult.changed) return initialResult
      let added = initialResult.added
      let changed = initialResult.changed
      const timeline = await updateTimeline(client, playthrough, current => {
        const next = appendCompletedTurns(current, messages, sessionId)
        added = next.added
        changed = next.changed
        return next.timeline
      }, { initial })
      return { timeline, added, changed }
    })
    pending = task.catch(() => {})
    return task
  }
}
