// Cordis 4.0.4 publishes creation/disposal before a fiber executes its body.
// Release our child at that boundary so an independently enabled copy can
// register the same services/routes. Never change the independent fiber.
export function installCompanion(ctx, plugin, config, { service } = {}) {
  const owned = new WeakSet()
  const independent = new Set()
  let child, creating = false, disposed = false, transition = Promise.resolve()
  const usable = () => !disposed && ctx.fiber.uid !== null
  const report = error => ctx.logger.error(error)
  const stop = () => {
    if (!child) return transition
    const previous = child
    child = undefined
    const cleanup = previous.dispose()
    transition = Promise.all([transition, cleanup]).then(() => undefined)
    return transition
  }
  const reconcile = async () => {
    await transition
    if (!usable() || independent.size || (service && ctx.get(service))) return
    if (child) return child.await()
    creating = true
    try {
      child = ctx.plugin(plugin, typeof config === 'function' ? config() : config)
    } finally {
      creating = false
    }
    await child
  }
  ctx.effect(() => () => { disposed = true })
  ctx.on('internal/plugin', fiber => {
    if (fiber.runtime?.name !== plugin.name || owned.has(fiber)) return
    if (creating) { owned.add(fiber); return }
    if (fiber.uid !== null) {
      independent.add(fiber)
      // dispose() marks the provider inactive synchronously. Its effects are
      // cleared before Cordis's two startup checkpoints run the new plugin.
      void stop().catch(report)
    } else {
      independent.delete(fiber)
      // The disposal event precedes inertia assignment; wait a microtask
      // before awaiting it, then restore only if no independent owner remains.
      void Promise.resolve().then(() => fiber.await()).then(reconcile).catch(report)
    }
  })
  for (const runtime of ctx.registry.values()) {
    if (runtime.name === plugin.name) {
      for (const fiber of runtime.fibers) if (fiber.uid !== null) independent.add(fiber)
    }
  }
  return reconcile()
}
