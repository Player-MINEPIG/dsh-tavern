import { applyMvuUpdate, parseMvuUpdate } from './updates.js'
import { fail, json } from './value.js'

/** Source greeting update envelopes only; display scripts are not commands. */
export function applyMvuGreetingInitialization(variables, text) {
  if (!variables) return null
  if (typeof text !== 'string' || text.length > 1024 * 1024) fail('MVU_LIMIT', 'Greeting exceeds 1 MiB')
  const stack = [], blocks = []
  let start
  for (const match of text.matchAll(/<\/?(UpdateVariable|json_?patch)>/gi)) {
    const name = match[1].toLowerCase()
    if (!match[0].startsWith('</')) { if (!stack.length) start = match.index; stack.push(name) }
    else {
      if (stack.pop() !== name) fail('MVU_INITIALIZATION_INVALID', 'Greeting update tags do not match')
      if (!stack.length) blocks.push(text.slice(start, match.index + match[0].length))
    }
  }
  if (stack.length) fail('MVU_INITIALIZATION_INVALID', 'Greeting update block is incomplete')
  let current = json(variables)
  for (const block of blocks) {
    const body = block.match(/^<UpdateVariable>([\s\S]*)<\/UpdateVariable>$/i)?.[1]?.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1')
    const commands = parseMvuUpdate(body?.startsWith('[') ? `<JSONPatch>${body}</JSONPatch>` : block)
    current = applyMvuUpdate(current, commands)
    if (current.update_diagnostics?.length) fail('MVU_INITIALIZATION_INVALID', 'Greeting updates do not match the source variables or schema')
  }
  return current
}
