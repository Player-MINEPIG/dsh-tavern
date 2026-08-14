export const TAVERN_MENU_ITEMS = Object.freeze([
  { id: 'preset', label: '预设', available: true },
  { id: 'world-info', label: '世界信息', available: true },
  { id: 'character', label: '角色卡', available: true },
  { id: 'user', label: '用户', available: false },
])

export function surfaceTitle(id) {
  return TAVERN_MENU_ITEMS.find(item => item.id === id)?.label ?? ''
}
