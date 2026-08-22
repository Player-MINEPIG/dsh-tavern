import { CLIENT_REFRESH_EVENT } from '../../../identity.js'
import { translate } from '../i18n.js'
import { MowanChatView } from './chat.js'
import { loadCurrentPlaythrough } from './chat-model.js'
import { PlayWorkspaceBrowser } from './sidebar.js'
import { PlaySessionDock } from './notice.js'
import { DefaultConversationViewAdapter } from './view-default.js'

export const PLAY_SLOT_PRIORITY = -100
export const PLAY_VIEW_ID = 'rp'
export const PLAY_VIEW_ORDER = -100
export const PLAY_DEFAULT_VIEW_ADAPTER_ID = 'pmp-dsh-tavern-default-rp-view'
export const PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT = 256

export function findNativeChatStore(slots) {
  if (typeof slots?.entries !== 'function') return undefined
  const entries = slots.entries('conversation.view')
  if (!Array.isArray(entries) && entries?.[Symbol.iterator] === undefined) return undefined
  for (const entry of entries) {
    if (entry?.options?.id === 'chat' && entry.store !== undefined) return entry.store
  }
  return undefined
}

export function installPlaySlotOccupancy(ctx, playClient, { playthroughController, switchToNative } = {}) {
  let mode = 'native'
  let declared = false
  let disposeEntry = null
  let disposeEffect = null
  let noticeDeclared = false
  let disposeNoticeEntry = null
  let disposeNoticeEffect = null
  let chatDeclared = false
  let chatGeneration = 0
  let disposeChatEntry = null
  let disposeDefaultViewEntry = null
  let defaultViewEntryKey = null
  let disposeSessionSubscription = null
  let refreshChatListener = null
  let chatBinding = null
  let pendingChatSignature = null
  let preferredPlaythroughId = null
  const playthroughSelectionListeners = new Set()
  const completedDefaultViewAttempts = new Set()

  const selectPlaythrough = playthroughId => {
    const next = typeof playthroughId === 'string' && playthroughId !== '' ? playthroughId : null
    if (next === preferredPlaythroughId) return
    preferredPlaythroughId = next
    for (const listener of playthroughSelectionListeners) listener(next)
  }

  const dropEntry = () => {
    const dispose = disposeEntry
    disposeEntry = null
    dispose?.()
  }

  const dropEffect = () => {
    const dispose = disposeEffect
    disposeEffect = null
    dispose?.()
    dropEntry()
  }

  const mount = () => {
    if (!declared || mode !== 'play' || disposeEntry !== null) return
    disposeEntry = ctx.slots.register({
      name: 'sidebar.workspaces',
      priority: PLAY_SLOT_PRIORITY,
      inject: () => ({
        playClient,
        playthroughController,
        openSession: (sessionId, playthrough = null) => openPlaySession(sessionId, playthrough),
        getActivePlaythroughId: () => preferredPlaythroughId,
        switchToNative,
        subscribeActivePlaythroughId: listener => {
          playthroughSelectionListeners.add(listener)
          return () => playthroughSelectionListeners.delete(listener)
        },
      }),
    }, PlayWorkspaceBrowser)
  }

  const reconcile = () => {
    dropEffect()
    if (!declared || mode !== 'play') return
    const effect = () => {
      mount()
      return dropEntry
    }
    if (typeof ctx.effect === 'function') {
      const dispose = ctx.effect(effect, 'pmp-dsh-tavern:play-sidebar-shadow')
      disposeEffect = typeof dispose === 'function' ? dispose : null
    } else {
      disposeEffect = effect()
    }
  }

  const dropNoticeEntry = () => {
    const dispose = disposeNoticeEntry
    disposeNoticeEntry = null
    dispose?.()
  }

  const dropNoticeEffect = () => {
    const dispose = disposeNoticeEffect
    disposeNoticeEffect = null
    dispose?.()
    dropNoticeEntry()
  }

  const mountNotice = () => {
    if (!noticeDeclared || mode !== 'play' || disposeNoticeEntry !== null) return
    disposeNoticeEntry = ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'pmp-dsh-tavern-session-dock',
      order: 90,
      inject: () => ({ playClient }),
    }, PlaySessionDock)
  }

  const reconcileNotice = () => {
    dropNoticeEffect()
    if (!noticeDeclared || mode !== 'play') return
    const effect = () => {
      mountNotice()
      return dropNoticeEntry
    }
    if (typeof ctx.effect === 'function') {
      const dispose = ctx.effect(effect, 'pmp-dsh-tavern:play-unbound-notice')
      disposeNoticeEffect = typeof dispose === 'function' ? dispose : null
    } else {
      disposeNoticeEffect = effect()
    }
  }

  const dropConversationEntry = () => {
    const dispose = disposeChatEntry
    disposeChatEntry = null
    dispose?.()
  }

  const dropDefaultViewEntry = () => {
    const dispose = disposeDefaultViewEntry
    disposeDefaultViewEntry = null
    defaultViewEntryKey = null
    dispose?.()
  }

  const rememberDefaultViewAttempt = key => {
    completedDefaultViewAttempts.delete(key)
    completedDefaultViewAttempts.add(key)
    if (completedDefaultViewAttempts.size <= PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT) return
    completedDefaultViewAttempts.delete(completedDefaultViewAttempts.values().next().value)
  }

  const dropChatEntry = () => {
    dropDefaultViewEntry()
    dropConversationEntry()
    chatBinding = null
  }

  const currentSession = () => {
    const snapshot = ctx.sessions?.list?.getSnapshot?.()
    const sessionId = snapshot?.current
    if (typeof sessionId !== 'string' || sessionId === '') return null
    const session = snapshot.byId?.[sessionId]
    return session == null ? null : { ...session, id: session.id ?? sessionId }
  }

  const sessionSignature = session => `${session.id}\u0000${String(session.cwd ?? '')}`

  const openPlaySession = (sessionId, playthrough = null) => {
    selectPlaythrough(playthrough?.id)
    const result = ctx.sessions.open(sessionId)
    queueMicrotask(() => reconcileChat(true))
    return result
  }

  const syncChatEntries = () => {
    if (chatBinding === null) return
    if (!chatDeclared) {
      dropDefaultViewEntry()
      dropConversationEntry()
    } else if (disposeChatEntry === null) {
      disposeChatEntry = ctx.slots.register({
        name: 'conversation.view',
        id: PLAY_VIEW_ID,
        order: PLAY_VIEW_ORDER,
        priority: PLAY_SLOT_PRIORITY,
        label: () => translate('play.chat.label'),
        inject: () => ({
          playClient,
          playthrough: chatBinding.playthrough,
          openSession: (sessionId, playthrough = chatBinding.playthrough) => openPlaySession(sessionId, playthrough),
        }),
      }, MowanChatView)
    }
    const defaultViewKey = `${chatBinding.signature}\u0000${chatBinding.playthrough.path}`
    if (chatDeclared
      && disposeDefaultViewEntry === null
      && !completedDefaultViewAttempts.has(defaultViewKey)) {
      const nativeChatStore = findNativeChatStore(ctx.slots)
      if (nativeChatStore !== undefined) {
        const complete = () => {
          rememberDefaultViewAttempt(defaultViewKey)
          if (defaultViewEntryKey === defaultViewKey) dropDefaultViewEntry()
        }
        defaultViewEntryKey = defaultViewKey
        disposeDefaultViewEntry = ctx.slots.register({
          name: 'conversation.input.dock',
          id: PLAY_DEFAULT_VIEW_ADAPTER_ID,
          order: -1000,
          priority: PLAY_SLOT_PRIORITY,
          store: nativeChatStore,
          inject: () => ({
            targetViewId: PLAY_VIEW_ID,
            complete,
          }),
        }, DefaultConversationViewAdapter)
      }
    }
  }

  const reconcileChat = (force = false) => {
    if (force !== true) force = false
    const session = currentSession()
    if (!chatDeclared || mode !== 'play' || session === null) {
      chatGeneration += 1
      pendingChatSignature = null
      dropChatEntry()
      return
    }
    const signature = sessionSignature(session)
    if (!force && chatBinding?.signature === signature) {
      syncChatEntries()
      return
    }
    if (!force && pendingChatSignature === signature) return
    chatGeneration += 1
    const generation = chatGeneration
    pendingChatSignature = signature
    const sessionId = session.id
    const preferred = preferredPlaythroughId ?? chatBinding?.playthrough?.id ?? null
    loadCurrentPlaythrough(playClient, session, {
      preferredPlaythroughId: preferred,
    }).then(match => {
      if (generation === chatGeneration) pendingChatSignature = null
      const latest = currentSession()
      if (generation !== chatGeneration
        || mode !== 'play'
        || !chatDeclared
        || latest === null
        || sessionSignature(latest) !== signature) return
      if (match === null) {
        selectPlaythrough(null)
        dropChatEntry()
        return
      }
      // Session navigation is also how a playthrough selects an existing
      // swipe. Keep the registered RP view alive while classification runs,
      // and reuse it when the destination belongs to the same playthrough.
      // Dropping it eagerly makes the entire conversation surface unmount and
      // visibly flash even though only the authoritative DSH session changed.
      const samePlaythrough = chatBinding?.playthrough?.path === match.playthrough.path
      if (!samePlaythrough) dropChatEntry()
      selectPlaythrough(match.playthrough.id)
      chatBinding = { signature, sessionId, playthrough: match.playthrough }
      syncChatEntries()
    }).catch(() => {
      if (generation === chatGeneration) pendingChatSignature = null
      // Classification failures keep the official Chat active.
    })
  }

  const stopChatObserver = () => {
    chatGeneration += 1
    pendingChatSignature = null
    dropChatEntry()
    const dispose = disposeSessionSubscription
    disposeSessionSubscription = null
    dispose?.()
    if (refreshChatListener !== null && typeof window !== 'undefined') {
      window.removeEventListener(CLIENT_REFRESH_EVENT, refreshChatListener)
    }
    refreshChatListener = null
  }

  const startChatObserver = () => {
    const list = ctx.sessions?.list
    if (disposeSessionSubscription === null && typeof list?.subscribe === 'function') {
      const dispose = list.subscribe(() => reconcileChat(false))
      disposeSessionSubscription = typeof dispose === 'function' ? dispose : null
    }
    if (refreshChatListener === null && typeof window !== 'undefined') {
      refreshChatListener = () => reconcileChat(true)
      window.addEventListener(CLIENT_REFRESH_EVENT, refreshChatListener)
    }
    reconcileChat(false)
  }

  ctx.slots.inject('sidebar.workspaces', () => {
    declared = true
    reconcile()
    return () => {
      declared = false
      dropEffect()
    }
  })

  ctx.slots.inject('conversation.input.dock', () => {
    noticeDeclared = true
    reconcileNotice()
    return () => {
      noticeDeclared = false
      dropNoticeEffect()
    }
  })

  ctx.slots.inject('conversation.view', () => {
    chatDeclared = true
    startChatObserver()
    return () => {
      chatDeclared = false
      dropDefaultViewEntry()
      dropConversationEntry()
      stopChatObserver()
    }
  })

  return {
    setMode(next) {
      const normalized = next === 'play' ? 'play' : 'native'
      if (mode === normalized) return
      mode = normalized
      reconcile()
      reconcileNotice()
      reconcileChat(true)
    },
  }
}
