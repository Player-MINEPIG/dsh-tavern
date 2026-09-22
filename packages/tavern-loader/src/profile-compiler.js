import { digest, namedParts, source } from './assembly-parts.js'
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

export function assemblePresetParts(preset, context = {}) {
  if (!isRecord(preset) || !Array.isArray(preset.prompts)) return []
  const variables = new Map()
  const resourceRevision = digest(preset)
  const sections = []
  for (const prompt of preset.prompts) {
    if (!isRecord(prompt) || prompt.enabled !== true || prompt.marker === true) continue
    const text = renderSillyTavernMacros(prompt.content, context, variables)
    if (text === '') continue
    sections.push({
      sources: [source('preset', preset, `prompts/${preset.prompts.indexOf(prompt)}/content`, prompt.content, {
        identifier: prompt.identifier,
        role: prompt.role,
        resourceRevision,
      })],
      provenance: 'section-contributors',
      text,
    })
  }
  return namedParts(sections)
}

export function compilePresetForDsh(preset, context = {}) {
  return assemblePresetParts(preset, context).map(part => part.text).join('\n\n')
}

export function projectPresetCallConfig(preset) {
  const sampling = isRecord(preset?.sampling) ? preset.sampling : {}
  return {
    ...(finite(sampling.temperature) === undefined ? {} : { temperature: sampling.temperature }),
    ...(positiveInteger(sampling.maxTokens) === undefined ? {} : { maxTokens: sampling.maxTokens }),
    ...(typeof sampling.reasoningEffort === 'string' && sampling.reasoningEffort.trim() !== '' && sampling.reasoningEffort.length <= 100
      ? { reasoningEffort: sampling.reasoningEffort }
      : {}),
    ...(Array.isArray(sampling.stop) && sampling.stop.length > 0 ? { stop: [...sampling.stop] } : {}),
  }
}
