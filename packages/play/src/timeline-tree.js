function adoptedVariant(node) {
  return node?.variants?.find(variant => variant.id === node.adoptedVariantId) ?? null
}

const EXTENSION_KEY = 'pmpDshTavern'
const BRANCH_HEADS_KEY = 'branchHeads'

function variantEntries(timeline) {
  const entries = new Map()
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      entries.set(variant.id, { node, variant })
    }
  }
  return entries
}

function storedBranchHeads(timeline, variants) {
  const result = new Map()
  const values = timeline?.ext?.[EXTENSION_KEY]?.[BRANCH_HEADS_KEY]
  if (!Array.isArray(values)) return result
  for (const value of values) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
    const branch = variants.get(value.branchVariantId)
    const head = variants.get(value.variantId)
    if (branch === undefined || head === undefined || head.node.id !== value.nodeId
      || head.variant.sessionId !== value.sessionId) continue
    result.set(value.branchVariantId, {
      sessionId: value.sessionId,
      nodeId: value.nodeId,
      variantId: value.variantId,
    })
  }
  return result
}

function headPathContains(timeline, head, variantId) {
  try {
    return activeTimelineEntries({ ...timeline, head })
      .some(entry => entry.variant.id === variantId)
  } catch {
    return false
  }
}

function uniqueLegacyBranchHead(timeline, variantId, variants) {
  let currentId = variantId
  const visited = new Set()
  while (!visited.has(currentId)) {
    visited.add(currentId)
    const children = (timeline?.nodes ?? [])
      .filter(node => node.parentVariantId === currentId)
    if (children.length !== 1) break
    const next = adoptedVariant(children[0])
    if (next === null) break
    currentId = next.id
  }
  const entry = variants.get(currentId)
  return entry === undefined ? null : {
    sessionId: entry.variant.sessionId,
    nodeId: entry.node.id,
    variantId: entry.variant.id,
  }
}

function withRememberedActiveHead(timeline) {
  const head = timelineHead(timeline)
  if (head === null) return timeline
  let active
  try {
    active = activeTimelineEntries(timeline)
  } catch {
    return timeline
  }
  if (active.length === 0) return timeline
  const variants = variantEntries(timeline)
  const remembered = storedBranchHeads(timeline, variants)
  for (const { variant } of active) remembered.set(variant.id, { ...head })
  const branchHeads = [...remembered.entries()].map(([branchVariantId, value]) => ({
    branchVariantId,
    ...value,
  }))
  return {
    ...timeline,
    ext: {
      ...(timeline.ext ?? {}),
      [EXTENSION_KEY]: {
        ...(timeline.ext?.[EXTENSION_KEY] ?? {}),
        [BRANCH_HEADS_KEY]: branchHeads,
      },
    },
  }
}

export function isTreeTimeline(timeline) {
  return timeline?.head !== undefined
    || (timeline?.nodes ?? []).some(node => Object.hasOwn(node, 'parentVariantId'))
}

export function legacyTimelineHead(timeline) {
  const nodes = timeline?.nodes ?? []
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
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
  const remembered = withRememberedActiveHead(timeline)
  if (head === null) {
    const { head: _discarded, ...rest } = remembered
    return rest
  }
  return withRememberedActiveHead({ ...remembered, head })
}

export function timelineHeadForVariant(timeline, variantId) {
  const variants = variantEntries(timeline)
  const target = variants.get(variantId)
  if (target === undefined) return null
  const current = timelineHead(timeline)
  if (current !== null && headPathContains(timeline, current, variantId)) return current
  const stored = storedBranchHeads(timeline, variants).get(variantId)
  if (stored !== undefined && headPathContains(timeline, stored, variantId)) return stored
  return uniqueLegacyBranchHead(timeline, variantId, variants)
}

export function activeVariantEnd(timeline, sessionId) {
  const head = timelineHead(timeline)
  if (head === null || head.sessionId !== sessionId) return -1
  const entry = activeTimelineEntries(timeline).at(-1)
  return entry?.variant?.endEventId ?? -1
}
