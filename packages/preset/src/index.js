import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { PresetStore } from './store.js'
import { installServerRoutes } from './server.js'

export const name = 'dsh-tavern'
export const inject = ['systemPrompt']

const DEFAULT_STORAGE_DIR = fileURLToPath(new URL('../../../data', import.meta.url))

export function apply(ctx, config = {}) {
  const storageDir = resolve(config.storageDir ?? DEFAULT_STORAGE_DIR)
  const store = new PresetStore(storageDir)
  const notifyChange = () => ctx.emit('system-prompt/change')

  ctx.systemPrompt.section({
    name: 'dsh-tavern:selected-preset',
    order: 10,
    text: () => store.compiledSelected(),
  })

  ctx.on('agent/request', async (_payload, next) => ({
    ...await next(),
    ...store.selectedCallConfig(),
  }))

  if (ctx.get('webServer') !== undefined) {
    ctx.effect(() => installServerRoutes(ctx, store, notifyChange), 'dsh-tavern: HTTP preset API')
  }

  ctx.logger.info(`dsh-tavern: prompt presets ready (${storageDir})`)
  return store
}

export { PresetStore } from './store.js'
export { createApiHandler } from './server.js'

