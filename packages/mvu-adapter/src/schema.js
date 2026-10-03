import { parse, parseExpressionAt } from 'acorn'
import { fail, json, safeKey } from './value.js'
import { compileFiniteRegex, testFiniteRegex } from './regex.js'

// Runtime capabilities are branded with private Symbols; JSON data cannot forge them.
const BUILTIN = Symbol('builtin'), SCHEMA = Symbol('schema'), FUNCTION = Symbol('function'), METHOD = Symbol('method'), REGEX = Symbol('regex'), ISSUES = Symbol('issues'), SHORT = Symbol('optional-chain'), CELL = Symbol('parameter-cell'), UNINITIALIZED = Symbol('uninitialized')
const builtin = name => ({ [BUILTIN]: true, builtin: name })
const schema = (kind, fields = {}) => ({ [SCHEMA]: true, kind, ...fields })
const capability = value => value && typeof value === 'object' && [BUILTIN, SCHEMA, FUNCTION, METHOD, REGEX, ISSUES, CELL].some(key => Object.hasOwn(value, key))
function data(value) {
  let count = 0
  const check = (item, depth) => {
    if (++count > 100000 || depth > 64) fail('MVU_LIMIT', 'Data exceeds structural limits')
    if (capability(item)) fail('MVU_SCHEMA_CODE', 'Interpreter capabilities are not JSON data')
    if (item && typeof item === 'object') for (const child of Object.values(item)) check(child, depth + 1)
  }
  check(value, 0)
  return json(value)
}
const mathFunctions = { abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round, sqrt: Math.sqrt, pow: Math.pow, min: Math.min, max: Math.max, trunc: Math.trunc, log: Math.log, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan }
const boundedBinary = (operation, left, right) => {
  if ((left !== null && typeof left === 'object') || (right !== null && typeof right === 'object')) fail('MVU_SCHEMA_CODE', 'Arithmetic requires scalar operands')
  if ((typeof left === 'string' || typeof right === 'string') && String(left).length + String(right).length > 128 * 1024) fail('MVU_LIMIT', 'Intermediate string exceeds limit')
  const result = operation(left, right)
  if (typeof result === 'number' && !Number.isFinite(result)) fail('MVU_LIMIT', 'Non-finite arithmetic result')
  return result
}
const binary = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b, '**': (a, b) => a ** b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '===': (a, b) => a === b, '!==': (a, b) => a !== b, '==': (a, b) => a == b, '!=': (a, b) => a != b }
const RETURN = Symbol('return')
const isFunction = node => ['ArrowFunctionExpression', 'FunctionExpression'].includes(node?.type)
const parameterName = node => node.type === 'AssignmentPattern' ? node.left.name : node.name
const ownPropertyCall = node => node?.type === 'MemberExpression' && !node.computed && !node.optional && node.property.name === 'call' && node.object?.type === 'MemberExpression' && !node.object.computed && !node.object.optional && node.object.property.name === 'hasOwnProperty' && node.object.object?.type === 'MemberExpression' && !node.object.object.computed && !node.object.object.optional && node.object.object.property.name === 'prototype' && node.object.object.object?.type === 'Identifier' && node.object.object.object.name === 'Object'
function freezeData(value, tick, seen = new WeakSet(), depth = 0) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  if (depth > 64) fail('MVU_LIMIT', 'Schema graph depth exceeds limit')
  tick(); seen.add(value)
  for (const child of Object.values(value)) freezeData(child, tick, seen, depth + 1)
  Object.freeze(value)
}
function machine() {
  let fuel = 10000, depth = 0
  const tick = () => { if (--fuel < 0 || depth > 64) fail('MVU_LIMIT', 'Schema computation limit exceeded') }
  const copyEnv = env => { for (const _ of Object.keys(env)) tick(); return { ...env } }
  const keyOf = (node, env) => safeKey(node.computed ? evaluate(node.property, env) : node.property.name)
  const declare = (nodes, env) => {
    for (let node of nodes) {
      if (node.type === 'ExportNamedDeclaration') node = node.declaration
      if (node?.type === 'VariableDeclaration') for (const declaration of node.declarations) {
        tick(); if (node.kind !== 'const' || declaration.id.type !== 'Identifier') fail('MVU_SCHEMA_CODE', 'Only const identifier declarations are supported')
        env[safeKey(declaration.id.name)] = { [CELL]: true, value: UNINITIALIZED }
      }
    }
  }
  const call = (fn, args) => {
    tick()
    if (fn?.[FUNCTION]) {
      const env = copyEnv(fn.env)
      if (fn.name) env[fn.name] = fn
      fn.params.forEach(param => { tick(); env[safeKey(parameterName(param))] = { [CELL]: true, value: UNINITIALIZED } })
      depth++
      try {
        fn.params.forEach((param, i) => { tick(); env[parameterName(param)].value = args[i] === undefined && param.type === 'AssignmentPattern' ? evaluate(param.right, env) : args[i] })
        const result = fn.body.type === 'BlockStatement' ? statement(fn.body, env) : evaluate(fn.body, env)
        return result?.[RETURN] ? result.value : result
      }
      finally { depth-- }
    }
    if (fn?.[ISSUES]) {
      if (args.length !== 1 || !args[0] || Object.keys(args[0]).some(key => !['code', 'path', 'message'].includes(key))) fail('MVU_SCHEMA_CODE', 'Invalid custom refinement issue')
      const { code = 'custom', path = [], message = 'Schema refinement rejected value' } = args[0]
      if (code !== 'custom' || !Array.isArray(path) || path.length > 64 || typeof message !== 'string' || message.length > 1024) fail('MVU_SCHEMA_CODE', 'Invalid custom refinement issue')
      fn[ISSUES].push({ code, path: path.map(safeKey), message })
      return undefined
    }
    const name = fn?.[BUILTIN] ? fn.builtin : undefined
    if (name === '_.clamp') { if (args.length !== 3 || args.some(x => typeof x !== 'number')) fail('MVU_SCHEMA_CODE', 'clamp requires three numbers'); return Math.min(Math.max(args[0], args[1]), args[2]) }
    const math = /^(?:Math\.|math\.)?([a-z]+)$/.exec(name ?? '')?.[1]
    if (math && Object.hasOwn(mathFunctions, math)) { if (args.some(x => typeof x !== 'number') || args.length > 1000) fail('MVU_SCHEMA_CODE', 'Math requires numeric arguments'); const result = mathFunctions[math](...args); if (!Number.isFinite(result)) fail('MVU_LIMIT', 'Non-finite arithmetic result'); return result }
    if (name?.startsWith('z.')) {
      const kind = name.slice(2).replace(/^coerce\./, ''), coerce = name.startsWith('z.coerce.')
      if (['number', 'string', 'boolean', 'any', 'unknown'].includes(kind)) return schema(kind, { coerce })
      if (kind === 'object') { if (!args[0] || Array.isArray(args[0]) || Object.values(args[0]).some(v => !v?.[SCHEMA])) fail('MVU_SCHEMA_CODE', 'Object requires schema properties'); return schema(kind, { properties: args[0] }) }
      if (kind === 'array') { if (!args[0]?.[SCHEMA]) fail('MVU_SCHEMA_CODE', 'Array requires item schema'); return schema(kind, { item: args[0] }) }
      if (kind === 'record' && args.some(v => !v?.[SCHEMA])) fail('MVU_SCHEMA_CODE', 'Record requires schemas')
      if (kind === 'record') return schema(kind, { key: args.length === 2 ? args[0] : schema('string'), item: args.at(-1) })
      if (kind === 'enum' && (!Array.isArray(args[0]) || !args[0].length || args[0].some(v => typeof v !== 'string'))) fail('MVU_SCHEMA_CODE', 'Enum requires string values')
      if (kind === 'enum') return schema(kind, { values: args[0] })
      if (kind === 'literal' && args[0] !== null && !['number', 'string', 'boolean'].includes(typeof args[0])) fail('MVU_SCHEMA_CODE', 'Literal requires a scalar')
      if (kind === 'literal') return schema(kind, { value: args[0] })
      if (kind === 'union' && (!Array.isArray(args[0]) || !args[0].length || args[0].some(v => !v?.[SCHEMA]))) fail('MVU_SCHEMA_CODE', 'Union requires schemas')
      if (kind === 'union') return schema(kind, { alternatives: args[0] })
    }
    if (fn?.[METHOD] && fn.target?.[SCHEMA]) {
      const target = fn.target, method = fn.method
      if (method === 'describe' && typeof args[0] !== 'string') fail('MVU_SCHEMA_CODE', 'Description requires a string')
      if (method === 'describe') return { ...target, description: args[0] }
      if (method === 'prefault' || method === 'default') return schema(method, { input: target, value: data(args[0]) })
      if (method === 'optional' || method === 'nullable') return schema(method, { input: target })
      if (['passthrough', 'strict', 'strip'].includes(method)) { if (target.kind !== 'object' || args.length) fail('MVU_SCHEMA_CODE', 'Object mode requires an object schema'); return { ...target, passthrough: method === 'passthrough', strict: method === 'strict' } }
      if (method === 'min' || method === 'max') {
        if (!['number', 'string', 'array'].includes(target.kind) || typeof args[0] !== 'number' || !Number.isFinite(args[0]) || (target.kind !== 'number' && (!Number.isSafeInteger(args[0]) || args[0] < 0))) fail('MVU_SCHEMA_CODE', 'Invalid schema constraint')
        return { ...target, [method]: target[method] === undefined ? args[0] : (method === 'min' ? Math.max(target.min, args[0]) : Math.min(target.max, args[0])) }
      }
      if (method === 'int' && target.kind !== 'number') fail('MVU_SCHEMA_CODE', 'int requires number schema')
      if (method === 'int') return { ...target, integer: true }
      if (method === 'or') return schema('union', { alternatives: [target, args[0]] })
      if (method === 'transform') { if (!args[0]?.[FUNCTION]) fail('MVU_SCHEMA_CODE', 'Transform requires a declarative function'); return schema('transform', { input: target, transform: args[0] }) }
      if (method === 'superRefine') { if (args.length !== 1 || !args[0]?.[FUNCTION]) fail('MVU_SCHEMA_CODE', 'Refinement requires a declarative function'); return schema('refinement', { input: target, refinement: args[0] }) }
      if (method === 'regex') { if (target.kind !== 'string' || args.length !== 1 || !args[0]?.[REGEX]) fail('MVU_SCHEMA_CODE', 'Regex requires a string schema and finite regex literal'); return { ...target, patterns: [...(target.patterns ?? []), args[0][REGEX]] } }
    }
    fail('MVU_SCHEMA_CODE', `Unsupported schema operation: ${name ?? fn?.method ?? 'call'}`)
  }
  function evaluate(node, env) {
    tick()
    if (!node) fail('MVU_SCHEMA_CODE', 'Missing expression')
    switch (node.type) {
      case 'Literal': if (node.regex) return { [REGEX]: compileFiniteRegex(node.regex, tick) }; if (node.bigint) fail('MVU_SCHEMA_CODE', 'Unsupported literal'); return node.value
      case 'Identifier': {
        safeKey(node.name)
        if (Object.hasOwn(env, node.name)) { const value = env[node.name]?.[CELL] ? env[node.name].value : env[node.name]; if (value === UNINITIALIZED) fail('MVU_SCHEMA_CODE', 'Binding referenced before initialization'); return value }
        if (['z', 'Math', 'math', '_', ...Object.keys(mathFunctions)].includes(node.name)) return builtin(node.name)
        if (node.name === 'undefined') return undefined
        fail('MVU_SCHEMA_CODE', `Unknown identifier: ${node.name}`)
      }
      case 'ArrayExpression': return node.elements.map(item => evaluate(item, env))
      case 'ObjectExpression': {
        const result = {}
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') { const source = evaluate(property.argument, env); if (!source || typeof source !== 'object' || capability(source)) fail('MVU_SCHEMA_CODE', 'Spread requires data object'); for (const [key, value] of Object.entries(source)) { tick(); result[safeKey(key)] = value } }
          else { if (property.kind !== 'init' || property.method || property.computed) fail('MVU_SCHEMA_CODE', 'Only plain object properties are supported'); const key = safeKey(property.key.name ?? property.key.value); result[key] = evaluate(property.value, env) }
        }
        return result
      }
      case 'MemberExpression': {
        const object = evaluate(node.object, env)
        if (object === SHORT || (object == null && node.optional)) return SHORT
        const key = keyOf(node, env)
        if (object?.[BUILTIN]) { const name = `${object.builtin}.${key}`; if (name === 'Math.PI' || name === 'math.pi') return Math.PI; if (name === 'Math.E' || name === 'math.e') return Math.E; if (name === 'z.ZodIssueCode.custom') return 'custom'; return builtin(name) }
        if (object?.[SCHEMA]) return { [METHOD]: true, method: key, target: object }
        if (object?.[ISSUES]) { if (key !== 'addIssue') fail('MVU_SCHEMA_CODE', 'Unsupported refinement capability'); return { [ISSUES]: object[ISSUES] } }
        if (capability(object)) fail('MVU_SCHEMA_CODE', 'Interpreter capabilities are opaque')
        if (object == null) fail('MVU_SCHEMA_CODE', 'Missing data receiver')
        return Object.hasOwn(Object(object), key) ? object[key] : undefined
      }
      case 'ChainExpression': { const value = evaluate(node.expression, env); return value === SHORT ? undefined : value }
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        if (node.async || node.generator || node.params.some(p => p.type !== 'Identifier' && !(p.type === 'AssignmentPattern' && p.left.type === 'Identifier'))) fail('MVU_SCHEMA_CODE', 'Only synchronous functions with simple/default parameters are supported')
        return { [FUNCTION]: true, params: node.params, name: node.id ? safeKey(node.id.name) : undefined, body: node.body, env: copyEnv(env) }
      case 'CallExpression': {
        if (node.optional || node.arguments.some(a => a.type === 'SpreadElement')) fail('MVU_SCHEMA_CODE', 'Unsupported call')
        if (ownPropertyCall(node.callee)) {
          if (Object.hasOwn(env, 'Object')) fail('MVU_SCHEMA_CODE', 'Own-property intrinsic cannot be shadowed')
          if (node.arguments.length !== 2) fail('MVU_SCHEMA_CODE', 'Own-property test requires data and a key')
          const [value, key] = node.arguments.map(a => evaluate(a, env))
          if (!value || typeof value !== 'object' || capability(value)) fail('MVU_SCHEMA_CODE', 'Own-property test requires data')
          return Object.hasOwn(value, safeKey(key))
        }
        return call(evaluate(node.callee, env), node.arguments.map(a => evaluate(a, env)))
      }
      case 'BinaryExpression': { const operation = binary[node.operator]; if (!operation) fail('MVU_SCHEMA_CODE', 'Unsupported binary operator'); return boundedBinary(operation, evaluate(node.left, env), evaluate(node.right, env)) }
      case 'LogicalExpression': { const left = evaluate(node.left, env); if (node.operator === '&&') return left && evaluate(node.right, env); if (node.operator === '||') return left || evaluate(node.right, env); if (node.operator === '??') return left ?? evaluate(node.right, env); break }
      case 'ConditionalExpression': return evaluate(node.test, env) ? evaluate(node.consequent, env) : evaluate(node.alternate, env)
      case 'UnaryExpression': { const value = evaluate(node.argument, env); if (node.operator !== '!' && typeof value !== 'number' && typeof value !== 'string') fail('MVU_SCHEMA_CODE', 'Unary arithmetic requires scalar data'); if (node.operator === '-' || node.operator === '+') { const number = node.operator === '-' ? -value : +value; if (!Number.isFinite(number)) fail('MVU_LIMIT', 'Non-finite unary result'); return number } if (node.operator === '!') return !value; break }
      case 'AssignmentExpression': {
        if (node.left.type !== 'MemberExpression') fail('MVU_SCHEMA_CODE', 'Only local data fields can be assigned')
        const object = evaluate(node.left.object, env), key = keyOf(node.left, env)
        if (!object || typeof object !== 'object' || Object.isFrozen(object) || capability(object)) fail('MVU_SCHEMA_CODE', 'Assignment target must be data')
        if (Array.isArray(object) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= object.length)) fail('MVU_PATH', 'Array writes require an existing integer index')
        const right = evaluate(node.right, env)
        if (node.operator === '=') object[key] = right
        else { const operation = binary[node.operator.slice(0, -1)]; if (!operation) fail('MVU_SCHEMA_CODE', 'Unsupported assignment'); object[key] = boundedBinary(operation, object[key], right) }
        return object[key]
      }
    }
    fail('MVU_SCHEMA_CODE', `Unsupported syntax: ${node.type}`)
  }
  function statement(node, env) {
    tick()
    if (node.type === 'BlockStatement') { env = copyEnv(env); declare(node.body, env); for (const child of node.body) { const result = statement(child, env); if (result?.[RETURN]) return result }; return undefined }
    if (node.type === 'ReturnStatement') return { [RETURN]: true, value: node.argument ? evaluate(node.argument, env) : undefined }
    if (node.type === 'IfStatement') return evaluate(node.test, env) ? statement(node.consequent, env) : node.alternate ? statement(node.alternate, env) : undefined
    if (node.type === 'ForOfStatement') {
      if (node.await || node.left.type !== 'VariableDeclaration' || node.left.kind !== 'const' || node.left.declarations.length !== 1 || node.left.declarations[0].id.type !== 'Identifier') fail('MVU_SCHEMA_CODE', 'Only finite const array iteration is supported')
      const name = safeKey(node.left.declarations[0].id.name)
      const values = evaluate(node.right, { ...copyEnv(env), [name]: { [CELL]: true, value: UNINITIALIZED } })
      if (!Array.isArray(values) || values.length > 1000) fail('MVU_LIMIT', 'Array iteration exceeds limit')
      for (const value of [...values]) { tick(); const result = statement(node.body, { ...copyEnv(env), [name]: { [CELL]: true, value } }); if (result?.[RETURN]) return result }
      return undefined
    }
    if (node.type === 'VariableDeclaration' && node.kind === 'const') { for (const declaration of node.declarations) { if (declaration.id.type !== 'Identifier') fail('MVU_SCHEMA_CODE', 'No destructuring'); const name = safeKey(declaration.id.name), value = evaluate(declaration.init, env); if (env[name]?.[CELL]) env[name].value = value; else env[name] = { [CELL]: true, value } }; return undefined }
    if (node.type === 'ExpressionStatement') { evaluate(node.expression, env); return undefined }
    fail('MVU_SCHEMA_CODE', `Unsupported statement: ${node.type}`)
  }
  return { evaluate, statement, call, tick, declare }
}

export function numericExpression(text) {
  if (text.length > 8192) fail('MVU_LIMIT', 'Arithmetic source exceeds limit')
  let tree
  try { tree = parseExpressionAt(text.replace(/\^/g, '**'), 0, { ecmaVersion: 2022 }) } catch (error) { fail(error instanceof RangeError ? 'MVU_LIMIT' : 'MVU_PARSE', 'Invalid arithmetic syntax') }
  inspectAst(tree)
  const prepared = text.replace(/\^/g, '**')
  if (prepared.slice(tree.end).trim()) fail('MVU_PARSE', 'Unexpected expression suffix')
  const value = machine().evaluate(tree, {})
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('MVU_PARSE', 'Expected finite arithmetic value')
  return Number(value.toPrecision(12))
}

function inspectAst(root) {
  const allowed = new Set(['Program', 'ImportDeclaration', 'ImportSpecifier', 'ExportNamedDeclaration', 'VariableDeclaration', 'VariableDeclarator', 'Identifier', 'Literal', 'ArrayExpression', 'ObjectExpression', 'Property', 'SpreadElement', 'MemberExpression', 'ArrowFunctionExpression', 'FunctionExpression', 'AssignmentPattern', 'ChainExpression', 'ForOfStatement', 'CallExpression', 'BinaryExpression', 'LogicalExpression', 'ConditionalExpression', 'UnaryExpression', 'AssignmentExpression', 'BlockStatement', 'ReturnStatement', 'IfStatement', 'ExpressionStatement'])
  const declared = new Set(['z', 'Math', 'math', '_', '$', 'registerMvuSchema', 'undefined', ...Object.keys(mathFunctions)])
  for (let entry of root.body ?? []) { if (entry.type === 'ExportNamedDeclaration') entry = entry.declaration; if (entry?.type === 'VariableDeclaration') for (const item of entry.declarations) if (item.id.type === 'Identifier') declared.add(item.id.name) }
  let nodes = 0
  function walk(node, depth, locals = new Set(), parent, field, mutable = new Set()) {
    if (++nodes > 10000 || depth > 64) fail('MVU_LIMIT', 'AST exceeds structural limits')
    if (!allowed.has(node.type)) fail('MVU_SCHEMA_CODE', `Unsupported syntax: ${node.type}`)
    if (isFunction(node)) {
      if (node.async || node.generator || node.params.some(p => p.type !== 'Identifier' && !(p.type === 'AssignmentPattern' && p.left.type === 'Identifier'))) fail('MVU_SCHEMA_CODE', 'Unsupported function declaration')
      mutable = new Set(node.params.map(parameterName))
      locals = new Set([...locals, ...mutable, ...(node.id ? [node.id.name] : [])])
      // Locals allocated in the function may be mutated; captured constants may not.
      const collect = n => { if (!n || typeof n !== 'object' || isFunction(n)) return; if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') { locals.add(n.id.name); mutable.add(n.id.name) }; for (const value of Object.values(n)) if (Array.isArray(value)) value.forEach(collect); else if (value && typeof value === 'object') collect(value) }
      collect(node.body)
    }
    if (node.type === 'Identifier') {
      const reference = !(parent?.type === 'MemberExpression' && field === 'property' && !parent.computed) && !(parent?.type === 'Property' && field === 'key' && !parent.computed) && !['ImportSpecifier', 'VariableDeclarator', 'ArrowFunctionExpression', 'FunctionExpression'].includes(parent?.type) && !(parent?.type === 'AssignmentPattern' && field === 'left')
      if (reference && !locals.has(node.name) && !declared.has(node.name)) fail('MVU_SCHEMA_CODE', `Unknown identifier: ${node.name}`)
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      if (ownPropertyCall(node.callee)) { for (const child of node.arguments) walk(child, depth + 1, locals, node, 'arguments', mutable); return }
      const member = node.callee, name = member.computed ? member.property.value : member.property.name
      if (!['number','string','boolean','any','unknown','object','array','record','enum','literal','union','describe','prefault','default','optional','nullable','passthrough','strict','strip','min','max','int','or','transform','superRefine','regex','addIssue','clamp',...Object.keys(mathFunctions)].includes(name)) fail('MVU_SCHEMA_CODE', 'Unsupported method')
    }
    if (node.type === 'AssignmentExpression') {
      let target = node.left
      while (target.type === 'MemberExpression') target = target.object
      if (target.type !== 'Identifier' || !mutable.has(target.name)) fail('MVU_SCHEMA_CODE', 'Captured bindings are immutable')
    }
    for (const [field, value] of Object.entries(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child?.type) walk(child, depth + 1, locals, node, field, mutable) }
      else if (value?.type) walk(value, depth + 1, locals, node, field, mutable)
    }
  }
  walk(root, 0)
}

/** Static schema DSL: imports are recognized but never fetched or executed. */
function buildSchema(source) {
  if (typeof source !== 'string' || source.length > 128 * 1024) fail('MVU_LIMIT', 'Schema source exceeds limit')
  let tree
  try { tree = parse(source, { ecmaVersion: 2022, sourceType: 'module' }) } catch (error) { fail(error instanceof RangeError ? 'MVU_LIMIT' : 'MVU_SCHEMA_CODE', 'Invalid or excessive schema syntax') }
  inspectAst(tree)
  const env = {}, vm = machine()
  vm.declare(tree.body, env)
  let registered
  for (let node of tree.body) {
    if (node.type === 'ImportDeclaration') {
      if (!/^https:\/\/[^\s]+\/mvu_zod\.js$/.test(node.source.value) || node.specifiers.some(s => s.imported?.name !== 'registerMvuSchema')) fail('MVU_SCHEMA_CODE', 'Unsupported schema import')
      continue
    }
    if (node.type === 'ExportNamedDeclaration') node = node.declaration
    if (node?.type === 'VariableDeclaration') { vm.statement(node, env); continue }
    // Accept only the conventional registration wrapper, without evaluating it.
    const expression = node?.expression
    if (node?.type === 'ExpressionStatement' && expression?.type === 'CallExpression' && expression.callee?.name === '$' && expression.arguments.length === 1) {
      const callback = expression.arguments[0], body = callback.body?.body
      const registration = callback.body?.type === 'CallExpression' ? callback.body : body?.length === 1 && body[0].type === 'ExpressionStatement' ? body[0].expression : null
      if (!isFunction(callback) || callback.params.length || registration?.type !== 'CallExpression' || registration.callee?.type !== 'Identifier' || registration.callee.name !== 'registerMvuSchema' || registration.arguments.length !== 1) fail('MVU_SCHEMA_CODE', 'Unsupported registration wrapper')
      const result = vm.evaluate(registration.arguments[0], env)
      if (!result?.[SCHEMA]) fail('MVU_SCHEMA_CODE', 'Registration requires a schema')
      if (registered) fail('MVU_SCHEMA_CODE', 'Duplicate schema registration')
      registered = result
      continue
    }
    fail('MVU_SCHEMA_CODE', 'Only schema declarations and registration are accepted')
  }
  const result = registered ?? (Object.hasOwn(env, 'Schema') ? vm.evaluate({ type: 'Identifier', name: 'Schema' }, env) : Object.hasOwn(env, 'schema') ? vm.evaluate({ type: 'Identifier', name: 'schema' }, env) : undefined)
  if (!result?.[SCHEMA]) fail('MVU_SCHEMA_CODE', 'Schema declaration missing')
  freezeData(result, vm.tick)
  return result
}

export function compileMvuSchema(source) {
  buildSchema(source)
  // Persist source instead of expanding a captured environment graph. Rebuilding
  // the bounded DSL gives each application isolated constants and functions.
  return { mvuSchema: 1, interpreterVersion: 1, source }
}

export function applyMvuSchema(value, definition) {
  if (definition?.mvuSchema !== 1 || definition.interpreterVersion !== 1 || Object.keys(definition).some(key => !['mvuSchema', 'interpreterVersion', 'source'].includes(key))) fail('MVU_SCHEMA_CODE', 'Invalid schema descriptor')
  const root = buildSchema(definition.source), vm = machine()
  let count = 0
  function apply(value, node, depth = 0) {
    if (++count > 10000 || depth > 64) fail('MVU_LIMIT', 'Schema traversal exceeds limit')
    if (!node?.[SCHEMA]) fail('MVU_SCHEMA_CODE', 'Invalid schema node')
    if (node.kind === 'default') return value === undefined ? data(node.value) : apply(value, node.input, depth + 1)
    if (node.kind === 'prefault') return apply(value === undefined ? data(node.value) : value, node.input, depth + 1)
    if (node.kind === 'optional') return value === undefined ? undefined : apply(value, node.input, depth + 1)
    if (node.kind === 'nullable') return value === null ? null : apply(value, node.input, depth + 1)
    if (node.kind === 'transform') return vm.call(node.transform, [apply(value, node.input, depth + 1)])
    if (node.kind === 'refinement') {
      const parsed = apply(value, node.input, depth + 1), checked = parsed === undefined ? undefined : data(parsed), issues = []
      freezeData(checked, vm.tick)
      vm.call(node.refinement, [checked, { [ISSUES]: issues }])
      if (issues.length) throw Object.assign(new Error('Schema refinement rejected value'), { code: 'MVU_SCHEMA', issues })
      return parsed
    }
    if (node.kind === 'union') { for (const alternative of node.alternatives) { try { return apply(value, alternative, depth + 1) } catch (error) { if (error.code !== 'MVU_SCHEMA') throw error } }; fail('MVU_SCHEMA', 'No union alternative matched') }
    if (node.coerce) { if (value !== null && typeof value === 'object') fail('MVU_SCHEMA', 'Coercion requires scalar data'); if (node.kind === 'number') value = Number(value); else if (node.kind === 'string') value = String(value); else if (node.kind === 'boolean') value = Boolean(value) }
    if (node.kind === 'object' || node.kind === 'record') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MVU_SCHEMA', 'Expected object')
      const result = node.passthrough ? data(value) : {}
      if (node.kind === 'record') {
        const keys = node.key.kind === 'enum' ? node.key.values : Object.keys(value)
        if (node.key.kind === 'enum' && Object.keys(value).some(key => !keys.includes(key))) fail('MVU_SCHEMA', 'Unknown record key')
        for (const key of keys) { const parsedKey = apply(key, node.key, depth + 1); result[safeKey(parsedKey)] = apply(value[key], node.item, depth + 1) }
      } else {
        if (node.strict && Object.keys(value).some(key => !Object.hasOwn(node.properties, key))) fail('MVU_SCHEMA', 'Unknown property')
        for (const [key, child] of Object.entries(node.properties)) { const resultValue = apply(value[key], child, depth + 1); if (resultValue !== undefined) result[safeKey(key)] = resultValue }
      }
      return result
    }
    if (node.kind === 'array') { if (!Array.isArray(value)) fail('MVU_SCHEMA', 'Expected array'); if ((node.min !== undefined && value.length < node.min) || (node.max !== undefined && value.length > node.max)) fail('MVU_SCHEMA', 'Array outside limits'); return value.map(v => apply(v, node.item, depth + 1)) }
    if (node.kind === 'enum' && !node.values.includes(value)) fail('MVU_SCHEMA', 'Invalid enum value')
    if (node.kind === 'literal' && value !== node.value) fail('MVU_SCHEMA', 'Invalid literal')
    if (['string', 'number', 'boolean'].includes(node.kind) && typeof value !== node.kind) fail('MVU_SCHEMA', `Expected ${node.kind}`)
    if (node.kind === 'number' && (!Number.isFinite(value) || (node.integer && !Number.isInteger(value)))) fail('MVU_SCHEMA', 'Invalid number')
    if (node.patterns?.some(pattern => !testFiniteRegex(value, pattern, vm.tick))) fail('MVU_SCHEMA', 'String does not match finite regex')
    const measured = typeof value === 'string' ? value.length : value
    if ((node.min !== undefined && measured < node.min) || (node.max !== undefined && measured > node.max)) fail('MVU_SCHEMA', 'Value outside limits')
    return value
  }
  return data(apply(data(value), root))
}
