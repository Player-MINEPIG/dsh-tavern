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

function boundedScanText(model, agent, fallback, maxCharacters) {
  let text = typeof fallback === 'string' ? fallback : ''
  if (typeof agent?.session?.deriveMessages === 'function') {
    const messages = agent.session.deriveMessages()
      .map(messageText)
      .filter(Boolean)
    const depth = model.settings?.scanDepth
    text = depth === 0 ? '' : (Number.isSafeInteger(depth) ? messages.slice(-depth) : messages).join('\n')
  }
  const originalLength = text.length
  return originalLength <= maxCharacters
    ? { text, truncated: false, originalLength }
    : { text: text.slice(-maxCharacters), truncated: true, originalLength }
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
          const maxScanCharacters = Number.isSafeInteger(options.maxScanCharacters) && options.maxScanCharacters > 0
            ? options.maxScanCharacters
            : 64 * 1024
          const scan = boundedScanText(model, agent, conversationText, maxScanCharacters)
          const candidates = computeWorldBookCandidates(model, {
            text: scan.text,
            tokenBudget: model.settings?.tokenBudget ?? options.defaultTokenBudget,
            probabilityRolls: options.probabilityRolls,
            groupRolls: options.groupRolls,
            allowUnsafeRegex: options.allowUnsafeRegex === true,
            maxRegexLength: options.maxRegexLength,
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
          if (scan.truncated) {
            projected.diagnostics.push({
              code: 'WORLD_BOOK_SCAN_TEXT_TRUNCATED',
              severity: 'info',
              message: `World-book scan input was limited to the most recent ${maxScanCharacters} characters`,
              resourceId: `character:${character.id}:embedded-world-book`,
              originalCharacters: scan.originalLength,
              scannedCharacters: maxScanCharacters,
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
