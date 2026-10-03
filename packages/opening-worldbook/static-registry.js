import { parseExpressionAt } from 'acorn'
import { createHash } from 'node:crypto'
import { OPENING_IDENTITY_SHA256, OPENING_SOURCES, OPENING_IDS } from './manifest.js'

export const sha256 = text => createHash('sha256').update(text).digest('hex')
export function openingFail(code, message, status = 400) { const error = new Error(message); Object.assign(error, { code, status }); throw error }
const invalid = () => openingFail('OPENING_STATIC_SOURCE', 'The fixed source does not match the supported literal structure')
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function expression(source, offset) {
  const node = parseExpressionAt(source, offset, { ecmaVersion: 'latest' })
  if (node.end - node.start > 256 * 1024) invalid()
  return node
}
function arrayExpression(source, offset) {
  const node = expression(source, offset)
  // Consume the array literal only. A following .join() is source syntax, not
  // an operation granted to this parser.
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'join'
    && node.arguments.length === 1 && node.arguments[0].type === 'Literal' && node.arguments[0].value === '\n' && node.callee.object.type === 'ArrayExpression') return node.callee.object
  return node
}
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) invalid()
  const node = expression(source, start)
  if (node.type !== 'FunctionExpression') invalid()
  return node.body.body
}
function declaration(statements, name) {
  const node = statements.flatMap(s => s.type === 'VariableDeclaration' ? s.declarations : []).find(d => d.id.name === name)?.init
  if (!node) invalid()
  return node
}
// A bounded data-expression reader, not a JavaScript evaluator. No functions,
// imports, assignments, prototype access, executable templates or arbitrary calls.
function data(node, env = {}, depth = 0) {
  if (!node || depth > 24) invalid()
  const read = child => data(child, env, depth + 1)
  if (node.type === 'Literal' && !node.regex && ['string', 'number', 'boolean'].includes(typeof node.value)) return node.value
  if (node.type === 'Literal' && node.value === null) return null
  if (node.type === 'Identifier' && Object.hasOwn(env, node.name)) return env[node.name]
  if (node.type === 'ArrayExpression' && node.elements.length <= 128) return node.elements.map(read)
  if (node.type === 'ObjectExpression' && node.properties.length <= 64) {
    const result = Object.create(null)
    for (const prop of node.properties) {
      const key = prop.key?.name ?? prop.key?.value
      if (prop.type !== 'Property' || prop.computed || prop.method || prop.kind !== 'init' || typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid()
      result[key] = read(prop.value)
    }
    return result
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const a = read(node.left), b = read(node.right)
    if (!['string', 'number'].includes(typeof a) || !['string', 'number'].includes(typeof b)) invalid()
    return a + b
  }
  invalid()
}
function arrayConst(source, name) {
  const marker = `const ${name} =`, index = source.indexOf(marker)
  if (index < 0) invalid()
  const result = data(arrayExpression(source, index + marker.length))
  if (!Array.isArray(result)) invalid()
  return result
}
function textArray(value) {
  if (!Array.isArray(value) || !value.length || value.some(v => typeof v !== 'string')) invalid()
  const result = value.join('\n')
  if (!result.trim()) invalid()
  return result
}
function arrayAfter(source, marker, from = 0) {
  const index = source.indexOf(marker, from)
  if (index < 0) invalid()
  // Acorn parses the literal and never invokes the surrounding source.
  const start = source.indexOf('[', index + marker.length)
  if (start < 0) invalid()
  return data(arrayExpression(source, start))
}
function persona(source, roleConstant) {
  const role = source.indexOf(`name: ${roleConstant}`), prop = source.indexOf('personaContent:', role)
  if (role < 0 || prop < 0) invalid()
  const next = source.indexOf('\n      affectionChain:', prop), wrapper = source.indexOf('encounterBranchPersonaContent(', prop)
  return textArray(wrapper >= 0 && (next < 0 || wrapper < next) ? arrayAfter(source, ',', wrapper) : arrayAfter(source, 'personaContent:', role))
}
function affection(identity, roleName, chain) {
  const statements = fn(identity, 'openingAffectionChainWorldbookText')
  const lines = data(declaration(statements, 'lines'), { roleName })
  const numerals = data(declaration(statements, 'numerals'))
  if (!Array.isArray(lines) || !Array.isArray(numerals) || !chain.length || chain.length > 6) invalid()
  // Only the known data fields are substituted. Source callback bodies are not run.
  for (let index = 0; index < chain.length; index++) {
    const item = chain[index]
    if (!plain(item) || typeof item.title !== 'string' || typeof item.summary !== 'string') invalid()
    lines.push(`- 事件${item.numeral || numerals[index] || String(index + 1)}:`)
    lines.push(`  好感阈值: ${item.threshold ?? ''}`)
    if (item.obeyThreshold !== undefined && item.obeyThreshold !== '') lines.push(`  服从阈值: ${item.obeyThreshold}`)
    lines.push(`  事件名: ${item.title || `事件${numerals[index] || String(index + 1)}`}`)
    lines.push(`  事件描述: ${item.summary || ''}`)
  }
  lines.push(`</${roleName}好感链>`)
  return textArray(lines)
}
function entry(args) {
  const [name, keys, content, options = {}] = args
  if (typeof name !== 'string' || !name || !Array.isArray(keys) || keys.some(k => typeof k !== 'string') || typeof content !== 'string' || !content.trim()) invalid()
  return { name, enabled: options.enabled !== false,
    strategy: { type: 'selective', keys, keys_secondary: { logic: 'and_any', keys: options.secondary ?? [] }, scan_depth: 'same_as_global' },
    position: { type: 'at_depth', role: 'system', depth: options.depth ?? 2, order: options.order ?? 92 }, content, probability: 100,
    recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null }, effect: { sticky: null, cooldown: null, delay: null }, extra: { comment: name } }
}
function variable(identity, roleName) {
  const result = fn(identity, 'openingVariableWorldbookEntry').find(s => s.type === 'ReturnStatement')?.argument
  if (result?.type !== 'CallExpression' || result.callee.name !== 'openingWorldbookEntry') invalid()
  return entry(result.arguments.map(n => data(n, { roleName })))
}
function registry(identity, source, family) {
  const env = family === 'Police' ? {
    persona: textArray(arrayConst(source, 'ST_POLICE_ATTENTION_PERSONA')),
    updateRules: textArray(arrayConst(source, 'ST_POLICE_ATTENTION_UPDATE_RULES')),
    event: textArray(arrayConst(source, 'ST_POLICE_ATTENTION_EVENT')),
    traitRoom: textArray(arrayConst(source, 'ST_POLICE_TRAIT_ROOM_EVENT')),
    affection: affection(identity, '九鬼真白', arrayConst(source, 'ST_POLICE_ATTENTION_AFFECTION_CHAIN')),
    completion: textArray(arrayAfter(source, 'encounterWorldbookEntry("[mvu_plot]警视厅担保结束"')),
  } : {
    honamiPersona: persona(source, 'ST_HOSPITAL_MOTHER_ROLE_NAME'),
    saraPersona: persona(source, 'ST_HOSPITAL_NURSE_ROLE_NAME'),
    honamiAffection: affection(identity, '犬冢穗波', arrayConst(source, 'ST_HOSPITAL_HONAMI_AFFECTION_CHAIN')),
    saraAffection: affection(identity, '天城纱良', arrayConst(source, 'ST_HOSPITAL_SARA_AFFECTION_CHAIN')),
    opening: textArray(arrayAfter(source, 'encounterWorldbookEntry("[mvu_plot]医院线初遇：犬冢穗波与天城纱良"')),
    completion: textArray(arrayAfter(source, 'encounterWorldbookEntry("[mvu_plot]医院改造室开放"')),
  }
  const statements = fn(identity, `openingFull${family}EntriesFromSource`)
  for (const name of family === 'Police' ? ['roleKeys'] : ['honamiKeys', 'saraKeys']) env[name] = data(declaration(statements, name))
  const nodes = statements.find(s => s.type === 'ReturnStatement')?.argument
  if (nodes?.type !== 'ArrayExpression') invalid()
  return nodes.elements.map(call => {
    if (call?.type !== 'CallExpression' || call.optional) invalid()
    if (call.callee.name === 'openingVariableWorldbookEntry' && call.arguments.length === 1) return variable(identity, data(call.arguments[0]))
    if (call.callee.name !== 'openingWorldbookEntry') invalid()
    return entry(call.arguments.map(n => data(n, env)))
  })
}
export function createStaticOpeningRegistry({ identitySha256 = OPENING_IDENTITY_SHA256, sources = OPENING_SOURCES } = {}) {
  return ({ openingId, identitySource, source }) => {
    if (!OPENING_IDS.includes(openingId)) openingFail('OPENING_ID', 'Unsupported opening')
    if (typeof identitySource !== 'string' || Buffer.byteLength(identitySource) > 256 * 1024 || sha256(identitySource) !== identitySha256) openingFail('OPENING_SOURCE_HASH', 'Fixed identity source hash mismatch')
    if (['default', 'alisa_party'].includes(openingId)) return []
    const fixed = sources.find(s => s.url === source?.url && s.sha256 === source?.sha256)
    if (!fixed || typeof source.content !== 'string' || Buffer.byteLength(source.content) > 8 * 1024 * 1024 || sha256(source.content) !== fixed.sha256) openingFail('OPENING_SOURCE_HASH', 'Fixed sibling source hash mismatch')
    const police = openingId !== 'hospital_done' ? registry(identitySource, source.content, 'Police') : []
    const hospital = openingId !== 'police_done' ? registry(identitySource, source.content, 'Hospital') : []
    if (police.length && police.length !== 7 || hospital.length && hospital.length !== 8) invalid()
    const entries = [...new Map([...police, ...hospital].map(e => [e.name, e])).values()]
    if (entries.length !== ({ police_done: 7, hospital_done: 8, pool: 15 }[openingId]) || Buffer.byteLength(JSON.stringify(entries)) > 2 * 1024 * 1024) invalid()
    return entries
  }
}
