import { createElement, useLayoutEffect, useSyncExternalStore } from 'react'
import { mainSessionId, retainedSessions } from '../session-selection.js'
import { CLIENT_REFRESH_EVENT, CLIENT_UI_SETTINGS_EVENT } from '../../../identity.js'
import { getClientUiSettings, translate } from '../i18n.js'
import { MowanChatView } from './chat.js'
import { loadCurrentPlaythrough } from './chat-model.js'
import { PlayWorkspaceBrowser } from './sidebar.js'
import { PlaySessionDock } from './notice.js'
import { DefaultConversationViewAdapter } from './view-default.js'
import { setSwipeTransitionSource } from './swipe-transition.js'

export const PLAY_SLOT_PRIORITY = -100
export const PLAY_VIEW_ID = 'rp'
export const PLAY_VIEW_ORDER = -100
export const PLAY_DEFAULT_VIEW_ADAPTER_ID = 'pmp-dsh-tavern-default-rp-view'
export const PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT = 256

export function findConversationStore(slots) {
  if (typeof slots?.entries !== 'function') return undefined
  const entries = slots.entries('conversation.session')
  if (!Array.isArray(entries) && entries?.[Symbol.iterator] === undefined) return undefined
  for (const entry of entries) {
    if (entry?.store !== undefined) return entry.store
  }
  return undefined
}

export function installPlaySlotOccupancy(ctx, playClient, { playthroughController, switchToNative, conversationPhase, diagnostics } = {}) {
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
  let disposeSessionSubscription = null
  let refreshChatListener = null
  let refreshLocaleListener = null
  const chatBindings = new Map()
  const pendingChats = new Map()
  const preferredPlaythroughs = new Map()
  const bindingListeners = new Set()
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
        diagnostics,
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
      inject: () => ({ playClient, conversationPhase }),
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
    dispose?.()
  }

  const rememberDefaultViewAttempt = key => {
    completedDefaultViewAttempts.delete(key)
    completedDefaultViewAttempts.add(key)
    if (completedDefaultViewAttempts.size <= PLAY_DEFAULT_VIEW_ATTEMPT_LIMIT) return
    completedDefaultViewAttempts.delete(completedDefaultViewAttempts.values().next().value)
  }

  const notifyBindings = () => {
    for (const listener of [...bindingListeners]) listener()
  }

  const bindingProps = sessionId => ({
    getBinding: () => chatBindings.get(sessionId) ?? (pendingChats.has(sessionId) ? undefined : null),
    subscribeBindings: listener => {
      bindingListeners.add(listener)
      return () => bindingListeners.delete(listener)
    },
  })

  const dropChatEntry = () => {
    dropDefaultViewEntry()
    dropConversationEntry()
    chatBindings.clear()
    notifyBindings()
  }

  const sessionSignature = session => `${session.id}\u0000${String(session.cwd ?? '')}`
  const defaultViewKey = binding => `${binding.signature}\u0000${binding.playthrough.path}`

  const openPlaySession = (sessionId, playthrough = null) => {
    if (playthrough?.id) preferredPlaythroughs.set(sessionId, playthrough.id)
    selectPlaythrough(playthrough?.id)
    const result = ctx.uiWorkspace.openSession(sessionId)
    queueMicrotask(() => reconcileChat(true))
    return result
  }

  const syncChatEntries = () => {
    if (!chatDeclared || mode !== 'play' || (chatBindings.size === 0 && pendingChats.size === 0)) {
      dropDefaultViewEntry()
      dropConversationEntry()
      return
    }
    if (chatBindings.size === 0) return
    if (disposeChatEntry === null) {
      disposeChatEntry = ctx.slots.register({
        name: 'conversation.view',
        id: PLAY_VIEW_ID,
        order: PLAY_VIEW_ORDER,
        priority: PLAY_SLOT_PRIORITY,
        label: () => translate('play.chat.label'),
        store: findConversationStore(ctx.slots),
        inject: sessionId => ({
          ...bindingProps(sessionId),
          playClient,
          openSession: (targetId, playthrough = chatBindings.get(sessionId)?.playthrough) => {
            setSwipeTransitionSource(targetId, sessionId)
            return openPlaySession(targetId, playthrough)
          },
        }),
      }, ScopedPlayChatView)
    }
    // The roster is global, but DSH resolves this shared Store independently
    // for every Session. Keep the adapter mounted so an unrelated retained
    // conversation can safely leave RP and each binding gets its own default.
    if (disposeDefaultViewEntry === null) {
      const conversationStore = findConversationStore(ctx.slots)
      if (conversationStore !== undefined) {
        disposeDefaultViewEntry = ctx.slots.register({
          name: 'conversation.input.dock',
          id: PLAY_DEFAULT_VIEW_ADAPTER_ID,
          order: -1000,
          priority: PLAY_SLOT_PRIORITY,
          store: conversationStore,
          inject: sessionId => ({
            ...bindingProps(sessionId),
            targetViewId: PLAY_VIEW_ID,
            shouldDefault: binding => !completedDefaultViewAttempts.has(defaultViewKey(binding)),
            complete: binding => rememberDefaultViewAttempt(defaultViewKey(binding)),
          }),
        }, DefaultConversationViewAdapter)
      }
    }
  }

  const reconcileChat = (force = false) => {
    if (!chatDeclared || mode !== 'play') {
      chatGeneration += 1
      pendingChats.clear()
      dropChatEntry()
      return
    }
    const snapshot = ctx.sessions?.list?.getSnapshot?.()
    const sessions = retainedSessions(snapshot)
    const retained = new Set(sessions.map(session => session.id))
    for (const id of chatBindings.keys()) if (!retained.has(id)) chatBindings.delete(id)
    for (const id of pendingChats.keys()) if (!retained.has(id)) pendingChats.delete(id)
    for (const id of preferredPlaythroughs.keys()) if (!retained.has(id)) preferredPlaythroughs.delete(id)
    const mainId = mainSessionId(snapshot)
    selectPlaythrough(chatBindings.get(mainId)?.playthrough.id ?? preferredPlaythroughs.get(mainId) ?? null)
    for (const session of sessions) {
      const signature = sessionSignature(session)
      if (force !== true && (chatBindings.get(session.id)?.signature === signature
        || pendingChats.get(session.id)?.signature === signature)) continue
      const request = { signature, generation: chatGeneration }
      pendingChats.set(session.id, request)
      loadCurrentPlaythrough(playClient, session, {
        preferredPlaythroughId: preferredPlaythroughs.get(session.id) ?? chatBindings.get(session.id)?.playthrough.id ?? null,
      }).then(match => {
        if (pendingChats.get(session.id) !== request || request.generation !== chatGeneration) return
        pendingChats.delete(session.id)
        if (match === null) chatBindings.delete(session.id)
        else chatBindings.set(session.id, { signature, sessionId: session.id, playthrough: match.playthrough })
        if (mainSessionId(ctx.sessions?.list?.getSnapshot?.()) === session.id) selectPlaythrough(match?.playthrough.id)
        syncChatEntries()
        notifyBindings()
      }).catch(() => {
        if (pendingChats.get(session.id) !== request || request.generation !== chatGeneration) return
        pendingChats.delete(session.id)
        chatBindings.delete(session.id)
        syncChatEntries()
        notifyBindings()
      })
    }
    syncChatEntries()
    notifyBindings()
  }

  const stopChatObserver = () => {
    chatGeneration += 1
    pendingChats.clear()
    dropChatEntry()
    const dispose = disposeSessionSubscription
    disposeSessionSubscription = null
    dispose?.()
    if (refreshChatListener !== null && typeof window !== 'undefined') {
      window.removeEventListener(CLIENT_REFRESH_EVENT, refreshChatListener)
    }
    refreshChatListener = null
    if (refreshLocaleListener !== null && typeof window !== 'undefined') {
      window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, refreshLocaleListener)
    }
    refreshLocaleListener = null
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
    if (refreshLocaleListener === null && typeof window !== 'undefined') {
      let locale = getClientUiSettings().locale
      refreshLocaleListener = () => {
        const next = getClientUiSettings().locale
        if (next === locale) return
        locale = next
        // DSH snapshots string labels into its view roster. Refresh only our
        // entry; keep the Conversation store and completed default choice.
        dropConversationEntry()
        syncChatEntries()
      }
      window.addEventListener(CLIENT_UI_SETTINGS_EVENT, refreshLocaleListener)
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

// Injected data belongs to this rendered Session, never to the main-view
// selection. Subscribe because classification may finish after the slot mounts.
export function ScopedPlayChatView({ getBinding, subscribeBindings, useStore, actions, ...props }) {
  const binding = useSyncExternalStore(subscribeBindings, getBinding, getBinding)
  const selectedView = typeof useStore === 'function' ? useStore(state => state.view) : null
  useLayoutEffect(() => {
    // Some retained surfaces omit the input dock; the view itself must also
    // restore native Chat if this Session has no RP binding.
    if (binding === null && selectedView === PLAY_VIEW_ID) actions?.setView?.('chat')
  }, [actions, binding, selectedView])
  return binding == null ? null : createElement(MowanChatView, {
    ...props,
    playthrough: binding.playthrough,
  })
}
