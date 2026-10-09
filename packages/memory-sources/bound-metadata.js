import { fail } from './policy.js'
export function boundScope(value) {
  if (!value || typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 200
    || value.authority && value.authority !== 'local' || Object.keys(value).some(key => !['authority', 'sessionId'].includes(key))) fail('SOURCE_BOUND_SCOPE', 'A current local session scope is required')
  return Object.freeze({ authority: 'local', sessionId: value.sessionId })
}
export function boundSnapshot(items, revision, checkCurrent) {
  const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }; return value }
  return freeze({ items: structuredClone(items), revision, checkCurrent })
}
