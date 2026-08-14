import { renderSillyTavernMacros } from '../../tavern-format/src/index.js'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function string(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function escapeAttribute(value) {
  return string(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function compilePresetForDsh(preset, context = {}) {
  if (!isRecord(preset) || !Array.isArray(preset.prompts)) return ''
  const variables = new Map()
  const sections = []
  for (const prompt of preset.prompts) {
    if (!isRecord(prompt) || prompt.enabled !== true || prompt.marker === true) continue
    const text = renderSillyTavernMacros(prompt.content, context, variables)
    if (text === '') continue
    sections.push(`<st-prompt identifier="${escapeAttribute(prompt.identifier)}" role="${escapeAttribute(prompt.role)}">\n${text}\n</st-prompt>`)
  }
  const header = [
    '[dsh-tavern selected preset]',
    `name: ${renderSillyTavernMacros(preset.name, context, variables)}`,
    `id: ${escapeAttribute(preset.id)}`,
  ].join('\n')
  return [header, ...sections].join('\n\n')
}

export function projectPresetCallConfig(preset) {
  const sampling = isRecord(preset?.sampling) ? preset.sampling : {}
  return {
    ...(finite(sampling.temperature) === undefined ? {} : { temperature: sampling.temperature }),
    ...(positiveInteger(sampling.maxTokens) === undefined ? {} : { maxTokens: sampling.maxTokens }),
    ...(['low', 'medium', 'high', 'xhigh'].includes(sampling.reasoningEffort)
      ? { reasoningEffort: sampling.reasoningEffort }
      : {}),
    ...(Array.isArray(sampling.stop) && sampling.stop.length > 0 ? { stop: [...sampling.stop] } : {}),
  }
}
