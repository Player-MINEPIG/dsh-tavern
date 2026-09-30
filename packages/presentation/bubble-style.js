const role = (background, text, border) => ({ background, text, border })
export const BUBBLE_STYLES = Object.freeze([
  { format: 'tavern-bubble', version: 1, name: 'Soft / 柔和', radius: 18, padding: 14, borderWidth: 0, font: 'sans', user: role('#e5efff', '#18335b', '#c5d8f5'), assistant: role('#f1f3f6', '#222c3b', '#d9dfe8') },
  { format: 'tavern-bubble', version: 1, name: 'Paper / 书页', radius: 4, padding: 20, borderWidth: 1, font: 'serif', user: role('#f4ecd9', '#483923', '#d5c6a9'), assistant: role('#fffaf0', '#40392d', '#ded3bd') },
  { format: 'tavern-bubble', version: 1, name: 'Midnight / 夜色', radius: 12, padding: 16, borderWidth: 1, font: 'sans', user: role('#253851', '#e2edff', '#536d8e'), assistant: role('#222733', '#e6e8ef', '#464e62') },
])
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Style must be an object')
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unsupported style field: ${key}`)
}
function number(value, low, high, label) {
  if (!Number.isInteger(value) || value < low || value > high) throw new TypeError(`${label}: ${low}–${high}`)
  return value
}
export function normalizeBubbleStyle(value) {
  fields(value, ['format', 'version', 'name', 'radius', 'padding', 'borderWidth', 'fontSize', 'font', 'user', 'assistant'])
  if (value.format !== 'tavern-bubble' || value.version !== 1) throw new TypeError('Expected tavern-bubble version 1')
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new TypeError('Style name: 1–80 characters')
  if (!['sans', 'serif', 'mono'].includes(value.font)) throw new TypeError('Font: sans, serif or mono')
  const result = { format: 'tavern-bubble', version: 1, name: value.name.trim(), radius: number(value.radius, 0, 32, 'radius'), padding: number(value.padding, 8, 24, 'padding'), borderWidth: number(value.borderWidth, 0, 3, 'borderWidth'), font: value.font }
  if (value.fontSize !== undefined) result.fontSize = number(value.fontSize, 8, 48, 'fontSize')
  for (const key of ['user', 'assistant']) {
    fields(value[key], ['background', 'text', 'border'])
    result[key] = {}
    for (const token of ['background', 'text', 'border']) {
      if (!/^#[a-f0-9]{6}$/i.test(value[key][token])) throw new TypeError(`${key}.${token}: use #RRGGBB`)
      result[key][token] = value[key][token]
    }
  }
  return result
}
export function bubbleCss(style, role = 'assistant') {
  const value = normalizeBubbleStyle(style ?? BUBBLE_STYLES[0])
  return { ...(value.fontSize === undefined ? {} : { fontSize: value.fontSize }), background: value[role].background, color: value[role].text, border: `${value.borderWidth}px solid ${value[role].border}`, borderRadius: value.radius, padding: value.padding, fontFamily: { sans: 'system-ui, sans-serif', serif: 'Georgia, serif', mono: 'ui-monospace, monospace' }[value.font] }
}
