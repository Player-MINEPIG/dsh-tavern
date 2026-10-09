import { Lexer } from 'marked'

// The angle form is a prose alias, not a replacement for XML role wrappers or
// executable/template source. Use the same Markdown tokenizer as the display.
function userAliases(source) {
  const tokenizer = new Lexer({ gfm: true }).tokenizer
  const candidates = [], wrappers = [], protectedRanges = []
  for (let offset = 0; offset < source.length;) {
    const rest = source.slice(offset)
    if (offset === 0 || source[offset - 1] === '\n') {
      const code = tokenizer.fences(rest) ?? tokenizer.code(rest)
      if (code) { offset += code.raw.length; continue }
    }
    if (source[offset] === '\\') { offset += 2; continue }
    if (source[offset] === '`') {
      const span = tokenizer.codespan(rest)
      if (span) { offset += span.raw.length; continue }
      offset += /^`+/.exec(rest)[0].length
      continue
    }
    if (source[offset] !== '<') { offset++; continue }
    const tag = tokenizer.tag(rest)
    if (!tag) { offset++; continue }
    const raw = tag.raw
    const opaque = /^<(html|head|script|style|pre|code|textarea)\b/i.exec(raw)
    if (opaque && !/\/\s*>$/.test(raw)) {
      const closing = new RegExp(`</${opaque[1]}\\s*>`, 'gi')
      closing.lastIndex = offset + raw.length
      const end = closing.exec(source)
      offset = end ? end.index + end[0].length : source.length
      continue
    }
    if (/^<user(?:\s[^<>]*)?>$/i.test(raw) && !/\/\s*>$/.test(raw)) {
      wrappers.push(offset)
      if (/^<user>$/i.test(raw)) candidates.push(offset)
    } else if (/^<\/user\s*>$/i.test(raw) && wrappers.length) {
      protectedRanges.push([wrappers.pop(), offset + raw.length])
    }
    offset += raw.length
  }
  // Merge nested wrapper ranges before checking prose candidates.
  protectedRanges.sort((a, b) => a[0] - b[0])
  const ranges = []
  for (const range of protectedRanges) {
    const previous = ranges.at(-1)
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else ranges.push(range)
  }
  let rangeIndex = 0
  return candidates.filter(offset => {
    while (ranges[rangeIndex]?.[1] <= offset) rangeIndex++
    return !ranges[rangeIndex] || offset < ranges[rangeIndex][0]
  })
}

export function applyDisplayNameMacros(text, { user = 'User', character = 'Assistant' } = {}) {
  const names = {
    user: typeof user === 'string' && user !== '' ? user : 'User',
    char: typeof character === 'string' && character !== '' ? character : 'Assistant',
  }
  const source = String(text ?? '')
  const replacements = [...source.matchAll(/\{\{\s*(user|char)\s*\}\}/gi)]
    .map(match => ({ offset: match.index, length: match[0].length, value: names[match[1].toLowerCase()] }))
  if (/<user>/i.test(source)) {
    const value = names.user.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    replacements.push(...userAliases(source).map(offset => ({ offset, length: 6, value })))
  }
  replacements.sort((a, b) => a.offset - b.offset)
  const parts = []
  let copied = 0
  for (const { offset, length, value } of replacements) {
    parts.push(source.slice(copied, offset), value)
    copied = offset + length
  }
  parts.push(source.slice(copied))
  return parts.join('')
}


// Worker text arrives after message macros/regex. Project aliases only onto the
// sanitized display copy, never the source HTML, executable DOM or MVU values.
export function applyCardUserAliases(root, user = 'User') {
  const name = typeof user === 'string' && user !== '' ? user : 'User'
  // Entity decoding can leave adjacent text nodes; match the visible text run.
  root.normalize()
  const walker = root.ownerDocument.createTreeWalker(root, 4)
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('pre,code,script,style,textarea,input,select,template,[contenteditable]')) continue
    const source = node.data
    if (!/<user>/i.test(source)) continue
    const offsets = userAliases(source)
    if (!offsets.length) continue
    const parts = []
    let copied = 0
    for (const offset of offsets) {
      parts.push(source.slice(copied, offset), name)
      copied = offset + 6
    }
    parts.push(source.slice(copied))
    node.data = parts.join('')
  }
}
