import { updateTimeline } from './mutations.js'
import { forkPlaythroughAtNode } from './fork.js'

function nodeById(timeline, nodeId) {
  const index = timeline.nodes.findIndex(node => node.id === nodeId)
  if (index < 0) throw new TypeError(`Unknown timeline node ${nodeId}`)
  return { index, node: timeline.nodes[index] }
}

function replaceNode(timeline, index, node) {
  const nodes = [...timeline.nodes]
  nodes[index] = node
  return { ...timeline, nodes }
}

function defaultDelay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function defaultId(startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? Date.now()
  return ['variant', startEventId, endEventId, random].join('-').slice(0, 200)
}

function completedPairAfter(messageState, eventId) {
  if (messageState?.incompleteTurn === true) return null
  const messages = (messageState?.messages ?? [])
    .filter(message => Number.isSafeInteger(message.seq) && message.seq > eventId)
    .sort((left, right) => left.seq - right.seq)
  const user = messages.find(message => message.role === 'user')
  if (user === undefined) return null
  const assistant = [...messages].reverse().find(message => message.role === 'assistant' && message.seq > user.seq)
  return assistant === undefined ? null : { user, assistant }
}

export function createPlayNodeController(client, {
  delay = defaultDelay,
  pollInterval = 500,
  maxPolls = 240,
  idFactory = defaultId,
} = {}) {
  if (client == null) throw new TypeError('playClient.required')
  let pending = Promise.resolve()

  const schedule = operation => {
    const task = pending.then(operation)
    pending = task.catch(() => {})
    return task
  }

  const update = (playthrough, nodeId, transform) => schedule(async () => {
    return updateTimeline(client, playthrough, timeline => {
      const { index, node } = nodeById(timeline, nodeId)
      return replaceNode(timeline, index, transform(node))
    })
  })

  return {
    setHidden(playthrough, nodeId, hidden) {
      if (typeof hidden !== 'boolean') throw new TypeError('hidden must be a boolean')
      return update(playthrough, nodeId, node => ({ ...node, hidden }))
    },

    setDisplayOverride(playthrough, nodeId, value) {
      if (value !== null && typeof value !== 'string') {
        throw new TypeError('displayOverride must be a string or null')
      }
      return update(playthrough, nodeId, node => ({ ...node, displayOverride: value }))
    },

    adoptVariant(playthrough, nodeId, variantId) {
      if (typeof variantId !== 'string' || variantId === '') throw new TypeError('variantId is required')
      return schedule(async () => {
        const next = await updateTimeline(client, playthrough, timeline => {
          const { index, node } = nodeById(timeline, nodeId)
          const variant = node.variants.find(item => item.id === variantId)
          if (variant === undefined) throw new TypeError(`Unknown variant ${variantId}`)
          return replaceNode(timeline, index, { ...node, adoptedVariantId: variantId })
        })
        const { node } = nodeById(next, nodeId)
        const variant = node.variants.find(item => item.id === variantId)
        const focus = await client.getFocus(playthrough)
        if (focus.sessionId !== variant.sessionId) throw new Error('Saved variant does not match derived focus')
        return { timeline: next, sessionId: variant.sessionId }
      })
    },
    createReplySwipe(playthrough, nodeId) {
      return schedule(async () => {
        const timeline = await client.getTimeline(playthrough)
        const { node } = nodeById(timeline, nodeId)
        const adopted = node.variants.find(item => item.id === node.adoptedVariantId)
        if (adopted === undefined) throw new TypeError('Adopted variant is missing')
        const source = await client.getMessages(adopted.sessionId)
        const user = source.messages.find(message => message.role === 'user'
          && message.seq >= adopted.startEventId
          && message.seq <= adopted.endEventId)
        if (user === undefined || typeof user.text !== 'string' || user.text === '') {
          throw new TypeError('Adopted variant has no reusable user message')
        }
        const forkEventId = Math.max(0, adopted.startEventId - 1)
        const branch = await client.postBranch(adopted.sessionId, forkEventId)
        const newSessionId = branch?.sessionId
        if (typeof newSessionId !== 'string' || newSessionId === '') {
          throw new TypeError('Branch response has no sessionId')
        }
        await client.postUserMessage(newSessionId, user.text)

        let pair = null
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          pair = completedPairAfter(await client.getMessages(newSessionId), forkEventId)
          if (pair !== null) break
          if (attempt + 1 < maxPolls) await delay(pollInterval)
        }
        if (pair === null) throw new Error('Timed out waiting for the swipe reply')

        const variantId = idFactory(pair.user.seq, pair.assistant.seq, newSessionId)
        const variant = {
          id: variantId,
          sessionId: newSessionId,
          startEventId: pair.user.seq,
          endEventId: pair.assistant.seq,
        }
        const next = await updateTimeline(client, playthrough, timeline => {
          const current = nodeById(timeline, nodeId)
          const existing = current.node.variants.find(item => item.id === variantId)
          if (existing !== undefined) {
            return replaceNode(timeline, current.index, { ...current.node, adoptedVariantId: variantId })
          }
          return replaceNode(timeline, current.index, {
            ...current.node,
            adoptedVariantId: variantId,
            variants: [...current.node.variants, variant],
          })
        })
        const focus = await client.getFocus(playthrough)
        if (focus.sessionId !== newSessionId) throw new Error('Saved swipe does not match derived focus')
        return { timeline: next, sessionId: newSessionId, variantId }
      })
    },

    forkPlaythrough(playthrough, nodeId) {
      return schedule(() => forkPlaythroughAtNode(client, { playthrough, nodeId }))
    },

  }
}
