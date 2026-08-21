import { updateTimeline } from './mutations.js'
import {
  activeVariantEnd,
  timelineHead,
  timelineWithHead,
} from '../../../play/src/timeline-tree.js'

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

export function appendCompletedTurns(timeline, messageState, sessionId, {
  idFactory = defaultId,
} = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId is required')
  if (messageState?.incompleteTurn === true) return { timeline, added: [] }
  const boundary = recordedEndSeq(timeline, sessionId)
  const messages = [...(messageState?.messages ?? [])]
    .filter(message => Number.isSafeInteger(message.seq) && message.seq > boundary)
    .sort((left, right) => left.seq - right.seq)
  const added = []
  let parentVariantId = timelineHead(timeline)?.variantId ?? null
  let user = null
  let assistant = null
  const appendPair = () => {
    if (user === null || assistant === null) return
    const nodeId = idFactory('qa', sessionId, user.seq, assistant.seq)
    const variantId = idFactory('variant', sessionId, user.seq, assistant.seq)
    added.push({
      id: nodeId,
      kind: 'qa',
      hidden: false,
      displayOverride: null,
      parentVariantId,
      adoptedVariantId: variantId,
      variants: [{
        id: variantId,
        sessionId,
        startEventId: user.seq,
        endEventId: assistant.seq,
      }],
    })
    parentVariantId = variantId
  }
  for (const message of messages) {
    if (message.role === 'user') {
      if (user === null) {
        user = message
      } else if (assistant !== null) {
        appendPair()
        user = message
        assistant = null
      }
      // DSH records model-visible runtime context with role=user and origin=context.
      // It stays in the authoritative range but the RP renderer uses origin rather
      // than presenting it as a human message.
    } else if (message.role === 'assistant' && user !== null) {
      assistant = message
    }
  }
  appendPair()
  if (added.length === 0) return { timeline, added }
  const tail = added.at(-1)
  const variant = tail.variants[0]
  return {
    timeline: timelineWithHead({
      ...timeline,
      nodes: [...timeline.nodes, ...added],
    }, { sessionId, nodeId: tail.id, variantId: variant.id }),
    added,
  }
}

export function createTurnReconciler(client) {
  if (client == null) throw new TypeError('playClient.required')
  let pending = Promise.resolve()
  return function reconcile(sessionId, playthrough) {
    const task = pending.then(async () => {
      const messages = await client.getMessages(sessionId)
      if (messages.incompleteTurn) return { timeline: null, added: [] }
      const initial = await client.getTimeline(playthrough)
      const initialResult = appendCompletedTurns(initial, messages, sessionId)
      if (initialResult.added.length === 0) return initialResult
      let added = initialResult.added
      const timeline = await updateTimeline(client, playthrough, current => {
        const next = appendCompletedTurns(current, messages, sessionId)
        added = next.added
        return next.timeline
      }, { initial })
      return { timeline, added }
    })
    pending = task.catch(() => {})
    return task
  }
}
