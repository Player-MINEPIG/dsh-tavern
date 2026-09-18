// This boundary isolates CSS, not JavaScript. All content must be purified first;
// user-supplied scripts, event handlers and templates never reach this function.
const BASE_STYLE = `
:host{display:block;font:inherit;color:inherit}
*,*::before,*::after{box-sizing:border-box}
:first-child{margin-top:0}p,ul,ol,blockquote,pre,table{margin:0 0 .85em}
ul,ol{padding-left:1.5em}
blockquote{padding-left:12px;border-left:3px solid var(--dsw-alias-border-secondary,#666)}
pre{max-width:100%;overflow:auto;padding:11px 12px;border-radius:9px;background:var(--dsw-alias-markdown-code-block,#181a20);white-space:pre}
code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:.92em}
:not(pre)>code{padding:.12em .35em;border-radius:5px;background:var(--dsw-alias-markdown-code-inline,#181a20)}
table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}
th,td{padding:6px 9px;border:1px solid var(--dsw-alias-border-l2,#555)}
img,video{max-width:100%;height:auto}
a{color:var(--dsw-alias-state-business-primary,#8ab4ff);text-decoration:underline}
hr{border:0;border-top:1px solid var(--dsw-alias-border-l2,#555)}
`

export function isolateStyledHtml(template, documentObject) {
  if (!template.content.querySelector('style')) return template.innerHTML

  // The outer paint/layout boundary is outside the shadow tree: even a template
  // rule targeting :host or a fixed-position child cannot cover the Host UI.
  const boundary = documentObject.createElement('div')
  boundary.setAttribute('data-dtv-style-boundary', '')
  boundary.setAttribute('style', 'display:block;min-width:0;contain:layout paint;isolation:isolate')
  const host = documentObject.createElement('div')
  const shadowTemplate = documentObject.createElement('template')
  shadowTemplate.setAttribute('shadowrootmode', 'open')
  shadowTemplate.setAttribute('data-dtv-style-root', '')
  const baseStyle = documentObject.createElement('style')
  baseStyle.textContent = BASE_STYLE
  shadowTemplate.content.append(baseStyle, template.content)
  host.append(shadowTemplate)
  boundary.append(host)
  template.content.append(boundary)
  return template.innerHTML
}

// Whole documents lose html/head/body during fragment sanitization. Rewrite
// only standalone root selectors, leaving declarations/imports byte-for-byte.
// CSSOM serialization can lose var() shorthands with later longhand overrides.
// This scanner skips strings, comments, escapes and declaration blocks; it is
// not a CSS sanitizer. The existing shadow/paint boundary provides isolation.
function skipCssTrivia(css, offset, end) {
  while (offset < end) {
    if (/\s/.test(css[offset])) offset++
    else if (css.startsWith('/*', offset)) {
      const close = css.indexOf('*/', offset + 2)
      if (close < 0 || close >= end) break
      offset = close + 2
    } else break
  }
  return offset
}

export function adaptDocumentCss(css) {
  const parts = []
  const frames = [{ rules: true, start: 0 }]
  let copied = 0
  let parentheses = 0
  let brackets = 0
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '\\') { i++; continue }
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end < 0) break
      i = end + 1
      continue
    }
    if (char === '"' || char === "'") {
      const quote = char
      while (++i < css.length) {
        if (css[i] === '\\') i++
        else if (css[i] === quote) break
      }
      continue
    }
    if (char === '(') parentheses++
    else if (char === ')') parentheses = Math.max(0, parentheses - 1)
    else if (char === '[') brackets++
    else if (char === ']') brackets = Math.max(0, brackets - 1)
    if (parentheses || brackets) continue
    const frame = frames.at(-1)
    if (char === '{') {
      const start = frame.rules ? skipCssTrivia(css, frame.start, i) : i
      const prefix = css.slice(start, Math.min(start + 20, i))
      const root = prefix.match(/^(?:html|body|:root)\b/i)?.[0]
      if (root && skipCssTrivia(css, start + root.length, i) === i) {
        parts.push(css.slice(copied, frame.start), ':host')
        copied = i
      }
      frames.push({ rules: /^@(media|supports|container|layer|scope|document|starting-style)\b/i.test(prefix), start: i + 1 })
    } else if (char === '}') {
      if (frames.length > 1) frames.pop()
      frames.at(-1).start = i + 1
    } else if (char === ';') frame.start = i + 1
  }
  parts.push(css.slice(copied))
  return parts.join('')
}

export function isolateHtmlDocuments(template, documentObject) {
  for (const document of template.content.querySelectorAll('[data-dtv-html-document]')) {
    const content = documentObject.createElement('template')
    while (document.firstChild) content.content.append(document.firstChild)
    for (const style of content.content.querySelectorAll('style')) style.textContent = adaptDocumentCss(style.textContent)
    document.innerHTML = isolateStyledHtml(content, documentObject)
  }
}

// innerHTML does not activate declarative shadow roots. React's ref runs after
// insertion/update; static HTML exports use the same markup natively, without JS.
export function mountStyledHtml(element) {
  if (!element) return
  for (const template of element.querySelectorAll('template[data-dtv-style-root]')) {
    const host = template.parentElement
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    root.replaceChildren(template.content)
    template.remove()
    mountStyledHtml(root)
  }
}
