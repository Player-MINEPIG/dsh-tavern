import { createHash } from 'node:crypto'

const bytes = value => Buffer.byteLength(JSON.stringify(value))
function snapshotId(ids, content) {
  const hex = createHash('sha256').update(JSON.stringify([ids, content])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Lower ordered source contributions to DSH's complete system snapshots.
 * Native systems replace only the native base. Source systems add in order for
 * the rest of this request. Only adjacent systems coalesce; no conversation
 * message moves or changes. Logical retention has already been resolved.
 */
export function projectSystemSnapshots(assembly, nativeMessages, maxBytes = 2 * 1024 * 1024, { systemPromptUpdate, preview = false } = {}) {
  const native = new Map(nativeMessages.map(m => [m.id, m]))
  let parts = [], pending = [], extraBytes = 0
  const messages = [], projections = [], indices = new Map()
  function append(message, inputIds, nativeBytes = 0) {
    extraBytes += Math.max(0, bytes(message) - nativeBytes)
    if (extraBytes > maxBytes) throw Object.assign(new Error(`System snapshot projection exceeds ${maxBytes} additional bytes`), { status: 413 })
    for (const id of inputIds) indices.set(id, messages.length)
    messages.push(message)
  }
  function flush() {
    if (!pending.length) return
    const last = pending.at(-1), inputIds = pending.map(m => m.id)
    const content = [{ type: 'text', text: parts.map(part => part.text).filter(Boolean).join('\n\n') }]
    const projected = JSON.stringify(content) === JSON.stringify(last.content) ? last : { ...last, id: snapshotId(inputIds, content), content }
    const base = parts.find(part => part.native && inputIds.includes(part.id))
    projections.push({ index: messages.length, inputIds, messageId: projected.id, contributorIds: parts.map(part => part.id),
      replacedNativeIds: inputIds.filter(id => native.get(id)?.role === 'system' && !parts.some(part => part.id === id)) })
    append(projected, inputIds, base ? bytes(native.get(base.id)) : 0)
    pending = []
  }
  for (const message of assembly.messages) {
    if (message.role !== 'system') {
      flush(); append(message, [message.id], native.has(message.id) ? bytes(native.get(message.id)) : 0); continue
    }
    if (message.content.some(b => b.type !== 'text')) throw new TypeError('System snapshot projection requires text-only system messages')
    const replacement = native.get(message.id)?.role === 'system'
    const part = { id: message.id, native: replacement, text: message.content.map(b => b.text).join('') }
    const baseIndex = replacement ? parts.findIndex(part => part.native) : -1
    if (baseIndex < 0) parts.push(part)
    else parts[baseIndex] = part
    pending.push(message)
  }
  flush()
  const hasUpdates = projections.some(p => p.index > 0)
  if (hasUpdates && !preview && systemPromptUpdate !== 'in-history') throw Object.assign(new Error('The selected model cannot preserve in-history system instructions. Use a model with system prompt updates, or place system contributions before the conversation.'), { code: 'ASSEMBLY_SYSTEM_UPDATES_UNSUPPORTED', status: 409 })
  return { ...assembly, messages, extraBytes,
    diagnostics: [...(assembly.diagnostics ?? []), ...(preview && hasUpdates ? [{ code: 'SYSTEM_UPDATE_CAPABILITY_UNVERIFIED' }] : [])],
    nodes: assembly.nodes.map(node => {
      const inputIds = node.requestMessageIds ?? assembly.messages.slice(node.start, node.start + node.count).map(m => m.id)
      const positions = [...new Set(inputIds.map(id => indices.get(id)))].filter(index => index !== undefined)
      return { ...node, start: positions[0] ?? -1, count: positions.length, requestMessageIds: positions.map(index => messages[index].id) }
    }),
    systemProjection: { version: 1, semantics: 'complete-snapshots', capability: preview ? 'unverified' : systemPromptUpdate ?? 'leading-only', messages: projections },
  }
}
