import DOMPurifyFactory from 'dompurify'
import { Marked } from 'marked'
import { createElement } from 'react'

const SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'style'],
  FORBID_ATTR: ['srcdoc'],
})

const markdownConverter = new Marked({
  async: false,
  breaks: true,
  gfm: true,
})

const STANDALONE_WRAPPER_TAG = /^\s*(<\/?[\p{L}][^<>]*?>)\s*$/u
const FENCE_MARKER = /^\s{0,3}(`{3,}|~{3,})/

function normalizeStQuotedFences(source) {
  let quotedFence = null
  return source
    .split('\n')
    .map(line => {
      if (quotedFence) {
        const closing = line.match(/^\s*>\s*(`{3,}|~{3,})\s*$/)
        if (closing && closing[1][0] === quotedFence.marker) {
          quotedFence = null
          return `> ${closing[1]}`
        }
        return /^\s*>/.test(line) ? line : `> ${line}`
      }

      const opening = line.match(/^\s*>\s*(`{3,}|~{3,})(.*)$/)
      if (!opening) return line
      quotedFence = { marker: opening[1][0] }
      return `> ${opening[1]}${opening[2]}`
    })
    .join('\n')
}

function protectStandaloneWrapperTags(source) {
  const wrappers = []
  let fence = null
  let prefix = 'DSHTAVERNWRAPPER'

  while (source.includes(prefix)) prefix += 'X'

  const text = source
    .split('\n')
    .map(line => {
      const fenceMatch = line.match(FENCE_MARKER)
      if (fenceMatch) {
        const marker = fenceMatch[1]
        if (!fence) fence = marker[0]
        else if (marker[0] === fence && marker.length >= 3) fence = null
        return line
      }
      if (fence) return line

      const tagMatch = line.match(STANDALONE_WRAPPER_TAG)
      if (!tagMatch) return line

      const token = `${prefix}${wrappers.length}END`
      wrappers.push(tagMatch[1])
      return token
    })
    .join('\n')

  return { prefix, text, wrappers }
}

function restoreStandaloneWrapperTags(html, { prefix, wrappers }) {
  let restored = html
  wrappers.forEach((tag, index) => {
    const token = `${prefix}${index}END`
    restored = restored
      .replace(`<p>${token}</p>`, tag)
      .replaceAll(token, tag)
  })
  return restored
}

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
  const normalizedSource = normalizeStQuotedFences(String(text ?? ''))
  const protectedSource = protectStandaloneWrapperTags(normalizedSource)
  const html = markdownConverter.parse(protectedSource.text)
  return restoreStandaloneWrapperTags(html, protectedSource)
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
