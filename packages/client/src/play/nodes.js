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

export function createPlayNodeController(client) {
  if (client == null) throw new TypeError('playClient.required')
  let pending = Promise.resolve()

  const schedule = operation => {
    const task = pending.then(operation)
    pending = task.catch(() => {})
    return task
  }

  const update = (playthrough, nodeId, transform) => schedule(async () => {
    const timeline = await client.getTimeline(playthrough)
    const { index, node } = nodeById(timeline, nodeId)
    const next = replaceNode(timeline, index, transform(node))
    await client.putTimeline(playthrough, next)
    return next
  })

  return {
    setHidden(playthrough, nodeId, hidden) {
      if (typeof hidden !== 'boolean') throw new TypeError('hidden must be a boolean')
      return update(playthrough, nodeId, node => ({ ...node, hidden }))
    },

    setDisplayOverride(playthrough, nodeId, value) {
      if (value !== null && typeof value !== 'string') {
        throw new TypeError('displayOverride must be a string or null')
      }
      return update(playthrough, nodeId, node => ({ ...node, displayOverride: value }))
    },

    adoptVariant(playthrough, nodeId, variantId) {
      if (typeof variantId !== 'string' || variantId === '') throw new TypeError('variantId is required')
      return schedule(async () => {
        const timeline = await client.getTimeline(playthrough)
        const { index, node } = nodeById(timeline, nodeId)
        const variant = node.variants.find(item => item.id === variantId)
        if (variant === undefined) throw new TypeError(`Unknown variant ${variantId}`)
        const next = replaceNode(timeline, index, { ...node, adoptedVariantId: variantId })
        await client.putTimeline(playthrough, next)
        const focus = await client.getFocus(playthrough)
        if (focus.sessionId !== variant.sessionId) throw new Error('Saved variant does not match derived focus')
        return { timeline: next, sessionId: variant.sessionId }
      })
    },
  }
}
