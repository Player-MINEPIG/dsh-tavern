import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  PresetStore,
  createApiHandler as createPresetApiHandler,
  installServerRoutes,
} from '../../preset/src/index.js'
import { PresetRuntime } from './preset-runtime.js'

export const name = 'dsh-tavern'
export const inject = ['systemPrompt']

const DEFAULT_STORAGE_DIR = fileURLToPath(new URL('../../../data', import.meta.url))

export function apply(ctx, config = {}) {
  const storageDir = resolve(config.storageDir ?? DEFAULT_STORAGE_DIR)
  const store = new PresetStore(storageDir)
  const runtime = new PresetRuntime(store)
  const notifyChange = () => ctx.emit('system-prompt/change')

  ctx.systemPrompt.section({
    name: 'dsh-tavern:selected-preset',
    order: 10,
    text: () => runtime.compiledSelected(),
  })

  ctx.on('agent/request', async (_payload, next) => ({
    ...await next(),
    ...runtime.selectedCallConfig(),
  }))

  ctx.on('system-prompt/assemble', async (_payload, _context, next) => {
    const assembly = await next()
    if (runtime.selectedSystemPromptMode() !== 'replace') return assembly
    const text = runtime.compiledSelected()
    return {
      ...assembly,
      sections: text === '' ? [] : [{
        name: 'dsh-tavern:selected-preset',
        order: 10,
        text,
      }],
    }
  })

  if (ctx.get('webServer') !== undefined) {
    ctx.effect(
      () => installServerRoutes(ctx, store, notifyChange, () => runtime.activeView()),
      'dsh-tavern: HTTP preset API',
    )
  }

  ctx.logger.info(`dsh-tavern: prompt presets ready (${storageDir})`)
  return store
}

export function createApiHandler(store, onChange = () => {}) {
  const runtime = new PresetRuntime(store)
  return createPresetApiHandler(store, onChange, () => runtime.activeView())
}

export { PresetRuntime } from './preset-runtime.js'
export { compilePresetForDsh, projectPresetCallConfig } from './profile-compiler.js'
export { PresetStore } from '../../preset/src/index.js'
