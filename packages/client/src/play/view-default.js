import { useLayoutEffect } from 'react'

export function defaultViewTarget(selectedView, targetViewId) {
  return selectedView === null || selectedView === undefined ? targetViewId : null
}

export function DefaultConversationViewAdapter({ useStore, actions, targetViewId, complete }) {
  const hasStore = typeof useStore === 'function'
  const selectedView = hasStore ? useStore(state => state.view) : undefined

  useLayoutEffect(() => {
    const target = defaultViewTarget(selectedView, targetViewId)
    if (hasStore && target !== null && typeof actions?.setView === 'function') {
      try {
        actions.setView(target)
      } catch {
        // Retire safely and leave the official Chat fallback active.
      }
    }
    queueMicrotask(complete)
  }, [actions, complete, hasStore, selectedView, targetViewId])

  return null
}
