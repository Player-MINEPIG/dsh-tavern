import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  PresetStore,
  API_ROOT,
  createApiHandler as createPresetApiHandler,
} from '../../preset/src/index.js'
import {
  CharacterStore,
  createCharacterAdapter,
  createCharacterApiHandler,
} from '../../character/src/index.js'
import { WorldBookStore, createWorldBookApiHandler } from '../../world-book-library/src/index.js'
import {
  UserStore,
  createUserAdapter,
  createUserApiHandler,
} from '../../user/src/index.js'
import { PresetRuntime } from './preset-runtime.js'
import { TavernProfileLoader } from './profile-loader.js'
import { SessionSelectionStore } from './session-policy.js'
import { UserWorldBookBindingStore } from './user-world-book-policy.js'
import { createWorldBookAdapter } from './world-book-adapter.js'
import { PendingInputProjection } from './pending-input-projection.js'
import { secureTavernApi } from './api-security.js'
import {
  UiSettingsStore,
  createUiSettingsApiHandler,
  isUiSettingsApiPath,
} from './ui-settings.js'
import {
  TavernTraceRecorder,
  TavernTraceStore,
  createTavernTraceApiHandler,
  isTavernTraceApiPath,
} from '../../tavern-trace/src/index.js'
import {
  SessionConfigurationService,
  SessionTemplateStore,
  createSessionTemplateApiHandler,
  isSessionTemplateApiPath,
} from '../../session-template/src/index.js'

export const name = 'dsh-tavern'
export const inject = ['systemPrompt']

const DEFAULT_STORAGE_DIR = fileURLToPath(new URL('../../../data', import.meta.url))

function migrateCharacterSelections(characterStore, selections) {
  for (const [sessionId, legacy] of Object.entries(characterStore.state.selectedBySessionId)) {
    try {
      const current = selections.get(sessionId)
      if (current.characterCardId === null) {
        const normalized = characterStore.normalizeSelection(legacy.characterCardId, legacy)
        selections.set(sessionId, normalized)
      }
    } catch (error) {
      if (error?.code !== 'CHARACTER_NOT_FOUND' && !(error instanceof TypeError)) throw error
    } finally {
      // Migration is one-way. Clearing the legacy binding prevents a user who
      // later unbinds in SessionSelectionStore from being rebound on restart.
      characterStore.select(sessionId, null)
    }
  }
}

function isCharacterApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === '/dsh-tavern/api/character-selection'
    || path === '/dsh-tavern/api/characters'
    || path.startsWith('/dsh-tavern/api/characters/')
}

function isWorldBookApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === '/dsh-tavern/api/world-book-selection'
    || path === '/dsh-tavern/api/world-books'
    || path.startsWith('/dsh-tavern/api/world-books/')
}

function isUserApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === '/dsh-tavern/api/user-selection'
    || path === '/dsh-tavern/api/users'
    || path.startsWith('/dsh-tavern/api/users/')
}

export function createCharacterSelectionPolicy(characterStore, selections) {
  return {
    selection(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const selected = selections.get(sessionId)
      if (selected.characterCardId === null) return null
      try {
        return characterStore.normalizeSelection(selected.characterCardId, selected)
      } catch (error) {
        if (error?.code !== 'CHARACTER_NOT_FOUND' && !(error instanceof TypeError)) throw error
        return null
      }
    },
    select(sessionId, patch) {
      if (patch === null || patch.characterCardId === null) {
        selections.set(sessionId, { characterCardId: null, character: {} })
        return null
      }
      const normalized = characterStore.normalizeSelection(patch.characterCardId, patch)
      selections.set(sessionId, normalized)
      return normalized
    },
    clearResource: (kind, id) => selections.clearResource(kind, id),
  }
}

export function createWorldBookSelectionPolicy(worldBookStore, selections, userWorldBooks = null) {
  return {
    selection(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return []
      return selections.get(sessionId).worldBookIds
    },
    select(sessionId, worldBookIds) {
      if (!Array.isArray(worldBookIds)) throw new TypeError('worldBookIds must be an array')
      if (worldBookIds.length > 100) throw new TypeError('A session can bind at most 100 world books')
      const normalized = [...new Set(worldBookIds)]
      for (const id of normalized) {
        if (typeof id !== 'string' || id === '') throw new TypeError('Every worldBookId must be a non-empty string')
        worldBookStore.get(id)
      }
      selections.set(sessionId, { worldBookIds: normalized })
      return normalized
    },
    clearResource(kind, id) {
      const sessionChanged = selections.clearResource(kind, id)
      const userChanged = kind === 'world-book' ? userWorldBooks?.clearWorldBook(id) === true : false
      return sessionChanged || userChanged
    },
  }
}

export function createUserSelectionPolicy(userStore, selections, userWorldBooks = null) {
  return {
    selection(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const selected = selections.get(sessionId)
      if (selected.userId === null) return null
      try {
        userStore.get(selected.userId)
        return { userId: selected.userId }
      } catch (error) {
        if (error?.code !== 'USER_NOT_FOUND' && !(error instanceof TypeError)) throw error
        return null
      }
    },
    select(sessionId, patch) {
      if (patch === null || patch.userId === null) {
        selections.set(sessionId, { userId: null })
        return null
      }
      userStore.get(patch.userId)
      selections.set(sessionId, { userId: patch.userId })
      return { userId: patch.userId }
    },
    clearResource(kind, id) {
      const sessionChanged = selections.clearResource(kind, id)
      const bindingChanged = kind === 'user' ? userWorldBooks?.clearUser(id) === true : false
      return sessionChanged || bindingChanged
    },
  }
}

export function createUserWorldBookBindingPolicy(userStore, worldBookStore, userWorldBooks) {
  if (typeof userWorldBooks?.get !== 'function' || typeof userWorldBooks?.set !== 'function') {
    throw new TypeError('User world-book policy requires a binding store')
  }
  return {
    selection(userId) {
      userStore.get(userId)
      return userWorldBooks.get(userId)
    },
    select(userId, worldBookIds) {
      userStore.get(userId)
      if (!Array.isArray(worldBookIds)) throw new TypeError('worldBookIds must be an array')
      if (worldBookIds.length > 100) throw new TypeError('A user can bind at most 100 world books')
      const normalized = [...new Set(worldBookIds)]
      for (const id of normalized) {
        if (typeof id !== 'string' || id === '') throw new TypeError('Every worldBookId must be a non-empty string')
        worldBookStore.get(id)
      }
      return userWorldBooks.set(userId, normalized)
    },
  }
}

export function apply(ctx, config = {}) {
  const storageDir = resolve(config.storageDir ?? DEFAULT_STORAGE_DIR)
  const store = new PresetStore(storageDir)
  const characterStore = new CharacterStore(storageDir)
  const worldBookStore = new WorldBookStore(storageDir)
  const userStore = new UserStore(storageDir)
  const userWorldBooks = new UserWorldBookBindingStore(storageDir, config.userWorldBooks)
  const sessionTemplateStore = new SessionTemplateStore(storageDir, config.sessionTemplates)
  const uiSettingsStore = new UiSettingsStore(storageDir)
  const selections = new SessionSelectionStore(storageDir, {
    ...config.sessionSelections,
    defaultSelection: () => ({ presetId: store.state.selectedId }),
  })
  migrateCharacterSelections(characterStore, selections)
  const runtime = new TavernProfileLoader({
    presetStore: store,
    selections,
    userWorldBooks,
    maxProfileBytes: config.limits?.maxProfileBytes,
  })
  const pendingInput = new PendingInputProjection({
    maxScanCharacters: config.worldBook?.maxScanCharacters,
    maxScanMessages: config.worldBook?.maxScanMessages,
    maxQueuedCharacters: config.pendingInput?.maxQueuedCharacters,
    maxQueuedMessages: config.pendingInput?.maxQueuedMessages,
  })
  runtime.registerActivationContextProvider(agent => pendingInput.activationContext(agent))
  const traceStore = new TavernTraceStore(storageDir, config.trace)
  if (traceStore.resetOversizedFile) {
    ctx.logger.warn?.('dsh-tavern: oversized legacy Tavern Trace storage exceeded the safe read limit and was reset')
  }
  const traceRecorder = new TavernTraceRecorder(traceStore)
  runtime.registerCharacterAdapter(createCharacterAdapter(characterStore))
  runtime.registerUserAdapter(createUserAdapter(userStore))
  runtime.registerWorldBookAdapter(createWorldBookAdapter(worldBookStore, config.worldBook))
  const notifyChange = () => ctx.emit('system-prompt/change')
  const traceSafely = (operation, callback) => {
    try {
      return callback()
    } catch (error) {
      ctx.logger.warn?.(`dsh-tavern: Tavern Trace ${operation} failed: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  }
  const characterSelectionPolicy = createCharacterSelectionPolicy(characterStore, selections)
  const worldBookSelectionPolicy = createWorldBookSelectionPolicy(worldBookStore, selections, userWorldBooks)
  const userSelectionPolicy = createUserSelectionPolicy(userStore, selections, userWorldBooks)
  const userWorldBookBindingPolicy = createUserWorldBookBindingPolicy(userStore, worldBookStore, userWorldBooks)
  const sessionConfigurations = new SessionConfigurationService({
    templates: sessionTemplateStore,
    selections,
    presets: store,
    characters: characterStore,
    users: userStore,
    worldBooks: worldBookStore,
  })

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
    pendingInput.ensureSession(agent?.session)
  })

  ctx.on('agent/request', async (payload, next) => {
    const snapshot = runtime.assembledFor(payload.agent) ?? runtime.compile({ agent: payload.agent })
    const config = {
      ...await next(),
      ...snapshot.callConfig,
    }
    traceSafely('request capture', () => traceRecorder.begin({ ...payload, snapshot }))
    return config
  })

  ctx.on('session/event', (session, event) => {
    pendingInput.observeSessionEvent(session, event)
    if (event?.type === 'turn/end') pendingInput.clearClaimed(session)
    traceSafely('header alignment', () => traceRecorder.observeSessionEvent(session, event))
  })

  ctx.on('agent/request-error', async (payload, next) => {
    const result = await next()
    traceSafely('request-error alignment', () => traceRecorder.observeRequestError(payload.agent, payload.turn, payload.step))
    return result
  })

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
    const presetApi = createPresetApiHandler(
      store,
      notifyChange,
      (sessionId) => runtime.activeView(sessionId),
      selectionPolicy,
    )
    const characterApi = createCharacterApiHandler(characterStore, {
      onChange: notifyChange,
      selectionPolicy: characterSelectionPolicy,
      beforeSelectionChange: ({ sessionId }) => {
        const agent = ctx.get('agents')?.get?.(sessionId)
        if (agent?.status === 'running') {
          const error = new Error('The session agent is running; change the character after the current turn finishes.')
          error.code = 'CHARACTER_AGENT_RUNNING'
          error.status = 409
          throw error
        }
      },
    })
    const worldBookApi = createWorldBookApiHandler(worldBookStore, {
      onChange: notifyChange,
      selectionPolicy: worldBookSelectionPolicy,
      beforeSelectionChange: ({ sessionId }) => {
        const agent = ctx.get('agents')?.get?.(sessionId)
        if (agent?.status === 'running') {
          const error = new Error('The session agent is running; change world books after the current turn finishes.')
          error.code = 'WORLD_BOOK_AGENT_RUNNING'
          error.status = 409
          throw error
        }
      },
    })
    const userApi = createUserApiHandler(userStore, {
      onChange: notifyChange,
      selectionPolicy: userSelectionPolicy,
      worldBookBindingPolicy: userWorldBookBindingPolicy,
      beforeSelectionChange: ({ sessionId }) => {
        const agent = ctx.get('agents')?.get?.(sessionId)
        if (agent?.status === 'running') {
          const error = new Error('The session agent is running; change the user after the current turn finishes.')
          error.code = 'USER_AGENT_RUNNING'
          error.status = 409
          throw error
        }
      },
    })
    const traceApi = createTavernTraceApiHandler(traceStore)
    const sessionTemplateApi = createSessionTemplateApiHandler(sessionTemplateStore, sessionConfigurations, {
      onChange: change => {
        if (change.kind === 'session-configuration-applied') notifyChange()
      },
    })
    const uiSettingsApi = createUiSettingsApiHandler(uiSettingsStore)
    const api = secureTavernApi(
      (req, res) => isUiSettingsApiPath(req.url)
        ? uiSettingsApi(req, res)
        : isSessionTemplateApiPath(req.url)
          ? sessionTemplateApi(req, res)
        : isUserApiPath(req.url)
        ? userApi(req, res)
        : isTavernTraceApiPath(req.url)
          ? traceApi(req, res)
          : isCharacterApiPath(req.url)
            ? characterApi(req, res)
            : isWorldBookApiPath(req.url)
              ? worldBookApi(req, res)
              : presetApi(req, res),
      config.security,
    )
    ctx.effect(
      () => ctx.get('webServer').register({
        kind: 'prefix',
        path: API_ROOT,
        handler: api,
      }),
      'dsh-tavern: HTTP Tavern API',
    )
  }

  ctx.logger.info(`dsh-tavern: Tavern profile loader ready (${storageDir})`)
  Object.defineProperties(store, {
    profileLoader: { value: runtime, enumerable: false },
    sessionSelections: { value: selections, enumerable: false },
    characterStore: { value: characterStore, enumerable: false },
    worldBookStore: { value: worldBookStore, enumerable: false },
    userStore: { value: userStore, enumerable: false },
    userWorldBooks: { value: userWorldBooks, enumerable: false },
    sessionTemplateStore: { value: sessionTemplateStore, enumerable: false },
    sessionConfigurations: { value: sessionConfigurations, enumerable: false },
    uiSettingsStore: { value: uiSettingsStore, enumerable: false },
    traceStore: { value: traceStore, enumerable: false },
    traceRecorder: { value: traceRecorder, enumerable: false },
    pendingInputProjection: { value: pendingInput, enumerable: false },
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
export {
  TavernProfileLimitError,
  TavernProfileLoader,
  compileTavernProfile,
  conversationTextFromAgent,
  profileLoaderConstants,
} from './profile-loader.js'
export {
  SessionSelectionLimitError,
  SessionSelectionStore,
  normalizeSelection,
  sessionPolicyConstants,
} from './session-policy.js'
export {
  UserWorldBookBindingLimitError,
  UserWorldBookBindingStore,
  composeWorldBookSelection,
  userWorldBookPolicyConstants,
} from './user-world-book-policy.js'
export { createWorldBookAdapter } from './world-book-adapter.js'
export { PendingInputProjection, pendingInputProjectionConstants } from './pending-input-projection.js'
export { WorldBookStore, createWorldBookApiHandler } from '../../world-book-library/src/index.js'
export { secureTavernApi, apiSecurityConstants } from './api-security.js'
export {
  UiSettingsStore,
  createUiSettingsApiHandler,
  isUiSettingsApiPath,
  normalizeUiSettings,
  uiSettingsConstants,
} from './ui-settings.js'
export { TavernTraceRecorder, TavernTraceStore } from '../../tavern-trace/src/index.js'
export {
  SessionConfigurationError,
  SessionConfigurationService,
  SessionTemplateLimitError,
  SessionTemplateStore,
  createSessionTemplateApiHandler,
  sessionTemplateApiConstants,
  sessionTemplateStoreConstants,
} from '../../session-template/src/index.js'
export { PresetStore } from '../../preset/src/index.js'
