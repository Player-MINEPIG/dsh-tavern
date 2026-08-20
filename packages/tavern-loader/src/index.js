import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  PresetStore,
  createApiHandler as createPresetApiHandler,
} from '../../preset/src/index.js'
import { API_ROOT, API_V1, PLUGIN_ID, PROFILE_SECTION } from '../../identity.js'
import { ChromeStore, PlayWorkspaceStore, createPlayApiHandler, isPlayApiPath } from '../../play/src/index.js'
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
import { ImportContextRuntime } from './import-context-runtime.js'
import { createPlayHost } from './play-host.js'
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
import {
  RpPolicyStore,
  createRpPolicyApiHandler,
  isRpPolicyApiPath,
} from './rp-policy-store.js'
import {
  RpModeController,
  createRpModeApiHandler,
  isRpModeApiPath,
  registerRpCommands,
  registerRpWriteGuard,
  resolveRpConfig,
  rpModeConstants,
} from './rp-mode.js'

export const name = PLUGIN_ID
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
  return path === `${API_V1}/character-selection`
    || path === `${API_V1}/characters`
    || path.startsWith(`${API_V1}/characters/`)
}

function isWorldBookApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === `${API_V1}/world-book-selection`
    || path === `${API_V1}/world-books`
    || path.startsWith(`${API_V1}/world-books/`)
}

function isUserApiPath(url) {
  const path = new URL(url ?? '/', 'http://localhost').pathname
  return path === `${API_V1}/user-selection`
    || path === `${API_V1}/users`
    || path.startsWith(`${API_V1}/users/`)
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
  const chromeStore = new ChromeStore(storageDir)
  const rpPolicyStore = new RpPolicyStore(storageDir, {
    defaultSection: resolveRpConfig(config.rpMode ?? {}).section,
  })
  const selections = new SessionSelectionStore(storageDir, {
    ...config.sessionSelections,
    defaultSelection: () => ({ presetId: store.state.selectedId }),
  })
  migrateCharacterSelections(characterStore, selections)
  const rpMode = new RpModeController({
    selections,
    uiSettings: uiSettingsStore,
    agents: () => ctx.get('agents'),
    sandboxDefault: () => ctx.get('sandboxPolicy')?.defaultMode,
    workspaceRoot: () => {
      const root = ctx.get('sandboxPolicy')?.workspaceRoot
      return typeof root === 'string' && root !== '' ? root : process.cwd()
    },
    logger: ctx.logger,
    policyStore: rpPolicyStore,
    section: rpPolicyStore.defaultSection,
  })
  const reconcileRpAfterSelection = (sessionId, operation) => {
    const liveAgent = ctx.get('agents')?.get?.(sessionId)
    const session = liveAgent === undefined ? ctx.get('sessions')?.get?.(sessionId) : undefined
    const agent = liveAgent ?? (session === undefined ? { id: sessionId } : { id: sessionId, session })
    try {
      rpMode.onSessionStart(agent)
    } catch (error) {
      ctx.logger.warn?.(`dsh-tavern: RP mode ${operation} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  let importContexts = null
  const playHost = createPlayHost(ctx, {
    selections,
    characters: characterStore,
    importContexts: () => importContexts,
    onSelectionCopied: sessionId => reconcileRpAfterSelection(sessionId, 'selection copy'),
  })
  const playWorkspaceStore = new PlayWorkspaceStore(storageDir, { host: playHost })
  importContexts = new ImportContextRuntime(storageDir, playWorkspaceStore)
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
  const selectCharacter = characterSelectionPolicy.select.bind(characterSelectionPolicy)
  characterSelectionPolicy.select = (sessionId, patch) => {
    const previousId = characterSelectionPolicy.selection(sessionId)?.characterCardId ?? null
    const result = selectCharacter(sessionId, patch)
    rpMode.followCharacterChange(sessionId, {
      previousId,
      nextId: result?.characterCardId ?? null,
    })
    return result
  }
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
    beforeSelectionChange: ({ sessionId }) => {
      const agent = ctx.get('agents')?.get?.(sessionId)
      if (agent?.status === 'running') {
        const error = new Error('The session agent is running; change the preset after the current turn finishes.')
        error.code = 'PRESET_AGENT_RUNNING'
        error.status = 409
        throw error
      }
    },
    clearResource: (kind, id) => selections.clearResource(kind, id),
  }

  ctx.systemPrompt.section({
    name: PROFILE_SECTION,
    order: 10,
    text: (context) => {
      const snapshot = runtime.forAssembleContext(context)
      const claimMetadata = snapshot.audit?.activation ?? null
      return [snapshot.systemText, importContexts.contextFor(context.agent?.id, claimMetadata)].filter(Boolean).join('\n\n')
    },
  })
  ctx.systemPrompt.section({
    name: rpModeConstants.sectionName,
    order: rpModeConstants.sectionOrder,
    text: (context) => {
      if (context.agent === undefined) return ''
      return rpMode.isActive(context.agent) ? rpMode.section : ''
    },
  })

  ctx.on('agent/session-start', ({ agent }) => {
    selections.ensureAgent(agent)
    pendingInput.ensureSession(agent?.session)
    try {
      rpMode.onSessionStart(agent)
    } catch (error) {
      ctx.logger.warn?.(`dsh-tavern: RP mode session start failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind === 'reject' || payload?.signal?.aborted) return decision
    try {
      rpMode.onBoundary(payload.agent)
      rpMode.enforceReadOnly(payload.agent?.session)
    } catch (error) {
      ctx.logger.warn?.(`dsh-tavern: RP mode pre-step commit failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    return decision
  })

  registerRpCommands(ctx, rpMode)
  registerRpWriteGuard(ctx, rpMode)

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
    if (event?.type === 'turn/end') {
      pendingInput.clearClaimed(session)
      importContexts.consumeAfterTurn(session?.id, event)
    }
    if (event?.type === 'sandbox/mode') {
      try { rpMode.enforceReadOnly(session) } catch (error) {
        ctx.logger.warn?.(`dsh-tavern: RP sandbox pin failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
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
    const profileSections = assembly.sections.filter((section) => (
      section.name === PROFILE_SECTION || section.name === rpModeConstants.sectionName
    ))
    const sections = profileSections.length > 0 || snapshot.systemText === ''
      ? profileSections
      : [{ name: PROFILE_SECTION, text: snapshot.systemText }]
    const rpSection = assembly.sections.find((section) => section.name === rpModeConstants.sectionName)
    if (rpSection !== undefined && !sections.some((section) => section.name === rpModeConstants.sectionName)) {
      sections.push(rpSection)
    }
    return { ...assembly, sections, contexts }
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
        if (change.kind === 'session-configuration-applied') {
          notifyChange()
          reconcileRpAfterSelection(change.sessionId, 'configuration apply')
        }
      },
    })
    const uiSettingsApi = createUiSettingsApiHandler(uiSettingsStore)
    const playApi = createPlayApiHandler({
      chromeStore,
      workspaceStore: playWorkspaceStore,
      host: playHost,
      logger: ctx.logger,
    })
    const rpPolicyApi = createRpPolicyApiHandler(rpPolicyStore, { onChange: notifyChange })
    const rpModeApi = createRpModeApiHandler(rpMode, {
      beforeChange: ({ sessionId, active }) => {
        notifyChange()
        if (typeof sessionId !== 'string' || typeof active !== 'boolean') return
      },
    })
    const api = secureTavernApi(
      (req, res) => isPlayApiPath(req.url)
        ? playApi(req, res)
        : isUiSettingsApiPath(req.url)
        ? uiSettingsApi(req, res)
        : isRpPolicyApiPath(req.url)
          ? rpPolicyApi(req, res)
        : isRpModeApiPath(req.url)
          ? rpModeApi(req, res)
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
    chromeStore: { value: chromeStore, enumerable: false },
    playWorkspaceStore: { value: playWorkspaceStore, enumerable: false },
    rpPolicyStore: { value: rpPolicyStore, enumerable: false },
    traceStore: { value: traceStore, enumerable: false },
    traceRecorder: { value: traceRecorder, enumerable: false },
    pendingInputProjection: { value: pendingInput, enumerable: false },
    rpMode: { value: rpMode, enumerable: false },
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
export {
  RpPolicyStore,
  createRpPolicyApiHandler,
  isRpPolicyApiPath,
  normalizeRpPolicySection,
  rpPolicyStoreConstants,
} from './rp-policy-store.js'
export {
  DEFAULT_RP_SECTION,
  DEFAULT_RP_STATE,
  RpModeController,
  createRpModeApiHandler,
  foldSandboxMode,
  hasOpenTurn,
  isRpModeApiPath,
  normalizeRpState,
  registerRpCommands,
  registerRpWriteGuard,
  resolveRpConfig,
  RP_MUTATING_TOOL_NAMES,
  RP_WRITE_BLOCK_REASON,
  rpHighRiskGuardReason,
  rpModeConstants,
  rpWorkspaceReadGuardReason,
  rpWriteGuardReason,
} from './rp-mode.js'
export { createPlayHost } from './play-host.js'
export {
  ChromeStore,
  PlayWorkspaceStore,
  chromeConstants,
  createPlayApiHandler,
  deriveFocus,
  isPlayApiPath,
  normalizeChrome,
  normalizeTimeline,
  playWorkspaceConstants,
  validatePlayDocument,
} from '../../play/src/index.js'
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
export {
  API_ROOT,
  API_V1,
  API_V2,
  CLIENT_REFRESH_EVENT,
  CLIENT_UI_SETTINGS_EVENT,
  LEGACY_API_ROOT,
  PLUGIN_ID,
  PROFILE_SECTION,
  identityConstants,
} from '../../identity.js'
