import test from 'node:test'
import assert from 'node:assert/strict'
import {
  markdownToHtml,
  renderRichTextHtml,
  sanitizeRenderedHtml,
} from '../packages/client/src/play/rich-text.js'

test('Tavern rich text parses GFM while preserving raw HTML for the sanitizer', () => {
  const html = markdownToHtml('**Bold**\n\n<div class="status">Ready</div>')
  assert.match(html, /<strong>Bold<\/strong>/)
  assert.match(html, /<div class="status">Ready<\/div>/)
})

test('Tavern rich text always delegates browser HTML to the constrained purifier profile', () => {
  let received = null
  const purifier = {
    sanitize(html, options) {
      received = { html, options }
      return html.replace(/<script>.*?<\/script>/g, '')
    },
  }
  const html = sanitizeRenderedHtml('<p>Safe</p><script>unsafe()</script>', {
    purifier,
    documentObject: null,
  })
  assert.equal(html, '<p>Safe</p>')
  assert.equal(received.options.USE_PROFILES.html, true)
  assert.ok(received.options.FORBID_TAGS.includes('script'))
  assert.ok(received.options.FORBID_TAGS.includes('iframe'))
  assert.ok(received.options.FORBID_ATTR.includes('srcdoc'))
})

test('Tavern rich text composes Markdown before sanitization', () => {
  const purifier = { sanitize: html => html }
  const html = renderRichTextHtml('line 1\nline 2', { purifier, documentObject: null }).trim()
  assert.match(html, /^<p>line 1<br\s*\/?>(?:\n)?line 2<\/p>$/)
})

test('Tavern rich text follows ST Markdown semantics inside custom wrapper tags', () => {
  const html = markdownToHtml(`<StatusBlock>
>\`\`\`json
催眠指令：
无
>\`\`\`
</StatusBlock>`)

  assert.match(html, /<StatusBlock>/)
  assert.match(html, /<blockquote>/)
  assert.match(html, /<pre><code class="language-json">催眠指令：\n无/)
  assert.doesNotMatch(html, /&gt;```/)
})

test('nested custom wrapper tags do not suppress inner Markdown', () => {
  const html = markdownToHtml(`<Outer>
<Inner>
**Bold**
</Inner>
</Outer>`)

  assert.match(html, /<Outer>/)
  assert.match(html, /<Inner>/)
  assert.match(html, /<strong>Bold<\/strong>/)
})

test('wrapper-like text inside fenced code remains code instead of becoming HTML', () => {
  const html = markdownToHtml('```html\n<StatusBlock>\n```')

  assert.match(html, /&lt;StatusBlock&gt;/)
  assert.doesNotMatch(html, /<StatusBlock>/)
})

test('sanitization removes executable HTML and unsafe link protocols', () => {
  const purifier = {
    sanitize(html) {
      return html
        .replace(/\sonerror="[^"]*"/g, '')
        .replace(/href="javascript:[^"]*"/g, '')
    },
  }
  const html = renderRichTextHtml(
    '<img src="x" onerror="alert(1)">\n\n[unsafe](javascript:alert(1))',
    { purifier, documentObject: null },
  )

  assert.doesNotMatch(html, /onerror/i)
  assert.doesNotMatch(html, /javascript:/i)
})

test('details renders Markdown and fences without requiring blank lines after summary', () => {
  const html = markdownToHtml('<details><summary>**Status**</summary>\n**Ready**\n\n- A\n- B\n</details>')
  assert.match(html, /<summary><strong>Status<\/strong><\/summary>/)
  assert.match(html, /<strong>Ready<\/strong>/)
  assert.match(html, /<li>A<\/li>/)
  const fenced = markdownToHtml('<details><summary>Status</summary>\n```\nA\nB\n```\n</details>')
  assert.match(fenced, /<pre><code>A\nB\n<\/code><\/pre>/)
})

test('details nesting ignores closing tags in code and keeps following prose outside', () => {
  const html = markdownToHtml('<details><summary>Outer</summary>\n```html\n</details>\n```\n<details><summary>Inner</summary>\n**Ready**\n</details>\n</details>\n\nAfter')
  assert.equal((html.match(/<details>/g) ?? []).length, 2)
  assert.match(html, /&lt;\/details&gt;/)
  assert.match(html, /<strong>Ready<\/strong>/)
  assert.match(html, /<\/details>\s*<p>After<\/p>/)
})

test('styled HTML retains its summary layout and CSS instead of gaining Markdown breaks', () => {
  const html = markdownToHtml('<style>\n.card {display:flex}\n</style>\n<details>\n<!-- heading -->\n<summary class="card">\n<span>A</span>\n<span>B</span>\n</summary>\n<div>\n<span>Body</span>\n</div>\n</details>')
  assert.match(html, /<style>\n.card \{display:flex\}\n<\/style>/)
  assert.doesNotMatch(html, /<br|<p>/)
  assert.match(html, /<summary class="card">/)
})

test('incomplete streaming details renders its body and fences preserve literal details', () => {
  assert.match(markdownToHtml('<details><summary>Status</summary>\n**Ready**'), /<strong>Ready<\/strong>/)
  assert.match(markdownToHtml('```html\n<details><summary>Sample</summary>\n```'), /&lt;details&gt;/)
})

test('details ignores inline code and quoted attributes containing closing tags', () => {
  const html = markdownToHtml('<details title="a > b"><summary>Status</summary>\n`</details>`\n\n<div title="</details>">Ready</div>\n\n**Inside**\n</details>\n\nAfter')
  assert.match(html, /<code>&lt;\/details&gt;<\/code>/)
  assert.match(html, /<strong>Inside<\/strong><\/p>\s*<\/details>\s*<p>After/)
})
