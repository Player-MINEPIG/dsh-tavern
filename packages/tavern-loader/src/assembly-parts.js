import { digest, counts } from '../../prompt-metadata.js'
export { digest, counts } from '../../prompt-metadata.js'
import { PLUGIN_ID } from '../../identity.js'


// Source relationships are captured before rendering. They are deliberately
// section-level: interpolation/overrides are not reversible character mappings.
export function source(kind, document, field, text, extra = {}) {
  return { kind, resourceId: document?.id ?? null, resourceRevision: extra.resourceRevision ?? (document ? digest(document) : null),
    field, text: typeof text === 'string' ? text : '', relationship: 'input', ...counts(typeof text === 'string' ? text : ''), ...extra }
}

export function assemblyBody() {
  const body = []
  body.parts = []
  body.sources = []
  body.push = function (...texts) {
    for (const text of texts) {
      Array.prototype.push.call(this, text)
      if (text !== '') this.parts.push({ text, sources: structuredClone(this.sources), provenance: 'section-contributors' })
    }
    return this.length
  }
  return body
}

export function namedParts(parts) {
  return parts.filter(part => part.text !== '').map((part, index) => {
    const primary = part.sources?.[0]
    const label = `${primary?.kind ?? 'generated'}:${primary?.field ?? 'header'}`.replace(/[^A-Za-z0-9_.:-]/g, '_')
    return { ...part, name: `${PLUGIN_ID}:part:${String(index).padStart(4, '0')}:${label}` }
  })
}
