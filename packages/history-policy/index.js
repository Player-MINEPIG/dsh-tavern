/** Tavern-owned opt-in selectors; the generic filtering engine lives in assembler. */
export const TAVERN_HISTORY_FRAGMENT_PRESETS = Object.freeze([
  { name: 'MVU 变量更新（独立行）', rule: { id: 'tavern-mvu-update', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: false } },
])

export async function mountTavernHistoryPolicyPanel(container, options) {
  const { mountHistoryPolicyPanel } = await import('dsh-prompt-assembler/history-client')
  return mountHistoryPolicyPanel(container, { ...options, fragmentPresets: TAVERN_HISTORY_FRAGMENT_PRESETS })
}
