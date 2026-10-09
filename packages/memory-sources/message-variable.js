import { stringify } from 'yaml'
export const MESSAGE_STATE_MACRO = 'format_message_variable::stat_data'
export const hasMessageStateMacro = text => /\{\{\s*format_message_variable::stat_data\s*\}\}/.test(text)
function visible(value) {
  if (Array.isArray(value)) return value.map(visible)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('$')).map(([key, item]) => [key, visible(item)]))
  return value
}
// Plain JSON data only. No Helper code or variable script is executed.
export const formatMessageState = variables => stringify(visible(variables.stat_data), { blockQuote: 'literal' }).trimEnd()
