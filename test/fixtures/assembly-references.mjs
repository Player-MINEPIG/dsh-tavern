// Explicit module-order fixtures remain useful after their reference catalog entries retire.
import { DEFAULT_RULES, NATIVE_RULES } from 'dsh-prompt-assembler/adapters/tavern'
import { normalizePreset, FORMAT } from 'dsh-prompt-assembler/model'
const policy = value => normalizePreset({ format: FORMAT, version: 1, name: 'Module-order test fixture', ...value })
export const MODULE_ORDER = policy({ rules: [0, 1, 2, 3, 5, 6, 4, 7].map(i => DEFAULT_RULES[i]) })
export const NATIVE_LORE_LAST = policy({ backend: 'native', rules: [...NATIVE_RULES.filter(r => !['worldbook', 'phi'].includes(r.kind)), { ...DEFAULT_RULES[4], role: 'user', delivery: 'context' }, { ...DEFAULT_RULES[7], role: 'user', delivery: 'pre-step' }] })
export const NATIVE_PHI_LAST = policy({ backend: 'native', rules: [...NATIVE_RULES.filter(r => r.kind !== 'phi'), { ...DEFAULT_RULES[7], role: 'user', delivery: 'pre-step' }] })
