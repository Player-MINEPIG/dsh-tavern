import { actualAssemblyResult } from 'dsh-prompt-assembler/actual-result'

// v3 detail has already verified the durable request. Never use the latest
// /actual endpoint or a current preview to fill a historical record.
export function recordedRequestResult(record) {
  const request = record.requestAssembly ?? record.nativeRequest
  if (!Array.isArray(request?.messages)
    || record.requestContentStatus && record.requestContentStatus !== 'available'
    || request.metadata?.assembly?.preview
    || record.requestAssembly && (request.turn !== record.turn || request.step !== record.step)) return null
  const metadata = { ...request.metadata }
  if (!metadata.assembly && record.nativeProvenance) metadata.assembly = record.nativeProvenance
  return actualAssemblyResult({ ...request, metadata })
}

// Associate only recorded message coordinates or snapshot contributor IDs.
// A later complete system snapshot includes earlier contributions as well.
export function recordedMessageNodes(result, message, index) {
  const hasId = typeof message.id === 'string'
  const projection = result.systemProjection?.version === 1
    && result.systemProjection.semantics === 'complete-snapshots'
    ? result.systemProjection.messages?.find(item => hasId && item.messageId === message.id && item.index === index) : null
  return result.nodes.filter(node => (hasId && node.reference?.messageId === message.id)
    || node.messageIndex === index
    || (hasId && node.requestMessageIds?.includes(message.id))
    || (hasId && node.messages?.some(item => item.id === message.id))
    || (projection && node.inputMessageIds?.some(id => projection.contributorIds?.includes(id))))
}

export function recordedSystemModules(result, message, index) {
  // Filtering may change final system bytes without updating module bodies.
  if (result.historyPolicy?.decisions?.some(item => item.messageId === message.id && item.action !== 'keep')) return []
  return recordedMessageNodes(result, message, index)
}
