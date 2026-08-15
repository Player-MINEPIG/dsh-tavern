export const TAVERN_MENU_ITEMS = Object.freeze([
  { id: 'preset', labelKey: 'nav.preset', emptyTitleKey: 'nav.preset.empty', available: true },
  { id: 'character', labelKey: 'nav.character', emptyTitleKey: 'nav.character.empty', available: true },
  { id: 'world-info', labelKey: 'nav.worldBook', emptyTitleKey: 'nav.worldBook.empty', available: true },
  { id: 'user', labelKey: 'nav.user', emptyTitleKey: 'nav.user.empty', available: true },
  { id: 'session-template', labelKey: 'nav.sessionTemplate', emptyTitleKey: 'nav.sessionTemplate.empty', available: true, binding: false, showBinding: false },
  { id: 'settings', labelKey: 'nav.settings', emptyTitleKey: 'nav.settings.empty', available: true, binding: false, showBinding: false },
])

export const TAVERN_LAUNCHER_SIZE = 44
export const TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 300, height: 376 })

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

function singleStatus({ id, resource, items, emptyTitleKey }) {
  const bound = id !== null && id !== undefined && id !== ''
  const directResource = isRecord(resource)
    && (resource.id === undefined || String(resource.id) === String(id))
    ? resource
    : null
  const resolved = firstRecord(directResource, bound ? findResourceById(items, id) : null)
  return {
    bound,
    title: bound ? resourceTitle(resolved, String(id)) : null,
    titleKey: bound ? null : emptyTitleKey,
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
  const worldTitles = selectedWorlds.map(resource => resourceTitle(resource, String(resource.id ?? resource.resourceId ?? '')))

  return {
    preset: singleStatus({
      id: presetId,
      resource: presetResource,
      items: catalog(snapshot, 'presets', 'preset'),
      emptyTitleKey: 'nav.preset.empty',
    }),
    character: singleStatus({
      id: characterId,
      resource: characterResource,
      items: catalog(snapshot, 'characters', 'characterCards', 'character'),
      emptyTitleKey: 'nav.character.empty',
    }),
    'world-info': {
      bound: selectedWorlds.length > 0,
      count: selectedWorlds.length,
      title: selectedWorlds.length === 0
        ? null
        : selectedWorlds.length === 1
          ? worldTitles[0]
          : worldTitles.join(' · '),
      titleKey: selectedWorlds.length === 0 ? 'nav.worldBook.empty' : null,
    },
    user: singleStatus({
      id: userId,
      resource: userResource,
      items: catalog(snapshot, 'users', 'userProfiles', 'personas'),
      emptyTitleKey: 'nav.user.empty',
    }),
    'session-template': { bound: false, count: 0, title: null, titleKey: 'nav.sessionTemplate.empty' },
    settings: { bound: false, count: 0, title: null, titleKey: 'nav.settings.empty' },
  }
}

export function clampLauncherAnchor(position, viewport, scale = 1) {
  const width = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport?.width) || TAVERN_LAUNCHER_SIZE)
  const height = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport?.height) || TAVERN_LAUNCHER_SIZE)
  const launcherSize = TAVERN_LAUNCHER_SIZE * Math.max(0.1, Number(scale) || 1)
  const margin = 8
  return {
    x: Math.min(width - launcherSize - margin, Math.max(margin, Number(position?.x) || margin)),
    y: Math.min(height - launcherSize - margin, Math.max(margin, Number(position?.y) || margin)),
  }
}

export function launcherPlacement(anchor, viewport, expanded = false, scale = 1) {
  const factor = Math.max(0.1, Number(scale) || 1)
  const point = clampLauncherAnchor(anchor, viewport, factor)
  const panelWidth = TAVERN_LAUNCHER_PANEL.width * factor
  const panelHeight = TAVERN_LAUNCHER_PANEL.height * factor
  const launcherSize = TAVERN_LAUNCHER_SIZE * factor
  const opensLeft = point.x + panelWidth > viewport.width - 8
  const opensUp = point.y + panelHeight > viewport.height - 8
  return {
    side: opensLeft ? 'left' : 'right',
    vertical: opensUp ? 'up' : 'down',
    left: expanded && opensLeft ? point.x - panelWidth + launcherSize : point.x,
    top: expanded && opensUp ? point.y - panelHeight + launcherSize : point.y,
    anchor: point,
  }
}

export function surfaceTitle(id) {
  return TAVERN_MENU_ITEMS.find(item => item.id === id)?.labelKey ?? ''
}
