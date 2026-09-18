import { assemblyBody, digest, namedParts, source } from './assembly-parts.js'
import { createHash } from 'node:crypto'
import { PROFILE_SECTION } from '../../identity.js'
import { assemblePresetParts, projectPresetCallConfig } from './profile-compiler.js'
import { composeWorldBookSelection } from './user-world-book-policy.js'
import { renderSillyTavernMacros } from '../../tavern-format/src/index.js'

const DEFAULT_MAX_PROFILE_BYTES = 512 * 1024
const HARD_MAX_PROFILE_BYTES = 2 * 1024 * 1024
const HARD_MAX_PROFILE_LORE_ENTRIES = 4096

function profileByteLimit(value) {
  if (!Number.isSafeInteger(value) || value <= 0) return DEFAULT_MAX_PROFILE_BYTES
  return Math.min(value, HARD_MAX_PROFILE_BYTES)
}

function profileBytes(value) {
  return Buffer.byteLength(value, 'utf8')
}

export class TavernProfileLimitError extends Error {
  constructor(actualBytes, maxBytes) {
    super(`Compiled Tavern profile is ${actualBytes} bytes; the hard limit is ${maxBytes} bytes`)
    this.name = 'TavernProfileLimitError'
    this.code = 'TAVERN_PROFILE_TOO_LARGE'
    this.status = 413
    this.actualBytes = actualBytes
    this.maxBytes = maxBytes
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function characterMacroName(character, override) {
  const data = isRecord(character?.data) ? character.data : character
  return [override, data?.nickname, data?.name, character?.name]
    .find(value => typeof value === 'string' && value.trim() !== '') ?? 'Assistant'
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

function isDurableUserMessage(message) {
  return message?.role === 'user'
    && (message.source == null || message.source?.kind === 'user')
}

/**
 * The selected greeting is a first-turn style reference, never durable chat
 * history. Context/tool injections do not consume it. Once a real assistant
 * reply exists (or more than one real user turn is present), later assemblies
 * must not keep re-injecting the opening reference.
 */
export function greetingReferenceAppliesToAgent(agent) {
  if (typeof agent?.session?.deriveMessages !== 'function') return true
  const messages = agent.session.deriveMessages()
  if (!Array.isArray(messages)) return true
  let userMessages = 0
  for (const message of messages) {
    if (message?.role === 'assistant') return false
    if (!isDurableUserMessage(message)) continue
    userMessages += 1
    if (userMessages > 1) return false
  }
  return true
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
  constructor({
    presetStore,
    selections,
    userWorldBooks = null,
    resourceWorldBooks = null,
    maxProfileBytes,
  }) {
    this.presetStore = presetStore
    this.selections = selections
    this.userWorldBooks = userWorldBooks
    this.resourceWorldBooks = resourceWorldBooks
    this.maxProfileBytes = profileByteLimit(maxProfileBytes)
    this.characterAdapter = null
    this.userAdapter = null
    this.worldBookAdapter = null
    this.activationContextProvider = null
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

  registerActivationContextProvider(provider) {
    if (this.activationContextProvider !== null) throw new Error('An activation-context provider is already registered')
    if (typeof provider !== 'function') throw new TypeError('Activation-context provider must be a function')
    this.activationContextProvider = provider
    return () => { if (this.activationContextProvider === provider) this.activationContextProvider = null }
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
    const activationContext = options.activationContext
      ?? (options.agent === undefined ? null : this.activationContextProvider?.(options.agent) ?? null)
    const conversationText = options.conversationText ?? activationContext?.text ?? conversationTextFromAgent(options.agent)
    const shared = {
      selection,
      agent: options.agent,
      sessionId: options.agent?.id ?? options.sessionId ?? null,
      conversationText,
      activationContext,
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

    const userBoundIds = userResult.user === null || this.userWorldBooks === null
      ? []
      : this.userWorldBooks.get(userResult.user.id)
    const presetBoundIds = preset === null || this.resourceWorldBooks === null
      ? []
      : this.resourceWorldBooks.get('preset', preset.id)
    const characterBoundIds = characterResult.character === null || this.resourceWorldBooks === null
      ? []
      : this.resourceWorldBooks.get('character', characterResult.character.id)
    const worldBookSelection = composeWorldBookSelection(
      selection.worldBookIds,
      userBoundIds,
      presetBoundIds,
      characterBoundIds,
    )
    const effectiveSelection = {
      ...selection,
      worldBookIds: worldBookSelection.effectiveIds,
    }

    const worldBookResult = normalizedAdapterResult(
      this.worldBookAdapter?.resolve?.({
        ...shared,
        selection: effectiveSelection,
        worldBookSelection,
        character: characterResult.character,
        user: userResult.user,
      }),
      'loreEntries',
    )
    diagnostics.push(...worldBookResult.diagnostics)

    const baseContext = isRecord(options.context) ? options.context : {}
    const macroContext = {
      user: userResult.user?.name ?? baseContext.user ?? 'User',
      character: characterMacroName(characterResult.character, baseContext.character),
    }
    const compiled = compileTavernProfile({
      preset,
      character: characterResult.character,
      user: userResult.user,
      characterSelection: selection.character,
      includeGreetingReference: options.agent === undefined
        ? true
        : greetingReferenceAppliesToAgent(options.agent),
      loreEntries: Array.isArray(worldBookResult.loreEntries) ? worldBookResult.loreEntries : [],
      context: { ...baseContext, ...macroContext },
      maxProfileBytes: this.maxProfileBytes,
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
      selection: clone(effectiveSelection),
      sessionSelection: clone(selection),
      worldBookSelection: clone(worldBookSelection),
      resources,
      diagnostics: clone(diagnostics),
      activeLoreEntries: compiled.activeLoreEntries,
      worldBooks: clone(worldBookResult.audit ?? { resources: [] }),
      activation: clone(activationContext?.metadata ?? {
        kind: 'durable-history-only',
        durableMessageCount: null,
        pendingMessageCount: 0,
        includedPendingMessageCount: 0,
        duplicatePendingMessageCount: 0,
        scannedMessageCount: null,
        scannedCharacters: conversationText.length,
        truncated: false,
        claimEventSeqs: [],
        invalidEventCount: 0,
      }),
      composition: {
        section: { name: PROFILE_SECTION, order: 10 },
        systemPromptMode: compiled.systemPromptMode,
        profileCharacters: compiled.systemText.length,
        callConfigFields: Object.keys(compiled.callConfig),
      },
    }

    return {
      ...compiled,
      macroContext,
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
      sessionSelection: snapshot.audit.sessionSelection,
      worldBookSelection: snapshot.audit.worldBookSelection,
      resources: snapshot.resources,
      callConfig: snapshot.callConfig,
      diagnostics: snapshot.diagnostics,
      audit: snapshot.audit,
    }
  }
}

/**
 * Pure combination seam. Character/world-book branches target this normalized
 * input rather than importing DSH or mutating session state themselves.
 */
function compileTavernProfileUnbounded({
  preset = null,
  character = null,
  user = null,
  characterSelection = {},
  includeGreetingReference = true,
  loreEntries = [],
  context = {},
} = {}) {
  // Preserve the already accepted preset-only byte shape and behavior.
  if (character === null && user === null && loreEntries.length === 0) {
    const sections = preset === null ? [] : assemblePresetParts(preset, context)
    return {
      systemText: sections.map(part => part.text).join('\n\n'),
      sections,
      callConfig: preset === null ? {} : projectPresetCallConfig(preset),
      systemPromptMode: preset?.systemPromptMode === 'replace' ? 'replace' : 'append',
      runtimeContexts: [],
      activeLoreEntries: [],
      diagnostics: [],
      userInjection: {
        selected: false,
        descriptionAvailable: false,
        descriptionCharacters: 0,
        descriptionInsertions: 0,
        descriptionPlacement: 'none',
      },
    }
  }

  const characterData = isRecord(character?.data) ? character.data : character
  const profileContext = {
    ...context,
    user: user?.name ?? context.user ?? 'User',
    character: characterMacroName(character, context.character),
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
  if (!includeGreetingReference) fields.greeting = ''
  const userFields = normalizedUserFields(user)
  const userInjection = {
    selected: user !== null,
    descriptionAvailable: userFields.description !== '',
    descriptionCharacters: userFields.description.length,
    descriptionInsertions: 0,
    descriptionPlacement: 'none',
  }
  const consumed = new Set()
  const body = assemblyBody()
  // Hash each resource once per assembly, not once per field/prompt.
  const presetRevision = preset ? digest(preset) : null
  const characterRevision = character ? digest(character) : null
  const userRevision = user ? digest(user) : null
  body.characterSource = field => source('character', character, field, fields[field], { resourceRevision: characterRevision })
  body.userSource = () => source('user', user, 'description', userFields.description, { resourceRevision: userRevision })

  if (preset !== null && Array.isArray(preset.prompts)) {
    for (const prompt of preset.prompts) {
      if (!isRecord(prompt) || prompt.enabled !== true) continue
      const identifier = String(prompt.identifier ?? '')
      body.sources = [source('preset', preset, `prompts/${preset.prompts.indexOf(prompt)}/content`, prompt.content, {
        identifier,
        role: prompt.role,
        resourceRevision: presetRevision,
      })]
      if (prompt.marker === true) {
        const marker = compileMarker(identifier, fields, userFields, beforeLore, afterLore, profileContext, consumed, userInjection, body)
        if (marker !== '') body.push(marker)
        continue
      }

      let content = typeof prompt.content === 'string' ? prompt.content : ''
      if (identifier === 'main' && fields.systemPrompt !== '' && characterSelection?.preferCharacterSystemPrompt !== false) {
        if (prompt.st?.forbid_overrides !== true) {
          if (!/\{\{\s*original\s*\}\}/i.test(fields.systemPrompt)) body.sources[0].relationship = 'placement-only'
          body.sources.push(body.characterSource('systemPrompt'))
          content = applyOriginal(fields.systemPrompt, content)
          consumed.add('systemPrompt')
        } else {
          diagnostics.push({ code: 'CHARACTER_SYSTEM_OVERRIDE_FORBIDDEN', severity: 'info', message: 'Preset main prompt forbids character overrides.' })
        }
      }
      if (identifier === 'jailbreak' && fields.postHistoryInstructions !== '' && characterSelection?.preferCharacterPostHistory !== false) {
        if (prompt.st?.forbid_overrides !== true) {
          if (!/\{\{\s*original\s*\}\}/i.test(fields.postHistoryInstructions)) body.sources[0].relationship = 'placement-only'
          body.sources.push(body.characterSource('postHistoryInstructions'))
          content = applyOriginal(fields.postHistoryInstructions, content)
          consumed.add('postHistoryInstructions')
          diagnostics.push(positionDiagnostic('CHARACTER_PHI_APPROXIMATE', 'Character post-history instructions are placed in the Tavern system profile, not strictly after chat history.'))
        }
      }
      for (const [macro, field] of Object.entries({ description: 'description', personality: 'personality', scenario: 'scenario', mesexamples: 'messageExample' })) {
        if (new RegExp('\\{\\{\\s*' + macro + '\\s*\\}\\}', 'i').test(content)) body.sources.push(body.characterSource(field))
      }
      if (/\{\{\s*persona\s*\}\}/i.test(content)) body.sources.push(body.userSource())
      const rendered = renderProfileMacros(content, profileContext, fields, userFields, consumed, userInjection, identifier)
      if (rendered !== '') body.push(rendered)
    }
  }

  appendUserFallback(body, userFields, consumed, profileContext, diagnostics, userInjection)
  appendCharacterFallbacks(body, fields, consumed, profileContext, diagnostics)
  if (!consumed.has('worldInfoBefore')) appendLore(body, beforeLore, profileContext)
  if (!consumed.has('worldInfoAfter')) appendLore(body, afterLore, profileContext)

  const systemText = body.filter(Boolean).join('\n\n')
  return {
    systemText,
    sections: namedParts(body.parts),
    callConfig: preset === null ? {} : projectPresetCallConfig(preset),
    systemPromptMode: preset?.systemPromptMode === 'replace' ? 'replace' : 'append',
    runtimeContexts: [],
    activeLoreEntries: normalizedLore.map((entry) => entry?.id ?? entry?.uid).filter((id) => id !== undefined),
    diagnostics,
    userInjection,
  }
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

function characterBlock(text, context) {
  const rendered = renderSillyTavernMacros(text, context)
  return rendered === '' ? '' : rendered
}

function userBlock(text, context) {
  const rendered = renderSillyTavernMacros(text, context)
  return rendered === '' ? '' : rendered
}

function compileMarker(identifier, fields, userFields, beforeLore, afterLore, context, consumed, userInjection, body) {
  const mapping = {
    charDescription: 'description',
    charPersonality: 'personality',
    scenario: 'scenario',
    dialogueExamples: 'messageExample',
  }
  if (mapping[identifier] !== undefined) {
    const field = mapping[identifier]
    consumed.add(field)
    body.sources = [body.characterSource(field)]
    return characterBlock(fields[field], context)
  }
  if (['personaDescription', 'userDescription', 'userPersona'].includes(identifier)) {
    if (consumed.has('userDescription')) return ''
    consumed.add('userDescription')
    body.sources = [body.userSource()]
    const block = userBlock(userFields.description, context)
    if (block !== '') markUserDescription(userInjection, `preset-marker:${identifier}`)
    return block
  }
  if (identifier === 'worldInfoBefore') {
    consumed.add('worldInfoBefore')
    appendLore(body, beforeLore, context)
    return ''
  }
  if (identifier === 'worldInfoAfter') {
    consumed.add('worldInfoAfter')
    appendLore(body, afterLore, context)
    return ''
  }
  // DSH owns the real durable history. The marker is deliberately consumed
  // without copying it into the system prompt.
  if (identifier === 'chatHistory') consumed.add('chatHistory')
  return ''
}

function appendUserFallback(body, fields, consumed, context, diagnostics, userInjection) {
  if (fields.description === '' || consumed.has('userDescription')) return
  const block = userBlock(fields.description, context)
  if (block === '') return
  body.sources = [body.userSource()]
  body.push(block)
  consumed.add('userDescription')
  markUserDescription(userInjection, 'fallback')
  diagnostics.push(positionDiagnostic(
    'USER_PERSONA_MARKER_FALLBACK',
    'The selected user description was appended before fallback character fields because the preset has no enabled personaDescription marker.',
  ))
}

function appendCharacterFallbacks(body, fields, consumed, context, diagnostics) {
  const fallbacks = [
    'systemPrompt',
    'description',
    'personality',
    'scenario',
    'messageExample',
    'postHistoryInstructions',
    'greeting',
    'depthPrompt',
  ]
  for (const field of fallbacks) {
    if (consumed.has(field) || fields[field] === '') continue
    const block = characterBlock(fields[field], context)
    if (block !== '') { body.sources = [body.characterSource(field)]; body.push(block) }
    if (field === 'postHistoryInstructions') diagnostics.push(positionDiagnostic('CHARACTER_PHI_APPROXIMATE', 'Character post-history instructions are placed in the Tavern system profile, not strictly after chat history.'))
    if (field === 'greeting') diagnostics.push(positionDiagnostic('CHARACTER_GREETING_REFERENCE', 'The selected greeting is a style reference; it is not an assistant history message.'))
    if (field === 'depthPrompt') diagnostics.push(positionDiagnostic('CHARACTER_DEPTH_APPROXIMATE', 'The character depth prompt is preserved in the Tavern system profile; DSH does not expose arbitrary history-depth insertion.'))
  }
}

function loreText(entries, context) {
  return entries.map((entry) => {
    const rendered = renderSillyTavernMacros(entry.content, context)
    return rendered === '' ? '' : rendered
  }).filter(Boolean).join('\n\n')
}

function appendLore(body, entries, context) {
  for (const entry of entries) {
    body.sources = [source('worldbook', null, 'content', entry.content, {
      resourceId: entry.resourceId ?? null,
      entryId: entry.uid == null ? null : String(entry.uid),
      qualifiedEntryId: entry.id == null ? null : String(entry.id),
    })]
    const text = loreText([entry], context)
    if (text !== '') body.push(text)
  }
}

function applyOriginal(override, original) {
  return override.replace(/\{\{\s*original\s*\}\}/gi, () => original)
}

/**
 * Compiles only as much ranked lore as fits the plugin-owned hard profile
 * budget. ST tokenBudget/ignoreBudget remain compatibility policy; neither can
 * bypass this byte limit. Static preset/character/user content is never cut in
 * the middle: if it alone is too large, compilation fails explicitly.
 */
export function compileTavernProfile(options = {}) {
  const maxBytes = profileByteLimit(options.maxProfileBytes)
  const loreEntries = Array.isArray(options.loreEntries) ? options.loreEntries : []
  const withoutLore = compileTavernProfileUnbounded({ ...options, loreEntries: [] })
  const baseBytes = profileBytes(withoutLore.systemText)
  if (baseBytes > maxBytes) {
    throw new TavernProfileLimitError(baseBytes, maxBytes)
  }
  if (loreEntries.length === 0) return withoutLore

  // Do not first concatenate every selected book merely to discover that the
  // result is oversized. A raw-input guard bounds transient assembly memory;
  // final output is still measured exactly below. Two profile budgets leave
  // room for macros that contract while keeping hostile multi-book input
  // bounded before section text is assembled.
  const maxLoreInputBytes = maxBytes * 2
  let inputBytes = 0
  let candidateCount = 0
  for (const entry of loreEntries.slice(0, HARD_MAX_PROFILE_LORE_ENTRIES)) {
    const entryBytes = profileBytes(typeof entry?.content === 'string' ? entry.content : '')
    if (inputBytes + entryBytes > maxLoreInputBytes) break
    inputBytes += entryBytes
    candidateCount += 1
  }

  let compiled = compileTavernProfileUnbounded({ ...options, loreEntries: loreEntries.slice(0, candidateCount) })
  const measuredBytes = profileBytes(compiled.systemText)
  if (candidateCount === loreEntries.length && measuredBytes <= maxBytes) return compiled

  let lower = 0
  let upper = candidateCount
  let accepted = withoutLore
  let acceptedCount = 0
  while (lower <= upper) {
    const count = Math.floor((lower + upper) / 2)
    const candidate = compileTavernProfileUnbounded({ ...options, loreEntries: loreEntries.slice(0, count) })
    if (profileBytes(candidate.systemText) <= maxBytes) {
      accepted = candidate
      acceptedCount = count
      lower = count + 1
    } else {
      upper = count - 1
    }
  }

  return {
    ...accepted,
    diagnostics: [
      ...accepted.diagnostics,
      {
        code: 'TAVERN_PROFILE_LORE_LIMITED',
        severity: 'warning',
        message: `${loreEntries.length - acceptedCount} lower-ranked lore entries were omitted to keep the Tavern profile within its ${maxBytes} byte hard limit.`,
        maxProfileBytes: maxBytes,
        measuredCandidateBytes: measuredBytes,
        maxLoreInputBytes,
        retainedLoreEntries: acceptedCount,
        omittedLoreEntries: loreEntries.length - acceptedCount,
      },
    ],
  }
}

export const profileLoaderConstants = Object.freeze({
  defaultMaxProfileBytes: DEFAULT_MAX_PROFILE_BYTES,
  hardMaxProfileBytes: HARD_MAX_PROFILE_BYTES,
  hardMaxLoreEntries: HARD_MAX_PROFILE_LORE_ENTRIES,
})

function renderProfileMacros(text, context, fields, userFields, consumed, userInjection, identifier) {
  let personaInserted = false
  const withPersona = String(text ?? '').replace(/\{\{\s*persona\s*\}\}/gi, () => {
    if (userFields.description === '' || consumed.has('userDescription') || personaInserted) return ''
    personaInserted = true
    consumed.add('userDescription')
    markUserDescription(userInjection, `preset-macro:${identifier}`)
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

function markUserDescription(audit, placement) {
  if (audit.descriptionInsertions !== 0) return
  audit.descriptionInsertions = 1
  audit.descriptionPlacement = placement
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
