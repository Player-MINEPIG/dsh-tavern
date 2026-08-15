export function sameOrderedIds(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((id, index) => id === right[index])
}

export function userResourceDirty(draft, saved) {
  if (draft === null || saved === null) return draft !== saved
  return draft.id !== saved.id
    || draft.name !== saved.name
    || draft.description !== saved.description
}

export function userPanelDirty(draft, saved, worldBookIds, appliedWorldBookIds) {
  return userResourceDirty(draft, saved) || !sameOrderedIds(worldBookIds, appliedWorldBookIds)
}
