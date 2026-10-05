export const FORMAT = 'dsh-tavern-request-assembly'
export const MODULES = Object.freeze(['native-system', 'preset', 'character', 'persona', 'worldbook', 'history', 'input', 'phi', 'custom'])
export const DEFAULT_RULES = Object.freeze([
  { id: 'native-system', kind: 'native-system', enabled: true },
  { id: 'preset', kind: 'preset', enabled: true },
  { id: 'persona', kind: 'persona', enabled: true },
  { id: 'character', kind: 'character', enabled: true },
  { id: 'worldbook', kind: 'worldbook', enabled: true },
  { id: 'history', kind: 'history', enabled: true },
  { id: 'input', kind: 'input', enabled: true },
  { id: 'phi', kind: 'phi', enabled: true },
])
export function normalizePreset(value) {
  if (!value || value.format !== FORMAT || value.version !== 1) throw new TypeError('Unsupported assembly preset format/version')
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) throw new TypeError('Preset name is required (max 200 characters)')
  if (!Array.isArray(value.rules) || value.rules.length > 128) throw new TypeError('Expected at most 128 assembly rules')
  const ids = new Set(), kinds = new Set()
  const rules = value.rules.map(rule => {
    if (!rule || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) throw new TypeError('Rule ids must be unique')
    if (typeof rule.kind !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(rule.kind)) throw new TypeError('Invalid or duplicate module')
    ids.add(rule.id); kinds.add(rule.kind)
    const role = rule.kind === 'custom' ? (rule.role === 'preserve' ? 'system' : rule.role ?? 'user') : rule.role ?? 'preserve', lifetime = rule.lifetime ?? 'request'
    if (!['preserve', 'system', 'user', 'assistant'].includes(role)) throw new TypeError('Invalid role')
    if (!['request', 'snapshot'].includes(lifetime)) throw new TypeError('Invalid lifetime')
    if (rule.depth !== undefined && rule.depth !== null && (!Number.isInteger(rule.depth) || rule.depth < 0 || rule.depth > 10000)) throw new TypeError('Invalid insertion depth')
    if (typeof (rule.text ?? '') !== 'string' || (rule.text ?? '').length > 524288) throw new TypeError('Custom text exceeds limit')
    return { id: rule.id, kind: rule.kind, enabled: rule.enabled !== false, role, lifetime, depth: rule.depth ?? null, text: rule.text ?? '', name: typeof rule.name === 'string' ? rule.name.slice(0, 200) : '' }
  })
  return { format: FORMAT, version: 1, name: value.name.trim(), placement: value.placement === 'st' ? 'st' : 'modules', rules }
}
export const BUILTINS = Object.freeze([
  { id: 'builtin-st', ...normalizePreset({ format: FORMAT, version: 1, name: 'ST 兼容 / ST compatible', placement: 'st', rules: DEFAULT_RULES }) },
  { id: 'builtin-cache', ...normalizePreset({ format: FORMAT, version: 1, name: '缓存友好 / Cache friendly', rules: [DEFAULT_RULES[0], DEFAULT_RULES[1], DEFAULT_RULES[2], DEFAULT_RULES[3], DEFAULT_RULES[5], DEFAULT_RULES[6], DEFAULT_RULES[4], DEFAULT_RULES[7]] }) },
  { id: 'builtin-snapshots', ...normalizePreset({ format: FORMAT, version: 1, name: '追加快照 / Append snapshots', rules: [DEFAULT_RULES[0], DEFAULT_RULES[1], DEFAULT_RULES[2], DEFAULT_RULES[3], DEFAULT_RULES[5], DEFAULT_RULES[6], { ...DEFAULT_RULES[4], lifetime: 'snapshot' }, DEFAULT_RULES[7]] }) },
])
export function moveRule(rules, id, targetId) {
  const from = rules.findIndex(r => r.id === id), to = rules.findIndex(r => r.id === targetId)
  if (from < 0 || to < 0 || from === to) return rules
  const copy = [...rules], [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy
}
