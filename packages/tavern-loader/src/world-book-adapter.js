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

function boundedScanText(model, context, maxCharacters, maxMessages) {
  let text = typeof context.conversationText === 'string' ? context.conversationText : ''
  let messages = Array.isArray(context.activationContext?.messages)
    ? context.activationContext.messages.map(message => message?.text).filter(text => typeof text === 'string' && text !== '')
    : null
  if (messages === null && typeof context.agent?.session?.deriveMessages === 'function') {
    messages = context.agent.session.deriveMessages().map(messageText).filter(Boolean)
  }
  if (messages !== null) {
    const depth = model.settings?.scanDepth
    const depthBounded = depth === 0 ? [] : (Number.isSafeInteger(depth) ? messages.slice(-depth) : messages)
    text = depthBounded.slice(-maxMessages).join('\n')
  }
  const originalLength = text.length
  const activationOriginalLength = Number.isSafeInteger(context.activationContext?.metadata?.inputCharacters)
    ? context.activationContext.metadata.inputCharacters
    : originalLength
  const truncatedBeforeAdapter = context.activationContext?.metadata?.truncated === true
  return originalLength <= maxCharacters
    ? { text, truncated: truncatedBeforeAdapter, originalLength: Math.max(originalLength, activationOriginalLength) }
    : { text: text.slice(-maxCharacters), truncated: true, originalLength: Math.max(originalLength, activationOriginalLength) }
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
  const maxScanMessages = Number.isSafeInteger(options.maxScanMessages) && options.maxScanMessages > 0
    ? Math.min(options.maxScanMessages, 1024)
    : 128
  const scan = boundedScanText(model, context, maxScanCharacters, maxScanMessages)
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
      bindingSources: Array.isArray(context.bindingSources) ? [...context.bindingSources] : ['session'],
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
      message: `World-book scan input was limited to the most recent ${scan.text.length} characters`,
      resourceId: document.id,
      originalCharacters: scan.originalLength,
      scannedCharacters: scan.text.length,
    })
  }
  return projected
}

export function createWorldBookAdapter(storeOrOptions = {}, maybeOptions = {}) {
  const { store, options } = resolveArguments(storeOrOptions, maybeOptions)
  return {
    resolve({
      selection,
      worldBookSelection,
      character,
      conversationText = '',
      activationContext = null,
      agent,
    } = {}) {
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
            const bindingSources = [
              ...(worldBookSelection?.explicitIds?.includes(id) ? ['session'] : []),
              ...(worldBookSelection?.userBoundIds?.includes(id) ? ['user'] : []),
            ]
            if (bindingSources.length === 0) bindingSources.push('session')
            results.push(projectBook(store.get(id), {
              agent,
              conversationText,
              activationContext,
              bindingSources,
            }, options))
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
          const maxScanMessages = Number.isSafeInteger(options.maxScanMessages) && options.maxScanMessages > 0
            ? Math.min(options.maxScanMessages, 1024)
            : 128
          const scan = boundedScanText(model, { agent, conversationText, activationContext }, maxScanCharacters, maxScanMessages)
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
              message: `World-book scan input was limited to the most recent ${scan.text.length} characters`,
              resourceId: `character:${character.id}:embedded-world-book`,
              originalCharacters: scan.originalLength,
              scannedCharacters: scan.text.length,
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
