import { parseMvuUpdate } from './updates.js'
import { fail, json, pathParts } from './value.js'

const path = parts => parts.map((part, i) => /^[^.[\]\"'\\]+$/.test(part) ? (i ? '.' : '') + part : `[${JSON.stringify(part)}]`).join('')
const canonical = commands => json(commands.map(({ full_match, reason, source_args, ...command }) => command))
const fingerprint = command => JSON.stringify(Object.fromEntries(Object.entries(command).sort(([a], [b]) => a.localeCompare(b))))
export function commandHookView(commands) {
  return commands.map(command => {
    const args = [path(command.path)]
    if (command.source_args) args.push(...command.source_args)
    else if (command.op === 'move') args.unshift(path(command.from))
    else if (command.op === 'insert' && command.key !== undefined) args.push(JSON.stringify(command.key), JSON.stringify(command.value))
    else if (['set', 'add', 'insert'].includes(command.op)) args.push(JSON.stringify(command.value))
    else if (command.target !== undefined) args.push(JSON.stringify(command.target))
    return { type: command.op, args, full_match: command.full_match ?? '', reason: command.reason ?? '' }
  })
}

// Only the actual Helper's missing-value separator grammar is recoverable.
// This scanner visits top-level operation objects, never nested user values.
function missingValuePatch(body) {
  if (!/^\s*\[/.test(body)) return null
  const edits = [], stack = []; let quoted = false, escaped = false
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue }
    if (char === '"') { quoted = true; continue }
    if (char === '{' && stack.length === 1 && stack[0] === '[') {
      const match = /^\{\s*"op"\s*:\s*"(?:add|replace)"\s*,\s*"path"\s*:\s*"(?:\\.|[^"\\])*"\s*(:)(?=\s*[\[{])/.exec(body.slice(i))
      if (match) edits.push(i + match[0].length - 1)
    }
    if (char === '{' || char === '[') stack.push(char)
    else if (char === '}' || char === ']') { if (stack.pop() !== (char === '}' ? '{' : '[')) return null }
  }
  if (quoted || stack.length || !edits.length) return null
  for (const at of edits.reverse()) body = body.slice(0, at) + ',"value":' + body.slice(at + 1)
  return body
}
function admittedRepair(text) {
  const patches = [...text.matchAll(/<(json_?patch)>([\s\S]*?)<\/\1>/gi)]
  let body, repair = false
  if (patches.length === 1) { body = patches[0][2]; repair = true }
  else if (patches.length || /<\/?json_?patch>/i.test(text)) return null
  else {
    const wrappers = [...text.matchAll(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi)]
    if (wrappers.length !== 1) return null
    body = wrappers[0][1]
    if (/[<>]/.test(body)) return null
  }
  body = body.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const normalized = repair ? missingValuePatch(body) : body
  if (!normalized) return null
  let operations
  try { operations = JSON.parse(normalized) } catch { return null }
  if (!Array.isArray(operations) || !operations.length || operations.some(op => !op || !['add', 'replace', 'remove'].includes(op.op) || Object.keys(op).sort().join(',') !== (op.op === 'remove' ? 'op,path' : 'op,path,value'))) return null
  try { return parseMvuUpdate(`<JSONPatch>${JSON.stringify(operations)}</JSONPatch>`, { source: true }) } catch { return null }
}
export function commandHookInput(text) {
  let commands, error
  try { commands = parseMvuUpdate(text, { source: true }) }
  catch (caught) {
    if (caught.code !== 'MVU_PARSE') throw caught
    error = caught; commands = []
  }
  const admitted = commands.length ? commands : admittedRepair(text)
  if (error && !admitted) throw error
  return { view: commandHookView(commands), admitted: canonical(admitted ?? commands), repairs: commands.length ? [] : (admitted ?? []).map(command => ({ command: canonical([command])[0], full_match: command.full_match })) }
}
export function commandsFromHook(view, admitted, repairs = []) {
  if (!Array.isArray(view) || view.length > 1000) fail('MVU_COMMAND_HOOK_OUTPUT', 'Invalid command list')
  const commands = view.flatMap(command => {
    if (!command || typeof command.type !== 'string' || !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string')) fail('MVU_COMMAND_HOOK_OUTPUT', 'Invalid command view')
    // Recovered JSONPatch text remains authoritative for escaped pointer keys.
    // Accept only the literal command factory shape derived from that one patch;
    // a changed arg, value or full_match cannot redirect a repair.
    const repair = repairs.find(item => item.full_match === command.full_match)
    if (repair) {
      const patch = JSON.parse(repair.full_match), rawPath = patch.path.slice(1).replaceAll('/', '.')
      let type, args
      if (patch.op === 'replace') { type = 'set'; args = [rawPath, JSON.stringify(patch.value)] }
      else if (patch.op === 'remove') { type = 'delete'; args = [rawPath] }
      else {
        const parts = rawPath.split('.'), key = parts.pop()
        type = 'insert'; args = [parts.join('.'), /^\d+$/.test(key) ? key : "'" + key + "'", JSON.stringify(patch.value)]
      }
      if (command.type !== type || JSON.stringify(command.args) !== JSON.stringify(args)) fail('MVU_COMMAND_HOOK_OUTPUT', 'Processor changed the recovered patch')
      return [repair.command]
    }
    if (command.type === 'move') {
      if (command.args.length !== 2) fail('MVU_COMMAND_HOOK_OUTPUT', 'Invalid move')
      return [{ op: 'move', from: pathParts(command.args[0]), path: pathParts(command.args[1]) }]
    }
    if (!['set', 'add', 'insert', 'assign', 'delete', 'unset', 'remove'].includes(command.type)) fail('MVU_COMMAND_HOOK_OUTPUT', 'Unsupported command')
    return canonical(parseMvuUpdate(`_.${command.type}(${command.args.map((arg, i) => i === 0 ? JSON.stringify(arg) : arg).join(',')});`))
  })
  // The fixed source adapter permits filtering or literal repair, not arbitrary
  // new writes. Preserve source order and repeated commands' multiplicity.
  let cursor = 0
  for (const command of commands) {
    const signature = fingerprint(command)
    while (cursor < admitted.length && fingerprint(admitted[cursor]) !== signature) cursor++
    if (cursor === admitted.length) fail('MVU_COMMAND_HOOK_OUTPUT', 'Processor changed the source candidate')
    cursor++
  }
  return commands
}
