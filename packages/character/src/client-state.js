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
