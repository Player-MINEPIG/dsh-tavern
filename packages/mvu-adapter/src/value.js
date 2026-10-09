export function fail(code, message) { throw Object.assign(new Error(message), { code }) }
export function json(value) {
  let nodes = 0, bytes = 0
  const charge = amount => { bytes += amount; if (bytes > 2 * 1024 * 1024) fail('MVU_LIMIT', 'State exceeds serialized size budget') }
  const string = value => { charge(2); for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); charge(c < 32 || (c >= 0xd800 && c <= 0xdfff) ? 6 : c === 34 || c === 92 ? 2 : c < 128 ? 1 : c < 2048 ? 2 : 3) } }
  const visit = (item, depth) => {
    if (++nodes > 100000 || depth > 64) fail('MVU_LIMIT', 'State exceeds structural limits')
    if (typeof item === 'string') { string(item); return }
    if (item === null || typeof item === 'boolean') { charge(5); return }
    if (typeof item === 'number' && Number.isFinite(item)) { charge(32); return }
    if (!item || typeof item !== 'object' || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(item))) fail('MVU_JSON', 'Only finite JSON data is supported')
    const array = Array.isArray(item)
    if (array && (item.length > 100000 || Object.keys(item).length !== item.length)) fail('MVU_LIMIT', 'Sparse or excessive array')
    charge(2)
    for (const [key, child] of Object.entries(item)) { safeKey(key); if (!array) string(key); charge(2); visit(child, depth + 1) }
  }
  visit(value, 0)
  const text = JSON.stringify(value)
  if (text.length > 2 * 1024 * 1024) fail('MVU_LIMIT', 'State exceeds 2 MiB')
  return JSON.parse(text)
}
export function safeKey(key) {
  if (typeof key !== 'string' && (typeof key !== 'number' || !Number.isFinite(key))) fail('MVU_PATH', 'Property keys must be finite strings or numbers')
  if (['__proto__', 'prototype', 'constructor'].includes(String(key))) fail('MVU_PATH', 'Unsafe property path')
  return String(key)
}
// A data grammar, never an evaluator: JSON plus single-quoted string literals.
export function literal(source) {
  let i = 0
  const whitespace = () => { while (/\s/.test(source[i] ?? '') && i < source.length) i++ }
  const value = (depth = 0) => {
    if (depth > 64) fail('MVU_LIMIT', 'Literal nesting exceeds limit')
    whitespace()
    const c = source[i++]
    if (c === '"' || c === "'") {
      let out = ''
      while (i < source.length) {
        const x = source[i++]
        if (x === c) return out
        if (x === '\\') {
          const e = source[i++]
          if (e === 'u') { const hex = source.slice(i, i + 4); if (!/^[a-f\d]{4}$/i.test(hex)) fail('MVU_PARSE', 'Invalid escape'); out += String.fromCharCode(parseInt(hex, 16)); i += 4 }
          else if (Object.hasOwn({ n: 1, r: 1, t: 1, b: 1, f: 1, '\\': 1, '/': 1, "'": 1, '"': 1 }, e)) out += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[e] ?? e
          else fail('MVU_PARSE', 'Unsupported escape')
        } else { if (x.charCodeAt(0) < 32) fail('MVU_PARSE', 'Unescaped control character'); out += x }
      }
      fail('MVU_PARSE', 'Unterminated string')
    }
    if (c === '[' || c === '{') {
      const array = c === '[', out = array ? [] : {}, end = array ? ']' : '}'
      whitespace()
      if (source[i] === end) { i++; return out }
      for (;;) {
        if (array) out.push(value(depth + 1))
        else { const key = value(depth + 1); if (typeof key !== 'string') fail('MVU_PARSE', 'Object keys must be quoted'); whitespace(); if (source[i++] !== ':') fail('MVU_PARSE', 'Expected colon'); out[safeKey(key)] = value(depth + 1) }
        whitespace(); const separator = source[i++]
        if (separator === end) return out
        if (separator !== ',') fail('MVU_PARSE', 'Expected comma')
      }
    }
    i--
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i))?.[0]
    if (!token) fail('MVU_PARSE', 'Unsupported expression; use literal JSON values')
    i += token.length
    return JSON.parse(token)
  }
  const result = value(); whitespace()
  if (i !== source.length) fail('MVU_PARSE', 'Unexpected expression after literal')
  return json(result)
}
export function pathParts(path, pointer = false) {
  if (typeof path !== 'string' || path.length > 2000) fail('MVU_PATH', 'Invalid path')
  if (path === '') return []
  if (pointer) {
    if (!path.startsWith('/') || /~(?![01])/.test(path)) fail('MVU_PATH', 'Invalid JSON pointer')
    return path.slice(1).split('/').map(x => safeKey(x.replace(/~1/g, '/').replace(/~0/g, '~')))
  }
  const parts = []; let i = 0
  while (i < path.length) {
    if (path[i] === '[') {
      let end = i + 1, quote = null, escaped = false
      for (; end < path.length; end++) { const c = path[end]; if (escaped) { escaped = false; continue }; if (c === '\\' && quote) { escaped = true; continue }; if (quote) { if (c === quote) quote = null } else if (c === '"' || c === "'") quote = c; else if (c === ']') break }
      const raw = path.slice(i + 1, end).trim()
      if (end === path.length) fail('MVU_PATH', 'Unterminated bracket')
      const key = /^\d+$/.test(raw) ? raw : literal(raw)
      if (typeof key !== 'string') fail('MVU_PATH', 'Invalid bracket key')
      parts.push(safeKey(key)); i = end + 1
    } else {
      const token = /^[^.\[\]]+/.exec(path.slice(i))?.[0]
      if (!token) fail('MVU_PATH', 'Invalid path component')
      parts.push(safeKey(token)); i += token.length
    }
    if (path[i] === '.') { i++; if (i === path.length) fail('MVU_PATH', 'Empty path component') }
    else if (i < path.length && path[i] !== '[') fail('MVU_PATH', 'Invalid path delimiter')
  }
  if (parts.length > 64) fail('MVU_LIMIT', 'Path is too deep')
  return parts
}
export function at(root, parts) {
  let current = root
  for (const part of parts) { if (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(String(part))) fail('MVU_PATH', 'Array paths require integer indices'); if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) fail('MVU_PATH_MISSING', `Missing path: ${parts.join('.')}`); current = current[part] }
  return current
}
