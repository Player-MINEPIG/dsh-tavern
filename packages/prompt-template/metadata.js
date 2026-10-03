const decorators = new Set(['activate', 'dont_activate', 'message_formatting', 'generate_before', 'generate_after', 'render_before', 'render_after', 'dont_preload', 'preload', 'only_preload', 'initial_variables', 'always_enabled', 'private', 'if', 'iframe', 'preprocessing'])
/** Classify explicit upstream metadata only; never decompile an arbitrary JS rule. */
export function inspectTemplateMetadata({ name = '', content = '' } = {}) {
  const tags = [...name.matchAll(/\[((?:PRELOAD|GENERATE|RENDER|INITIALVARIABLES)(?::[^\]\r\n]*)?)\]/gi)].map(m => m[1].toUpperCase())
  if (/(?:^|\s)@INJECT\b/i.test(name)) tags.push('@INJECT')
  const leading = []
  for (const line of content.split(/\r?\n/)) {
    // Only contiguous leading decorators have upstream semantics. @@@ escapes them.
    const match = /^@@(?!@)([^ \t]*)(?:[ \t]+(.*))?$/i.exec(line)
    if (!match) break
    leading.push({ name: match[1].toLowerCase(), arguments: match[2] ?? '', recognized: decorators.has(match[1].toLowerCase()) })
  }
  const unsupported = tags.filter(tag => !['GENERATE:BEFORE', 'GENERATE:AFTER'].includes(tag))
  const diagnostics = [
    ...unsupported.map(stage => ({ code: 'TEMPLATE_LIFECYCLE_UNSUPPORTED', stage })),
    ...leading.map(d => ({ code: d.recognized ? 'TEMPLATE_DECORATOR_UNSUPPORTED' : 'TEMPLATE_DECORATOR_UNKNOWN', stage: `@@${d.name}` })),
  ]
  return { language: content.includes('<%') ? 'ejs-style' : 'text', originalTags: tags,
    ...(leading.length ? { decorators: leading } : {}),
    ...(tags.some(tag => ['GENERATE:BEFORE', 'GENERATE:AFTER'].includes(tag)) ? { suggestedOn: 'before_model_request', placementRequired: true } : {}),
    supported: diagnostics.length === 0, diagnostics, content }
}
