export const TAVERN_MENU_ITEMS = Object.freeze([
  { id: 'preset', label: '预设', available: true },
  { id: 'world-info', label: '世界信息', available: true },
  { id: 'character', label: '角色卡', available: true },
  { id: 'user', label: '用户', available: false },
])

export const TAVERN_LAUNCHER_SIZE = 44
export const TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 220, height: 244 })

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
  const opensLeft = point.x + (TAVERN_LAUNCHER_PANEL.width / 2) > viewport.width / 2
  const opensUp = point.y + (TAVERN_LAUNCHER_PANEL.height / 2) > viewport.height
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
