import { apply as applyAssembler } from 'dsh-prompt-assembler/plugin'
import { join } from 'node:path'

export function withIndependentAssembler(ctx, directory, testContext) {
  const read = ctx.get?.bind(ctx)
  const subscribe = ctx.on.bind(ctx)
  const listeners = new Map(), effects = []
  ctx.get = name => Object.hasOwn(ctx, name) ? ctx[name] : read?.(name)
  ctx.provide = (name, value) => { ctx[name] = value }
  ctx.effect = install => {
    const stop = install()
    if (typeof stop === 'function') effects.push(stop)
    return stop
  }
  ctx.on = (name, listener) => {
    const handlers = listeners.get(name) ?? []
    handlers.push(listener)
    listeners.set(name, handlers)
    subscribe(name, (...args) => {
      if (typeof args.at(-1) === 'function') {
        const next = args.pop()
        const dispatch = index => index === handlers.length ? next() : handlers[index](...args, () => dispatch(index + 1))
        return dispatch(0)
      }
      let result
      for (const handler of handlers) result = handler(...args)
      return result
    })
    return () => { const index = handlers.indexOf(listener); if (index !== -1) handlers.splice(index, 1) }
  }
  const assemblerContext = Object.create(ctx)
  assemblerContext.inject = undefined
  applyAssembler(assemblerContext, { storageDir: join(directory, 'independent-assembler') })
  testContext.after(async () => {
    for (const stop of effects.reverse()) await stop()
  })
  return ctx
}
