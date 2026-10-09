import { fail } from './value.js'

// A finite, anchored regex subset. No native RegExp matching or backtracking.
// Character classes, groups, alternatives and bounded repetitions become an NFA.
export function compileFiniteRegex({ pattern, flags }, tick) {
  if (flags || pattern.length > 256 || !pattern.startsWith('^') || !pattern.endsWith('$')) fail('MVU_SCHEMA_CODE', 'Regex requires a short anchored pattern without flags')
  const text = pattern.slice(1, -1)
  let offset = 0
  const invalid = () => fail('MVU_SCHEMA_CODE', 'Unsupported finite regex syntax')
  function character() {
    const c = text[offset++]
    if (c === '\\') {
      const escaped = text[offset++]
      if (escaped === 'd') return [[48, 57]]
      if (escaped && '\\.^$|?*+()[]{}-'.includes(escaped)) return [[escaped.charCodeAt(0), escaped.charCodeAt(0)]]
      invalid()
    }
    if (!c || '^$|?*+()[]{}'.includes(c)) invalid()
    return [[c.charCodeAt(0), c.charCodeAt(0)]]
  }
  function expression(depth = 0) {
    if (depth > 16) fail('MVU_LIMIT', 'Regex nesting exceeds limit')
    const choices = [], items = []
    while (offset < text.length && text[offset] !== ')') {
      if (text[offset] === '|') { offset++; if (!items.length) invalid(); choices.push({ sequence: items.splice(0) }); continue }
      let item
      if (text[offset] === '(') { offset++; item = expression(depth + 1); if (text[offset++] !== ')') invalid() }
      else if (text[offset] === '[') {
        offset++
        const ranges = []
        while (offset < text.length && text[offset] !== ']') {
          const start = character()
          if (text[offset] === '-') {
            offset++; const end = character()
            if (start.length !== 1 || end.length !== 1 || start[0][0] !== start[0][1] || end[0][0] !== end[0][1] || start[0][0] > end[0][0]) invalid()
            ranges.push([start[0][0], end[0][0]])
          } else ranges.push(...start)
        }
        if (!ranges.length || text[offset++] !== ']') invalid()
        item = { ranges }
      } else { if (text[offset] === '.') invalid(); item = { ranges: character() } }
      if (text[offset] === '{') {
        const quantifier = /^\{(\d{1,2})(?:,(\d{1,2}))?\}/.exec(text.slice(offset))
        if (!quantifier) invalid()
        offset += quantifier[0].length
        const min = Number(quantifier[1]), max = Number(quantifier[2] ?? quantifier[1])
        if (min > max || max > 64) invalid()
        item = { repeat: item, min, max }
      } else if (text[offset] === '?') { offset++; item = { repeat: item, min: 0, max: 1 } }
      items.push(item)
    }
    if (!items.length) invalid()
    choices.push({ sequence: items })
    return { choices }
  }
  const root = expression()
  if (offset !== text.length) invalid()
  if (root.choices.length !== 1) fail('MVU_SCHEMA_CODE', 'Regex alternatives must be grouped inside both anchors')
  const states = []
  const state = () => { tick(); if (states.length >= 2048) fail('MVU_LIMIT', 'Regex automaton exceeds limit'); states.push([]); return states.length - 1 }
  const edge = (from, value) => { tick(); states[from].push(value) }
  function build(node, start, end) {
    if (node.ranges) { edge(start, { ranges: node.ranges, next: end }); return 1 }
    if (node.choices) { let max = 0; for (const choice of node.choices) max = Math.max(max, build(choice, start, end)); return max }
    if (node.sequence) {
      let length = 0, from = start
      node.sequence.forEach((item, i) => { const to = i === node.sequence.length - 1 ? end : state(); length += build(item, from, to); from = to })
      return length
    }
    let length = 0, from = start
    for (let i = 0; i < node.max; i++) {
      if (i >= node.min) edge(from, { next: end })
      const to = i === node.max - 1 ? end : state()
      length += build(node.repeat, from, to); from = to
    }
    if (!node.max) edge(start, { next: end })
    return length
  }
  const start = state(), end = state(), maxLength = build(root, start, end)
  return { states, start, end, maxLength }
}

export function testFiniteRegex(value, regex, tick) {
  if (value.length > regex.maxLength) return false
  const closure = input => {
    const result = new Set(input), pending = [...result]
    for (let i = 0; i < pending.length; i++) {
      tick()
      for (const edge of regex.states[pending[i]]) if (!edge.ranges && !result.has(edge.next)) { result.add(edge.next); pending.push(edge.next) }
    }
    return result
  }
  let current = closure([regex.start])
  for (let i = 0; i < value.length; i++) {
    const next = new Set(), code = value.charCodeAt(i)
    for (const from of current) for (const edge of regex.states[from]) { tick(); if (edge.ranges?.some(([min, max]) => min <= code && code <= max)) next.add(edge.next) }
    current = closure(next)
    if (!current.size) return false
  }
  return current.has(regex.end)
}
