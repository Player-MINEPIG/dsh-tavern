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

  return {
    setMode(next) {
      const normalized = next === 'play' ? 'play' : 'native'
      if (mode === normalized) return
      mode = normalized
      reconcile()
      reconcileNotice()
    },
  }
}
