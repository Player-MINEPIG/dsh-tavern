import { actualAssemblyResult } from 'dsh-prompt-assembler/actual-result'
import { isPersonalitySource } from './personality-source.js'

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

const hasPersonalityNode = node => isPersonalitySource(node.source) || node.children?.some(hasPersonalityNode)

/** Consecutive snapshots can carry the same field at different coordinates. */
export function recordedPersonalityPositions(record, result) {
  const rows = new Map()
  function add(source, messageId, role, messageIndex, range, text) {
    const key = JSON.stringify([messageId, source.resourceId, source.field, range?.startUtf16, range?.endUtf16])
    if (!rows.has(key)) rows.set(key, { source, messageId, role, messageIndex, range, text })
  }
  // Historical no-policy traces may verify individual system sections even
  // when the recorder did not retain a digest of the complete request.
  for (const part of record.sections ?? []) {
    const ref = part.reference
    if (part.contentStatus !== 'available' || ref?.kind !== 'system-message' || !ref.range || !ref.messageId
      || part.sources?.length !== 1 || !isPersonalitySource(part.sources[0])) continue
    const index = result?.messages.findIndex(message => message.id === ref.messageId) ?? -1
    if (result && index < 0) continue
    add(part.sources[0], ref.messageId, 'system', index, ref.range, part.text)
  }
  const candidates = result?.nodes.filter(hasPersonalityNode) ?? []
  const fieldResult = candidates.length ? { ...result, nodes: candidates } : null
  for (const [index, message] of (fieldResult?.messages ?? []).entries()) {
    const nodes = message.role === 'system' ? recordedSystemModules(fieldResult, message, index) : recordedMessageNodes(fieldResult, message, index)
    if (!nodes.length) continue
    const content = (message.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('')
    function visit(node) {
      if (isPersonalitySource(node.source) && node.text) {
        const ref = node.reference
        const start = ref?.messageId === message.id ? ref.startUtf16 : content.indexOf(node.text)
        const end = start + node.text.length
        if (start >= 0 && content.slice(start, end) === node.text && (ref?.messageId === message.id
          ? ref.endUtf16 === end : content.indexOf(node.text, start + 1) < 0)) {
          add(node.source, message.id, message.role, index, { startUtf16: start, endUtf16: end }, node.text)
        }
      }
      for (const child of node.children ?? []) visit(child)
    }
    nodes.forEach(visit)
  }
  return [...rows.values()].sort((a, b) => a.messageIndex - b.messageIndex || a.range.startUtf16 - b.range.startUtf16)
}
