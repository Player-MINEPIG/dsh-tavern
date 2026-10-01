import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import DOMPurify from 'dompurify'
import { RichText, renderRichTextHtml } from '../../packages/client/src/play/rich-text.js'
import { MessageContent } from '../../packages/client/src/play/scripted-content.js'
import { staticHtmlExport } from '../../packages/client/src/play/export.js'
import { mathStyles } from '../../packages/client/src/play/math-styles.js'

const results = []
const styles = document.createElement('style')
styles.textContent = mathStyles('[data-dtv-rich-text]')
document.head.append(styles)
function check(name, condition) { results.push({ name, pass: Boolean(condition) }) }
function content(host) { return host.querySelector('[data-dtv-style-boundary] > div')?.shadowRoot ?? host }
function mount(text, Component = MessageContent) {
  const host = document.createElement('section')
  host.style.cssText = 'width:320px;font:16px/1.6 system-ui;color:rgb(31,41,55)'
  document.body.append(host)
  const root = createRoot(host)
  const update = text => flushSync(() => root.render(h(Component, { text, enabled: false, scopeKey: 'math-check' })))
  update(text)
  return { host, update }
}
async function run() {
  for (const source of [String.raw`$\frac{1}{2}$`, String.raw`\(\frac{1}{2}\)`, String.raw`$$\frac{1}{2}$$`, String.raw`\[\frac{1}{2}\]`, '$$\n\\frac{1}{2}\n$$', '\\[\n\\frac{1}{2}\n\\]']) {
    const { host } = mount(source)
    const fraction = content(host).querySelector('mfrac')
    const numerator = fraction?.children[0].getBoundingClientRect()
    const denominator = fraction?.children[1].getBoundingClientRect()
    check(`visible MathML fraction: ${JSON.stringify(source)}`, fraction?.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && numerator.width > 0 && numerator.top < denominator.top)
    check(`source annotation survives sanitization: ${JSON.stringify(source)}`, content(host).querySelector('annotation')?.textContent.includes('\\frac{1}{2}'))
  }
  const matrix = mount('$$\n\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}\n$$')
  check('matrix rows and columns survive sanitization and layout', content(matrix.host).querySelectorAll('mtr').length === 2 && content(matrix.host).querySelectorAll('mtd').length === 4 && content(matrix.host).querySelector('mtable').getBoundingClientRect().height > 20)
  const combined = mount('# $x^2$\n\n*before $a*b$ after*\n\n- $y$\n\n[$z$](https://example.com)\n\n| A |\n|---|\n| $w$ |\n\n<details open><summary>$s$</summary>\n$t$\n</details>')
  check('Markdown emphasis, lists, links, tables and details retain math', combined.host.querySelectorAll('math').length === 7 && combined.host.querySelector('em math') && combined.host.querySelector('td math') && combined.host.querySelector('summary math'))
  const literal = mount('Cost $5 and $10.\n\n`$x$`\n\n```latex\n\\frac{1}{2}\n```\n\n<div title="$x$">$y$</div>')
  check('currency, inline/fenced code and raw HTML stay literal', !literal.host.querySelector('math') && literal.host.textContent.includes('Cost $5 and $10.') && literal.host.querySelector('code').textContent === '$x$' && literal.host.querySelector('[title]').getAttribute('title') === '$x$')
  const inlineHtml = mount('Inline <span title="$x$">$y$</span>, <code>$z$</code>.')
  check('inline HTML text supports math while attributes and code stay literal', inlineHtml.host.querySelectorAll('math').length === 1 && inlineHtml.host.querySelector('code').textContent === '$z$')
  const outside = mount('Outside')
  const before = getComputedStyle(outside.host).color
  const styled = mount('<style>.ink{color:rgb(137,17,93)}</style>\n\n<details open><summary>Formula</summary>\n<span class="ink">$x^2$</span>\n</details>')
  const shadow = content(styled.host)
  check('HTML/CSS math remains inside the message shadow root', shadow !== styled.host && shadow.querySelector('math') && getComputedStyle(shadow.querySelector('math')).color === 'rgb(137, 17, 93)' && getComputedStyle(outside.host).color === before)
  const wide = mount('$$\n' + Array(100).fill('x').join('+') + '\n$$')
  check('ordinary display math does not move surrounding prose into a styled shadow', !wide.host.querySelector('[data-dtv-style-boundary]'))
  const scroll = content(wide.host).querySelector('.dtv-math-block')
  check('wide display math scrolls within the message', scroll.clientWidth <= 320 && scroll.scrollWidth > scroll.clientWidth && getComputedStyle(scroll).overflowX === 'auto')
  const stream = mount('$$\n\\frac{1}')
  check('unfinished display math has no partial formula', !content(stream.host).querySelector('math'))
  stream.update('$$\n\\frac{1}{2}\n$$')
  check('closing a streamed expression replaces source with a fraction', content(stream.host).querySelector('mfrac'))
  stream.update('**Done**')
  check('stream can return to ordinary Markdown without stale math or shadow', stream.host.querySelector('strong')?.textContent === 'Done' && !stream.host.querySelector('[data-dtv-style-boundary], math'))

  let sanitizations = 0
  const original = DOMPurify.sanitize
  DOMPurify.sanitize = (...args) => { sanitizations++; return original(...args) }
  try {
    const host = document.createElement('section'); document.body.append(host)
    const root = createRoot(host)
    const update = text => flushSync(() => root.render(h('div', null,
      h(RichText, { key: 'history', className: 'history', text: '<details open><summary>Saved</summary>\n$x^2$\n</details>' }),
      h(RichText, { key: 'live', text }),
    )))
    update('$x$')
    const savedMath = host.querySelector('.history math')
    const initial = sanitizations
    for (let i = 0; i < 10; i++) update(`$x^{${i}}$`)
    check('streaming only sanitizes changed math and preserves history DOM', sanitizations - initial === 10 && savedMath === host.querySelector('.history math') && host.querySelector('details').open)
    flushSync(() => root.unmount())
  } finally { DOMPurify.sanitize = original }
  const malformed = mount(String.raw`$\badCommand{<img src=x onerror=alert(1)>}$` + '\n\n**Next**')
  check('invalid math is escaped source and does not break following Markdown', !content(malformed.host).querySelector('img,math') && malformed.host.querySelector('strong')?.textContent === 'Next')
  for (const tex of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\includegraphics{https://example.com/x.png}`, String.raw`\htmlStyle{background:url(https://example.com)}{x}`]) {
    const unsafe = mount(`$${tex}$`)
    check(`untrusted TeX has no active elements: ${tex.split('{')[0]}`, !content(unsafe.host).querySelector('a,img,script,iframe,[onerror]'))
  }
  const rawAttack = mount('<math><annotation-xml encoding="text/html"><img src=x onerror="window.__mathExecuted=true"></annotation-xml><mtext><img src=x onerror="window.__mathExecuted=true"></mtext></math>')
  check('MathML sanitizer rejects foreign HTML and event handlers', !content(rawAttack.host).querySelector('annotation-xml,[onerror],script') && !window.__mathExecuted)

  const frame = document.createElement('iframe')
  frame.srcdoc = staticHtmlExport({ playthrough: { id: 'math', title: 'Offline math' }, displayTurns: [{ userText: 'Math', assistantText: '$$\n\\frac{1}{2}\n$$' }] })
  const loaded = new Promise(resolve => { frame.onload = resolve })
  document.body.append(frame)
  await loaded
  const exportRoot = frame.contentDocument.querySelector('[data-dtv-style-boundary] > div')?.shadowRoot ?? frame.contentDocument
  check('static HTML export renders MathML without scripts or external fonts', exportRoot?.querySelector('mfrac')?.getBoundingClientRect().height > 0 && !frame.contentDocument.querySelector('script,link[src],link[href]'))
  check('direct render helper shares the math sanitizer', renderRichTextHtml('$x$').includes('<math'))
}
run().catch(error => results.push({ name: error.stack, pass: false })).finally(() => {
  const report = document.createElement('pre')
  report.id = 'results'
  report.textContent = JSON.stringify(results)
  document.body.append(report)
})
