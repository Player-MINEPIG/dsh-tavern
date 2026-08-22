const SCHEMA_VERSION = 1
const CHAT_COMPLETION_ORDER_ID = 100001

const SAMPLING_KEYS = [
  'temperature',
  'frequency_penalty',
  'presence_penalty',
  'top_p',
  'top_k',
  'top_a',
  'min_p',
  'repetition_penalty',
  'openai_max_context',
  'openai_max_tokens',
  'reasoning_effort',
  'seed',
  'n',
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function string(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function makeId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeName(value, fallback) {
  const name = string(value).trim()
  return name === '' ? fallback : name.slice(0, 200)
}

function normalizeRole(value) {
  switch (value) {
    case 'model':
    case 'assistant':
      return 'assistant'
    case 'system':
      return 'system'
    default:
      return 'user'
  }
}

function promptIdentifier(prompt, index) {
  const candidate = string(prompt?.identifier).trim()
  return candidate === '' ? `prompt-${index + 1}` : candidate
}

function usableOrder(order, promptIds) {
  if (!isRecord(order) || !Array.isArray(order.order)) return -1
  return order.order.reduce((score, entry) => score + (isRecord(entry) && promptIds.has(entry.identifier) ? 1 : 0), 0)
}

function choosePromptOrder(orders, promptIds) {
  const valid = orders.filter((order) => usableOrder(order, promptIds) >= 0)
  const chatCompletion = valid.find((order) => Number(order.character_id) === CHAT_COMPLETION_ORDER_ID)
  if (chatCompletion !== undefined) return chatCompletion
  return valid.toSorted((left, right) => usableOrder(right, promptIds) - usableOrder(left, promptIds))[0]
}

function normalizePrompts(rawPrompts, selectedOrder) {
  const base = rawPrompts.map((rawPrompt, index) => {
    const prompt = isRecord(rawPrompt) ? rawPrompt : {}
    return {
      identifier: promptIdentifier(prompt, index),
      name: normalizeName(prompt.name, `Prompt ${index + 1}`),
      role: normalizeRole(prompt.role),
      content: string(prompt.content),
      enabled: typeof prompt.enabled === 'boolean' ? prompt.enabled : false,
      marker: prompt.marker === true,
      systemPrompt: prompt.system_prompt === true,
      injectionPosition: finite(prompt.injection_position),
      injectionDepth: finite(prompt.injection_depth),
      st: clone(prompt),
    }
  })

  if (selectedOrder === undefined) {
    return base.map((prompt) => ({
      ...prompt,
      enabled: typeof prompt.st.enabled === 'boolean'
        ? prompt.st.enabled
        : !prompt.marker && prompt.content.trim() !== '',
    }))
  }

  const byIdentifier = new Map(base.map((prompt) => [prompt.identifier, prompt]))
  const ordered = []
  const seen = new Set()
  for (const entry of selectedOrder.order) {
    if (!isRecord(entry) || typeof entry.identifier !== 'string') continue
    const prompt = byIdentifier.get(entry.identifier)
    if (prompt === undefined || seen.has(prompt.identifier)) continue
    seen.add(prompt.identifier)
    ordered.push({ ...prompt, enabled: entry.enabled === true })
  }
  for (const prompt of base) {
    if (!seen.has(prompt.identifier)) ordered.push(prompt)
  }
  return ordered
}

function normalizedSampling(raw) {
  const st = {}
  for (const key of SAMPLING_KEYS) {
    if (raw[key] !== undefined) st[key] = clone(raw[key])
  }
  if (Array.isArray(raw.stop)) st.stop = clone(raw.stop)

  return {
    temperature: finite(raw.temperature),
    maxTokens: positiveInteger(raw.openai_max_tokens ?? raw.max_tokens),
    reasoningEffort: ['low', 'medium', 'high', 'xhigh'].includes(raw.reasoning_effort)
      ? raw.reasoning_effort
      : undefined,
    stop: Array.isArray(raw.stop)
      ? raw.stop.filter((item) => typeof item === 'string' && item !== '').slice(0, 16)
      : undefined,
    st,
  }
}

function parseInput(input) {
  if (typeof input !== 'string') return input
  try {
    return JSON.parse(input)
  } catch (error) {
    throw new TypeError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function parseSillyTavernPreset(input, options = {}) {
  const raw = parseInput(input)
  if (!isRecord(raw)) throw new TypeError('SillyTavern preset must be a JSON object')
  if (!Array.isArray(raw.prompts)) throw new TypeError('SillyTavern Chat Completion preset must contain a prompts array')

  const promptIds = new Set(raw.prompts.map(promptIdentifier))
  const orders = Array.isArray(raw.prompt_order) ? raw.prompt_order.filter(isRecord) : []
  const selectedOrder = choosePromptOrder(orders, promptIds)
  const now = options.now ?? new Date().toISOString()

  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.id ?? makeId(),
    name: normalizeName(options.name ?? raw.name, 'Imported preset'),
    createdAt: now,
    updatedAt: now,
    source: {
      format: 'sillytavern-chat-completion',
      importedAt: now,
      selectedOrderCharacterId: selectedOrder?.character_id,
      raw: clone(raw),
    },
    systemPromptMode: 'append',
    sampling: normalizedSampling(raw),
    prompts: normalizePrompts(raw.prompts, selectedOrder),
  }
}

export function createBlankPreset(options = {}) {
  const now = options.now ?? new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: options.id ?? makeId(),
    name: normalizeName(options.name, 'Untitled preset'),
    createdAt: now,
    updatedAt: now,
    source: { format: 'dsh-tavern', createdAt: now },
    systemPromptMode: 'append',
    sampling: {
      temperature: 1,
      maxTokens: undefined,
      reasoningEffort: undefined,
      stop: undefined,
      st: {},
    },
    prompts: [{
      identifier: 'main',
      name: 'Main prompt',
      role: 'system',
      content: '',
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {},
    }],
  }
}

function editablePrompt(prompt, index) {
  if (!isRecord(prompt)) throw new TypeError(`Prompt at index ${index} must be an object`)
  return {
    ...clone(prompt),
    identifier: promptIdentifier(prompt, index),
    name: normalizeName(prompt.name, `Prompt ${index + 1}`),
    role: normalizeRole(prompt.role),
    content: string(prompt.content),
    enabled: prompt.enabled === true,
    marker: prompt.marker === true,
    systemPrompt: prompt.systemPrompt === true,
    st: isRecord(prompt.st) ? clone(prompt.st) : {},
  }
}

export function editPreset(existing, patch, options = {}) {
  if (!isRecord(existing) || existing.schemaVersion !== SCHEMA_VERSION) throw new TypeError('Unsupported preset document')
  if (!isRecord(patch)) throw new TypeError('Preset update must be an object')

  const samplingPatch = isRecord(patch.sampling) ? patch.sampling : {}
  const temperature = samplingPatch.temperature === null || samplingPatch.temperature === ''
    ? undefined
    : finite(Number(samplingPatch.temperature))
  const maxTokens = samplingPatch.maxTokens === null || samplingPatch.maxTokens === ''
    ? undefined
    : positiveInteger(Number(samplingPatch.maxTokens))
  const reasoningEffort = ['low', 'medium', 'high', 'xhigh'].includes(samplingPatch.reasoningEffort)
    ? samplingPatch.reasoningEffort
    : undefined
  const stop = Array.isArray(samplingPatch.stop)
    ? samplingPatch.stop.filter((item) => typeof item === 'string' && item !== '').slice(0, 16)
    : existing.sampling.stop

  return {
    ...clone(existing),
    name: normalizeName(patch.name ?? existing.name, existing.name),
    updatedAt: options.now ?? new Date().toISOString(),
    systemPromptMode: patch.systemPromptMode === 'replace' ? 'replace' : 'append',
    sampling: {
      ...clone(existing.sampling),
      temperature,
      maxTokens,
      reasoningEffort,
      stop,
      st: isRecord(samplingPatch.st) ? clone(samplingPatch.st) : clone(existing.sampling.st ?? {}),
    },
    prompts: Array.isArray(patch.prompts)
      ? patch.prompts.map(editablePrompt)
      : clone(existing.prompts),
  }
}

function resolveMacro(body, variables, context) {
  const macro = body.trim()
  if (macro.startsWith('//')) return ''
  const set = /^setvar::([^:]+)::([\s\S]*)$/i.exec(macro)
  if (set !== null) {
    variables.set(set[1].trim(), set[2])
    return ''
  }
  const get = /^getvar::(.+)$/i.exec(macro)
  if (get !== null) return variables.get(get[1].trim()) ?? ''
  if (/^user$/i.test(macro)) return context.user ?? 'User'
  if (/^char$/i.test(macro)) return context.character ?? 'Assistant'
  if (/^lastusermessage$/i.test(macro)) return context.lastUserMessage ?? ''
  if (/^lastcharmessage$/i.test(macro)) return context.lastAssistantMessage ?? ''
  if (/^trim$/i.test(macro)) return ''
  const random = /^random::([\s\S]+)$/i.exec(macro)
  if (random !== null) {
    const values = random[1].split(',').map((value) => value.trim()).filter(Boolean)
    if (values.length === 0) return ''
    const value = Math.min(0.999999, Math.max(0, context.random?.() ?? Math.random()))
    return values[Math.floor(value * values.length)]
  }
  const roll = /^roll\s+(\d+)d(\d+)([+-]\d+)?$/i.exec(macro)
  if (roll !== null) {
    const count = Math.min(100, Number(roll[1]))
    const sides = Math.max(1, Number(roll[2]))
    let total = Number(roll[3] ?? 0)
    for (let index = 0; index < count; index += 1) {
      const value = Math.min(0.999999, Math.max(0, context.random?.() ?? Math.random()))
      total += 1 + Math.floor(value * sides)
    }
    return String(total)
  }
  return ''
}

function setExportedValue(target, key, value) {
  if (value === undefined) delete target[key]
  else target[key] = clone(value)
}

function exportedPrompt(prompt, index) {
  const raw = isRecord(prompt?.st) ? clone(prompt.st) : {}
  raw.identifier = promptIdentifier(prompt, index)
  raw.name = normalizeName(prompt?.name, `Prompt ${index + 1}`)
  raw.role = normalizeRole(prompt?.role)
  raw.content = string(prompt?.content)
  raw.enabled = prompt?.enabled === true
  raw.marker = prompt?.marker === true
  raw.system_prompt = prompt?.systemPrompt === true
  setExportedValue(raw, 'injection_position', finite(prompt?.injectionPosition))
  setExportedValue(raw, 'injection_depth', finite(prompt?.injectionDepth))
  return raw
}

function exportedOrder(raw, preset, prompts) {
  const orders = Array.isArray(raw.prompt_order)
    ? raw.prompt_order.filter(isRecord).map(clone)
    : []
  const sourceOrderId = preset.source?.selectedOrderCharacterId
  const selectedOrderId = sourceOrderId === undefined
    ? CHAT_COMPLETION_ORDER_ID
    : sourceOrderId
  const index = orders.findIndex(order => String(order.character_id) === String(selectedOrderId))
  const order = index === -1 ? { character_id: selectedOrderId } : orders[index]
  order.order = prompts.map(prompt => ({
    identifier: prompt.identifier,
    enabled: prompt.enabled === true,
  }))
  if (index === -1) orders.push(order)
  else orders[index] = order
  return orders
}

/**
 * Serialize the current normalized preset as an ST Chat Completion preset.
 * Unknown source fields are retained, while editable canonical fields always
 * reflect the current Tavern document rather than the import-time snapshot.
 */
export function exportSillyTavernPreset(preset, options = {}) {
  if (!isRecord(preset) || preset.schemaVersion !== SCHEMA_VERSION) {
    throw new TypeError('Unsupported preset document')
  }
  const raw = isRecord(preset.source?.raw) ? clone(preset.source.raw) : {}
  const sampling = isRecord(preset.sampling) ? preset.sampling : {}
  if (isRecord(sampling.st)) {
    for (const [key, value] of Object.entries(sampling.st)) raw[key] = clone(value)
  }

  raw.name = normalizeName(preset.name, 'Exported preset')
  setExportedValue(raw, 'temperature', finite(sampling.temperature))
  setExportedValue(raw, 'openai_max_tokens', positiveInteger(sampling.maxTokens))
  delete raw.max_tokens
  setExportedValue(raw, 'reasoning_effort', ['low', 'medium', 'high', 'xhigh'].includes(sampling.reasoningEffort)
    ? sampling.reasoningEffort
    : undefined)
  setExportedValue(raw, 'stop', Array.isArray(sampling.stop)
    ? sampling.stop.filter(item => typeof item === 'string' && item !== '').slice(0, 16)
    : undefined)

  const prompts = Array.isArray(preset.prompts)
    ? preset.prompts.map(exportedPrompt)
    : []
  raw.prompts = prompts
  raw.prompt_order = exportedOrder(raw, preset, prompts)

  const space = options.pretty === false ? undefined : 2
  return `${JSON.stringify(raw, null, space)}${space === undefined ? '' : '\n'}`
}

export function renderSillyTavernMacros(content, context = {}, variables = new Map()) {
  let rendered = string(content)
  for (let pass = 0; pass < 5 && /\{\{[\s\S]*?\}\}/.test(rendered); pass += 1) {
    rendered = rendered.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_match, body) => resolveMacro(body, variables, context))
  }
  return rendered.replaceAll('{{', '{ {').replaceAll('}}', '} }').trim()
}

export const constants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  chatCompletionOrderId: CHAT_COMPLETION_ORDER_ID,
})

export {
  characterCardConstants,
  createBlankCharacterCard,
  editCharacterCard,
  embeddedCharacterBookResource,
  exportCharacterCardJson,
  exportCharacterCardPng,
  parseSillyTavernCharacterCard,
} from './character.js'
export {
  embedCharacterCardPng,
  extractCharacterCardPng,
  isPng,
  pngCharacterCardConstants,
  stripCharacterCardPng,
} from './png-card.js'
export {
  readNativeRegexScripts,
  replaceNativeRegexScripts,
} from './regex-scripts.js'
