function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pathOf(value) {
  return typeof value?.path === 'string' && value.path !== '' ? value.path : null
}

function titleOf(value) {
  if (typeof value?.title === 'string' && value.title.trim() !== '') return value.title.trim()
  if (typeof value?.name === 'string' && value.name.trim() !== '') return value.name.trim()
  return pathOf(value) ?? ''
}

function comparablePath(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '')
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized
}

export function projectRpWorkspaceSetting({ workspace, items = [] } = {}) {
  const currentPath = pathOf(workspace?.rootPath === null ? null : { path: workspace?.rootPath })
  const available = (Array.isArray(items) ? items : []).filter(item => isRecord(item) && pathOf(item) !== null).map(item => ({
    id: item.workspaceId ?? item.id ?? pathOf(item),
    path: pathOf(item),
    title: titleOf(item),
  }))
  const current = currentPath === null
    ? null
    : available.find(item => comparablePath(item.path) === comparablePath(currentPath)) ?? { id: `unavailable:${currentPath}`, path: currentPath, title: currentPath, unavailable: true }
  const selected = workspace?.selected === true
  const currentAvailable = current?.unavailable !== true && current !== null
  return {
    currentPath,
    current,
    available,
    selectedPath: current?.path ?? '',
    selected,
    currentAvailable,
    ready: selected && currentAvailable,
  }
}

export function workspaceSelectionRequest(path, { setting } = {}) {
  if (typeof path !== 'string' || path === '') throw new TypeError('workspace path must be a non-empty string')
  if (setting?.ready === true && comparablePath(setting?.currentPath) === comparablePath(path)) return { path, changed: false }
  return { path, changed: true }
}
