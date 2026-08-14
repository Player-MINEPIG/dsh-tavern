import { createHash } from 'node:crypto'
import { compilePresetForDsh, projectPresetCallConfig } from './profile-compiler.js'
import { renderSillyTavernMacros } from '../../tavern-format/src/index.js'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function safeGet(store, id, kind, diagnostics) {
  if (store === null || id === null) return null
  try {
    return store.get(id)
  } catch (error) {
    diagnostics.push({
      code: `${kind.toUpperCase().replaceAll('-', '_')}_NOT_FOUND`,
      severity: 'warning',
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function textFromBlock(block) {
  return block?.type === 'text' && typeof block.text === 'string' ? block.text : ''
}

export function conversationTextFromAgent(agent) {
  if (typeof agent?.session?.deriveMessages !== 'function') return ''
  return agent.session.deriveMessages()
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .flatMap((message) => Array.isArray(message.content) ? message.content.map(textFromBlock) : [])
    .filter(Boolean)
    .join('\n')
}

function normalizedAdapterResult(value, key) {
  if (!isRecord(value)) return { [key]: null, diagnostics: [] }
  return {
    ...value,
    [key]: value[key] ?? null,
    diagnostics: Array.isArray(value.diagnostics) ? clone(value.diagnostics) : [],
  }
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/**
 * Coordinates format/use-case modules without making them depend on DSH.
 * Adapters resolve normalized documents; the compiler owns request semantics.
 */
export class TavernProfileLoader {
  constructor({ presetStore, selections }) {
    this.presetStore = presetStore
    this.selections = selections
    this.characterAdapter = null
    this.userAdapter = null
    this.worldBookAdapter = null
    this.contextCache = new WeakMap()
    this.assembledByAgent = new WeakMap()
  }

  registerCharacterAdapter(adapter) {
    if (this.characterAdapter !== null) throw new Error('A character-card adapter is already registered')
    this.characterAdapter = adapter
    return () => { if (this.characterAdapter === adapter) this.characterAdapter = null }
  }

  registerWorldBookAdapter(adapter) {
    if (this.worldBookAdapter !== null) throw new Error('A world-book adapter is already registered')
    this.worldBookAdapter = adapter
    return () => { if (this.worldBookAdapter === adapter) this.worldBookAdapter = null }
  }

  registerUserAdapter(adapter) {
    if (this.userAdapter !== null) throw new Error('A user adapter is already registered')
    this.userAdapter = adapter
    return () => { if (this.userAdapter === adapter) this.userAdapter = null }
  }

  selection({ agent, sessionId } = {}) {
    return agent === undefined
      ? this.selections.get(sessionId)
      : this.selections.ensureAgent(agent)
  }

  compile(options = {}) {
    const diagnostics = []
    const selection = this.selection(options)
    const preset = safeGet(this.presetStore, selection.presetId, 'preset', diagnostics)
    const conversationText = options.conversationText ?? conversationTextFromAgent(options.agent)
    const shared = {
      selection,
      agent: options.agent,
      sessionId: options.agent?.id ?? options.sessionId ?? null,
      conversationText,
      context: options.context ?? {},
    }

    const characterResult = normalizedAdapterResult(
      this.characterAdapter?.resolve?.(shared),
      'character',
    )
    diagnostics.push(...characterResult.diagnostics)

    const userResult = normalizedAdapterResult(
      this.userAdapter?.resolve?.(shared),
      'user',
    )
    diagnostics.push(...userResult.diagnostics)

    const worldBookResult = normalizedAdapterResult(
      this.worldBookAdapter?.resolve?.({ ...shared, character: characterResult.character, user: userResult.user }),
      'loreEntries',
    )
    diagnostics.push(...worldBookResult.diagnostics)

    const compiled = compileTavernProfile({
      preset,
      character: characterResult.character,
      user: userResult.user,
      characterSelection: selection.character,
      loreEntries: Array.isArray(worldBookResult.loreEntries) ? worldBookResult.loreEntries : [],
      context: options.context ?? {},
    })
    diagnostics.push(...compiled.diagnostics)

    const resources = {
      preset: preset === null ? null : { id: preset.id, name: preset.name, updatedAt: preset.updatedAt },
      characterCard: characterResult.character === null ? null : {
        id: characterResult.character.id,
        name: characterResult.character.name ?? characterResult.character.data?.name ?? '',
        updatedAt: characterResult.character.updatedAt,
      },
      user: userResult.user === null ? null : clone(userResult.user),
      worldBooks: Array.isArray(worldBookResult.resources) ? clone(worldBookResult.resources) : [],
    }
    const audit = {
      schemaVersion: 1,
      sessionId: shared.sessionId,
      selection: clone(selection),
      resources,
      diagnostics: clone(diagnostics),
      activeLoreEntries: compiled.activeLoreEntries,
      worldBooks: clone(worldBookResult.audit ?? { resources: [] }),
      composition: {
        section: { name: 'dsh-tavern:profile', order: 10 },
        systemPromptMode: compiled.systemPromptMode,
        profileCharacters: compiled.systemText.length,
        callConfigFields: Object.keys(compiled.callConfig),
      },
    }

    return {
      ...compiled,
      diagnostics,
      resources,
      audit: { ...audit, fingerprint: fingerprint(audit) },
    }
  }

  forAssembleContext(context = {}) {
    if (!isRecord(context)) return this.compile()
    const cached = this.contextCache.get(context)
    if (cached !== undefined) return cached
    const snapshot = this.compile({ agent: context.agent, context })
    this.contextCache.set(context, snapshot)
    if (isRecord(context.agent)) this.assembledByAgent.set(context.agent, snapshot)
    return snapshot
  }

  assembledFor(agent) {
    return isRecord(agent) ? this.assembledByAgent.get(agent) : undefined
  }

  activeView(sessionId) {
    const snapshot = this.compile({ sessionId })
    return {
      selected: snapshot.resources.preset,
      selection: snapshot.audit.selection,
      resources: snapshot.resources,
      callConfig: snapshot.callConfig,
      compiledPrompt: snapshot.systemText,
      diagnostics: snapshot.diagnostics,
      audit: snapshot.audit,
    }
  }
}

/**
 * Pure combination seam. Character/world-book branches target this normalized
 * input rather than importing DSH or mutating session state themselves.
 */
export function compileTavernProfile({
  preset = null,
  character = null,
  user = null,
  characterSelection = {},
  loreEntries = [],
  context = {},
} = {}) {
  // Preserve the already accepted preset-only byte shape and behavior.
  if (character === null && user === null && loreEntries.length === 0) {
    return {
      systemText: preset === null ? '' : compilePresetForDsh(preset, context),
      callConfig: preset === null ? {} : projectPresetCallConfig(preset),
      systemPromptMode: preset?.systemPromptMode === 'replace' ? 'replace' : 'append',
      runtimeContexts: [],
      activeLoreEntries: [],
      diagnostics: [],
    }
  }

  const characterData = isRecord(character?.data) ? character.data : character
  const profileContext = {
    ...context,
    user: user?.name ?? context.user ?? 'User',
    character: context.character
      ?? characterData?.nickname
      ?? characterData?.name
      ?? character?.name
      ?? 'Assistant',
  }

  const diagnostics = []
  const normalizedLore = loreEntries
    .filter((entry) => typeof entry?.content === 'string' && entry.content.trim() !== '')
    .map((entry) => ({
      ...entry,
      position: entry.position === 'before' || entry.position === 'before-character' ? 'before' : 'after',
    }))
  const beforeLore = normalizedLore.filter((entry) => entry.position === 'before')
  const afterLore = normalizedLore.filter((entry) => entry.position === 'after')
  const fields = normalizedCharacterFields(characterData, characterSelection)
  const userFields = normalizedUserFields(user)
  const consumed = new Set()
  const body = []

  if (preset !== null && Array.isArray(preset.prompts)) {
    for (const prompt of preset.prompts) {
      if (!isRecord(prompt) || prompt.enabled !== true) continue
      const identifier = String(prompt.identifier ?? '')
      if (prompt.marker === true) {
        const marker = compileMarker(identifier, fields, userFields, beforeLore, afterLore, profileContext, consumed)
        if (marker !== '') body.push(marker)
        continue
      }

      let content = typeof prompt.content === 'string' ? prompt.content : ''
      if (identifier === 'main' && fields.systemPrompt !== '' && characterSelection?.preferCharacterSystemPrompt !== false) {
        if (prompt.st?.forbid_overrides !== true) {
          content = applyOriginal(fields.systemPrompt, content)
          consumed.add('systemPrompt')
        } else {
          diagnostics.push({ code: 'CHARACTER_SYSTEM_OVERRIDE_FORBIDDEN', severity: 'info', message: 'Preset main prompt forbids character overrides.' })
        }
      }
      if (identifier === 'jailbreak' && fields.postHistoryInstructions !== '' && characterSelection?.preferCharacterPostHistory !== false) {
        if (prompt.st?.forbid_overrides !== true) {
          content = applyOriginal(fields.postHistoryInstructions, content)
          consumed.add('postHistoryInstructions')
          diagnostics.push(positionDiagnostic('CHARACTER_PHI_APPROXIMATE', 'Character post-history instructions are placed in the Tavern system profile, not strictly after chat history.'))
        }
      }
      const rendered = renderProfileMacros(content, profileContext, fields, userFields, consumed)
      if (rendered !== '') body.push(promptBlock(prompt, rendered))
    }
  }

  appendUserFallback(body, userFields, consumed, profileContext, diagnostics)
  appendCharacterFallbacks(body, fields, consumed, profileContext, diagnostics)
  if (!consumed.has('worldInfoBefore')) appendLore(body, beforeLore, profileContext)
  if (!consumed.has('worldInfoAfter')) appendLore(body, afterLore, profileContext)

  const header = profileHeader(preset, character, user, profileContext)
  const systemText = [...header, ...body].filter(Boolean).join('\n\n')
  return {
    systemText,
    callConfig: preset === null ? {} : projectPresetCallConfig(preset),
    systemPromptMode: preset?.systemPromptMode === 'replace' ? 'replace' : 'append',
    runtimeContexts: [],
    activeLoreEntries: normalizedLore.map((entry) => entry?.id ?? entry?.uid).filter((id) => id !== undefined),
    diagnostics,
  }
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizedCharacterFields(data, selection) {
  if (!isRecord(data)) return {
    description: '', personality: '', scenario: '', messageExample: '',
    systemPrompt: '', postHistoryInstructions: '', greeting: '', depthPrompt: '',
  }
  const depth = isRecord(data.extensions?.depth_prompt) ? data.extensions.depth_prompt.prompt : ''
  return {
    description: stringField(data.description),
    personality: stringField(data.personality),
    scenario: stringField(data.scenario),
    messageExample: stringField(data.messageExample ?? data.mes_example),
    systemPrompt: selection?.preferCharacterSystemPrompt === false
      ? ''
      : stringField(data.systemPrompt ?? data.system_prompt),
    postHistoryInstructions: selection?.preferCharacterPostHistory === false
      ? ''
      : stringField(data.postHistoryInstructions ?? data.post_history_instructions),
    greeting: stringField(selectedGreeting(data, selection)),
    depthPrompt: stringField(depth),
  }
}

function normalizedUserFields(user) {
  return {
    name: stringField(user?.name),
    description: stringField(user?.description),
  }
}

function stringField(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function profileHeader(preset, character, user, context) {
  const lines = ['[dsh-tavern profile]']
  if (preset !== null) {
    lines.push(`preset-name: ${renderSillyTavernMacros(preset.name, context)}`)
    lines.push(`preset-id: ${escapeAttribute(preset.id)}`)
  }
  if (character !== null) {
    const data = isRecord(character.data) ? character.data : character
    lines.push(`character-name: ${renderSillyTavernMacros(data?.name ?? character.name ?? '', context)}`)
    lines.push(`character-id: ${escapeAttribute(character.id)}`)
  }
  if (user !== null) {
    lines.push(`user-name: ${renderSillyTavernMacros(user.name ?? '', { ...context, user: user.name ?? context.user })}`)
    lines.push(`user-id: ${escapeAttribute(user.id)}`)
  }
  return [lines.join('\n')]
}

function promptBlock(prompt, text) {
  return `<st-prompt identifier="${escapeAttribute(prompt.identifier)}" role="${escapeAttribute(prompt.role)}">\n${text}\n</st-prompt>`
}

function characterBlock(name, text, context) {
  const rendered = renderSillyTavernMacros(text, context)
  return rendered === '' ? '' : `<st-character-field name="${name}">\n${rendered}\n</st-character-field>`
}

function userBlock(text, context) {
  const rendered = renderSillyTavernMacros(text, context)
  return rendered === '' ? '' : `<st-user-field name="persona-description">\n${rendered}\n</st-user-field>`
}

function compileMarker(identifier, fields, userFields, beforeLore, afterLore, context, consumed) {
  const mapping = {
    charDescription: ['description', 'description'],
    charPersonality: ['personality', 'personality'],
    scenario: ['scenario', 'scenario'],
    dialogueExamples: ['messageExample', 'message-example'],
  }
  if (mapping[identifier] !== undefined) {
    const [field, tag] = mapping[identifier]
    consumed.add(field)
    return characterBlock(tag, fields[field], context)
  }
  if (['personaDescription', 'userDescription', 'userPersona'].includes(identifier)) {
    if (consumed.has('userDescription')) return ''
    consumed.add('userDescription')
    return userBlock(userFields.description, context)
  }
  if (identifier === 'worldInfoBefore') {
    consumed.add('worldInfoBefore')
    return loreText(beforeLore, context)
  }
  if (identifier === 'worldInfoAfter') {
    consumed.add('worldInfoAfter')
    return loreText(afterLore, context)
  }
  // DSH owns the real durable history. The marker is deliberately consumed
  // without copying it into the system prompt.
  if (identifier === 'chatHistory') consumed.add('chatHistory')
  return ''
}

function appendUserFallback(body, fields, consumed, context, diagnostics) {
  if (fields.description === '' || consumed.has('userDescription')) return
  const block = userBlock(fields.description, context)
  if (block === '') return
  body.push(block)
  consumed.add('userDescription')
  diagnostics.push(positionDiagnostic(
    'USER_PERSONA_MARKER_FALLBACK',
    'The selected user description was appended before fallback character fields because the preset has no enabled personaDescription marker.',
  ))
}

function appendCharacterFallbacks(body, fields, consumed, context, diagnostics) {
  const fallbacks = [
    ['systemPrompt', 'system-prompt'],
    ['description', 'description'],
    ['personality', 'personality'],
    ['scenario', 'scenario'],
    ['messageExample', 'message-example'],
    ['postHistoryInstructions', 'post-history-instructions'],
    ['greeting', 'greeting-reference'],
    ['depthPrompt', 'depth-prompt'],
  ]
  for (const [field, tag] of fallbacks) {
    if (consumed.has(field) || fields[field] === '') continue
    const block = characterBlock(tag, fields[field], context)
    if (block !== '') body.push(block)
    if (field === 'postHistoryInstructions') diagnostics.push(positionDiagnostic('CHARACTER_PHI_APPROXIMATE', 'Character post-history instructions are placed in the Tavern system profile, not strictly after chat history.'))
    if (field === 'greeting') diagnostics.push(positionDiagnostic('CHARACTER_GREETING_REFERENCE', 'The selected greeting is a style reference; it is not an assistant history message.'))
    if (field === 'depthPrompt') diagnostics.push(positionDiagnostic('CHARACTER_DEPTH_APPROXIMATE', 'The character depth prompt is preserved in the Tavern system profile; DSH does not expose arbitrary history-depth insertion.'))
  }
}

function loreText(entries, context) {
  return entries.map((entry) => {
    const rendered = renderSillyTavernMacros(entry.content, context)
    return rendered === '' ? '' : `<st-world-info entry="${escapeAttribute(entry.id ?? entry.uid ?? '')}" position="${escapeAttribute(entry.position)}">\n${rendered}\n</st-world-info>`
  }).filter(Boolean).join('\n\n')
}

function appendLore(body, entries, context) {
  const text = loreText(entries, context)
  if (text !== '') body.push(text)
}

function applyOriginal(override, original) {
  return override.replace(/\{\{\s*original\s*\}\}/gi, original)
}

function renderProfileMacros(text, context, fields, userFields, consumed) {
  let personaInserted = false
  const withPersona = String(text ?? '').replace(/\{\{\s*persona\s*\}\}/gi, () => {
    if (userFields.description === '' || consumed.has('userDescription') || personaInserted) return ''
    personaInserted = true
    consumed.add('userDescription')
    return userFields.description
  })
  const replacements = {
    description: fields.description ?? '',
    personality: fields.personality ?? '',
    scenario: fields.scenario ?? '',
    mesexamples: fields.messageExample ?? '',
  }
  const expanded = withPersona.replace(/\{\{\s*(description|personality|scenario|mesExamples)\s*\}\}/gi, (_match, name) => replacements[name.toLowerCase()] ?? '')
  return renderSillyTavernMacros(expanded, context)
}

function positionDiagnostic(code, message) {
  return { code, severity: 'warning', message }
}

function selectedGreeting(data, selection) {
  const index = Number.isSafeInteger(selection?.greetingIndex) ? selection.greetingIndex : 0
  if (index <= 0) return data.firstMessage ?? data.first_mes ?? ''
  const alternatives = data.alternateGreetings ?? data.alternate_greetings
  return Array.isArray(alternatives) ? alternatives[index - 1] ?? '' : ''
}
