export function characterGreetingOptions(character) {
  if (character === null || typeof character !== 'object') return []
  const first = typeof character.data?.firstMessage === 'string' ? character.data.firstMessage : ''
  const alternates = Array.isArray(character.data?.alternateGreetings)
    ? character.data.alternateGreetings.filter((item) => typeof item === 'string')
    : []
  return [
    { index: 0, labelKey: first === '' ? 'character.greeting.defaultEmpty' : 'character.greeting.default', text: first },
    ...alternates.map((text, index) => ({
      index: index + 1,
      labelKey: 'character.greeting.alternate',
      labelValues: { index: index + 1 },
      text,
    })),
  ]
}

export function defaultCharacterSelection(characterCardId) {
  return {
    characterCardId,
    character: {
      greetingIndex: 0,
      preferCharacterSystemPrompt: true,
      preferCharacterPostHistory: true,
    },
  }
}

function characterBindingOptions(value) {
  const options = value !== null && typeof value === 'object' && value.character !== null && typeof value.character === 'object'
    ? value.character
    : {}
  return {
    greetingIndex: Number(options.greetingIndex ?? 0),
    preferCharacterSystemPrompt: options.preferCharacterSystemPrompt !== false,
    preferCharacterPostHistory: options.preferCharacterPostHistory !== false,
  }
}

export function characterBindingDirty(selection, binding) {
  if (selection === null || typeof selection !== 'object' || binding === null || typeof binding !== 'object') return false
  if (selection.characterCardId !== binding.characterCardId) return false
  const applied = characterBindingOptions(selection)
  const pending = characterBindingOptions(binding)
  return applied.greetingIndex !== pending.greetingIndex
    || applied.preferCharacterSystemPrompt !== pending.preferCharacterSystemPrompt
    || applied.preferCharacterPostHistory !== pending.preferCharacterPostHistory
}

export function characterEditorDraft(character) {
  if (character === null || typeof character !== 'object') return null
  const data = character.data ?? {}
  return {
    name: typeof data.name === 'string' ? data.name : '',
    nickname: typeof data.nickname === 'string' ? data.nickname : '',
    description: typeof data.description === 'string' ? data.description : '',
    personality: typeof data.personality === 'string' ? data.personality : '',
    scenario: typeof data.scenario === 'string' ? data.scenario : '',
    firstMessage: typeof data.firstMessage === 'string' ? data.firstMessage : '',
    alternateGreetings: Array.isArray(data.alternateGreetings)
      ? data.alternateGreetings.filter((item) => typeof item === 'string')
      : [],
    messageExample: typeof data.messageExample === 'string' ? data.messageExample : '',
    creatorNotes: typeof data.creatorNotes === 'string' ? data.creatorNotes : '',
    systemPrompt: typeof data.systemPrompt === 'string' ? data.systemPrompt : '',
    postHistoryInstructions: typeof data.postHistoryInstructions === 'string' ? data.postHistoryInstructions : '',
    tagsText: Array.isArray(data.tags) ? data.tags.filter((item) => typeof item === 'string').join(', ') : '',
    creator: typeof data.creator === 'string' ? data.creator : '',
    characterVersion: typeof data.characterVersion === 'string' ? data.characterVersion : '',
  }
}

export function characterEditorDirty(draft, saved) {
  return JSON.stringify(draft) !== JSON.stringify(saved)
}

export function characterEditorPatch(draft) {
  return {
    name: draft.name,
    nickname: draft.nickname,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    firstMessage: draft.firstMessage,
    alternateGreetings: [...draft.alternateGreetings],
    messageExample: draft.messageExample,
    creatorNotes: draft.creatorNotes,
    systemPrompt: draft.systemPrompt,
    postHistoryInstructions: draft.postHistoryInstructions,
    tags: draft.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
    creator: draft.creator,
    characterVersion: draft.characterVersion,
  }
}
