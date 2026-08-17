import { embeddedCharacterBookResource } from '../../tavern-format/src/index.js'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function clampGreetingIndexValue(greetingIndex, greetingCount) {
  const maxIndex = Math.max(0, greetingCount - 1)
  if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0) return 0
  return Math.min(greetingIndex, maxIndex)
}

const LOADER_HANDLED_DIAGNOSTICS = new Set([
  'embedded-character-book-pass-through',
  'post-history-runtime-required',
  'depth-prompt-runtime-required',
])

export function createCharacterCardResource(character, selection) {
  if (!isRecord(character) || character.schemaVersion !== 1 || !isRecord(character.data)) {
    throw new TypeError('Unsupported character document')
  }
  if (!isRecord(selection) || selection.characterCardId !== character.id) {
    throw new TypeError('Character selection does not match the character document')
  }
  const options = isRecord(selection.character) ? selection.character : {}
  const alternateGreetings = Array.isArray(character.data.alternateGreetings)
    ? character.data.alternateGreetings
    : []
  const greetingIndex = clampGreetingIndexValue(
    Number(options.greetingIndex ?? 0),
    1 + alternateGreetings.length,
  )
  const greeting = greetingIndex === 0
    ? character.data.firstMessage ?? ''
    : alternateGreetings[greetingIndex - 1] ?? ''

  return {
    kind: 'character-card',
    resourceVersion: 1,
    characterId: character.id,
    displayName: character.name,
    characterName: character.data.nickname || character.data.name || character.name,
    selection: {
      greetingIndex,
      preferCharacterSystemPrompt: options.preferCharacterSystemPrompt !== false,
      preferCharacterPostHistory: options.preferCharacterPostHistory !== false,
    },
    greeting: {
      index: greetingIndex,
      kind: greetingIndex === 0 ? 'first-message' : 'alternate-greeting',
      text: greeting,
    },
    fields: {
      name: character.data.name,
      nickname: character.data.nickname,
      description: character.data.description,
      personality: character.data.personality,
      scenario: character.data.scenario,
      messageExample: character.data.messageExample,
      systemPrompt: character.data.systemPrompt,
      postHistoryInstructions: character.data.postHistoryInstructions,
      groupOnlyGreetings: clone(character.data.groupOnlyGreetings ?? []),
      creatorNotes: character.data.creatorNotes,
    },
    embeddedCharacterBook: embeddedCharacterBookResource(character),
    extensions: clone(character.data.extensions ?? {}),
    assets: clone(character.data.assets ?? []),
    source: {
      format: character.source?.format ?? 'unknown',
      container: character.source?.container ?? 'unknown',
      specVersion: character.source?.specVersion,
      sha256: character.source?.sha256,
    },
    compatibility: clone(character.compatibility ?? { warnings: [], unsupportedFeatures: [], unknownMacroNames: [] }),
  }
}

export function selectedCharacterCardResource(store, sessionId) {
  const selected = store.selectedCharacter(sessionId)
  return selected === null ? null : createCharacterCardResource(selected.character, selected.selection)
}

export function createCharacterAdapter(store) {
  if (typeof store?.get !== 'function') throw new TypeError('Character adapter requires a character store')
  return {
    resolve({ selection } = {}) {
      const characterCardId = selection?.characterCardId
      if (characterCardId === null || characterCardId === undefined) return { character: null, diagnostics: [] }
      try {
        const document = store.get(characterCardId)
        const compatibility = clone(document.compatibility ?? { warnings: [], unsupportedFeatures: [], unknownMacroNames: [] })
        return {
          character: {
            id: document.id,
            name: document.name,
            updatedAt: document.updatedAt,
            data: clone(document.data),
            source: {
              format: document.source?.format ?? 'unknown',
              container: document.source?.container ?? 'unknown',
              specVersion: document.source?.specVersion,
              sha256: document.source?.sha256,
            },
            compatibility,
          },
          diagnostics: [
            ...(compatibility.warnings ?? []),
            ...(compatibility.unsupportedFeatures ?? []).filter((item) => !LOADER_HANDLED_DIAGNOSTICS.has(item?.code)),
          ],
        }
      } catch (error) {
        if (error?.code !== 'CHARACTER_NOT_FOUND' && !(error instanceof TypeError)) throw error
        return {
          character: null,
          diagnostics: [{
            code: error instanceof TypeError ? 'invalid-character-card-selection' : 'character-card-not-found',
            message: error instanceof TypeError
              ? 'Selected character card id is invalid.'
              : `Selected character card "${characterCardId}" was not found.`,
            resourceId: characterCardId,
          }],
        }
      }
    },
  }
}
