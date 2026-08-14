export function reorder(items, from, to) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array')
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return items
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const result = [...items]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

export function shouldUseFloatingPanel(sessionState) {
  const current = sessionState?.current
  if (current === undefined || current === null) return true
  return sessionState.byId?.[current]?.blank === true
}
