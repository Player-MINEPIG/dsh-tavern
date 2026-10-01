import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownToHtml as render } from '../packages/client/src/play/rich-text.js'

test('inline and display delimiters produce native MathML without external resources', () => {
  for (const source of [String.raw`$\frac{1}{2}$`, String.raw`\(\frac{1}{2}\)`, String.raw`$$\frac{1}{2}$$`, String.raw`\[\frac{1}{2}\]`, '$$\n\\frac{1}{2}\n$$', '\\[\n\\frac{1}{2}\n\\]']) {
    const html = render(source)
    assert.match(html, /<math\b/)
    assert.match(html, /<mfrac>/)
    assert.doesNotMatch(html, /<(?:script|link|img)\b/)
    if (!source.startsWith('$\\') && !source.startsWith('\\(')) assert.match(html, /display="block"/)
  }
})

test('matrices, alignment, roots, integrals and comparisons retain TeX semantics', () => {
  for (const [tex, tag] of [
    [String.raw`\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}`, 'mtable'],
    [String.raw`\begin{aligned}a&=b+c\\d&=e+f\end{aligned}`, 'mtable'],
    [String.raw`\sqrt{x}`, 'msqrt'], [String.raw`\int_0^1 x^2\,dx`, 'msup'],
    ['x<y', 'mo'],
  ]) assert.match(render(`$$\n${tex}\n$$`), new RegExp(`<${tag}\\b`))
})

test('math composes with emphasis, headings, lists, links, tables and details', () => {
  for (const source of ['*before $a*b$ after*', '_before $a_b$ after_', String.raw`*before \(a*b\) after*`, '**before $a**b$ after**']) {
    const html = render(source)
    assert.match(html, /<(?:em|strong)>before <span class="katex">/)
    assert.match(html, /after<\/(?:em|strong)>/)
  }
  const html = render('# $x^2$\n\n- $y$\n\n[$z$](https://example.com)\n\n| A |\n|---|\n| $w$ |\n\n<details><summary>$s$</summary>\n$t$\n</details>')
  assert.equal((html.match(/<math\b/g) ?? []).length, 6)
  for (const tag of ['h1', 'li', 'a', 'td', 'summary']) assert.match(html, new RegExp(`<${tag}[^>]*><span class="katex">`))
})

test('ordinary currency, escaped dollars, code and raw HTML blocks stay literal', () => {
  for (const source of ['Cost $5 and $10.', 'Range $5-$10 and US$15.', '$ 5 $', String.raw`\$x\$`, '`$x$`', '```latex\n$\\frac{1}{2}$\n```', '    $x$', '<code>$x$</code>', '<pre>$x$</pre>', '<div title="$x$">$y$</div>', '<style>.x::after{content:"$x$"}</style>', '<!-- $x$ -->', '```html\n<html><body>$x$</body></html>\n```']) {
    assert.doesNotMatch(render(source), /<math\b/, source)
  }
  const inline = render('Inline <span title="$x$">$y$</span>.')
  assert.match(inline, /title="\$x\$"/)
  assert.equal((inline.match(/<math\b/g) ?? []).length, 1)
})

test('incomplete or invalid formulas do not break later Markdown or leak macros', () => {
  for (const source of ['$x', '$$x$', '$$\n\\frac{1}', String.raw`$\notARealCommand{x}$`, '$$\n' + 'x'.repeat(4097) + '\n$$', String.raw`$\def\x{\x}\x$`]) {
    assert.doesNotMatch(render(source), /<math\b/)
    assert.match(render(source + '\n\n**Next**'), /<strong>Next<\/strong>/)
  }
  assert.match(render('$$\n\\frac{1}{2}\n$$'), /<mfrac>/)
  render(String.raw`$\gdef\foo{secret}\foo$`)
  assert.doesNotMatch(render(String.raw`$\foo$`), /<math\b/)
  assert.equal(render(String.raw`$\notARealCommand{x}$`).trim(), '<p>$\\notARealCommand{x}$</p>')
})

test('TeX resource and HTML commands cannot emit active elements', () => {
  for (const tex of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\includegraphics{https://example.com/x.png}`, String.raw`\htmlClass{evil}{x}`, String.raw`\htmlStyle{background:url(https://example.com)}{x}`]) {
    assert.doesNotMatch(render(`$${tex}$`), /<(?:a|img|script|iframe)\b|class="evil"|style="[^"]*url\(/)
  }
})
