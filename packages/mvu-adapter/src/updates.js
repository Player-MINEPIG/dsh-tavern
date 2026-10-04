import { at, fail, json, literal, pathParts, safeKey } from './value.js'
import { parseCommandValue } from './data.js'
import { applyMvuSchema } from './schema.js'

export function parseMvuUpdate(text) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) fail('MVU_LIMIT', 'Reply exceeds 1 MiB')
  const commands = [], covered = []
  for (const match of text.matchAll(/<(json_?patch)>\s*([\s\S]*?)<\/\1>/gi)) {
    let body = match[2].trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const patches = parseCommandValue(body)
    if (!Array.isArray(patches)) fail('MVU_PARSE', 'JSONPatch must be an array')
    for (const patch of patches) {
      if (!patch || !['replace', 'delta', 'insert', 'add', 'remove', 'move'].includes(patch.op)) fail('MVU_UNSUPPORTED', 'Unsupported JSONPatch operation')
      const path = pathParts(patch.path ?? patch.to, true)
      const command = { op: { replace: 'set', delta: 'add', add: 'insert', remove: 'delete' }[patch.op] ?? patch.op, path, index: match.index }
      if (patch.op === 'move') command.from = pathParts(patch.from, true)
      else if (patch.op !== 'remove') { if (!Object.hasOwn(patch, 'value')) fail('MVU_PARSE', 'Patch value is missing'); command.value = patch.value }
      if (command.op === 'insert') { command.key = path.at(-1); command.path = path.slice(0, -1); if (!path.length) fail('MVU_UNSUPPORTED', 'Root insert is unsupported') }
      commands.push(command)
    }
    covered.push([match.index, match.index + match[0].length])
  }
  const re = /_\.(\w+)\s*\(/g
  let match
  while ((match = re.exec(text))) {
    if (covered.some(([a, b]) => match.index >= a && match.index < b)) continue
    if (!['set', 'add', 'insert', 'assign', 'remove', 'unset', 'delete'].includes(match[1])) fail('MVU_UNSUPPORTED', `Unsupported command: ${match[1]}`)
    let i = re.lastIndex, start = i, depth = 0, quote = null, escaped = false, args = []
    for (; i < text.length; i++) {
      const c = text[i]
      if (escaped) { escaped = false; continue }
      if (quote) { if (c === '\\') escaped = true; else if (c === quote) quote = null; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if ('[{('.includes(c)) depth++
      else if (c === ')' && depth === 0) { if (text.slice(start, i).trim()) args.push(parseCommandValue(text.slice(start, i))); break }
      else if (']})'.includes(c)) depth--
      else if (c === ',' && depth === 0) { args.push(parseCommandValue(text.slice(start, i))); start = i + 1 }
    }
    if (i === text.length || depth !== 0) fail('MVU_PARSE', 'Unterminated update command')
    const op = { assign: 'insert', remove: 'delete', unset: 'delete' }[match[1]] ?? match[1]
    if ((op === 'set' && ![2, 3].includes(args.length)) || (op === 'add' && args.length !== 2) || (op === 'insert' && ![2, 3].includes(args.length)) || (op === 'delete' && ![1, 2].includes(args.length))) fail('MVU_PARSE', 'Invalid command arity')
    const command = { op, path: pathParts(args[0]), index: match.index }
    if (op === 'set' || op === 'add') command.value = args.at(-1)
    if (op === 'insert') { command.value = args.at(-1); if (args.length === 3) command.key = safeKey(args[1]) }
    if (op === 'delete' && args.length === 2) command.target = args[1]
    commands.push(command); re.lastIndex = i + 1
  }
  if (commands.length > 1000) fail('MVU_LIMIT', 'Too many update commands')
  return commands.sort((a, b) => a.index - b.index).map(({ index, ...command }) => command)
}

function deriveSchema(value, inherited = false, old = {}) {
  if (Array.isArray(value)) {
    const metadata = value.find(v => v?.$arrayMeta === true && v.$meta)?.$meta ?? {}
    const marker = value.includes('$__META_EXTENSIBLE__$')
    const items = value.filter(v => v !== '$__META_EXTENSIBLE__$' && !(v?.$arrayMeta === true && v.$meta))
    value.splice(0, value.length, ...items)
    const extensible = metadata.extensible === true || marker || inherited || old.extensible === true
    const recursive = inherited || old.recursiveExtensible === true
    const node = { type: 'array', extensible, recursiveExtensible: recursive, elementType: old.elementType ?? { type: 'any' } }
    if (metadata.template !== undefined || old.template !== undefined) node.template = json(metadata.template ?? old.template)
    // Element metadata is consumed even for heterogeneous/VWD collections.
    for (const item of value) deriveSchema(item, recursive)
    return node
  }
  if (value && typeof value === 'object') {
    const meta = value.$meta ?? {}, recursive = meta.recursiveExtensible === true || inherited || old.recursiveExtensible === true
    const extensible = meta.extensible === true || recursive || old.extensible === true
    delete value.$meta
    const properties = {}
    for (const [key, child] of Object.entries(value)) {
      const previous = old.properties?.[key]
      properties[key] = { ...deriveSchema(child, recursive, previous), required: previous?.required ?? (meta.required?.includes(key) || !extensible) }
    }
    const node = { type: 'object', extensible, recursiveExtensible: recursive, properties }
    if (meta.template !== undefined || old.template !== undefined) node.template = json(meta.template ?? old.template)
    for (const key of ['strictSet', 'strictTemplate', 'concatTemplateArray']) if (meta[key] !== undefined || old[key] !== undefined) node[key] = meta[key] ?? old[key]
    return node
  }
  return { type: value === null ? 'any' : typeof value }
}
function mergeData(base, override, depth = 0) {
  if (depth > 64) fail('MVU_LIMIT', 'Template merge exceeds depth')
  if (!base || !override || typeof base !== 'object' || typeof override !== 'object' || Array.isArray(base) !== Array.isArray(override)) return json(override)
  const result = json(base)
  for (const [key, value] of Object.entries(override)) result[safeKey(key)] = Object.hasOwn(result, key) ? mergeData(result[key], value, depth + 1) : json(value)
  return json(result)
}
function applyTemplate(value, template, root) {
  if (template === undefined) return json(value)
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) { if ((value && typeof value === 'object') || root.strictTemplate) return json(value); value = [value] }
    return root.concatTemplateArray === false ? mergeData(template, value) : json([...value, ...template])
  }
  return value && typeof value === 'object' && !Array.isArray(value) && template && typeof template === 'object' ? mergeData(template, value) : json(value)
}
function schemaAt(schema, parts) {
  for (const part of parts) schema = schema?.type === 'array' ? schema.elementType : schema?.properties?.[part]
  return schema
}
function validate(value, schema) {
  if (!schema || schema.type === 'any') return
  if (value === null) return
  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) fail('MVU_SCHEMA', 'Expected object')
    for (const [key, child] of Object.entries(schema.properties ?? {})) { if (child.required && !Object.hasOwn(value, key)) fail('MVU_SCHEMA', `Required key: ${key}`); if (Object.hasOwn(value, key)) validate(value[key], child) }
    if (schema.extensible === false && Object.keys(value).some(key => key !== '$meta' && !Object.hasOwn(schema.properties ?? {}, key))) fail('MVU_SCHEMA', 'Unknown object property')
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('MVU_SCHEMA', 'Expected array')
    for (const item of value) validate(item, schema.elementType)
  } else if (typeof value !== schema.type) fail('MVU_SCHEMA', `Expected ${schema.type}`)
}
export function normalizeVariables(input) {
  const result = json(input)
  if (!result || typeof result.stat_data !== 'object' || result.stat_data === null || Array.isArray(result.stat_data)) fail('MVU_SCHEMA', 'stat_data must be an object')
  result.schema ??= deriveSchema(result.stat_data)
  validate(result.stat_data, result.schema)
  result.initialized_lorebooks ??= {}
  result.display_data ??= json(result.stat_data); result.delta_data ??= {}
  return json(result)
}
function applyCommands(variables, commands) {
  const next = normalizeVariables(variables)
  next.display_data = json(next.stat_data); next.delta_data = {}
  const write = (path, value, remove = false) => {
    if (!path.length) { if (remove) fail('MVU_UNSUPPORTED', 'Cannot delete root'); next.stat_data = value; return }
    const parent = at(next.stat_data, path.slice(0, -1)), key = path.at(-1)
    if (!parent || typeof parent !== 'object') fail('MVU_PATH', 'Target parent is not a collection')
    if (Array.isArray(parent) && (!/^(0|[1-9]\d*)$/.test(String(key)) || Number(key) >= parent.length)) fail('MVU_PATH', 'Array writes require an existing integer index')
    if (remove && Array.isArray(parent)) parent.splice(Number(key), 1)
    else if (remove) delete parent[key]
    else parent[key] = value
  }
  const insert = (path, key, value, useTemplate = true) => {
    const target = at(next.stat_data, path), schema = schemaAt(next.schema, path)
    if (!target || typeof target !== 'object') fail('MVU_SCHEMA', 'Insert target must be a collection')
    if (schema?.extensible === false && (!Object.hasOwn(target, key) || Array.isArray(target))) fail('MVU_SCHEMA', 'Collection is not extensible')
    if (useTemplate) value = applyTemplate(value, schema?.template, next.schema)
    if (Array.isArray(target)) {
      const index = key === '-' ? target.length : Number(key)
      if (!/^(?:0|[1-9]\d*|-)$/.test(String(key)) || !Number.isSafeInteger(index) || index < 0 || index > target.length) fail('MVU_PATH', 'Invalid array index')
      target.splice(index, 0, json(value))
    } else target[safeKey(key)] = json(value)
  }
  const remove = path => {
    at(next.stat_data, path)
    const parentSchema = schemaAt(next.schema, path.slice(0, -1)), targetSchema = schemaAt(next.schema, path)
    if (targetSchema?.required || (parentSchema?.type === 'array' && parentSchema.extensible === false)) fail('MVU_SCHEMA', 'Cannot remove protected field')
    write(path, null, true)
  }
  for (const command of json(commands)) {
    const path = command.path
    if (!Array.isArray(path)) fail('MVU_PATH', 'Command path must be an array')
    path.forEach(safeKey)
    const before = json(next.stat_data)
    if (command.op === 'set' || command.op === 'add') {
      const old = at(next.stat_data, path), described = !next.schema.strictSet && Array.isArray(old) && old.length === 2 && typeof old[1] === 'string' && !Array.isArray(old[0])
      const previous = described ? old[0] : old
      let value = command.value
      if (command.op === 'add') { if (typeof previous !== 'number' || typeof value !== 'number') fail('MVU_UNSUPPORTED', 'Delta requires numeric values'); value = Number((previous + value).toPrecision(12)) }
      else if (typeof previous === 'number' && typeof value === 'string') value = Number(value)
      if (described) write([...path, '0'], value); else write(path, value)
    } else if (command.op === 'insert') {
      if (command.key !== undefined) insert(path, command.key, command.value)
      else {
        const target = at(next.stat_data, path)
        if (Array.isArray(target)) insert(path, '-', command.value)
        else if (command.value && typeof command.value === 'object' && !Array.isArray(command.value)) { if (schemaAt(next.schema, path)?.extensible === false) fail('MVU_SCHEMA', 'Object is not extensible'); for (const [key, value] of Object.entries(command.value)) insert(path, key, Object.hasOwn(target, key) ? mergeData(target[key], value) : value, false) }
        else fail('MVU_SCHEMA', 'Object merge requires an object')
      }
    } else if (command.op === 'delete') {
      if (Object.hasOwn(command, 'target')) {
        const collection = at(next.stat_data, path), target = command.target
        if (!collection || typeof collection !== 'object') fail('MVU_SCHEMA', 'Remove target is not a collection')
        const key = Array.isArray(collection) ? (typeof target === 'number' ? target : collection.findIndex(value => JSON.stringify(value) === JSON.stringify(target))) : (typeof target === 'number' ? Object.keys(collection)[target] : safeKey(target))
        if (key === undefined || key === -1) fail('MVU_PATH_MISSING', 'Remove value is absent')
        remove([...path, safeKey(key)])
      } else remove(path)
    }
    else if (command.op === 'move') {
      const from = command.from; from.forEach(safeKey)
      if (path.length > from.length && from.every((key, i) => path[i] === key)) fail('MVU_PATH', 'Cannot move a parent into its child')
      const value = json(at(next.stat_data, from)); remove(from); insert(path.slice(0, -1), path.at(-1), value)
    } else fail('MVU_UNSUPPORTED', 'Unsupported operation')
    json(next.stat_data); if (!next.mvu_schema) { validate(next.stat_data, next.schema); next.schema = deriveSchema(next.stat_data, false, next.schema) }
    if (JSON.stringify(before) !== JSON.stringify(next.stat_data)) next.delta_data[path.join('.')] = { before, after: json(next.stat_data) }
  }
  next.display_data = json(next.stat_data)
  if (next.mvu_schema) { next.stat_data = applyMvuSchema(next.stat_data, next.mvu_schema); next.display_data = json(next.stat_data) }
  return next
}
export function applyMvuUpdate(variables, commands) {
  let current = normalizeVariables(variables)
  const diagnostics = []
  for (const [index, command] of commands.entries()) {
    try { current = applyCommands(current, [command]) }
    catch (error) {
      if (!['MVU_SCHEMA', 'MVU_PATH_MISSING'].includes(error.code)) throw error
      diagnostics.push({ command: index, code: error.code })
    }
  }
  current.update_diagnostics = diagnostics
  return json(current)
}
export const containsMvuUpdate = text => typeof text === 'string' && /_\.\w+\s*\(|<json_?patch>/i.test(text)
