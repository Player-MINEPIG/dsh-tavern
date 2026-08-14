import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  PresetStore,
  createApiHandler as createPresetApiHandler,
  installServerRoutes,
} from '../../preset/src/index.js'
import { PresetRuntime } from './preset-runtime.js'
import { TavernProfileLoader } from './profile-loader.js'
import { SessionSelectionStore } from './session-policy.js'

export const name = 'dsh-tavern'
export const inject = ['systemPrompt']

const DEFAULT_STORAGE_DIR = fileURLToPath(new URL('../../../data', import.meta.url))

export function apply(ctx, config = {}) {
  const storageDir = resolve(config.storageDir ?? DEFAULT_STORAGE_DIR)
  const store = new PresetStore(storageDir)
  const selections = new SessionSelectionStore(storageDir, {
    defaultSelection: () => ({ presetId: store.state.selectedId }),
  })
  const runtime = new TavernProfileLoader({ presetStore: store, selections })
  const notifyChange = () => ctx.emit('system-prompt/change')

  const selectionPolicy = {
    selectedPresetId: (sessionId) => runtime.selection({ sessionId }).presetId,
    selectPreset: (id, sessionId) => {
      if (id !== null) store.get(id)
      if (sessionId === null) {
        store.select(id)
      } else {
        selections.set(sessionId, { presetId: id })
      }
      return id === null ? null : store.get(id)
    },
    clearResource: (kind, id) => selections.clearResource(kind, id),
  }

  ctx.systemPrompt.section({
    name: 'dsh-tavern:profile',
    order: 10,
    text: (context) => runtime.forAssembleContext(context).systemText,
  })

  ctx.on('agent/session-start', ({ agent }) => {
    selections.ensureAgent(agent)
  })

  ctx.on('agent/request', async (payload, next) => ({
    ...await next(),
    ...runtime.compile({ agent: payload.agent }).callConfig,
  }))

  ctx.on('system-prompt/assemble', async (_payload, context, next) => {
    const assembly = await next()
    const snapshot = runtime.forAssembleContext(context)
    const contexts = snapshot.runtimeContexts.length === 0
      ? assembly.contexts
      : [...assembly.contexts, ...snapshot.runtimeContexts]
    if (snapshot.systemPromptMode !== 'replace') return { ...assembly, contexts }
    const profileSections = assembly.sections.filter((section) => section.name === 'dsh-tavern:profile')
    return {
      ...assembly,
      sections: profileSections.length > 0 || snapshot.systemText === ''
        ? profileSections
        : [{ name: 'dsh-tavern:profile', text: snapshot.systemText }],
      contexts,
    }
  })

  if (ctx.get('webServer') !== undefined) {
    ctx.effect(
      () => installServerRoutes(ctx, store, notifyChange, (sessionId) => runtime.activeView(sessionId), selectionPolicy),
      'dsh-tavern: HTTP preset API',
    )
  }

  ctx.logger.info(`dsh-tavern: prompt presets ready (${storageDir})`)
  Object.defineProperties(store, {
    profileLoader: { value: runtime, enumerable: false },
    sessionSelections: { value: selections, enumerable: false },
  })
  return store
}

export function createApiHandler(store, onChange = () => {}) {
  const selections = new SessionSelectionStore(store.storageDir, {
    defaultSelection: () => ({ presetId: store.state.selectedId }),
  })
  const runtime = new TavernProfileLoader({ presetStore: store, selections })
  const selectionPolicy = {
    selectedPresetId: (sessionId) => runtime.selection({ sessionId }).presetId,
    selectPreset: (id, sessionId) => {
      if (id !== null) store.get(id)
      if (sessionId === null) store.select(id)
      else selections.set(sessionId, { presetId: id })
      return id === null ? null : store.get(id)
    },
    clearResource: (kind, id) => selections.clearResource(kind, id),
  }
  return createPresetApiHandler(store, onChange, (sessionId) => runtime.activeView(sessionId), selectionPolicy)
}

export { PresetRuntime } from './preset-runtime.js'
export { compilePresetForDsh, projectPresetCallConfig } from './profile-compiler.js'
export { TavernProfileLoader, compileTavernProfile, conversationTextFromAgent } from './profile-loader.js'
export { SessionSelectionStore, normalizeSelection } from './session-policy.js'
export { PresetStore } from '../../preset/src/index.js'
