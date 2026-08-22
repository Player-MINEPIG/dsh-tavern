import { nextPlaythroughNumber } from './create.js'
import { updateCatalog } from './mutations.js'
import { playthroughCharacterId } from './schema.js'
import { activeTimelineEntries } from '../../../play/src/timeline-tree.js'

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

function safeSegment(value, label) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`)
  }
  return value
}

function safeSessionId(value) {
  if (typeof value !== 'string' || !SAFE_SESSION_ID.test(value)) {
    throw new TypeError('session.id must be a valid DSH session id')
  }
  return value
}

function nodeById(timeline, nodeId) {
  const index = timeline.nodes.findIndex(node => node.id === nodeId)
  if (index < 0) throw new TypeError(`Unknown timeline node ${nodeId}`)
  return { index, node: timeline.nodes[index] }
}

function forkedTimeline(source, nodeIndex, adoptedId, sessionId) {
  const entries = activeTimelineEntries(source)
  const activeIndex = entries.findIndex(entry => entry.node.id === source.nodes[nodeIndex].id)
  if (activeIndex < 0) throw new TypeError('Fork target is not on the active timeline branch')
  let parentVariantId = null
  const nodes = entries.slice(0, activeIndex + 1).map(({ node, variant }) => {
    const copy = {
      ...node,
      parentVariantId,
      adoptedVariantId: variant.id,
      variants: node.variants.map(item => item.id === adoptedId
        ? { ...item, sessionId }
        : { ...item }),
    }
    parentVariantId = variant.id
    return copy
  })
  return {
    ...source,
    nodes,
    head: { sessionId, nodeId: nodes.at(-1).id, variantId: adoptedId },
  }
}

function inheritedRangeExists(messages, variant) {
  const values = messages?.messages ?? []
  const user = values.some(message => message.role === 'user'
    && Number.isSafeInteger(message.seq)
    && message.seq >= variant.startEventId
    && message.seq <= variant.endEventId)
  const assistant = values.some(message => message.role === 'assistant'
    && message.seq === variant.endEventId)
  return messages?.incompleteTurn !== true && user && assistant
}

export async function branchPlaythroughAtNode(client, { playthrough, nodeId } = {}) {
  if (client == null) throw new TypeError('playClient.required')
  const source = await client.getTimeline(playthrough)
  const { index, node } = nodeById(source, nodeId)
  const active = activeTimelineEntries(source).find(entry => entry.node.id === nodeId)
  if (active === undefined) throw new TypeError('Branch target is not on the active timeline branch')
  const adopted = active.variant
  const branch = await client.postBranch(adopted.sessionId, adopted.endEventId)
  const sessionId = safeSessionId(branch?.sessionId)
  const inherited = await client.getMessages(sessionId)
  if (!inheritedRangeExists(inherited, adopted)) {
    throw new Error('Forked session does not contain the adopted reply range')
  }
  return { source, index, node, adopted, sessionId, inherited }
}

export async function forkPlaythroughAtNode(client, {
  playthrough,
  nodeId,
  now = () => new Date(),
  randomUUID = () => globalThis.crypto.randomUUID(),
} = {}) {
  if (client == null) throw new TypeError('playClient.required')
  const characterId = safeSegment(playthroughCharacterId(playthrough), 'character.id')
  const { source, index, node, adopted, sessionId } = await branchPlaythroughAtNode(client, { playthrough, nodeId })

  const value = now()
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) throw new TypeError('now must return a valid Date')
  const playthroughId = safeSegment(`playthrough-${randomUUID()}`, 'playthrough.id')
  const directory = `${characterId}/${playthroughId}`
  const path = `${directory}/timeline.json`
  const timeline = forkedTimeline(source, index, adopted.id, sessionId)
  const draft = {
    id: playthroughId,
    path,
    title: '周目',
    lastOpenedAt: value.toISOString(),
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId,
        playthroughNumber: 0,
      },
    },
  }

  await client.createDirs(directory)
  await client.putTimeline(draft, timeline)
  let saved
  const catalog = await updateCatalog(client, fresh => {
    const existing = fresh.playthroughs.find(item => item.id === playthroughId && item.path === path)
    if (existing !== undefined) {
      if (existing.ext?.pmpDshTavern?.rootSessionId !== sessionId) {
        throw new Error('playthrough.fork.identityConflict')
      }
      saved = existing
      return fresh
    }
    const playthroughNumber = nextPlaythroughNumber(fresh, characterId)
    saved = {
      ...draft,
      title: `${playthroughNumber}周目`,
      ext: {
        ...draft.ext,
        pmpDshTavern: { ...draft.ext.pmpDshTavern, playthroughNumber },
      },
    }
    return { ...fresh, playthroughs: [...fresh.playthroughs, saved] }
  })
  saved ??= catalog?.playthroughs?.find(item => item.id === playthroughId && item.path === path)
  const focus = await client.getFocus(saved ?? draft)
  if (focus.sessionId !== sessionId || focus.nodeId !== node.id || focus.variantId !== adopted.id) {
    throw new Error('Forked playthrough focus verification failed')
  }
  return { sessionId, playthrough: saved ?? draft, timeline }
}
