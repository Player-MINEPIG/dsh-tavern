function recordedEndSeq(timeline, sessionId) {
  let end = -1
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId) end = Math.max(end, variant.endEventId)
    }
  }
  return end
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
      adoptedVariantId: variantId,
      variants: [{
        id: variantId,
        sessionId,
        startEventId: user.seq,
        endEventId: assistant.seq,
      }],
    })
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
      // DSH can append model-visible runtime context as another user message
      // between the real user input and the assistant. It belongs to the same
      // turn range; the first user message remains the visible prompt.
    } else if (message.role === 'assistant' && user !== null) {
      assistant = message
    }
  }
  appendPair()
  if (added.length === 0) return { timeline, added }
  return { timeline: { ...timeline, nodes: [...timeline.nodes, ...added] }, added }
}

export function createTurnReconciler(client) {
  if (client == null) throw new TypeError('playClient.required')
  let pending = Promise.resolve()
  return function reconcile(sessionId, playthrough) {
    const task = pending.then(async () => {
      const messages = await client.getMessages(sessionId)
      if (messages.incompleteTurn) return { timeline: null, added: [] }
      const timeline = await client.getTimeline(playthrough)
      const next = appendCompletedTurns(timeline, messages, sessionId)
      if (next.added.length === 0) return next
      await client.putTimeline(playthrough, next.timeline)
      return next
    })
    pending = task.catch(() => {})
    return task
  }
}
