import {
  computeWorldBookCandidates,
  mergeWorldBookLoaderResults,
  parseCharacterBook,
  projectWorldBookForLoader,
} from '../../world-book/src/index.js'

function messageText(message) {
  if (message?.role !== 'user' && message?.role !== 'assistant') return ''
  return Array.isArray(message.content)
    ? message.content
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n')
    : ''
}

function scanText(model, agent, fallback) {
  if (typeof agent?.session?.deriveMessages !== 'function') return fallback
  const messages = agent.session.deriveMessages()
    .map(messageText)
    .filter(Boolean)
  const depth = model.settings?.scanDepth
  if (depth === 0) return ''
  return (Number.isSafeInteger(depth) ? messages.slice(-depth) : messages).join('\n')
}

export function createWorldBookAdapter(options = {}) {
  return {
    resolve({ selection, character, conversationText = '', agent } = {}) {
      const results = []
      const diagnostics = []

      if (Array.isArray(selection?.worldBookIds) && selection.worldBookIds.length > 0) {
        diagnostics.push({
          code: 'WORLD_BOOK_STORE_NOT_INSTALLED',
          severity: 'warning',
          message: 'Standalone world-book ids are selected, but the first integration slice has no world-book document store.',
          resourceIds: [...selection.worldBookIds],
        })
      }

      const embedded = character?.data?.characterBook
      if (embedded !== null && typeof embedded === 'object' && !Array.isArray(embedded)) {
        try {
          const model = parseCharacterBook(embedded, {
            name: `${character.name || character.data?.name || 'Character'} embedded book`,
          })
          const candidates = computeWorldBookCandidates(model, {
            text: scanText(model, agent, conversationText),
            tokenBudget: model.settings?.tokenBudget ?? options.defaultTokenBudget,
            probabilityRolls: options.probabilityRolls,
            groupRolls: options.groupRolls,
          })
          const projected = projectWorldBookForLoader(model, candidates, {
            resource: {
              id: `character:${character.id}:embedded-world-book`,
              name: model.name,
              ownerCharacterId: character.id,
              kind: 'embedded-character-book',
            },
          })
          if (model.settings?.recursiveScanning === true) {
            projected.diagnostics.push({
              code: 'WORLD_BOOK_RECURSION_DEFERRED',
              severity: 'warning',
              message: 'Recursive world-book scanning is preserved but not executed in the first loader integration slice.',
              resourceId: `character:${character.id}:embedded-world-book`,
            })
          }
          results.push(projected)
        } catch (error) {
          diagnostics.push({
            code: 'EMBEDDED_WORLD_BOOK_INVALID',
            severity: 'warning',
            message: error instanceof Error ? error.message : String(error),
            resourceId: `character:${character.id}:embedded-world-book`,
          })
        }
      }

      const merged = mergeWorldBookLoaderResults(results)
      return {
        ...merged,
        diagnostics: [...diagnostics, ...merged.diagnostics],
      }
    },
  }
}
