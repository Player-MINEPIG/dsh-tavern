import { useLayoutEffect } from 'react'

export function defaultViewTarget(selectedView, targetViewId) {
  return selectedView === null || selectedView === undefined ? targetViewId : null
}

export function DefaultConversationViewAdapter({ useStore, actions, targetViewId, complete }) {
  const selectedView = useStore(state => state.view)

  useLayoutEffect(() => {
    const target = defaultViewTarget(selectedView, targetViewId)
    if (target !== null && typeof actions?.setView === 'function') {
      try {
        actions.setView(target)
      } catch {
        // Retire safely and leave the official Chat fallback active.
      }
    }
    queueMicrotask(complete)
  }, [actions, complete, selectedView, targetViewId])

  return null
}
