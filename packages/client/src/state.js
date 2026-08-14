export const TAVERN_MENU_ITEMS = Object.freeze([
  { id: 'preset', label: '预设', emptyTitle: '未选择预设', available: true },
  { id: 'character', label: '角色卡', emptyTitle: '未绑定角色', available: true },
  { id: 'world-info', label: '世界书', emptyTitle: '未绑定世界书', available: true },
  { id: 'user', label: '用户', emptyTitle: '未绑定用户', available: true },
])

export const TAVERN_LAUNCHER_SIZE = 44
export const TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 300, height: 276 })

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function firstRecord(...values) {
  return values.find(isRecord) ?? null
}

function firstArray(...values) {
  return values.find(Array.isArray) ?? []
}

function resourceTitle(resource, fallback = '') {
  if (!isRecord(resource)) return fallback
  for (const key of ['name', 'title', 'displayName', 'label']) {
    if (typeof resource[key] === 'string' && resource[key].trim() !== '') return resource[key].trim()
  }
  return fallback
}

function catalog(snapshot, ...keys) {
  for (const container of [snapshot?.catalog, snapshot?.catalogs]) {
    if (!isRecord(container)) continue
    for (const key of keys) {
      if (Array.isArray(container[key])) return container[key]
      if (Array.isArray(container[key]?.items)) return container[key].items
    }
  }
  return []
}

function findResourceById(items, id) {
  return items.find(item => isRecord(item) && String(item.id ?? item.resourceId ?? '') === String(id)) ?? null
}

function selectionIds(value) {
  if (!Array.isArray(value)) return []
  const ids = value
    .map(item => isRecord(item) ? item.id ?? item.resourceId : item)
    .filter(id => (typeof id === 'string' && id !== '') || Number.isSafeInteger(id))
  return ids.filter((id, index) => ids.findIndex(item => String(item) === String(id)) === index)
}

function singleStatus({ id, resource, items, emptyTitle }) {
  const bound = id !== null && id !== undefined && id !== ''
  const directResource = isRecord(resource)
    && (resource.id === undefined || String(resource.id) === String(id))
    ? resource
    : null
  const resolved = firstRecord(directResource, bound ? findResourceById(items, id) : null)
  return {
    bound,
    title: bound ? resourceTitle(resolved, String(id)) : emptyTitle,
    count: bound ? 1 : 0,
  }
}

/**
 * Projects the loader's active view into launcher-only display state. Resource
 * modules may add catalog/catalogs fields later; older active responses remain
 * valid because selection and resolved resources are sufficient fallbacks.
 * No activation/match fields are read here: dots describe selection only.
 */
export function launcherResourceStatuses(snapshot) {
  const selection = isRecord(snapshot?.selection) ? snapshot.selection : {}
  const resources = isRecord(snapshot?.resources) ? snapshot.resources : {}

  const presetResource = firstRecord(resources.preset, snapshot?.selected)
  const presetId = selection.presetId ?? presetResource?.id ?? null
  const characterResource = firstRecord(resources.characterCard, resources.character)
  const characterId = selection.characterCardId ?? selection.characterId ?? characterResource?.id ?? null
  const userResource = firstRecord(resources.user, resources.userProfile, resources.persona)
  const userId = selection.userId ?? selection.userProfileId ?? selection.personaId ?? userResource?.id ?? null

  const explicitWorldIds = selectionIds(firstArray(
    selection.worldBookIds,
    selection.worldBooks,
    selection.worldBookSelection?.ids,
  ))
  const resolvedWorlds = firstArray(resources.worldBooks, resources.worldBook)
    .filter(isRecord)
  const implicitlySelectedWorlds = resolvedWorlds.filter(resource => resource.selected !== false)
  const worldIds = explicitWorldIds.length > 0
    ? explicitWorldIds
    : implicitlySelectedWorlds.map(resource => resource.id ?? resource.resourceId).filter(id => id !== undefined && id !== null)
  const worldCatalog = catalog(snapshot, 'worldBooks', 'worldBook', 'lorebooks')
  const selectedWorlds = worldIds.map(id => firstRecord(
    findResourceById(resolvedWorlds, id),
    findResourceById(worldCatalog, id),
    { id },
  ))
  for (const resource of implicitlySelectedWorlds) {
    const id = resource.id ?? resource.resourceId
    if (id === undefined || id === null || selectedWorlds.some(item => String(item.id ?? item.resourceId) === String(id))) continue
    selectedWorlds.push(resource)
  }
  const worldTitles = selectedWorlds.map(resource => resourceTitle(resource, String(resource.id ?? resource.resourceId ?? '已选择')))

  return {
    preset: singleStatus({
      id: presetId,
      resource: presetResource,
      items: catalog(snapshot, 'presets', 'preset'),
      emptyTitle: '未选择预设',
    }),
    character: singleStatus({
      id: characterId,
      resource: characterResource,
      items: catalog(snapshot, 'characters', 'characterCards', 'character'),
      emptyTitle: '未绑定角色',
    }),
    'world-info': {
      bound: selectedWorlds.length > 0,
      count: selectedWorlds.length,
      title: selectedWorlds.length === 0
        ? '未绑定世界书'
        : selectedWorlds.length === 1
          ? worldTitles[0]
          : `${worldTitles.join('、')} · ${selectedWorlds.length} 本`,
    },
    user: singleStatus({
      id: userId,
      resource: userResource,
      items: catalog(snapshot, 'users', 'userProfiles', 'personas'),
      emptyTitle: '未绑定用户',
    }),
  }
}

export function clampLauncherAnchor(position, viewport) {
  const width = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport?.width) || TAVERN_LAUNCHER_SIZE)
  const height = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport?.height) || TAVERN_LAUNCHER_SIZE)
  const margin = 8
  return {
    x: Math.min(width - TAVERN_LAUNCHER_SIZE - margin, Math.max(margin, Number(position?.x) || margin)),
    y: Math.min(height - TAVERN_LAUNCHER_SIZE - margin, Math.max(margin, Number(position?.y) || margin)),
  }
}

export function launcherPlacement(anchor, viewport, expanded = false) {
  const point = clampLauncherAnchor(anchor, viewport)
  const opensLeft = point.x + TAVERN_LAUNCHER_PANEL.width > viewport.width - 8
  const opensUp = point.y + TAVERN_LAUNCHER_PANEL.height > viewport.height - 8
  return {
    side: opensLeft ? 'left' : 'right',
    vertical: opensUp ? 'up' : 'down',
    left: expanded && opensLeft ? point.x - TAVERN_LAUNCHER_PANEL.width + TAVERN_LAUNCHER_SIZE : point.x,
    top: expanded && opensUp ? point.y - TAVERN_LAUNCHER_PANEL.height + TAVERN_LAUNCHER_SIZE : point.y,
    anchor: point,
  }
}

export function surfaceTitle(id) {
  return TAVERN_MENU_ITEMS.find(item => item.id === id)?.label ?? ''
}
