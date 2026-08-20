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
  assert.match(html, /^<p>line 1<br \/>\nline 2<\/p>$/)
})

test('Tavern rich text follows ST Showdown semantics inside custom wrapper tags', () => {
  const html = markdownToHtml(`<StatusBlock>
>\`\`\`json
催眠指令：
无
>\`\`\`
</StatusBlock>`)

  assert.match(html, /<StatusBlock>/)
  assert.match(html, /<blockquote>/)
  assert.match(html, /<pre><code class="json language-json">催眠指令：\n无/)
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
