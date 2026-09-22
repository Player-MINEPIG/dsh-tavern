import { useLayoutEffect, useSyncExternalStore } from 'react'

export function defaultViewTarget(selectedView, targetViewId) {
  return selectedView === null || selectedView === undefined ? targetViewId : null
}

export function sessionViewTarget(selectedView, targetViewId, binding, shouldDefault) {
  if (binding === undefined) return null // Classification is still pending.
  if (binding === null) return selectedView === targetViewId ? 'chat' : null
  return shouldDefault(binding) ? defaultViewTarget(selectedView, targetViewId) : null
}

export function DefaultConversationViewAdapter({ useStore, actions, targetViewId, complete, shouldDefault, getBinding, subscribeBindings }) {
  const binding = useSyncExternalStore(subscribeBindings, getBinding, getBinding)
  const hasStore = typeof useStore === 'function'
  const selectedView = hasStore ? useStore(state => state.view) : undefined

  useLayoutEffect(() => {
    const target = sessionViewTarget(selectedView, targetViewId, binding, shouldDefault)
    if (hasStore && target !== null && typeof actions?.setView === 'function') {
      try {
        actions.setView(target)
      } catch {
        // Leave the official Chat fallback active when its Store is disposed.
      }
    }
    if (binding != null) complete(binding)
  }, [actions, binding, complete, hasStore, selectedView, shouldDefault, targetViewId])

  return null
}
