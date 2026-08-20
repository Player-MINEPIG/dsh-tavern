import DOMPurifyFactory from 'dompurify'
import { createElement } from 'react'
import showdown from 'showdown'

const SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'style'],
  FORBID_ATTR: ['srcdoc'],
})

const markdownConverter = new showdown.Converter({
  disableForced4SpacesIndentedSublists: true,
  emoji: true,
  literalMidWordUnderscores: true,
  parseImgDimensions: true,
  simpleLineBreaks: true,
  strikethrough: true,
  tables: true,
  underline: true,
})

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function browserPurifier() {
  if (typeof DOMPurifyFactory?.sanitize === 'function') return DOMPurifyFactory
  if (typeof DOMPurifyFactory === 'function' && globalThis.window?.document != null) {
    return DOMPurifyFactory(globalThis.window)
  }
  return null
}

export function markdownToHtml(text) {
  return markdownConverter.makeHtml(String(text ?? ''))
}

export function sanitizeRenderedHtml(html, {
  purifier = browserPurifier(),
  documentObject = globalThis.document,
} = {}) {
  if (purifier === null || typeof purifier?.sanitize !== 'function') return escapeHtml(html)
  const clean = String(purifier.sanitize(String(html), SANITIZE_OPTIONS))
  if (documentObject == null || typeof documentObject.createElement !== 'function') return clean
  const template = documentObject.createElement('template')
  template.innerHTML = clean
  for (const link of template.content.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) continue
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  return template.innerHTML
}

export function renderRichTextHtml(text, options) {
  return sanitizeRenderedHtml(markdownToHtml(text), options)
}

export function RichText({ text, className }) {
  return createElement('div', {
    className,
    'data-dtv-rich-text': '',
    dangerouslySetInnerHTML: { __html: renderRichTextHtml(text) },
  })
}
