/** Classify only explicit title metadata. Never infer an outer rule by decompiling JS. */
export function inspectTemplateMetadata({ name = '', content = '' } = {}) {
  const tags = [...name.matchAll(/\[(PRELOAD|GENERATE:(?:BEFORE|AFTER)|RENDER(?::(?:BEFORE|AFTER))?)\]/gi)].map(m => m[1].toUpperCase())
  const unsupported = tags.filter(tag => !tag.startsWith('GENERATE:'))
  return { language: content.includes('<%') ? 'ejs-style' : 'text', originalTags: tags,
    ...(tags.some(tag => tag.startsWith('GENERATE:')) ? { suggestedOn: 'before_model_request', placementRequired: true } : {}),
    supported: unsupported.length === 0, diagnostics: unsupported.map(stage => ({ code: 'TEMPLATE_LIFECYCLE_UNSUPPORTED', stage })),
    // Timing is a proposal only. The caller must choose an assembly position and
    // enable a separate resource; original title/body and arbitrary JS stay intact.
    content }
}
