import { digest } from '../../prompt-metadata.js'

const textOf = message => (message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('')
const contentHash = message => digest(message.content)
const sourceKeys = ['plugin', 'module', 'sourceId', 'version', 'resourceId', 'field', 'sourceKind', 'section', 'providedBy', 'generationRequiresPlugin', 'recordedContentSurvivesRemoval']
const sourceMetadata = source => Object.fromEntries(sourceKeys.filter(key => source?.[key] !== undefined).map(key => [key, structuredClone(source[key])]))
const uniqueRange = (text, part) => {
  if (!part) return null
  const start = text.indexOf(part)
  return start >= 0 && text.indexOf(part, start + 1) < 0 ? { startUtf16: start, endUtf16: start + part.length } : null
}
function partAnchor(part, messages) {
  const ref = part.reference
  if (part.contentStatus && part.contentStatus !== 'available') return null
  const message = messages.find(m => m.id === ref?.messageId && contentHash(m) === ref.messageHash)
  if (!message) return null
  const range = ref.range ?? (typeof part.text === 'string' ? uniqueRange(textOf(message), part.text) : null)
  if (!range) return null
  const text = textOf(message).slice(range.startUtf16, range.endUtf16)
  if (digest(text) !== part.hash) return null
  return { messageId: message.id, messageHash: contentHash(message), ...range }
}
function nodeReference(node, anchor, text) {
  const children = (node.children ?? []).flatMap(child => {
    const range = uniqueRange(text, child.text)
    return range ? [nodeReference(child, { ...anchor, startUtf16: anchor.startUtf16 + range.startUtf16,
      endUtf16: anchor.startUtf16 + range.endUtf16 }, child.text)] : []
  })
  return { version: 1, id: node.id, name: node.name, module: node.module ?? node.source?.module ?? 'history', ruleId: node.ruleId,
    source: sourceMetadata(node.source), stability: node.stability ?? 'snapshot', depth: node.depth ?? null,
    hash: digest(text), reference: anchor, children, nameRecorded: true }
}

/** Only keep metadata for nodes observed in the frozen native request. */
export function captureNativeSourceReferences(record, observed, messages) {
  if (!observed || digest(observed.messages) !== digest(messages)) return []
  return observed.nodes.flatMap(node => {
    let anchor
    if (node.nativeSectionName) {
      const part = record.sections.find(s => s.name === node.nativeSectionName && s.hash === digest(node.text))
      anchor = part && partAnchor(part, messages)
    } else if (node.nativeMessageId) {
      const message = messages.find(m => m.id === node.nativeMessageId && m.role === node.role && textOf(m) === node.text)
      if (message) anchor = { messageId: message.id, messageHash: contentHash(message), startUtf16: 0, endUtf16: node.text.length }
    } else if (node.nativeContextName) {
      const part = record.contexts.find(s => s.name === node.nativeContextName && s.hash === digest(node.text))
      const message = messages.find(m => m.id === part?.reference?.messageId && contentHash(m) === part.reference.messageHash
        && m.source?.form === 'snapshot' && m.source.sections?.some(s => s.name === node.nativeContextName && s.text === node.text))
      if (message) {
        const range = uniqueRange(textOf(message), node.text)
        if (range) anchor = { messageId: message.id, messageHash: contentHash(message), ...range }
      }
    }
    return anchor ? [nodeReference(node, anchor, node.text)] : []
  })
}
function hydrateNode(stored, messages) {
  if (stored.version !== 1) return null
  const ref = stored.reference
  const message = messages.find(m => m.id === ref?.messageId && contentHash(m) === ref.messageHash)
  if (!message || !Number.isSafeInteger(ref.startUtf16) || !Number.isSafeInteger(ref.endUtf16)
    || ref.startUtf16 < 0 || ref.endUtf16 <= ref.startUtf16 || ref.endUtf16 > textOf(message).length) return null
  const text = textOf(message).slice(ref.startUtf16, ref.endUtf16)
  if (digest(text) !== stored.hash) return null
  return { ...stored, source: sourceMetadata(stored.source), text, role: message.role, lifetime: 'native',
    locked: true, lockReason: 'recorded-request', sourceStatus: stored.nameRecorded ? 'recorded' : 'name-unrecorded',
    children: (stored.children ?? []).map(child => hydrateNode(child, messages)).filter(Boolean) }
}

/** Project only recorded, verified provenance onto immutable request bodies. */
export function nativeRequestProvenance(record, request, { resolveSourceName } = {}) {
  if (!request?.messages || request.metadata?.assembly) return null
  const messages = request.messages
  const candidates = (record.nativeSourceRefs ?? []).map(node => hydrateNode(node, messages)).filter(Boolean)
  // Older records already retain section references and source identifiers.
  // They can supply an identifier, but never a name from today's resource.
  for (const [index, part] of [...record.sections ?? [], ...record.contexts ?? []].entries()) {
    const anchor = partAnchor(part, messages)
    if (!anchor || candidates.some(n => n.reference.messageId === anchor.messageId
      && n.reference.startUtf16 === anchor.startUtf16 && n.reference.endUtf16 === anchor.endUtf16)) continue
    const source = (part.sources ?? []).find(s => s.hash === part.hash)
    const module = source?.module ?? source?.sourceId ?? 'native-section'
    const node = hydrateNode({ version: 1, id: `recorded-section-${index}`, module,
      name: source?.field ? `${module}:${source.field}` : part.name,
      source: source ?? { plugin: 'DSH', field: part.name, sourceKind: 'official-section' },
      nameRecorded: false, hash: part.hash, reference: anchor, children: [], stability: 'snapshot' }, messages)
    if (node) {
      if (!source) node.sourceStatus = 'section-only'
      else if (resolveSourceName) {
        // A current label helps identify an old item; it is never historical evidence.
        let name
        try { name = resolveSourceName(source) } catch {}
        if (typeof name === 'string' && name.trim()) { node.name = name; node.sourceStatus = 'current-name' }
      }
      candidates.push(node)
    }
  }
  const nodes = []
  messages.forEach((message, messageIndex) => {
    const text = textOf(message)
    const known = candidates.filter(node => node.reference.messageId === message.id && node.role === message.role)
      .sort((a, b) => a.reference.startUtf16 - b.reference.startUtf16)
    // Conflicting attribution is not proof: discard both overlapping ranges.
    const disjoint = known.filter((node, index) => !known.some((other, otherIndex) => index !== otherIndex
      && node.reference.startUtf16 < other.reference.endUtf16 && other.reference.startUtf16 < node.reference.endUtf16))
    const fallback = (start, end, whole = false) => {
      const value = text.slice(start, end)
      if (!whole && !value.trim()) return
      const context = message.source?.form === 'snapshot' && (message.source.kind === 'runtime-context'
        || message.source.plugin === '@deepseek-ai/dsh-system-prompt')
      const historicalSystem = message.role === 'system' && message.source?.kind === 'system-prompt'
        && messages.slice(messageIndex + 1).some(later => later.role === 'system' && candidates.some(n => n.reference.messageId === later.id))
      const sourceUnknown = message.role === 'system' || context || message.source?.kind === 'tavern-assembly'
      nodes.push({ id: `actual-${messageIndex}-${start}`, module: 'history',
        name: historicalSystem ? 'historical-system-update' : context && !whole ? 'native-context-framing' : sourceUnknown ? 'source-unrecorded' : message.role,
        role: message.role, text: value, source: { plugin: message.source?.plugin ?? 'DSH', field: message.source?.kind },
        sourceStatus: historicalSystem ? 'historical-system' : sourceUnknown ? 'unrecorded' : 'native', stability: 'snapshot', lifetime: 'native',
        locked: true, lockReason: 'recorded-request', depth: null, messageIndex })
    }
    if (!disjoint.length) { fallback(0, text.length, true); return }
    let offset = 0
    for (const node of disjoint) {
      fallback(offset, node.reference.startUtf16)
      nodes.push({ ...node, id: `${node.id}:${messageIndex}:${node.reference.startUtf16}`, messageIndex })
      offset = node.reference.endUtf16
    }
    fallback(offset, text.length)
  })
  return { backend: 'native', nodes, diagnostics: [], provenance: 'recorded-references' }
}
