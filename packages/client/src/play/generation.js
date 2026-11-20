import { runGenerationOperation } from './generation-recovery.js'
import { activeTimelineEntries } from '../../../play/src/timeline-tree.js'
import { beginPendingSwipe, finishPendingSwipe, pendingSwipe, pendingSwipeTimeline } from './pending-swipe.js'

export function supportsGenerationRecovery(client) {
  return typeof client?.getCheckpoint === 'function' || typeof client?.generation === 'function'
}

function generation(client, row, body, timeline) {
  return typeof client.generation === 'function' ? client.generation(row, body, timeline) : runGenerationOperation(client, row, body)
}

function requestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
}

function project(client, playthrough, timeline, entry, expectedWorkspaceScope, restored = false) {
  const previous = pendingSwipe(client, playthrough)
  if (previous?.operationKey === entry.operationKey && previous.expectedWorkspaceScope === expectedWorkspaceScope) return previous
  return beginPendingSwipe(client, { ...entry, playthrough, expectedWorkspaceScope, restored,
    timeline: pendingSwipeTimeline(timeline, activeTimelineEntries(timeline), entry.sourceIndex, entry.sessionId) })
}

function call(client, pending, action) {
  return generation(client, pending.playthrough, { action, operationKey: pending.operationKey, expectedWorkspaceScope: pending.expectedWorkspaceScope })
}

function statusError(status) {
  const message = status.state === 'stopped'
    ? 'Generation stopped without a saved assistant reply.'
    : 'Generation needs verification. Open Repair playthrough. Operation ' + status.pending.operationKey
  return Object.assign(new Error(message), { code: status.code ?? 'PLAY_GENERATION_PENDING' })
}

async function complete(client, pending) {
  const result = await call(client, pending, 'finish')
  finishPendingSwipe(client, pending)
  return result
}

export async function recoverDurableGeneration(client, pending) {
  const status = await call(client, pending, 'status')
  if (status.state === 'ready' || status.state === 'done') return complete(client, pending)
  if (status.state === 'stopped') {
    try { await complete(client, pending) }
    catch (error) { if (pending.error !== error.message) finishPendingSwipe(client, pending, error) }
  } else if (status.state === 'uncertain') {
    const error = statusError(status)
    if (pending.error !== error.message) finishPendingSwipe(client, pending, error)
  } else if (pending.restored) pending.error = null
  return null
}

// Restore navigation from the backend checkpoint even after the client map was lost.
// Session classification may inspect several playthroughs. Only the matching child
// (or a row explicitly opened by the user) can finish a verified reply.
export async function restorePendingGeneration(client, playthrough, timeline, { sessionId, expectedWorkspaceScope } = {}) {
  if (!supportsGenerationRecovery(client)) return null
  if (!expectedWorkspaceScope) {
    const workspace = await client.getWorkspace()
    expectedWorkspaceScope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
  }
  const status = await generation(client, playthrough, { action: 'status', expectedWorkspaceScope })
  if (!status.pending) {
    const prior = pendingSwipe(client, playthrough)
    if (prior?.operationKey && prior.expectedWorkspaceScope === expectedWorkspaceScope && (!sessionId || prior.sessionId === sessionId)) finishPendingSwipe(client, prior)
    return null
  }
  const entry = status.pending
  if (!entry.sessionId || (sessionId && entry.sessionId !== sessionId)) return null
  const pending = project(client, playthrough, timeline, entry, expectedWorkspaceScope, true)
  if (status.state === 'ready') return complete(client, pending)
  if (status.state === 'stopped') {
    try { await complete(client, pending) } catch (error) { finishPendingSwipe(client, pending, error) }
  } else if (status.state === 'uncertain' && !pending.error) {
    finishPendingSwipe(client, pending, statusError(status))
  }
  return pending
}

export async function runGeneration(client, playthrough, request, { onStarted, delay, pollInterval, maxPolls }) {
  const workspace = await client.getWorkspace()
  const scope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
  const timeline = await client.getTimeline(playthrough)
  const started = await generation(client, playthrough, { ...request, action: 'start', operationKey: requestKey(), expectedWorkspaceScope: scope }, timeline)
  const pending = project(client, playthrough, timeline, started, scope)
  try {
    onStarted?.({ sessionId: pending.sessionId, nodeId: pending.nodeId })
    for (let idlePolls = 0; idlePolls < maxPolls;) {
      const status = await call(client, pending, 'status')
      if (status.state === 'ready' || status.state === 'done' || status.state === 'stopped') return await complete(client, pending)
      if (!['busy', 'waiting', 'running'].includes(status.state)) throw statusError(status)
      idlePolls = status.state === 'running' ? 0 : idlePolls + 1
      if (idlePolls < maxPolls) await delay(pollInterval)
    }
    throw new Error('Timed out waiting for the generation. Open Repair playthrough to check the saved request.')
  } catch (error) {
    finishPendingSwipe(client, pending, error)
    throw error
  }
}
