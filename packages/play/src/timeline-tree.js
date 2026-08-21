function adoptedVariant(node) {
  return node?.variants?.find(variant => variant.id === node.adoptedVariantId) ?? null
}

export function isTreeTimeline(timeline) {
  return timeline?.head !== undefined
    || (timeline?.nodes ?? []).some(node => Object.hasOwn(node, 'parentVariantId'))
}

export function legacyTimelineHead(timeline) {
  const nodes = timeline?.nodes ?? []
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node.hidden === true) continue
    const variant = adoptedVariant(node)
    if (variant !== null) {
      return { sessionId: variant.sessionId, nodeId: node.id, variantId: variant.id }
    }
  }
  return null
}

export function timelineHead(timeline) {
  const head = timeline?.head
  if (head !== undefined && head !== null) return head
  return legacyTimelineHead(timeline)
}

export function activeTimelineEntries(timeline) {
  const nodes = timeline?.nodes ?? []
  if (!isTreeTimeline(timeline)) {
    return nodes.map(node => ({ node, variant: adoptedVariant(node) }))
      .filter(entry => entry.variant !== null)
  }
  const head = timelineHead(timeline)
  if (head === null) return []
  const variants = new Map()
  for (const [index, node] of nodes.entries()) {
    for (const variant of node.variants ?? []) variants.set(variant.id, { node, variant, index })
  }
  const reversed = []
  const visited = new Set()
  let variantId = head.variantId
  while (variantId !== null) {
    if (visited.has(variantId)) throw new TypeError('timeline branch contains a cycle')
    visited.add(variantId)
    const entry = variants.get(variantId)
    if (entry === undefined) throw new TypeError(`Unknown active variant ${variantId}`)
    reversed.push({ node: entry.node, variant: entry.variant })
    if (Object.hasOwn(entry.node, 'parentVariantId')) {
      variantId = entry.node.parentVariantId
    } else {
      const previous = nodes[entry.index - 1]
      variantId = adoptedVariant(previous)?.id ?? null
    }
  }
  return reversed.reverse()
}

export function activeTimelineNodes(timeline) {
  return activeTimelineEntries(timeline).map(({ node, variant }) => ({
    ...node,
    adoptedVariantId: variant.id,
  }))
}

export function timelineWithHead(timeline, head) {
  if (head === null) {
    const { head: _discarded, ...rest } = timeline
    return rest
  }
  return { ...timeline, head }
}

export function activeVariantEnd(timeline, sessionId) {
  const head = timelineHead(timeline)
  if (head === null || head.sessionId !== sessionId) return -1
  const entry = activeTimelineEntries(timeline).at(-1)
  return entry?.variant?.endEventId ?? -1
}
