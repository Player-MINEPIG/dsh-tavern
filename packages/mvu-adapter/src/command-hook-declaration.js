import { parse } from 'acorn'

/** The bounded, inline COMMAND_PARSED declaration supported by the source. */
export function commandHookDeclaration(source) {
  if (typeof source !== 'string' || !source.includes('COMMAND_PARSED') || !source.includes('global_Mvu_initialized')) return null
  if (source.length > 64 * 1024) throw Object.assign(new Error('Command Helper exceeds 64 KiB'), { code: 'MVU_COMMAND_HOOK_LIMIT' })
  let tree
  try { tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script' }) }
  catch { throw Object.assign(new Error('Command Helper must be a complete inline script'), { code: 'MVU_COMMAND_HOOK_DECLARATION' }) }
  let parsed = false, initialized = false
  const gates = new Map(), reads = new Map(), pending = [tree]
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'MemberExpression' && !node.computed && node.property.name === 'COMMAND_PARSED') parsed = true
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'eventOn' && node.arguments[0]?.value === 'global_Mvu_initialized') initialized = true
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init?.type === 'MemberExpression' && node.init.object.name === 'globalThis' && !node.init.computed) gates.set(node.id.name, node.init.property.name)
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && !node.computed && ['latestUserText', 'extractOperationBlock'].includes(node.property.name)) {
      if (!reads.has(node.object.name)) reads.set(node.object.name, new Set())
      reads.get(node.object.name).add(node.property.name)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) { if (child?.type) pending.push(child) }
      else if (value?.type) pending.push(value)
    }
  }
  if (!parsed || !initialized) return null
  const globals = [...gates].filter(([name]) => reads.get(name)?.size === 2).map(([, name]) => name)
  if (globals.length > 1 || globals.some(name => !/^[A-Za-z_$][\w$]{0,127}$/.test(name) || ['Mvu', 'console', 'JSON', 'Object', '__proto__', 'constructor', 'prototype'].includes(name))) throw Object.assign(new Error('Ambiguous operation context'), { code: 'MVU_COMMAND_HOOK_DECLARATION' })
  return { protocolVersion: 1, source, ...(globals.length ? { gateGlobal: globals[0] } : {}) }
}

export function commandHookSourceFromCharacter(character) {
  const raw = character?.source?.raw ?? character, data = raw?.data ?? raw
  let helper = data?.extensions?.tavern_helper
  if (Array.isArray(helper)) helper = Object.fromEntries(helper.filter(row => Array.isArray(row) && row.length === 2))
  const sources = []
  const visit = (entries, enabled = true, depth = 0) => {
    if (!Array.isArray(entries) || depth > 8) return
    for (const entry of entries.slice(0, 128)) {
      const value = entry?.value && typeof entry.value === 'object' ? entry.value : entry
      if (!value || typeof value !== 'object') continue
      const active = enabled && value.enabled !== false && value.disabled !== true && entry.enabled !== false && entry.disabled !== true
      if (active && typeof value.content === 'string' && commandHookDeclaration(value.content)) sources.push(value.content)
      visit(value.scripts ?? value.children, active, depth + 1)
    }
  }
  visit(helper?.scripts)
  const unique = [...new Set(sources)]
  if (unique.length > 1) throw Object.assign(new Error('One command Helper must be selected'), { code: 'MVU_COMMAND_HOOK_CONFLICT' })
  return unique[0] ?? null
}
