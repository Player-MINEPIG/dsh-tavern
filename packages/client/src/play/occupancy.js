import { CLIENT_REFRESH_EVENT } from '../../../identity.js'
import { translate } from '../i18n.js'
import { MowanChatView } from './chat.js'
import { loadCurrentPlaythrough } from './chat-model.js'
import { PlayWorkspaceBrowser } from './sidebar.js'
import { PlayUnboundNotice } from './notice.js'

export const PLAY_SLOT_PRIORITY = -100

export function installPlaySlotOccupancy(ctx, playClient) {
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
  let disposeSessionSubscription = null
  let refreshChatListener = null

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
        openSession: sessionId => ctx.sessions.open(sessionId),
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
      id: 'pmp-dsh-tavern-unbound-notice',
      order: 90,
      inject: () => ({ playClient }),
    }, PlayUnboundNotice)
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

  const dropChatEntry = () => {
    const dispose = disposeChatEntry
    disposeChatEntry = null
    dispose?.()
  }

  const currentSession = () => {
    const snapshot = ctx.sessions?.list?.getSnapshot?.()
    const sessionId = snapshot?.current
    if (typeof sessionId !== 'string' || sessionId === '') return null
    const session = snapshot.byId?.[sessionId]
    return session == null ? null : { ...session, id: session.id ?? sessionId }
  }

  const reconcileChat = () => {
    chatGeneration += 1
    const generation = chatGeneration
    dropChatEntry()
    if (!chatDeclared || mode !== 'play') return
    const session = currentSession()
    if (session === null) return
    const sessionId = session.id
    loadCurrentPlaythrough(playClient, session).then(match => {
      if (generation !== chatGeneration
        || mode !== 'play'
        || !chatDeclared
        || currentSession()?.id !== sessionId
        || match === null) return
      disposeChatEntry = ctx.slots.register({
        name: 'conversation.view',
        id: 'chat',
        order: 0,
        priority: PLAY_SLOT_PRIORITY,
        label: () => translate('play.chat.label'),
        inject: () => ({
          playClient,
          playthrough: match.playthrough,
        }),
      }, MowanChatView)
    }).catch(() => {
      // Classification failures keep the official Chat active.
    })
  }

  const stopChatObserver = () => {
    chatGeneration += 1
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
    stopChatObserver()
    const list = ctx.sessions?.list
    if (typeof list?.subscribe === 'function') {
      const dispose = list.subscribe(reconcileChat)
      disposeSessionSubscription = typeof dispose === 'function' ? dispose : null
    }
    if (typeof window !== 'undefined') {
      refreshChatListener = reconcileChat
      window.addEventListener(CLIENT_REFRESH_EVENT, refreshChatListener)
    }
    reconcileChat()
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
      reconcileChat()
    },
  }
}
