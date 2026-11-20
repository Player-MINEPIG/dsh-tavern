import { variantFormatVersion } from '../../../play/src/session-coordinates.js'
import { creationRequest } from './creation-request.js'
import { activeTimelineEntries } from '../../../play/src/timeline-tree.js'

const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/

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
  const branch = await client.postBranch(adopted.sessionId, adopted.endEventId, variantFormatVersion(adopted))
  const sessionId = safeSessionId(branch?.sessionId)
  const inherited = await client.getMessages(sessionId)
  if (!inheritedRangeExists(inherited, adopted)) {
    throw new Error('Forked session does not contain the adopted reply range')
  }
  return { source, index, node, adopted, sessionId, inherited }
}

export async function forkPlaythroughAtNode(client, { playthrough, nodeId, variantId, creationId } = {}) {
  if (typeof client?.forkPlaythrough !== 'function') {
    throw Object.assign(new Error('This client requires the Host forkPlaythrough API to create a recoverable branch.'), { code: 'PLAY_CREATION_UNAVAILABLE' })
  }
  return creationRequest(client, ['fork', playthrough.id, playthrough.path, nodeId, variantId], creationId,
    (identity, options) => client.forkPlaythrough(playthrough, { nodeId, ...(variantId === undefined ? {} : { variantId }), ...identity }, options))
}
