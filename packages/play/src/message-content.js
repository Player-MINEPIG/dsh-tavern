export function projectContentText(content) {
  if (!Array.isArray(content)) return ''
  return content.map(part => {
    if (part === null || typeof part !== 'object' || Array.isArray(part)) return ''
    if (typeof part.text === 'string') return part.text
    return typeof part.type === 'string' && part.type !== 'text' ? `⟦${part.type}⟧` : ''
  }).join('')
}
