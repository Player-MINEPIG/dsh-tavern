import katex from 'katex'
import { Tokenizer } from 'marked'

const MAX_FORMULA_LENGTH = 4096

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function render(token) {
  try {
    if (token.text.length > MAX_FORMULA_LENGTH) throw new Error('Formula too long')
    // Native MathML needs neither global KaTeX CSS nor downloadable fonts and
    // works inside isolated templates and offline HTML exports. Never share
    // macros between formulas (\gdef must not affect subsequent messages).
    const html = katex.renderToString(token.text, {
      output: 'mathml', displayMode: token.display, throwOnError: true,
      trust: false, strict: 'error', maxExpand: 200, maxSize: 10, macros: {},
    })
    if (!token.display) return html
    const tag = token.block ? 'div' : 'span'
    return `<${tag} class="dtv-math-block">${html}</${tag}>${token.block ? '\n' : ''}`
  } catch {
    // Bad/unsupported TeX is message content, not an error for the whole view.
    return escapeHtml(token.raw)
  }
}

function inlineFormula(source) {
  const open = source.startsWith('$$') ? '$$'
    : source.startsWith('\\(') ? '\\('
      : source.startsWith('\\[') ? '\\['
        : source[0] === '$' ? '$' : null
  if (!open) return
  const close = open === '\\(' ? '\\)' : open === '\\[' ? '\\]' : open
  if (open === '$' && (!source[1] || /\s|\$/.test(source[1]))) return
  // Inline math does not consume another line or code span. Block
  // math below owns multiline expressions. A bounded scan protects streams
  // containing many unmatched delimiters.
  const limit = Math.min(source.length, MAX_FORMULA_LENGTH + open.length + close.length)
  for (let i = open.length; i < limit; i++) {
    if (source[i] === '\n' || source[i] === '`') return
    if (source.startsWith(close, i)) {
      if (open === '$' && (/\s/.test(source[i - 1]) || /[\d$]/.test(source[i + 1] ?? ''))) return
      const text = source.slice(open.length, i)
      if (!text.trim()) return
      return { type: 'tavernMathInline', raw: source.slice(0, i + close.length), text, display: open === '$$' || open === '\\[' }
    }
    if (source[i] === '\\') i++
  }
}

export function mathExtension() {
  return {
    tokenizer: {
      emStrong(source, maskedSource, previous) {
        if (!/^[*_]/.test(source) || !/\$|\\[([]/.test(source)) return false
        // Marked searches ahead for emphasis before it reaches our math token.
        // Hide TeX's * and _ from that search, using original source because
        // Marked's default mask has already replaced \( / \) with escapes.
        const offset = maskedSource.length - source.length
        const mask = maskedSource.split('')
        for (let i = 0; i < source.length; i++) {
          if (source[i] !== '$' && source[i] !== '\\') continue
          const token = inlineFormula(source.slice(i))
          if (token) {
            mask.fill('a', offset + i, offset + i + token.raw.length)
            i += token.raw.length - 1
          } else if (source[i] === '\\') i++
        }
        return Tokenizer.prototype.emStrong.call(this, source, mask.join(''), previous)
      },
    },
    extensions: [
      {
        name: 'tavernMathBlock', level: 'block',
        start: source => source.match(/^ {0,3}(?:\$\$|\\\[)/m)?.index,
        tokenizer(source) {
          const opening = source.match(/^ {0,3}(\$\$|\\\[)[\t ]*\n/)
          if (!opening) return
          const rest = source.slice(opening[0].length)
          const closing = opening[1] === '$$' ? /^ {0,3}\$\$[\t ]*(?:\n|$)/m : /^ {0,3}\\\][\t ]*(?:\n|$)/m
          const match = closing.exec(rest)
          if (!match) return
          return { type: 'tavernMathBlock', raw: source.slice(0, opening[0].length + match.index + match[0].length), text: rest.slice(0, match.index), display: true, block: true }
        },
        renderer: render,
      },
      {
        name: 'tavernMathInline', level: 'inline',
        start: source => source.search(/\$|\\[([]/),
        tokenizer(source) {
          if (this.lexer.state.inRawBlock) return
          const formula = inlineFormula(source)
          if (formula) return formula
          // Do not reinterpret the second dollar of an unfinished $$ expression
          // as a new single-dollar opener while streaming.
          if (source.startsWith('$$')) {
            const raw = source.match(/^\$+/)[0]
            return { type: 'text', raw, text: raw }
          }
        },
        renderer: render,
      },
    ],
  }
}
