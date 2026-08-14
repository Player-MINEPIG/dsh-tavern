export function reorder(items, from, to) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array')
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return items
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const result = [...items]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

export function reorderAtBoundary(items, from, boundary) {
  if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > items.length) return items
  const destination = boundary > from ? boundary - 1 : boundary
  return reorder(items, from, destination)
}
