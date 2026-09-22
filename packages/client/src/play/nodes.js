import { beginPendingSwipe, finishPendingSwipe, pendingSwipeTimeline } from './pending-swipe.js'
import { updateTimeline } from './mutations.js'
import {
  branchPlaythroughAtNode,
  forkPlaythroughAtNode,
} from './fork.js'
import {
  activeTimelineEntries,
  timelineHeadForVariant,
  timelineWithHead,
} from '../../../play/src/timeline-tree.js'

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

function messageOriginKind(message) {
  const kind = message?.origin?.kind
  if (typeof kind === 'string' && kind !== '') return kind
  return message?.role === 'user' ? 'user' : message?.role
}

function completedPairAfter(messageState, eventId) {
  if (messageState?.incompleteTurn === true) return null
  const messages = (messageState?.messages ?? [])
    .filter(message => Number.isSafeInteger(message.seq) && message.seq > eventId)
    .sort((left, right) => left.seq - right.seq)
  const user = messages.find(message => message.role === 'user'
    && (messageOriginKind(message) === 'user' || messageOriginKind(message) === 'steering'))
  if (user === undefined) return null
  const assistant = [...messages].reverse().find(message => message.role === 'assistant' && message.seq > user.seq)
  return assistant === undefined ? null : { user, assistant, sessionFormatVersion: messageState.sessionFormatVersion }
}

async function createRootSwipeSession(client, sourceSessionId) {
  const binding = typeof client.getImportContextBinding === 'function'
    ? await client.getImportContextBinding(sourceSessionId)
    : null
  const importContextRef = typeof binding?.path === 'string' && binding.path !== ''
    ? { path: binding.path }
    : undefined
  return client.postSession(sourceSessionId, importContextRef)
}

export function createPlayNodeController(client, {
  delay = defaultDelay,
  pollInterval = 500,
  maxPolls = 240,
  idFactory = defaultId,
} = {}) {
  if (client == null) throw new TypeError('playClient.required')
  // Long-running branch operations are isolated per playthrough. Metadata writes
  // use a separate short queue, so they can finish while a swipe is streaming.
  const operations = new Map()
  const writes = new Map()
  const key = playthrough => JSON.stringify([playthrough?.id ?? null, playthrough?.path ?? null])
  const enqueue = (queue, playthrough, operation) => {
    const id = key(playthrough)
    const task = (queue.get(id) ?? Promise.resolve()).then(operation)
    const settled = task.catch(() => {}).finally(() => {
      if (queue.get(id) === settled) queue.delete(id)
    })
    queue.set(id, settled)
    return task
  }
  const schedule = (playthrough, operation) => enqueue(operations, playthrough, operation)
  const writeTimeline = (playthrough, transform) => enqueue(writes, playthrough,
    () => updateTimeline(client, playthrough, transform))

  const update = (playthrough, nodeId, transform) => writeTimeline(playthrough, timeline => {
    const { index, node } = nodeById(timeline, nodeId)
    return replaceNode(timeline, index, transform(node))
  })

  return {
    setDisplayOverride(playthrough, nodeId, value) {
      if (value !== null && typeof value !== 'string') {
        throw new TypeError('displayOverride must be a string or null')
      }
      return update(playthrough, nodeId, node => ({ ...node, displayOverride: value }))
    },

    adoptVariant(playthrough, nodeId, variantId) {
      if (typeof variantId !== 'string' || variantId === '') throw new TypeError('variantId is required')
      return schedule(playthrough, async () => {
        const next = await writeTimeline(playthrough, timeline => {
          const { index, node } = nodeById(timeline, nodeId)
          const variant = node.variants.find(item => item.id === variantId)
          if (variant === undefined) throw new TypeError(`Unknown variant ${variantId}`)
          const head = timelineHeadForVariant(timeline, variantId) ?? {
            sessionId: variant.sessionId,
            nodeId: node.id,
            variantId: variant.id,
          }
          return timelineWithHead(
            replaceNode(timeline, index, { ...node, adoptedVariantId: variantId }),
            head,
          )
        })
        const focus = await client.getFocus(playthrough)
        if (focus.sessionId !== next.head?.sessionId
          || focus.nodeId !== next.head?.nodeId
          || focus.variantId !== next.head?.variantId) {
          throw new Error('Saved variant does not match derived focus')
        }
        return { timeline: next, sessionId: focus.sessionId }
      })
    },
    createReplySwipe(playthrough, nodeId, { onStarted } = {}) {
      return schedule(playthrough, async () => {
        const timeline = await client.getTimeline(playthrough)
        const entries = activeTimelineEntries(timeline)
        const requestedIndex = entries.findIndex(entry => entry.node.id === nodeId)
        if (requestedIndex < 0) throw new TypeError(`Unknown active timeline node ${nodeId}`)
        let sourceNode = null
        let sourceIndex = -1
        let adopted = null
        let source = null
        let user
        for (let index = requestedIndex; index >= 0; index -= 1) {
          const candidate = entries[index]
          const messages = await client.getMessages(candidate.variant.sessionId)
          const reusable = messages.messages.find(message => message.role === 'user'
            && (messageOriginKind(message) === 'user' || messageOriginKind(message) === 'steering')
            && message.seq >= candidate.variant.startEventId
            && message.seq <= candidate.variant.endEventId)
          if (reusable !== undefined && typeof reusable.text === 'string' && reusable.text !== '') {
            sourceNode = candidate.node
            sourceIndex = index
            adopted = candidate.variant
            source = messages
            user = reusable
            break
          }
        }
        if (sourceNode === null || adopted === null || source === null
          || user === undefined || typeof user.text !== 'string' || user.text === '') {
          throw new TypeError('Active branch has no reusable user message')
        }
        const parent = sourceIndex > 0 ? entries[sourceIndex - 1] : null
        const forkEventId = parent?.variant.endEventId ?? -1
        const branch = parent === null
          ? await createRootSwipeSession(client, adopted.sessionId)
          : await client.postBranch(adopted.sessionId, forkEventId)
        const newSessionId = branch?.sessionId
        if (typeof newSessionId !== 'string' || newSessionId === '') {
          throw new TypeError('Branch response has no sessionId')
        }
        const pending = beginPendingSwipe(client, {
          playthrough, sessionId: newSessionId, sourceSessionId: adopted.sessionId, nodeId: sourceNode.id,
          timeline: pendingSwipeTimeline(timeline, entries, sourceIndex, newSessionId),
        })
        try {
          onStarted?.({ sessionId: newSessionId, nodeId: sourceNode.id })
          await client.postUserMessage(newSessionId, user.text)

          let pair = null
          let sawOpenTurn = false
          for (let attempt = 0; attempt < maxPolls; attempt += 1) {
            const messages = await client.getMessages(newSessionId)
            pair = completedPairAfter(messages, forkEventId)
            if (sawOpenTurn && messages.incompleteTurn === false && pair === null) {
              throw new Error('Swipe stopped without a saved assistant reply')
            }
            sawOpenTurn ||= messages.incompleteTurn === true
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
            ...(Number.isSafeInteger(pair.sessionFormatVersion) ? {
              ext: { pmpDshTavern: { sessionFormatVersion: pair.sessionFormatVersion } },
            } : {}),
          }
          const next = await writeTimeline(playthrough, timeline => {
            const current = nodeById(timeline, sourceNode.id)
            const existing = current.node.variants.find(item => item.id === variantId)
            if (existing !== undefined) {
              return timelineWithHead(
                replaceNode(timeline, current.index, { ...current.node, adoptedVariantId: variantId }),
                { sessionId: existing.sessionId, nodeId: current.node.id, variantId },
              )
            }
            return timelineWithHead(
              replaceNode(timeline, current.index, {
                ...current.node,
                adoptedVariantId: variantId,
                variants: [...current.node.variants, variant],
              }),
              { sessionId: newSessionId, nodeId: current.node.id, variantId },
            )
          })
          const focus = await client.getFocus(playthrough)
          if (focus.sessionId !== newSessionId) throw new Error('Saved swipe does not match derived focus')
          finishPendingSwipe(client, pending)
          return { timeline: next, sessionId: newSessionId, nodeId: sourceNode.id, variantId }
        } catch (error) {
          finishPendingSwipe(client, pending, error)
          throw error
        }
      })
    },

    forkPlaythrough(playthrough, nodeId) {
      return schedule(playthrough, () => forkPlaythroughAtNode(client, { playthrough, nodeId }))
    },

    rollbackPlaythrough(playthrough, nodeId) {
      return schedule(playthrough, async () => {
        const branch = await branchPlaythroughAtNode(client, { playthrough, nodeId })
        const next = await writeTimeline(playthrough, timeline => {
          const current = nodeById(timeline, nodeId)
          const variant = current.node.variants.find(item => item.id === branch.adopted.id)
          if (variant === undefined) throw new Error('Rollback target changed before commit')
          return timelineWithHead(
            replaceNode(timeline, current.index, {
              ...current.node,
              adoptedVariantId: variant.id,
            }),
            { sessionId: branch.sessionId, nodeId: current.node.id, variantId: variant.id },
          )
        })
        const focus = await client.getFocus(playthrough)
        if (focus.sessionId !== branch.sessionId
          || focus.nodeId !== nodeId
          || focus.variantId !== branch.adopted.id) {
          throw new Error('Rollback focus verification failed')
        }
        return { timeline: next, sessionId: branch.sessionId }
      })
    },

  }
}
