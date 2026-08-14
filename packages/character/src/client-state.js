export function shouldShowCharacterLauncher(sessionState) {
  const current = sessionState?.current
  if (current === undefined || current === null) return true
  return sessionState.byId?.[current]?.blank === true
}

export function characterGreetingOptions(character) {
  if (character === null || typeof character !== 'object') return []
  const first = typeof character.data?.firstMessage === 'string' ? character.data.firstMessage : ''
  const alternates = Array.isArray(character.data?.alternateGreetings)
    ? character.data.alternateGreetings.filter((item) => typeof item === 'string')
    : []
  return [
    { index: 0, label: first === '' ? '默认开场（空）' : '默认开场', text: first },
    ...alternates.map((text, index) => ({ index: index + 1, label: `备选开场 ${index + 1}`, text })),
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
