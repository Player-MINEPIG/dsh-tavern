import DOMPurifyFactory from 'dompurify'
import { Marked } from 'marked'
import { createElement, memo } from 'react'
import { isolateHtmlDocuments, isolateStyledHtml, mountStyledHtml } from './rich-text-styles.js'

const SANITIZE_OPTIONS = Object.freeze({
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'style', 'template'],
  FORBID_ATTR: ['srcdoc'],
})

const markdownConverter = new Marked({
  async: false,
  breaks: true,
  gfm: true,
})
const summaryConverter = new Marked({ async: false, breaks: false, gfm: true })

const STANDALONE_WRAPPER_TAG = /^\s*(<\/?[\p{L}][^<>]*?>)\s*$/u
const FENCE_MARKER = /^\s{0,3}(`{3,}|~{3,})/
const HTML_TAGS = new Set('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr'.split(' '))

function withoutHtmlComments(html) {
  const parts = []
  let offset = 0
  for (;;) {
    const start = html.indexOf('<!--', offset)
    if (start < 0) break
    const end = html.indexOf('-->', start + 4)
    if (end < 0) break
    parts.push(html.slice(offset, start))
    offset = end + 3
  }
  parts.push(html.slice(offset))
  return parts.join('')
}

// ST display templates may wrap a whole HTML document in a Markdown fence.
// Only closed document-shaped blocks opt in; snippets and streaming code retain
// Markdown semantics. This is format recognition, not a security boundary:
// renderRichTextHtml still purifies the result before isolating its styles.
function fencedHtmlDocument(token) {
  if (token.lang && token.lang.trim().toLowerCase() !== 'html') return null
  const lines = token.raw.trimEnd().split('\n')
  const opening = lines[0].match(/^ {0,3}(`{3,}|~{3,})[\t ]*(?:html)?[\t ]*$/i)
  const closing = lines.at(-1).match(/^ {0,3}(`{3,}|~{3,})[\t ]*$/)
  if (lines.length < 3 || !opening || !closing || opening[1][0] !== closing[1][0]
    || closing[1].length < opening[1].length) return null

  const html = token.text.trim()
  const shape = withoutHtmlComments(html).trim().replace(/^<!doctype\s+html[^>]*>\s*/i, '')
  const document = /^<html(?:\s[^<>]*|)>/i.test(shape) && /<\/html\s*>$/i.test(shape)
  const headAndBody = /^<head(?:\s[^<>]*|)>/i.test(shape) && /<\/body\s*>$/i.test(shape)
    && /<\/head\s*>\s*<body(?:\s[^<>]*|)>/i.test(shape)
  return document || headAndBody ? html : null
}

markdownConverter.use({ renderer: {
  code(token) {
    const html = fencedHtmlDocument(token)
    return html === null ? false : `<div data-dtv-html-document="">${html}</div>\n`
  },
} })

// A details body is Markdown even when authors omit CommonMark's blank lines.
// Keep raw HTML cards intact, and ignore apparent closing tags in code/comments.
markdownConverter.use({ extensions: [{
  name: 'tavernDetails',
  level: 'block',
  start: source => source.match(/^ {0,3}<details(?=[\s>])/im)?.index,
  tokenizer(source) {
    const opening = source.match(/^ {0,3}<details(?=[\s>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/i)
    if (!opening) return undefined
    const tokens = /<!--[\s\S]*?-->|<(pre|code|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|^ {0,3}(`{3,}|~{3,})[^\n]*|(`+)[\s\S]*?\3|<\/?[a-z][a-z0-9:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>/gim
    tokens.lastIndex = opening[0].length
    let depth = 1
    let fence = null
    let end = source.length
    let bodyEnd = end
    for (let match; (match = tokens.exec(source));) {
      if (match[2]) {
        const marker = match[2]
        if (!fence) fence = marker
        else if (marker[0] === fence[0] && marker.length >= fence.length && match[0].trim() === marker) fence = null
      } else if (!fence && /^<\/?details(?=[\s>])/i.test(match[0])) {
        depth += /^<\//.test(match[0]) ? -1 : 1
        if (depth === 0) { bodyEnd = match.index; end = tokens.lastIndex; break }
      }
    }
    const body = source.slice(opening[0].length, bodyEnd).trim()
    const summary = body.match(/^(?:\s|<!--[\s\S]*?-->)*(<summary(?=[\s>])(?:[^"'<>]|"[^"]*"|'[^']*')*>)([\s\S]*?)<\/summary\s*>/i)
    return {
      type: 'tavernDetails', raw: source.slice(0, end), opening: opening[0],
      summary: summary ? `${summary[1]}${summaryConverter.parseInline(summary[2])}</summary>` : '',
      body: summary ? body.slice(summary[0].length).trim() : body,
    }
  },
  renderer(token) {
    return `${token.opening}${token.summary}\n${markdownToHtml(token.body)}</details>\n`
  },
}] })

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
        if (!fence) fence = marker
        else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null
        return line
      }
      if (fence) return line

      const tagMatch = line.match(STANDALONE_WRAPPER_TAG)
      if (!tagMatch) return line
      const tagName = tagMatch[1].match(/^<\/?([^\s/>]+)/)?.[1].toLowerCase()
      if (HTML_TAGS.has(tagName)) return line

      const token = `${prefix}${wrappers.length}END`
      wrappers.push(tagMatch[1])
      return `\n${token}\n`
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
  isolateStyles = false,
} = {}) {
  if (purifier === null || typeof purifier?.sanitize !== 'function') return escapeHtml(html)
  const canIsolate = isolateStyles && typeof documentObject?.createElement === 'function'
    && typeof documentObject.createElement('div').attachShadow === 'function'
  const options = canIsolate ? {
    ...SANITIZE_OPTIONS,
    FORCE_BODY: true,
    FORBID_TAGS: SANITIZE_OPTIONS.FORBID_TAGS.filter(tag => tag !== 'style'),
  } : SANITIZE_OPTIONS
  const clean = String(purifier.sanitize(String(html), options))
  if (documentObject == null || typeof documentObject.createElement !== 'function') return clean
  const template = documentObject.createElement('template')
  template.innerHTML = clean
  for (const link of template.content.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) continue
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  if (canIsolate) {
    isolateHtmlDocuments(template, documentObject)
    return isolateStyledHtml(template, documentObject)
  }
  return template.innerHTML
}

export function renderRichTextHtml(text, options) {
  return sanitizeRenderedHtml(markdownToHtml(text), { ...options, isolateStyles: true })
}

// Stream updates rerender the conversation; unchanged messages must not repeat
// Markdown parsing, sanitization, or shadow-template traversal on every chunk.
export const RichText = memo(function RichText({ text, className }) {
  return createElement('div', {
    className,
    'data-dtv-rich-text': '',
    ref: element => mountStyledHtml(element),
    dangerouslySetInnerHTML: { __html: renderRichTextHtml(text) },
  })
})
