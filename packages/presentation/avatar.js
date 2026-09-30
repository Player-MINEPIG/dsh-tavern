export const MAX_AVATAR_LENGTH = 128 * 1024

// Raster data only: no URLs, SVG, credentials, or executable markup.
export function normalizeAvatar(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) throw new TypeError('Avatar exceeds 128 KiB')
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) throw new TypeError('Avatar must be PNG, JPEG or WebP data')
  const bytes = atob(match[2].slice(0, 32))
  const valid = match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n')
    : match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff')
    : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'
  if (!valid) throw new TypeError('Avatar image signature does not match its type')
  return value
}

export function avatarFor(appearance, role, key, defaults = {}) {
  return normalizeAvatar(appearance?.messages?.[key]?.[role])
    ?? normalizeAvatar(appearance?.[role]) ?? defaults[role] ?? null
}

export function editAvatar(timeline, { role, key, scope, avatar }) {
  if (!['user', 'assistant'].includes(role)) throw new TypeError('Invalid avatar role')
  if (!['message', 'playthrough', 'reset-message', 'reset-playthrough'].includes(scope)) throw new TypeError('Invalid avatar scope')
  if (typeof key !== 'string' || key.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError('Invalid message key')
  const next = structuredClone(timeline)
  next.ext ??= {}
  next.ext.pmpDshTavern ??= {}
  const appearance = next.ext.pmpDshTavern.appearance ??= { schemaVersion: 1, messages: {} }
  if (appearance.schemaVersion !== 1) throw new TypeError('Unsupported avatar schema')
  appearance.messages ??= {}
  if (scope === 'message') {
    if (Object.keys(appearance.messages).length >= 500 && !Object.hasOwn(appearance.messages, key)) throw new TypeError('Too many message avatar overrides')
    appearance.messages[key] = { ...appearance.messages[key], [role]: normalizeAvatar(avatar) }
  } else if (scope === 'reset-message') {
    if (Object.hasOwn(appearance.messages, key)) delete appearance.messages[key][role]
  } else {
    if (scope === 'reset-playthrough') delete appearance[role]
    else appearance[role] = normalizeAvatar(avatar)
    // Explicit replace-all includes existing single-message overrides.
    for (const value of Object.values(appearance.messages)) delete value[role]
  }
  for (const [messageKey, overrides] of Object.entries(appearance.messages)) {
    if (!Object.values(overrides).some(value => value != null)) delete appearance.messages[messageKey]
  }
  validateAppearance(appearance)
  return next
}

export function validateAppearance(value) {
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x)
  if (!record(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported avatar schema')
  for (const key of Object.keys(value)) if (!['schemaVersion','user','assistant','messages'].includes(key)) throw new TypeError('Unknown avatar field')
  for (const role of ['user','assistant']) if (value[role] !== undefined) normalizeAvatar(value[role])
  if (!record(value.messages) || Object.keys(value.messages).length > 500) throw new TypeError('Invalid avatar messages')
  for (const [key, overrides] of Object.entries(value.messages)) {
    if (key.length > 500 || ['__proto__','constructor','prototype'].includes(key) || !record(overrides)) throw new TypeError('Invalid avatar message')
    for (const role of Object.keys(overrides)) {
      if (!['user','assistant'].includes(role)) throw new TypeError('Invalid avatar role')
      normalizeAvatar(overrides[role])
    }
  }
  if (JSON.stringify(value).length > 512 * 1024) throw new TypeError('Playthrough avatars exceed 512K serialized characters; clear unused overrides')
  return value
}
