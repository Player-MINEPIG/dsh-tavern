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

function resolveArguments(storeOrOptions, maybeOptions) {
  if (typeof storeOrOptions?.get === 'function') return { store: storeOrOptions, options: maybeOptions ?? {} }
  return { store: null, options: storeOrOptions ?? {} }
}

function projectBook(document, context, options) {
  const model = document.book
  const maxScanCharacters = Number.isSafeInteger(options.maxScanCharacters) && options.maxScanCharacters > 0
    ? options.maxScanCharacters
    : 64 * 1024
  const scan = boundedScanText(model, context.agent, context.conversationText, maxScanCharacters)
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
      id: document.id,
      name: document.name,
      kind: 'standalone-world-book',
      updatedAt: document.updatedAt,
    },
  })
  if (model.settings?.recursiveScanning === true) {
    projected.diagnostics.push({
      code: 'WORLD_BOOK_RECURSION_DEFERRED',
      severity: 'warning',
      message: 'Recursive world-book scanning is preserved but not executed in this runtime phase.',
      resourceId: document.id,
    })
  }
  if (scan.truncated) {
    projected.diagnostics.push({
      code: 'WORLD_BOOK_SCAN_TEXT_TRUNCATED',
      severity: 'info',
      message: `World-book scan input was limited to the most recent ${maxScanCharacters} characters`,
      resourceId: document.id,
      originalCharacters: scan.originalLength,
      scannedCharacters: maxScanCharacters,
    })
  }
  return projected
}

export function createWorldBookAdapter(storeOrOptions = {}, maybeOptions = {}) {
  const { store, options } = resolveArguments(storeOrOptions, maybeOptions)
  return {
    resolve({ selection, character, conversationText = '', agent } = {}) {
      const results = []
      const diagnostics = []

      if (Array.isArray(selection?.worldBookIds) && selection.worldBookIds.length > 0) {
        for (const id of selection.worldBookIds) {
          if (store === null) {
            diagnostics.push({
              code: 'WORLD_BOOK_STORE_NOT_INSTALLED',
              severity: 'warning',
              message: 'Standalone world-book ids are selected, but no world-book document store is installed.',
              resourceIds: [...selection.worldBookIds],
            })
            break
          }
          try {
            results.push(projectBook(store.get(id), { agent, conversationText }, options))
          } catch (error) {
            diagnostics.push({
              code: error?.code === 'WORLD_BOOK_NOT_FOUND' ? 'WORLD_BOOK_NOT_FOUND' : 'WORLD_BOOK_DOCUMENT_INVALID',
              severity: 'warning',
              message: error instanceof Error ? error.message : String(error),
              resourceId: id,
            })
          }
        }
      }

      const embedded = character?.data?.characterBook
      if (embedded !== null && typeof embedded === 'object' && !Array.isArray(embedded)) {
        try {
          const model = parseCharacterBook(embedded, {
            name: character.name || character.data?.name || '角色卡世界书',
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
