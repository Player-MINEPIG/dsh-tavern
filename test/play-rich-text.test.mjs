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
  assert.equal(
    renderRichTextHtml('line 1\nline 2', { purifier, documentObject: null }).trim(),
    '<p>line 1<br>line 2</p>',
  )
})
